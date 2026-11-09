import db from '../db';
import { getEnabledMcpTools } from './mcp/mcpConnectionService';
import {
  addMcpChatTraceSkippedCall,
  finishMcpChatTraceCall,
  startMcpChatTraceCall,
} from './mcp/mcpChatTraceService';
import {
  makeMcpAiToolResult,
} from './mcp/mcpResultNormalizer';
import {
  MAX_SAVED_INFO_LOOKUPS_PER_RESPONSE,
  SAVED_INFO_PROMPT_RULE,
  SAVED_INFO_TOOL_NAME,
  buildSavedInfoToolDefinition,
  runSavedInfoLookup,
} from './savedInfoTool';
import {
  WEB_SEARCH_PROMPT_RULE,
  WEB_SEARCH_TOOL_NAME,
  buildWebSearchToolDefinition,
  runWebSearchCall,
} from './webSearchTool';
import {
  callMcpToolRuntime,
} from './mcp/mcpRuntimeService';
import { extractMcpCard } from './mcp/mcpCardRegistry';
import {
  ST_RECALL_TOOL_NAME,
  createStRecallSession,
} from '../apps/stmemory/stRecallTool';

/*
 * 不再限制一次角色回复能经历多少轮 MCP 调用。
 *
 * 保护目标不是限制正常的信息获取，而是阻断模型在同一轮回复中，
 * 对完全相同的工具和参数进行无意义的高速重复调用。
 *
 * 例如：
 * - 连续读取不同页面、不同关键词、不同共同空间状态：允许；
 * - 用户下一次发言后再次查询相同信息：允许；
 * - 同一次生成中对同一请求连续重复调用：最多两次。
 */
const MAX_IDENTICAL_CALLS_PER_RESPONSE = 2;

/*
 * 同一请求已连续失败两次时，停止本次回复内的进一步重试。
 * 下一次用户发言会重新开始，因此不会永久阻断工具。
 */
const MAX_IDENTICAL_FAILURES_PER_RESPONSE = 2;

const TOOL_NAME_MAX_LENGTH = 64;

const nowIso = () => new Date().toISOString();

const createSafeToolName = (tool, index) => {
  const safeOriginalName = String(tool.toolName || 'tool')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36) || 'tool';

  const safeConnectionId = String(tool.connectionId || 'connection')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-12) || 'connection';

  return `mcp_${index}_${safeConnectionId}_${safeOriginalName}`
    .slice(0, TOOL_NAME_MAX_LENGTH);
};

const getSafeInputSchema = (inputSchema) => {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return {
      type: 'object',
      properties: {},
    };
  }

  return {
    type: 'object',
    properties: {},
    ...inputSchema,
  };
};

/**
 * 将用户已启用的 MCP 工具转换为 OpenAI-compatible tools。
 *
 * 注意：
 * - function.name 是本次请求内临时名称；
 * - 原始 MCP toolName 保存在 registry 中；
 * - 避免不同 MCP Server 同名工具互相冲突。
 */
export const buildMcpToolDefinitions = async () => {
  const enabledTools = await getEnabledMcpTools();

  console.log('[MCP] 已启用工具数量:', enabledTools.length);
  console.log(
    '[MCP] 已启用工具:',
    enabledTools.map((tool) => ({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      enabled: tool.enabled,
      isAvailable: tool.isAvailable,
      connectionStatus: tool.connection?.status,
    })),
  );

  const registry = new Map();

  const tools = enabledTools.map((tool, index) => {
    let functionName = createSafeToolName(tool, index);

    while (registry.has(functionName)) {
      functionName = `${functionName.slice(0, TOOL_NAME_MAX_LENGTH - 4)}_${index}`;
    }

    registry.set(functionName, tool);

    return {
      type: 'function',
      function: {
        name: functionName,
        description: [
          `来自 MCP 服务「${tool.connection?.name || '外接工具'}」。`,
          tool.description || tool.displayName || tool.toolName,
        ]
          .filter(Boolean)
          .join('\n'),
        parameters: getSafeInputSchema(tool.inputSchema),
      },
    };
  });

  return {
    tools,
    registry,
  };
};

const parseToolArguments = (rawArguments) => {
  if (rawArguments === undefined || rawArguments === null) {
    return {};
  }

  if (typeof rawArguments === 'object') {
    return rawArguments;
  }

  const text = String(rawArguments).trim();

  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('工具参数必须是 JSON 对象。');
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `AI 返回的工具参数无法解析：${error?.message || '格式无效'}`,
    );
  }
};

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify(value[key])}`,
    )
    .join(',')}}`;
};

const createToolCallFingerprint = (tool, toolArguments) => {
  return [
    tool?.connectionId || '',
    tool?.toolName || '',
    stableStringify(toolArguments || {}),
  ].join('::');
};

const makeToolLoopGuardResult = (message, code) => {
  return JSON.stringify({
    isError: true,
    error: code,
    message,
  });
};

const makeToolResultText = (toolResult) => {
  return makeMcpAiToolResult(toolResult);
};

const addMcpActivity = async ({
  connectionId,
  toolName,
  chatId = null,
  characterId = null,
  source = 'chat',
  status,
  errorCode = '',
  automationId = null,
  executorId = null,
}) => {
  try {
    await db.mcpActivities.add({
      connectionId,
      toolName,
      chatId: chatId ?? null,
      characterId: characterId ?? null,

      source,
      automationId,
      executorId,

      status,
      errorCode,
      createdAt: nowIso(),
    });
  } catch (error) {
    // 工具调用记录失败不能阻断正常对话。
    console.warn('[MCP] 无法写入调用记录：', error);
  }
};

const executeMcpToolCall = async ({
  toolCall,
  registry,
  callCounts,
  failureCounts,
  mcpTraceSession = null,
  chatId = null,
  characterId = null,
  source = 'chat',
  automationId = null,
  executorId = null,
  requestToolApproval,
  companionshipAuthorization = null,
}) => {
  const temporaryName = toolCall?.function?.name;
  const tool = registry.get(temporaryName);

  if (!tool) {
    return {
      toolCallId: toolCall?.id || '',
      shouldStop: true,
      result: makeToolLoopGuardResult(
        '请求的外接工具不存在、未启用，或已经失效。',
        'MCP_TOOL_UNAVAILABLE',
      ),
    };
  }

  let toolArguments;

  try {
    toolArguments = parseToolArguments(
      toolCall?.function?.arguments,
    );
  } catch (error) {
    /*
     * 此时尚未实际调用 Runtime，因此由编排器留下参数错误记录。
     */
    addMcpChatTraceSkippedCall({
      session: mcpTraceSession,
      tool,
      status: 'invalid-arguments',
      errorCode: 'INVALID_ARGUMENTS',
    });

    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: 'invalid-arguments',
      errorCode: 'INVALID_ARGUMENTS',
    });

    return {
      toolCallId: toolCall?.id || '',
      shouldStop: true,
      result: makeToolLoopGuardResult(
        `AI 返回的工具参数无法使用：${error.message}`,
        'INVALID_ARGUMENTS',
      ),
    };
  }

  const fingerprint = createToolCallFingerprint(
    tool,
    toolArguments,
  );

  const previousCallCount = callCounts.get(fingerprint) || 0;
  const previousFailureCount = failureCounts.get(fingerprint) || 0;

  if (previousFailureCount >= MAX_IDENTICAL_FAILURES_PER_RESPONSE) {
    addMcpChatTraceSkippedCall({
      session: mcpTraceSession,
      tool,
      status: 'failed',
      errorCode: 'MCP_REPEATED_FAILURE_GUARD',
    });

    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: 'failed',
      errorCode: 'MCP_REPEATED_FAILURE_GUARD',
    });

    return {
      toolCallId: toolCall?.id || '',
      shouldStop: true,
      result: makeToolLoopGuardResult(
        '这项相同的外接请求已经连续失败。本次回复不会继续重复尝试；可以调整问题、参数或稍后再试。',
        'MCP_REPEATED_FAILURE_GUARD',
      ),
    };
  }

  if (previousCallCount >= MAX_IDENTICAL_CALLS_PER_RESPONSE) {
    addMcpChatTraceSkippedCall({
      session: mcpTraceSession,
      tool,
      status: 'failed',
      errorCode: 'MCP_REPEATED_CALL_GUARD',
    });

    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: 'failed',
      errorCode: 'MCP_REPEATED_CALL_GUARD',
    });

    return {
      toolCallId: toolCall?.id || '',
      shouldStop: true,
      result: makeToolLoopGuardResult(
        '这项相同的外接请求在本次回复中已经完成过。请根据已有结果继续回答，或改用不同参数。',
        'MCP_REPEATED_CALL_GUARD',
      ),
    };
  }

  callCounts.set(fingerprint, previousCallCount + 1);

  const traceCallId = startMcpChatTraceCall({
    session: mcpTraceSession,
    tool,
  });

  try {
    /*
     * Runtime 是唯一的真实工具调用入口：
     * - 处理权限；
     * - 执行调用；
     * - 规范化结果；
     * - 为一次真实调用留下唯一一条最终活动记录。
     */
    const runtimeResult = await callMcpToolRuntime({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      arguments: toolArguments,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      requestApproval: requestToolApproval,
      companionshipAuthorization,
    });

    const isToolError = runtimeResult.rawResult?.isError === true;

    if (isToolError) {
      failureCounts.set(
        fingerprint,
        previousFailureCount + 1,
      );
    } else {
      failureCounts.delete(fingerprint);
    }

       finishMcpChatTraceCall({
      session: mcpTraceSession,
      callId: traceCallId,
      status: isToolError ? 'tool-error' : 'success',
      toolResult: runtimeResult.rawResult,
    });

    // 尝试从真实返回中提取可视化卡片
    const mcpCard = isToolError ? null : extractMcpCard(tool.toolName, runtimeResult.rawResult);

    return {
      toolCallId: toolCall?.id || '',
      result: makeToolResultText(runtimeResult.rawResult),
      mcpCard, // <--- 新增这行，带出卡片
    };

  } catch (error) {
    /*
     * Runtime 已经为真实调用写入最终失败 / 拒绝活动。
     * 此处不能再重复写入 mcpActivities。
     */
    failureCounts.set(
      fingerprint,
      previousFailureCount + 1,
    );

    finishMcpChatTraceCall({
      session: mcpTraceSession,
      callId: traceCallId,
      status:
        error?.code === 'MCP_PERMISSION_DENIED'
          ? 'denied'
          : 'failed',
      errorCode: error?.code || 'MCP_CALL_FAILED',
    });

    return {
      toolCallId: toolCall?.id || '',
      result: makeToolLoopGuardResult(
        `工具调用未完成：${error?.message || '未知错误'}`,
        error?.code || 'MCP_CALL_FAILED',
      ),
    };
  }
};

/**
 * OpenAI-compatible Tool Calling 循环。
 *
 * requestAiCompletion 必须返回：
 * {
 *   error: boolean,
 *   content?: string,
 *   message?: {
 *     role: 'assistant',
 *     content?: string | null,
 *     tool_calls?: []
 *   }
 * }
 */
export const runAiToolOrchestrator = async ({
  systemPrompt,
  historyContext = [],
  apiConfig,
  chatId = null,
  characterId = null,

  source = 'chat',
  automationId = null,
  executorId = null,

  requestAiCompletion,
  requestToolApproval,
  mcpTraceSession = null,
  companionshipAuthorization = null,
}) => {
  if (typeof requestAiCompletion !== 'function') {
    return {
      error: true,
      code: 'AI_REQUEST_HANDLER_MISSING',
      message: 'AI 请求处理器尚未配置。',
    };
  }

  const { tools, registry } = await buildMcpToolDefinitions();

  console.log('[MCP] 传给 AI 的工具定义数量:', tools.length);
  console.log('[MCP] 传给 AI 的工具:', tools);

  const savedInfoTool = await buildSavedInfoToolDefinition();
  let savedInfoLookupCount = 0;

  // 联网搜索是独立配置的第三份 OpenAI 兼容 API（db.settings 里的
  // webSearchApiConfig），跟 MCP 工具、常用信息查阅完全独立——用户哪怕
  // 一个 MCP 服务器都没接，只要配置了这个也要能用，所以下面判断"要不要
  // 完全走原有普通请求"时必须把它也算进"有没有可用工具"，不能只看
  // MCP 工具数量（这也顺带修了一个既有小问题：原来 savedInfoTool 同样
  // 被这个判断挡住了，没接 MCP 的用户即使保存过常用信息也用不上）。
   const webSearchTool = await buildWebSearchToolDefinition();

  // 前尘召回：让角色拿不准细节时自己去查往事原文。只在聊天里挂了"只带概览"
  // 且有总结的往事时才有；线下模式不注入往事概览，所以不注册。
  const stRecall = source === 'offline'
    ? null
    : await createStRecallSession(chatId);

  // 没有任何已启用工具时，完全沿用原有普通 AI 请求。
  if (tools.length === 0 && !savedInfoTool && !webSearchTool && !stRecall) {
    return requestAiCompletion({
      systemPrompt,
      messages: historyContext,
      apiConfig,
      tools: [],
    });
  }

  if (savedInfoTool) {
    tools.push(savedInfoTool);
  }

   if (webSearchTool) {
    tools.push(webSearchTool);
  }

  if (stRecall) {
    tools.push(stRecall.definition);
  }

  const extraPromptNotes = [
    savedInfoTool ? SAVED_INFO_PROMPT_RULE : '',
    webSearchTool ? WEB_SEARCH_PROMPT_RULE : '',
    stRecall ? stRecall.promptRule : '',
  ]
    .filter(Boolean)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: extraPromptNotes
        ? `${systemPrompt}\n${extraPromptNotes}`
        : systemPrompt,
    },
    ...historyContext,
  ];

  /*
   * 这些状态只存在于当前一次角色回复。
   *
   * 下一条用户消息会再次进入 runAiToolOrchestrator，
   * 因而不会阻断用户后续持续查询同一个 MCP 工具。
   */
      const callCounts = new Map();
  const failureCounts = new Map();
  let latestMcpCard = null; // <--- 新增这行，记录卡片
  // 双 API 备用：只要这轮工具调用循环里，任何一次实际请求是靠备用 API
  // 才成功的，就记下来——循环结束时要带着这个标记一起返回给上层
  // （不然默认的返回分支是重新拼的对象，会把这条信息弄丢）。
  let hasUsedFallbackApi = false;


  /*
   * 不设固定工具轮数上限。
   *
   * 循环会在 AI 返回普通文本回复时结束。
   * 相同调用与连续失败由 executeMcpToolCall 内部保护。
   */
  while (true) {
    const completion = await requestAiCompletion({
      systemPrompt: '',
      messages,
      apiConfig,
      tools,
    });

     if (completion?.error) {
      return completion;
    }

    if (completion?.usedFallbackApi) {
      hasUsedFallbackApi = true;
    }

    const assistantMessage = completion?.message || {
      role: 'assistant',
      content: completion?.content || '',
    };

    const toolCalls = Array.isArray(assistantMessage.tool_calls)
      ? assistantMessage.tool_calls
      : [];

    if (toolCalls.length === 0) {
      const content = String(
        assistantMessage.content ?? completion?.content ?? '',
      ).trim();

      if (!content) {
        return {
          error: true,
          code: 'EMPTY_RESPONSE',
          message: 'AI 未返回可显示的回复内容。',
        };
      }

               return {
        error: false,
        content,
        mcpCard: latestMcpCard, // <--- 新增这行，返回给外层
        usedFallbackApi: hasUsedFallbackApi,
      };

    }
    messages.push({
      role: 'assistant',
      content: assistantMessage.content ?? null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
            if (toolCall?.function?.name === SAVED_INFO_TOOL_NAME) {
        savedInfoLookupCount += 1;

        if (savedInfoLookupCount > MAX_SAVED_INFO_LOOKUPS_PER_RESPONSE) {
          return {
            error: true,
            code: 'MCP_TOOL_LOOP_GUARD',
            message: '检测到重复的常用信息查阅，本次请求已安全停止。',
          };
        }

                messages.push({
          role: 'tool',
          tool_call_id: toolCall?.id || '',
          content: await runSavedInfoLookup(toolCall?.function?.arguments),
        });

        continue;
      }


      // 前尘召回：次数和去重由 stRecall 会话自己管，超限只返回一句话让模型
      // 继续回答，不中断本次回复；内部已经 try/catch，失败也只是一段文字。
      if (stRecall && toolCall?.function?.name === ST_RECALL_TOOL_NAME) {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall?.id || '',
          content: await stRecall.run(toolCall?.function?.arguments),
        });

        continue;
      }
      
      // 联网搜索：不走 executeMcpToolCall 那一整套 MCP 审批/连接/频率
      // 保护（跟常用信息查阅一样，本来就不是 MCP 工具），也不设调用
      // 次数上限——用户明确要求"先不设限"，跟戳一戳/换气泡同一套"相信
      // 模型自己判断"的约定。runWebSearchCall 内部已经 try/catch 过，
      // 失败也只是返回一段"没查到"的工具结果文本，不会抛出去打断循环。
      if (toolCall?.function?.name === WEB_SEARCH_TOOL_NAME) {
        const { toolContent, card } = await runWebSearchCall(
          toolCall?.function?.arguments,
        );

        if (card) {
          latestMcpCard = card;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall?.id || '',
          content: toolContent,
        });

        continue;
      }
            const execution = await executeMcpToolCall({
        toolCall,
        registry,
        callCounts,
        failureCounts,
        mcpTraceSession,
        chatId,
        characterId,
        source,
        automationId,
        executorId,
        requestToolApproval,
        companionshipAuthorization,
      });

      if (execution.mcpCard) {
        latestMcpCard = execution.mcpCard; // <--- 新增这行，捕获到卡片
      }

      messages.push({

        role: 'tool',
        tool_call_id: execution.toolCallId,
        content: execution.result,
      });

      /*
       * 某些错误不能继续交给 AI 无限重试：
       * - 请求的工具不存在或已失效；
       * - AI 持续返回无效参数；
       * - 相同请求已连续失败；
       * - 相同请求在当前回复内重复调用过多。
       */
      if (execution.shouldStop) {
        return {
          error: true,
          code: 'MCP_TOOL_LOOP_GUARD',
          message: '检测到无效或重复的外接工具调用，本次请求已安全停止。',
        };
      }
    }
  }
};

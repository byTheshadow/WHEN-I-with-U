import db from '../db';
import {
  callMcpTool,
  getMcpErrorMessage,
} from './mcp/mcpClientService';
import { getEnabledMcpTools } from './mcp/mcpConnectionService';
import {
  getMcpToolAuthorizationState,
  MCP_PERMISSION_DECISIONS,
  MCP_PERMISSION_SCOPES,
  saveMcpPermission,
} from './mcp/mcpPermissionService';
import {
  makeMcpAiToolResult,
} from './mcp/mcpResultNormalizer';
import {
  callMcpToolRuntime,
} from './mcp/mcpRuntimeService';



const MAX_TOOL_ROUNDS = 6;

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

const makeDeniedToolResult = (reason) => {
  return JSON.stringify({
    isError: true,
    error: 'TOOL_CALL_NOT_APPROVED',
    message: reason,
  });
};

/**
 * 请求 UI 层确认工具调用。
 *
 * 目前编排器不依赖 React。之后聊天 UI 会把它接到
 * McpToolApprovalModal；在 UI 尚未接入时，默认拒绝首次调用。
 */
const requestApprovalSafely = async ({
  requestToolApproval,
  tool,
  toolArguments,
  chatId,
  characterId,
}) => {
  if (typeof requestToolApproval !== 'function') {
    return {
      decision: MCP_PERMISSION_DECISIONS.DENY,
      scope: MCP_PERMISSION_SCOPES.ONCE,
    };
  }

  try {
    const result = await requestToolApproval({
      tool,
      arguments: toolArguments,
      chatId,
      characterId,
    });

    return {
      decision:
        result?.decision === MCP_PERMISSION_DECISIONS.ALLOW
          ? MCP_PERMISSION_DECISIONS.ALLOW
          : MCP_PERMISSION_DECISIONS.DENY,
      scope: Object.values(MCP_PERMISSION_SCOPES).includes(result?.scope)
        ? result.scope
        : MCP_PERMISSION_SCOPES.ONCE,
    };
  } catch (error) {
    console.warn('[MCP] 工具授权流程未完成：', error);

    return {
      decision: MCP_PERMISSION_DECISIONS.DENY,
      scope: MCP_PERMISSION_SCOPES.ONCE,
    };
  }
};

const executeMcpToolCall = async ({
  toolCall,
  registry,
  chatId = null,
  characterId = null,
  source = 'chat',
  automationId = null,
  executorId = null,
  requestToolApproval,
}) => {
  const temporaryName = toolCall?.function?.name;
  const tool = registry.get(temporaryName);

  if (!tool) {
    return {
      toolCallId: toolCall?.id || '',
      result: makeDeniedToolResult('请求的外接工具不存在或已失效。'),
    };
  }

  let toolArguments;

  try {
    toolArguments = parseToolArguments(toolCall?.function?.arguments);
  } catch (error) {
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
      result: makeDeniedToolResult(error.message),
    };
  }

  const authorization = await getMcpToolAuthorizationState({
    tool,
    chatId,
    characterId,
  });

  if (authorization.state === 'denied') {
    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: 'denied',
      errorCode: authorization.reason,
    });

    return {
      toolCallId: toolCall?.id || '',
      result: makeDeniedToolResult('用户未允许使用此工具。'),
    };
  }

  if (authorization.state === 'requires-approval') {
    const approval = await requestApprovalSafely({
      requestToolApproval,
      tool,
      toolArguments,
      chatId,
      characterId,
    });

    if (approval.decision !== MCP_PERMISSION_DECISIONS.ALLOW) {
      if (approval.scope !== MCP_PERMISSION_SCOPES.ONCE) {
        await saveMcpPermission({
          connectionId: tool.connectionId,
          toolName: tool.toolName,
          decision: MCP_PERMISSION_DECISIONS.DENY,
          scope: approval.scope,
          chatId,
          characterId,
        });
      }

      await addMcpActivity({
        connectionId: tool.connectionId,
        toolName: tool.toolName,
        chatId,
        characterId,
        source,
        automationId,
        executorId,
        status: 'denied',
        errorCode: 'USER_DENIED',
      });

      return {
        toolCallId: toolCall?.id || '',
        result: makeDeniedToolResult('用户拒绝了本次外接工具调用。'),
      };
    }

    if (approval.scope !== MCP_PERMISSION_SCOPES.ONCE) {
      await saveMcpPermission({
        connectionId: tool.connectionId,
        toolName: tool.toolName,
        decision: MCP_PERMISSION_DECISIONS.ALLOW,
        scope: approval.scope,
        chatId,
        characterId,
      });
    }
  }

  try {
    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: 'calling',
    });

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
});

const toolResult = runtimeResult.rawResult;


    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: toolResult.isError ? 'tool-error' : 'success',
      errorCode: toolResult.isError ? 'MCP_TOOL_ERROR' : '',
    });

    return {
      toolCallId: toolCall?.id || '',
      result: makeToolResultText(toolResult),
    };
  } catch (error) {
    const message = getMcpErrorMessage(error);

    await addMcpActivity({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      chatId,
      characterId,
      source,
      automationId,
      executorId,
      status: 'failed',
      errorCode: error?.code || 'MCP_CALL_FAILED',
    });

    return {
      toolCallId: toolCall?.id || '',
      result: makeDeniedToolResult(`工具调用未完成：${message}`),
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

  // 没有任何已启用工具时，完全沿用原有普通 AI 请求。
  if (tools.length === 0) {
    return requestAiCompletion({
      systemPrompt,
      messages: historyContext,
      apiConfig,
      tools: [],
    });
  }

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...historyContext,
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await requestAiCompletion({
      systemPrompt: '',
      messages,
      apiConfig,
      tools,
    });

    if (completion?.error) {
      return completion;
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
      };
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content ?? null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const execution = await executeMcpToolCall({
        toolCall,
        registry,
        chatId,
        characterId,
        source,
        automationId,
        executorId,
        requestToolApproval,
      });

      messages.push({
        role: 'tool',
        tool_call_id: execution.toolCallId,
        content: execution.result,
      });
    }
  }

  return {
    error: true,
    code: 'TOOL_LOOP_LIMIT',
    message: '外接工具调用次数过多，本次对话已安全停止。',
  };
};


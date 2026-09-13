import { getEnabledMcpTools } from './mcpConnectionService';
import { callMcpTool } from './mcpClientService';

const MAX_TOOL_LOOPS = 4;

const toOpenAiToolDefinitions = (mcpTools) => {
  const toolMap = new Map();

  const definitions = mcpTools.map((tool) => {
    toolMap.set(tool.toolName, tool);

    return {
      type: 'function',
      function: {
        name: tool.toolName,
        description: tool.description || '',
        parameters:
          tool.inputSchema && typeof tool.inputSchema === 'object'
            ? tool.inputSchema
            : { type: 'object', properties: {} },
      },
    };
  });

  return { definitions, toolMap };
};

const executeToolCall = async (toolCall, toolMap) => {
  const tool = toolMap.get(toolCall.function?.name);

  if (!tool) {
    return JSON.stringify({
      error: `未找到工具：${toolCall.function?.name}`,
    });
  }

  let parsedArgs = {};

  try {
    parsedArgs = toolCall.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : {};
  } catch {
    return JSON.stringify({ error: '工具参数解析失败。' });
  }

  try {
    const result = await callMcpTool({
      connection: tool.connection,
      toolName: tool.toolName,
      arguments: parsedArgs,
    });

    return JSON.stringify({
      isError: result.isError,
      content: result.content,
      structuredContent: result.structuredContent,
    });
  } catch (error) {
    return JSON.stringify({
      error: error?.message || 'MCP 工具调用失败。',
    });
  }
};

/**
 * 在已有的 chat/completions 请求基础上，补上一轮 MCP 工具调用循环。
 *
 * sendRequest 是调用方提供的"发一次请求"函数，签名为
 * async (payload) => { error, content, rawMessage } —— 复用调用方
 * 已有的 fetch/错误处理逻辑，本文件只负责判断要不要继续循环。
 *
 * 如果当前没有任何已启用的 MCP 工具，直接透传原始请求，
 * 完全不影响没有配置 MCP 的用户。
 */
export const runChatCompletionWithMcpTools = async ({
  requestPayload,
  sendRequest,
}) => {
  const enabledTools = await getEnabledMcpTools();

  if (enabledTools.length === 0) {
    return sendRequest(requestPayload);
  }

  const { definitions, toolMap } = toOpenAiToolDefinitions(enabledTools);

  const messages = [...requestPayload.messages];
  let loopCount = 0;

  while (loopCount < MAX_TOOL_LOOPS) {
    const response = await sendRequest({
      ...requestPayload,
      messages,
      tools: definitions,
    });

    if (response.error) {
      return response;
    }

    const toolCalls = response.rawMessage?.tool_calls;

    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return response;
    }

    messages.push(response.rawMessage);

    for (const toolCall of toolCalls) {
      const toolResultText = await executeToolCall(toolCall, toolMap);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResultText,
      });
    }

    loopCount += 1;
  }

  return {
    error: true,
    code: 'MCP_TOOL_LOOP_EXCEEDED',
    message: 'AI 反复调用工具但未能给出最终回复。',
  };
};
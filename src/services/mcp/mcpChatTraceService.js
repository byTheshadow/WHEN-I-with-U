import {
  makeMcpActivitySummary,
} from './mcpResultNormalizer';

const listeners = new Set();

const nowIso = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mcp_chat_trace_${crypto.randomUUID()}`;
  }

  return `mcp_chat_trace_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
};

const safeText = (value = '', maxLength = 160) => {
  const text = String(value || '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
};

const normalizeStatus = (value) => {
  switch (value) {
    case 'calling':
    case 'success':
    case 'tool-error':
    case 'denied':
    case 'failed':
    case 'invalid-arguments':
      return value;

    default:
      return 'failed';
  }
};

const notify = (event) => {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('[MCP Chat Trace] 事件监听失败：', error);
    }
  });
};

const createCallRecord = ({
  tool,
  status = 'calling',
}) => {
  return {
    id: createId(),

    /*
     * 仅用于本地聊天痕迹定位，不包含 endpoint、认证信息或参数。
     */
    connectionId: safeText(tool?.connectionId, 180),

    connectionName:
      safeText(tool?.connection?.name) ||
      '未命名外接能力',

    toolName:
      safeText(tool?.toolName) ||
      '未命名工具',

    toolLabel:
      safeText(
        tool?.displayName ||
        tool?.description ||
        tool?.toolName ||
        '未命名工具',
      ),

    status: normalizeStatus(status),

    /*
     * 成功时由结果规范化器给出，例如 ['text', 'resource']。
     * 不保存原始内容、Base64、resource URI 或 structuredContent。
     */
    itemTypes: [],

    errorCode: '',
    startedAt: nowIso(),
    completedAt: null,
  };
};

const cloneTraceForUi = (trace) => {
  if (!trace) return null;

  return {
    version: 1,
    used: Array.isArray(trace.calls) && trace.calls.length > 0,
    calls: trace.calls.map((call) => ({
      id: call.id,
      connectionId: call.connectionId,
      connectionName: call.connectionName,
      toolName: call.toolName,
      toolLabel: call.toolLabel,
      status: call.status,
      itemTypes: [...call.itemTypes],
      errorCode: call.errorCode,
      startedAt: call.startedAt,
      completedAt: call.completedAt,
    })),
  };
};

/*
 * 供 ChatRoom 使用。
 *
 * 只发送安全 UI 摘要，不发送参数、Token、原始 MCP 返回内容。
 */
export const subscribeMcpChatTraceEvents = (listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/*
 * 一次角色回复对应一个 trace session。
 * 它只存在于本次 AI 请求期间，最终由 getMcpChatTraceSummary()
 * 转换为可写入 messages.metadata 的纯数据。
 */
export const createMcpChatTraceSession = ({
  chatId = null,
  characterId = null,
} = {}) => {
  return {
    id: createId(),
    chatId: chatId === undefined || chatId === null
      ? null
      : String(chatId),
    characterId: characterId === undefined || characterId === null
      ? null
      : String(characterId),
    calls: [],
    createdAt: nowIso(),
  };
};

export const startMcpChatTraceCall = ({
  session,
  tool,
}) => {
  if (!session || !tool) return null;

  const call = createCallRecord({
    tool,
    status: 'calling',
  });

  session.calls.push(call);

  notify({
    type: 'MCP_CHAT_TRACE_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    trace: cloneTraceForUi(session),
  });

  return call.id;
};

export const finishMcpChatTraceCall = ({
  session,
  callId,
  status,
  toolResult = null,
  errorCode = '',
}) => {
  if (!session || !callId) return;

  const call = session.calls.find((item) => item.id === callId);

  if (!call) return;

  call.status = normalizeStatus(status);
  call.errorCode = safeText(errorCode, 96);
  call.completedAt = nowIso();

  if (toolResult) {
    const summary = makeMcpActivitySummary(toolResult);

    call.itemTypes = Array.isArray(summary.itemTypes)
      ? summary.itemTypes
          .map((item) => safeText(item, 32))
          .filter(Boolean)
          .slice(0, 6)
      : [];
  }

  notify({
    type: 'MCP_CHAT_TRACE_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    trace: cloneTraceForUi(session),
  });
};

export const addMcpChatTraceSkippedCall = ({
  session,
  tool,
  status = 'failed',
  errorCode = '',
}) => {
  if (!session || !tool) return null;

  const call = createCallRecord({
    tool,
    status,
  });

  call.errorCode = safeText(errorCode, 96);
  call.completedAt = nowIso();

  session.calls.push(call);

  notify({
    type: 'MCP_CHAT_TRACE_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    trace: cloneTraceForUi(session),
  });

  return call.id;
};

/*
 * 用于最终角色消息 metadata。
 *
 * 返回的新对象，不能反向修改 session 内的状态。
 */
export const getMcpChatTraceSummary = (session) => {
  const trace = cloneTraceForUi(session);

  if (!trace?.used) {
    return null;
  }

  return trace;
};

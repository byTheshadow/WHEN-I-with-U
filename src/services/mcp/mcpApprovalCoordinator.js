import {
  MCP_PERMISSION_DECISIONS,
  MCP_PERMISSION_SCOPES,
} from './mcpPermissionService';

const approvalHandlers = new Map();

const normalizeChatId = (chatId) => {
  if (chatId === undefined || chatId === null || chatId === '') {
    return null;
  }

  return String(chatId);
};

const makeDeniedApproval = () => ({
  decision: MCP_PERMISSION_DECISIONS.DENY,
  scope: MCP_PERMISSION_SCOPES.ONCE,
});

/**
 * 由 ChatRoom 注册当前聊天的 MCP 授权 UI 处理器。
 *
 * 同一时间每个 chatId 只应有一个活跃 ChatRoom。
 */
export const registerMcpToolApprovalHandler = (
  chatId,
  handler,
) => {
  const normalizedChatId = normalizeChatId(chatId);

  if (!normalizedChatId || typeof handler !== 'function') {
    return () => {};
  }

  approvalHandlers.set(normalizedChatId, handler);

  return () => {
    if (approvalHandlers.get(normalizedChatId) === handler) {
      approvalHandlers.delete(normalizedChatId);
    }
  };
};

/**
 * 供 aiService 使用。
 *
 * 若用户已离开聊天室、页面尚未挂载或没有可用授权 UI，
 * 默认拒绝本次调用，绝不静默放行。
 */
export const requestMcpToolApproval = async ({
  chatId,
  ...request
}) => {
  const normalizedChatId = normalizeChatId(chatId);
  const handler = normalizedChatId
    ? approvalHandlers.get(normalizedChatId)
    : null;

  if (!handler) {
    return makeDeniedApproval();
  }

  try {
    const result = await handler({
      ...request,
      chatId,
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
    console.warn('[MCP] 授权处理器未完成：', error);
    return makeDeniedApproval();
  }
};

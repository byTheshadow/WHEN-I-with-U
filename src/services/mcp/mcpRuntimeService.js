import db from '../../db';
import { callMcpTool } from './mcpClientService';
import {
  getMcpToolAuthorizationState,
  MCP_PERMISSION_DECISIONS,
  saveMcpPermission,
} from './mcpPermissionService';
import {
  normalizeMcpToolResult,
} from './mcpResultNormalizer';

const nowIso = () => new Date().toISOString();

const createRuntimeError = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const normalizeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
};

const writeActivity = async ({
  connectionId,
  toolName,
  chatId = null,
  characterId = null,
  source = 'manual',
  status,
  errorCode = '',
  automationId = null,
  executorId = null,
}) => {
  await db.mcpActivities.add({
    connectionId,
    toolName,
    chatId: normalizeId(chatId),
    characterId: normalizeId(characterId),
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt: nowIso(),
  });
};

const getToolContext = async ({
  connectionId,
  toolName,
}) => {
  if (!connectionId || !toolName) {
    throw createRuntimeError(
      'MCP_TOOL_CONTEXT_MISSING',
      '缺少 MCP 连接或工具信息。',
    );
  }

  const toolId = `mcp_tool_${connectionId}_${encodeURIComponent(toolName)}`;

  const tool = await db.mcpTools.get(toolId);

  if (!tool) {
    throw createRuntimeError(
      'MCP_TOOL_NOT_FOUND',
      '没有找到对应的 MCP 工具，请先重新同步连接。',
    );
  }

  const connection = await db.mcpConnections.get(connectionId);

  if (!connection) {
    throw createRuntimeError(
      'MCP_CONNECTION_NOT_FOUND',
      '没有找到对应的 MCP 连接。',
    );
  }

  return {
    ...tool,
    connection,
  };
};

const resolvePermission = async ({
  tool,
  toolArguments = {},
  chatId = null,
  characterId = null,
  permission = null,
  requestApproval = null,
}) => {

  const authorizationState = await getMcpToolAuthorizationState({
    tool,
    chatId,
    characterId,
  });

  if (authorizationState.state === 'allowed') {
    return authorizationState.permission;
  }

  if (authorizationState.state === 'denied') {
    throw createRuntimeError(
      'MCP_PERMISSION_DENIED',
      '这项 MCP 工具当前没有获得允许。',
      authorizationState,
    );
  }

  if (permission?.decision === MCP_PERMISSION_DECISIONS.ALLOW) {
    return saveMcpPermission({
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      decision: permission.decision,
      scope: permission.scope,
      chatId,
      characterId,
    });
  }

  if (typeof requestApproval !== 'function') {
    throw createRuntimeError(
      'MCP_APPROVAL_REQUIRED',
      '这项 MCP 工具需要用户确认。',
      authorizationState,
    );
  }

const approval = await requestApproval({
  tool,
  arguments: toolArguments,
  chatId,
  characterId,
});


  if (
    approval?.decision !== MCP_PERMISSION_DECISIONS.ALLOW
  ) {
    throw createRuntimeError(
      'MCP_PERMISSION_DENIED',
      '用户拒绝了这项 MCP 工具调用。',
      approval,
    );
  }

  return saveMcpPermission({
    connectionId: tool.connectionId,
    toolName: tool.toolName,
    decision: approval.decision,
    scope: approval.scope,
    chatId,
    characterId,
  });
};

export const callMcpToolRuntime = async ({
  connectionId,
  toolName,
  arguments: toolArguments = {},
  chatId = null,
  characterId = null,
  source = 'manual',
  automationId = null,
  executorId = null,
  permission = null,
  requestApproval = null,
}) => {
  const activityContext = {
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
  };

  let tool;

  try {
    tool = await getToolContext({
      connectionId,
      toolName,
    });

   

        await resolvePermission({
      tool,
      toolArguments,
      chatId,
      characterId,
      permission,
      requestApproval,
    });


    const rawResult = await callMcpTool({
      connection: tool.connection,
      toolName: tool.toolName,
      arguments: toolArguments || {},
    });

    const result = normalizeMcpToolResult(rawResult);

    await writeActivity({
      ...activityContext,
      status: result.isError ? 'tool-error' : 'success',
    });

    return {
      tool,
      rawResult,
      result,
    };
  } catch (error) {
    const status =
      error?.code === 'MCP_PERMISSION_DENIED'
        ? 'denied'
        : 'failed';

    await writeActivity({
      ...activityContext,
      status,
      errorCode: error?.code || 'MCP_RUNTIME_ERROR',
    });

    throw error;
  }
};

export const getMcpToolForRuntime = async ({
  connectionId,
  toolName,
}) => {
  return getToolContext({
    connectionId,
    toolName,
  });
};

export const getMcpActivities = async ({
  connectionId = null,
  chatId = null,
  limit = 50,
} = {}) => {
  let activities = await db.mcpActivities
    .orderBy('createdAt')
    .reverse()
    .toArray();

  if (connectionId) {
    activities = activities.filter(
      (item) => item.connectionId === connectionId,
    );
  }

  if (chatId) {
    activities = activities.filter(
      (item) => normalizeId(item.chatId) === normalizeId(chatId),
    );
  }

  return activities.slice(0, Math.max(1, limit));
};

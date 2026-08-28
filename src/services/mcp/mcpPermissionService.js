import db from '../../db';
import { RISK_LEVELS } from './mcpConnectionService';

export const MCP_PERMISSION_DECISIONS = {
  ALLOW: 'allow',
  DENY: 'deny',
};

export const MCP_PERMISSION_SCOPES = {
  ONCE: 'once',
  CHAT: 'chat',
  CHARACTER: 'character',
  GLOBAL: 'global',
};

const nowIso = () => new Date().toISOString();

const normalizeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
};

const normalizeScope = (scope) => {
  if (Object.values(MCP_PERMISSION_SCOPES).includes(scope)) {
    return scope;
  }

  return MCP_PERMISSION_SCOPES.ONCE;
};

const normalizeDecision = (decision) => {
  if (decision === MCP_PERMISSION_DECISIONS.ALLOW) {
    return MCP_PERMISSION_DECISIONS.ALLOW;
  }

  return MCP_PERMISSION_DECISIONS.DENY;
};

const makePermissionId = ({
  connectionId,
  toolName,
  scope,
  chatId,
  characterId,
}) => {
  return [
    'mcp_permission',
    connectionId || '',
    toolName || '',
    scope || '',
    chatId || '',
    characterId || '',
  ]
    .map((value) => encodeURIComponent(String(value)))
    .join('_');
};

const isSameTool = (permission, { connectionId, toolName }) => {
  return (
    permission.connectionId === connectionId &&
    permission.toolName === toolName
  );
};

const matchesScope = (
  permission,
  { connectionId, toolName, chatId, characterId },
) => {
  if (!isSameTool(permission, { connectionId, toolName })) {
    return false;
  }

  if (permission.scope === MCP_PERMISSION_SCOPES.GLOBAL) {
    return true;
  }

  if (
    permission.scope === MCP_PERMISSION_SCOPES.CHARACTER &&
    normalizeId(permission.characterId) === normalizeId(characterId)
  ) {
    return true;
  }

  if (
    permission.scope === MCP_PERMISSION_SCOPES.CHAT &&
    normalizeId(permission.chatId) === normalizeId(chatId)
  ) {
    return true;
  }

  return false;
};

const getPermissionPriority = (scope) => {
  switch (scope) {
    case MCP_PERMISSION_SCOPES.CHAT:
      return 3;
    case MCP_PERMISSION_SCOPES.CHARACTER:
      return 2;
    case MCP_PERMISSION_SCOPES.GLOBAL:
      return 1;
    default:
      return 0;
  }
};

const getStoredPermissionsForTool = async (connectionId, toolName) => {
  const permissions = await db.mcpPermissions.toArray();

  return permissions.filter(
    (permission) =>
      permission.connectionId === connectionId &&
      permission.toolName === toolName,
  );
};

/**
 * 获取当前聊天环境下对某个工具生效的持久化授权。
 *
 * 优先级：
 * 当前聊天 > 当前角色 > 全局
 */
export const getEffectiveMcpPermission = async ({
  connectionId,
  toolName,
  chatId = null,
  characterId = null,
}) => {
  if (!connectionId || !toolName) {
    return null;
  }

  const permissions = await getStoredPermissionsForTool(
    connectionId,
    toolName,
  );

  const matchedPermissions = permissions
    .filter((permission) =>
      matchesScope(permission, {
        connectionId,
        toolName,
        chatId,
        characterId,
      }),
    )
    .sort(
      (a, b) =>
        getPermissionPriority(b.scope) - getPermissionPriority(a.scope),
    );

  return matchedPermissions[0] || null;
};

/**
 * 保存持久化权限。
 *
 * ONCE 不会写入数据库，由调用方在当前工具调用流程中直接处理。
 */
export const saveMcpPermission = async ({
  connectionId,
  toolName,
  decision,
  scope,
  chatId = null,
  characterId = null,
}) => {
  if (!connectionId || !toolName) {
    throw new Error('保存 MCP 权限时缺少连接或工具信息。');
  }

  const normalizedScope = normalizeScope(scope);
  const normalizedDecision = normalizeDecision(decision);

  if (normalizedScope === MCP_PERMISSION_SCOPES.ONCE) {
    return {
      id: null,
      connectionId,
      toolName,
      decision: normalizedDecision,
      scope: normalizedScope,
      chatId: normalizeId(chatId),
      characterId: normalizeId(characterId),
      persisted: false,
      updatedAt: nowIso(),
    };
  }

  const permission = {
    id: makePermissionId({
      connectionId,
      toolName,
      scope: normalizedScope,
      chatId: normalizedScope === MCP_PERMISSION_SCOPES.CHAT ? chatId : null,
      characterId:
        normalizedScope === MCP_PERMISSION_SCOPES.CHARACTER
          ? characterId
          : null,
    }),

    connectionId,
    toolName,
    decision: normalizedDecision,
    scope: normalizedScope,

    chatId:
      normalizedScope === MCP_PERMISSION_SCOPES.CHAT
        ? normalizeId(chatId)
        : null,

    characterId:
      normalizedScope === MCP_PERMISSION_SCOPES.CHARACTER
        ? normalizeId(characterId)
        : null,

    updatedAt: nowIso(),
  };

  await db.mcpPermissions.put(permission);

  return {
    ...permission,
    persisted: true,
  };
};

export const removeMcpPermission = async ({
  connectionId,
  toolName,
  scope,
  chatId = null,
  characterId = null,
}) => {
  const normalizedScope = normalizeScope(scope);

  if (normalizedScope === MCP_PERMISSION_SCOPES.ONCE) {
    return false;
  }

  const id = makePermissionId({
    connectionId,
    toolName,
    scope: normalizedScope,
    chatId: normalizedScope === MCP_PERMISSION_SCOPES.CHAT ? chatId : null,
    characterId:
      normalizedScope === MCP_PERMISSION_SCOPES.CHARACTER
        ? characterId
        : null,
  });

  await db.mcpPermissions.delete(id);

  return true;
};

/**
 * 判断工具是否属于可直接调用的只读工具。
 *
 * 写入和未知工具不能仅凭此函数自动放行。
 */
export const isMcpToolReadOnly = (tool) => {
  return tool?.riskLevel === RISK_LEVELS.READ;
};

/**
 * 判断工具是否需要用户确认。
 *
 * 任何写入或未知工具都默认需要确认。
 */
export const mcpToolRequiresApproval = (tool) => {
  return !isMcpToolReadOnly(tool);
};

/**
 * 返回工具当前的调用状态。
 *
 * 返回值：
 * - allowed：已有持久化允许
 * - denied：已有持久化拒绝
 * - requires-approval：没有授权，或工具不是只读工具
 */
export const getMcpToolAuthorizationState = async ({
  tool,
  chatId = null,
  characterId = null,
}) => {
  if (!tool?.connectionId || !tool?.toolName) {
    return {
      state: 'denied',
      reason: 'invalid-tool',
      permission: null,
    };
  }

  if (tool.enabled !== true || tool.isAvailable === false) {
    return {
      state: 'denied',
      reason: 'tool-disabled',
      permission: null,
    };
  }

  const permission = await getEffectiveMcpPermission({
    connectionId: tool.connectionId,
    toolName: tool.toolName,
    chatId,
    characterId,
  });

  if (permission?.decision === MCP_PERMISSION_DECISIONS.DENY) {
    return {
      state: 'denied',
      reason: 'user-denied',
      permission,
    };
  }

  if (permission?.decision === MCP_PERMISSION_DECISIONS.ALLOW) {
    return {
      state: 'allowed',
      reason: 'stored-permission',
      permission,
    };
  }

  if (mcpToolRequiresApproval(tool)) {
    return {
      state: 'requires-approval',
      reason: 'write-or-unknown-tool',
      permission: null,
    };
  }

  /*
   * 只读工具没有持久化拒绝记录时，可以先进入审批状态。
   *
   * 第一版仍建议由编排器询问用户一次，避免用户开启工具后
   * 不知道角色会立即访问外部服务。
   */
  return {
    state: 'requires-approval',
    reason: 'first-use',
    permission: null,
  };
};

/**
 * 清理某个聊天的聊天级权限。
 */
export const clearChatMcpPermissions = async (chatId) => {
  const normalizedChatId = normalizeId(chatId);

  if (!normalizedChatId) return 0;

  const permissions = await db.mcpPermissions.toArray();

  const ids = permissions
    .filter(
      (permission) =>
        permission.scope === MCP_PERMISSION_SCOPES.CHAT &&
        normalizeId(permission.chatId) === normalizedChatId,
    )
    .map((permission) => permission.id);

  if (ids.length > 0) {
    await db.mcpPermissions.bulkDelete(ids);
  }

  return ids.length;
};

/**
 * 清理某个角色的角色级权限。
 */
export const clearCharacterMcpPermissions = async (characterId) => {
  const normalizedCharacterId = normalizeId(characterId);

  if (!normalizedCharacterId) return 0;

  const permissions = await db.mcpPermissions.toArray();

  const ids = permissions
    .filter(
      (permission) =>
        permission.scope === MCP_PERMISSION_SCOPES.CHARACTER &&
        normalizeId(permission.characterId) === normalizedCharacterId,
    )
    .map((permission) => permission.id);

  if (ids.length > 0) {
    await db.mcpPermissions.bulkDelete(ids);
  }

  return ids.length;
};

export const getAllMcpPermissions = async () => {
  return db.mcpPermissions.orderBy('updatedAt').reverse().toArray();
};

import db from '../../db';
import {
  disconnectMcpClient,
  getMcpErrorMessage,
  initializeMcpClient,
  listMcpTools,
} from './mcpClientService';

const MCP_TRANSPORT = 'streamable-http';

const RISK_LEVELS = {
  READ: 'read',
  WRITE: 'write',
  UNKNOWN: 'unknown',
};

const CONNECTION_STATUSES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

const createId = (prefix) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
};

const nowIso = () => new Date().toISOString();

const normalizeText = (value = '') => String(value || '').trim();

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const buildToolId = (connectionId, toolName) =>
  `mcp_tool_${connectionId}_${encodeURIComponent(toolName)}`;

const normalizeEndpoint = (rawEndpoint = '') => {
  const endpoint = normalizeText(rawEndpoint);

  if (!endpoint) {
    throw new Error('请填写 MCP 服务地址。');
  }

  let url;

  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('MCP 服务地址格式无效，请填写完整的 HTTP 或 HTTPS 地址。');
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('当前仅支持 HTTP 或 HTTPS 的远程 MCP 地址。');
  }

  if (url.username || url.password) {
    throw new Error('MCP 地址中不能包含账号或密码，请使用独立的认证信息。');
  }

  return url.toString();
};

const inferToolRiskLevel = (tool = {}) => {
  const source = `${tool.name || ''} ${tool.title || ''} ${
    tool.description || ''
  }`.toLowerCase();

  const writeKeywords = [
    'create',
    'add',
    'send',
    'post',
    'publish',
    'invite',
    'update',
    'edit',
    'modify',
    'delete',
    'remove',
    'cancel',
    'start',
    'stop',
    'control',
    'purchase',
    'pay',
    'write',
    'upload',
    'share',
    '创建',
    '新增',
    '发送',
    '发布',
    '邀请',
    '修改',
    '编辑',
    '删除',
    '移除',
    '取消',
    '启动',
    '停止',
    '控制',
    '购买',
    '支付',
    '写入',
    '上传',
    '分享',
  ];

  const readKeywords = [
    'get',
    'list',
    'search',
    'find',
    'read',
    'query',
    'fetch',
    'lookup',
    'view',
    'preview',
    'status',
    '获取',
    '查询',
    '搜索',
    '查找',
    '读取',
    '列出',
    '预览',
    '查看',
    '状态',
  ];

  if (writeKeywords.some((keyword) => source.includes(keyword))) {
    return RISK_LEVELS.WRITE;
  }

  if (readKeywords.some((keyword) => source.includes(keyword))) {
    return RISK_LEVELS.READ;
  }

  return RISK_LEVELS.UNKNOWN;
};

const normalizeServerTool = (connectionId, tool, existingTool = null) => {
  const toolName = normalizeText(tool?.name);

  if (!toolName) {
    return null;
  }

  const timestamp = nowIso();

  return {
    id: existingTool?.id || buildToolId(connectionId, toolName),
    connectionId,
    toolName,

    displayName: normalizeText(tool.title) || toolName,
    description: normalizeText(tool.description),
    inputSchema:
      tool.inputSchema && typeof tool.inputSchema === 'object'
        ? tool.inputSchema
        : {
            type: 'object',
            properties: {},
          },

    annotations:
      tool.annotations && typeof tool.annotations === 'object'
        ? tool.annotations
        : {},

    enabled: existingTool?.enabled ?? false,
    riskLevel: existingTool?.riskLevel || inferToolRiskLevel(tool),

    isAvailable: true,
    discoveredAt: existingTool?.discoveredAt || timestamp,
    updatedAt: timestamp,
  };
};

const sanitizeAuth = (auth = {}) => {
  const type = auth?.type === 'bearer' ? 'bearer' : 'none';

  return {
    type,
    token: type === 'bearer' ? normalizeText(auth.token) : '',
  };
};

const makeConnectionRecord = (draft = {}, existing = null) => {
  const timestamp = nowIso();
  const endpoint = normalizeEndpoint(
    hasOwn(draft, 'endpoint') ? draft.endpoint : existing?.endpoint,
  );

  const auth = hasOwn(draft, 'auth')
    ? sanitizeAuth(draft.auth)
    : sanitizeAuth(existing?.auth);

  return {
    id: existing?.id || draft.id || createId('mcp_connection'),

    name:
      normalizeText(draft.name) ||
      normalizeText(existing?.name) ||
      new URL(endpoint).hostname,

    endpoint,
    transport: MCP_TRANSPORT,

    auth,
    enabled: hasOwn(draft, 'enabled')
      ? Boolean(draft.enabled)
      : existing?.enabled ?? true,

    status: existing?.status || CONNECTION_STATUSES.IDLE,
    serverInfo: existing?.serverInfo || null,
    capabilities: existing?.capabilities || {},
    protocolVersion: existing?.protocolVersion || null,

    lastConnectedAt: existing?.lastConnectedAt || null,
    lastToolSyncAt: existing?.lastToolSyncAt || null,
    lastError: existing?.lastError || '',

    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
};

const syncMcpTools = async (connection, remoteTools = []) => {
  const existingTools = await db.mcpTools
    .where('connectionId')
    .equals(connection.id)
    .toArray();

  const existingToolByName = new Map(
    existingTools.map((tool) => [tool.toolName, tool]),
  );

  const remoteToolNames = new Set();

  const normalizedTools = remoteTools
    .map((tool) => {
      const normalized = normalizeServerTool(
        connection.id,
        tool,
        existingToolByName.get(tool?.name),
      );

      if (normalized) {
        remoteToolNames.add(normalized.toolName);
      }

      return normalized;
    })
    .filter(Boolean);

  await db.transaction('rw', db.mcpTools, async () => {
    if (normalizedTools.length > 0) {
      await db.mcpTools.bulkPut(normalizedTools);
    }

    const unavailableTools = existingTools
      .filter((tool) => !remoteToolNames.has(tool.toolName))
      .map((tool) => ({
        ...tool,
        isAvailable: false,
        updatedAt: nowIso(),
      }));

    if (unavailableTools.length > 0) {
      await db.mcpTools.bulkPut(unavailableTools);
    }
  });

  return normalizedTools;
};

const fetchAllMcpTools = async (connection) => {
  const allTools = [];
  const visitedCursors = new Set();
  let cursor = null;

  do {
    const page = await listMcpTools(connection, cursor);

    if (Array.isArray(page.tools)) {
      allTools.push(...page.tools);
    }

    cursor = page.nextCursor || null;

    if (cursor && visitedCursors.has(cursor)) {
      throw new Error('MCP 工具列表分页出现重复游标，已停止同步。');
    }

    if (cursor) {
      visitedCursors.add(cursor);
    }
  } while (cursor);

  return allTools;
};

export const getMcpConnections = async () => {
  const connections = await db.mcpConnections
    .orderBy('updatedAt')
    .reverse()
    .toArray();

  return connections;
};

export const getMcpConnection = async (connectionId) => {
  if (!connectionId) return null;
  return db.mcpConnections.get(connectionId);
};

export const getMcpToolsForConnection = async (connectionId) => {
  if (!connectionId) return [];

  return db.mcpTools
    .where('connectionId')
    .equals(connectionId)
    .sortBy('displayName');
};

export const createMcpConnection = async (draft = {}) => {
  const connection = makeConnectionRecord(draft);

  await db.mcpConnections.add(connection);

  return connection;
};

export const updateMcpConnection = async (connectionId, patch = {}) => {
  const existing = await getMcpConnection(connectionId);

  if (!existing) {
    throw new Error('未找到需要更新的 MCP 连接。');
  }

  const nextConnection = makeConnectionRecord(
    {
      ...patch,
      id: existing.id,
    },
    existing,
  );

  await db.mcpConnections.put(nextConnection);

  if (
    nextConnection.endpoint !== existing.endpoint ||
    nextConnection.auth?.token !== existing.auth?.token ||
    nextConnection.auth?.type !== existing.auth?.type
  ) {
    await disconnectMcpClient(existing);
  }

  return nextConnection;
};

export const setMcpConnectionEnabled = async (connectionId, enabled) => {
  const existing = await getMcpConnection(connectionId);

  if (!existing) {
    throw new Error('未找到需要更新的 MCP 连接。');
  }

  const updatedAt = nowIso();

  await db.mcpConnections.update(connectionId, {
    enabled: Boolean(enabled),
    updatedAt,
  });

  if (!enabled) {
    await disconnectMcpClient(existing);
  }

  return db.mcpConnections.get(connectionId);
};

export const setMcpToolEnabled = async (toolId, enabled) => {
  const tool = await db.mcpTools.get(toolId);

  if (!tool) {
    throw new Error('未找到需要更新的 MCP 工具。');
  }

  await db.mcpTools.update(toolId, {
    enabled: Boolean(enabled),
    updatedAt: nowIso(),
  });

  return db.mcpTools.get(toolId);
};

export const setMcpToolRiskLevel = async (toolId, riskLevel) => {
  if (!Object.values(RISK_LEVELS).includes(riskLevel)) {
    throw new Error('无效的 MCP 工具风险等级。');
  }

  const tool = await db.mcpTools.get(toolId);

  if (!tool) {
    throw new Error('未找到需要更新的 MCP 工具。');
  }

  await db.mcpTools.update(toolId, {
    riskLevel,
    updatedAt: nowIso(),
  });

  return db.mcpTools.get(toolId);
};

/**
 * 测试连接、完成 MCP 初始化并同步全部工具。
 *
 * 成功后才将连接标为 connected。
 * 失败时保留用户原有配置，并写入 lastError 供界面显示。
 */
export const testAndSyncMcpConnection = async (connectionId) => {
  const storedConnection = await getMcpConnection(connectionId);

  if (!storedConnection) {
    throw new Error('未找到需要测试的 MCP 连接。');
  }

  const connectingAt = nowIso();

  await db.mcpConnections.update(connectionId, {
    status: CONNECTION_STATUSES.CONNECTING,
    lastError: '',
    updatedAt: connectingAt,
  });

  try {
    await disconnectMcpClient(storedConnection);

    const session = await initializeMcpClient(storedConnection);
    const remoteTools = await fetchAllMcpTools(storedConnection);
    const syncedTools = await syncMcpTools(storedConnection, remoteTools);

    const connectedAt = nowIso();

    await db.mcpConnections.update(connectionId, {
      status: CONNECTION_STATUSES.CONNECTED,
      protocolVersion: session.protocolVersion || null,
      serverInfo: session.serverInfo || null,
      capabilities: session.capabilities || {},
      lastConnectedAt: connectedAt,
      lastToolSyncAt: connectedAt,
      lastError: '',
      updatedAt: connectedAt,
    });

    return {
      connection: await getMcpConnection(connectionId),
      tools: syncedTools,
    };
  } catch (error) {
    const message = getMcpErrorMessage(error);

    await db.mcpConnections.update(connectionId, {
      status: CONNECTION_STATUSES.ERROR,
      lastError: message,
      updatedAt: nowIso(),
    });

    throw error;
  }
};

export const deleteMcpConnection = async (connectionId) => {
  const connection = await getMcpConnection(connectionId);

  if (!connection) {
    return false;
  }

  await disconnectMcpClient(connection);

  await db.transaction(
    'rw',
    db.mcpConnections,
    db.mcpTools,
    db.mcpPermissions,
    db.mcpActivities,
    async () => {
      await db.mcpConnections.delete(connectionId);

      await db.mcpTools
        .where('connectionId')
        .equals(connectionId)
        .delete();

      await db.mcpPermissions
        .where('connectionId')
        .equals(connectionId)
        .delete();

      await db.mcpActivities
        .where('connectionId')
        .equals(connectionId)
        .delete();
    },
  );

  return true;
};

export const getEnabledMcpTools = async () => {
  const allConnections = await db.mcpConnections.toArray();

  const enabledConnections = allConnections.filter(
    (connection) => connection.enabled === true,
  );

  if (enabledConnections.length === 0) {
    return [];
  }
  const connectionById = new Map(
    enabledConnections.map((connection) => [connection.id, connection]),
  );

  const allTools = await db.mcpTools.toArray();

  return allTools
    .filter((tool) => {
      const connection = connectionById.get(tool.connectionId);

      return Boolean(
        connection &&
          tool.enabled &&
          tool.isAvailable !== false &&
          connection.status === CONNECTION_STATUSES.CONNECTED,
      );
    })
    .map((tool) => ({
      ...tool,
      connection: connectionById.get(tool.connectionId),
    }));
};

export {
  CONNECTION_STATUSES,
  MCP_TRANSPORT,
  RISK_LEVELS,
  inferToolRiskLevel,
  normalizeEndpoint,
};

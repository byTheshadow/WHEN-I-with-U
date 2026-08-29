import db from '../../db';
import {
  disconnectMcpClient,
  getMcpErrorMessage,
  initializeMcpClient,
  listMcpTools,
} from './mcpClientService';

import {
  MCP_TRANSPORTS,
} from './mcpTransportRegistry';


export const MCP_PROVIDERS = {
  GENERIC: 'generic',
  MODELSCOPE: 'modelscope',
  BRIDGE: 'bridge',
  CUSTOM: 'custom',
};

export const MCP_EXECUTION_MODES = {
  BROWSER_DIRECT: 'browser-direct',
  USER_BRIDGE: 'user-bridge',
  USER_EXECUTOR: 'user-executor',
};

/*
 * 保留旧导出，避免现有 import 立即失效。
 */
const MCP_TRANSPORT = MCP_TRANSPORTS.STREAMABLE_HTTP;


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

const getAllowedTransports = () => Object.values(MCP_TRANSPORTS);

const normalizeTransport = (value, fallback = MCP_TRANSPORT) => {
  return getAllowedTransports().includes(value)
    ? value
    : fallback;
};

const normalizeProvider = (value) => {
  return Object.values(MCP_PROVIDERS).includes(value)
    ? value
    : MCP_PROVIDERS.GENERIC;
};

const normalizeExecutionMode = (value, transport) => {
  if (Object.values(MCP_EXECUTION_MODES).includes(value)) {
    return value;
  }

  if (transport === MCP_TRANSPORTS.BRIDGE_HTTP) {
    return MCP_EXECUTION_MODES.USER_BRIDGE;
  }

  return MCP_EXECUTION_MODES.BROWSER_DIRECT;
};

const transportIsImplemented = (transport) => {
  return [
    MCP_TRANSPORTS.STREAMABLE_HTTP,
    MCP_TRANSPORTS.BRIDGE_HTTP,
  ].includes(transport);
};

const getTransportUnavailableMessage = (transport) => {
  switch (transport) {
    case MCP_TRANSPORTS.SSE:
      return '此连接使用 SSE 兼容传输，但当前版本尚未完成对应客户端实现。';

    case MCP_TRANSPORTS.BRIDGE_WEBSOCKET:
      return '此连接使用 Bridge WebSocket 传输，但当前版本尚未配置与该 Bridge 匹配的协议适配器。';

    case MCP_TRANSPORTS.CUSTOM:
      return '此连接需要自定义传输适配器，当前版本尚未注册对应实现。';

    default:
      return '此 MCP 连接方式暂不可用。';
  }
};



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

  const transport = normalizeTransport(
    hasOwn(draft, 'transport')
      ? draft.transport
      : existing?.transport,
  );

  const provider = normalizeProvider(
    hasOwn(draft, 'provider')
      ? draft.provider
      : existing?.provider,
  );

  const executionMode = normalizeExecutionMode(
    hasOwn(draft, 'executionMode')
      ? draft.executionMode
      : existing?.executionMode,
    transport,
  );

  const endpoint = normalizeEndpoint(
    hasOwn(draft, 'endpoint') ? draft.endpoint : existing?.endpoint,
  );

  const auth = hasOwn(draft, 'auth')
    ? sanitizeAuth(draft.auth)
    : sanitizeAuth(existing?.auth);

  const bridge = {
    id: normalizeText(
      hasOwn(draft, 'bridge')
        ? draft.bridge?.id
        : existing?.bridge?.id,
    ) || null,

    label: normalizeText(
      hasOwn(draft, 'bridge')
        ? draft.bridge?.label
        : existing?.bridge?.label,
    ),
  };

  const source = {
    kind: normalizeText(
      hasOwn(draft, 'source')
        ? draft.source?.kind
        : existing?.source?.kind,
    ) || 'endpoint',

    /*
     * 仅保存用户提供给 Bridge 的 stdio 描述；
     * 浏览器绝不会自行执行 command / args。
     */
    command: normalizeText(
      hasOwn(draft, 'source')
        ? draft.source?.command
        : existing?.source?.command,
    ),

    args: Array.isArray(
      hasOwn(draft, 'source')
        ? draft.source?.args
        : existing?.source?.args,
    )
      ? (
        hasOwn(draft, 'source')
          ? draft.source.args
          : existing.source.args
      )
        .map((item) => normalizeText(item))
        .filter(Boolean)
      : [],

    /*
     * 不在此处接受环境变量值。
     * 含密钥的 env 必须由用户 Bridge 自己保管。
     */
    envKeys: Array.isArray(
      hasOwn(draft, 'source')
        ? draft.source?.envKeys
        : existing?.source?.envKeys,
    )
      ? (
        hasOwn(draft, 'source')
          ? draft.source.envKeys
          : existing.source.envKeys
      )
        .map((key) => normalizeText(key))
        .filter(Boolean)
      : [],
  };

  return {
    id: existing?.id || draft.id || createId('mcp_connection'),

    name:
      normalizeText(draft.name) ||
      normalizeText(existing?.name) ||
      new URL(endpoint).hostname,

    endpoint,
    provider,
    transport,
    executionMode,

    bridgeId: bridge.id,
    bridge,

    source,

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
  nextConnection.transport !== existing.transport ||
  nextConnection.executionMode !== existing.executionMode ||
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

  /*
   * 当前已实际实现的传输：
   * - streamable-http：浏览器直连的标准 HTTP MCP；
   * - bridge-http：用户自行运行的 Bridge 暴露标准 HTTP MCP。
   *
   * SSE、WebSocket、custom 的数据模型可以先保存和导入，
   * 但尚未有真正 Transport Adapter 时，不能错误地发起
   * Streamable HTTP 请求，更不能显示为连接成功。
   */
  if (!transportIsImplemented(storedConnection.transport)) {
    const message = getTransportUnavailableMessage(
      storedConnection.transport,
    );

    await db.mcpConnections.update(connectionId, {
      status: CONNECTION_STATUSES.IDLE,
      lastError: message,
      updatedAt: nowIso(),
    });

    throw new Error(message);
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
  const allTools = await db.mcpTools.toArray();

  console.log(
    '[MCP] 全部连接状态:',
    allConnections.map((connection) => ({
      id: connection.id,
      name: connection.name,
      enabled: connection.enabled,
      status: connection.status,
      endpoint: connection.endpoint,
    })),
  );

  console.log(
    '[MCP] 全部工具状态:',
    allTools.map((tool) => ({
      id: tool.id,
      connectionId: tool.connectionId,
      toolName: tool.toolName,
      displayName: tool.displayName,
      enabled: tool.enabled,
      isAvailable: tool.isAvailable,
      riskLevel: tool.riskLevel,
    })),
  );

  const enabledConnections = allConnections.filter(
    (connection) =>
      connection.enabled === true &&
      connection.status === 'connected',
  );

  const connectionById = new Map(
    enabledConnections.map((connection) => [
      connection.id,
      connection,
    ]),
  );

  const enabledTools = allTools
    .filter((tool) => {
      const connection = connectionById.get(tool.connectionId);

      return (
        Boolean(connection) &&
        tool.enabled === true &&
        tool.isAvailable !== false
      );
    })
    .map((tool) => ({
      ...tool,
      connection: connectionById.get(tool.connectionId),
    }));

  console.log(
    '[MCP] 筛选后可用工具:',
    enabledTools.map((tool) => ({
      toolName: tool.toolName,
      connectionName: tool.connection?.name,
    })),
  );

  return enabledTools;
};


export {
  CONNECTION_STATUSES,
  MCP_TRANSPORT,
  MCP_TRANSPORTS,
  RISK_LEVELS,
  inferToolRiskLevel,
  normalizeEndpoint,
};


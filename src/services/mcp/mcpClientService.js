import {
  assertMcpTransportSupported,
} from './mcpTransportRegistry';
import {
  getMcpOAuthAccessToken,
} from './mcpOAuthService';


const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

const REQUEST_TIMEOUT_MS = 20_000;

const activeSessions = new Map();

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `mcp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const cleanEndpoint = (endpoint = '') => String(endpoint).trim();

const createMcpError = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const getConnectionKey = (connection = {}) => {
  return connection.id || connection.endpoint || '';
};

const getAuthHeaders = async (connection = {}) => {
  const auth = connection.auth || {};

  if (auth.type === 'bearer' && String(auth.token || '').trim()) {
    return {
      Authorization: `Bearer ${String(auth.token).trim()}`,
    };
  }

  if (auth.type === 'oauth') {
    const accessToken = await getMcpOAuthAccessToken(connection);

    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return {};
};


const parseSsePayload = (rawText = '') => {
  const events = String(rawText)
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const event of events) {
    const dataLines = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());

    if (dataLines.length === 0) continue;

    const dataText = dataLines.join('\n');

    try {
      return JSON.parse(dataText);
    } catch {
      // 继续尝试下一个 SSE event。
    }
  }

  return null;
};

const parseMcpResponse = async (response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const rawText = await response.text();

  if (!rawText.trim()) {
    return null;
  }

  if (contentType.includes('text/event-stream')) {
    const parsedSse = parseSsePayload(rawText);

    if (!parsedSse) {
      throw createMcpError(
        'INVALID_SSE_RESPONSE',
        'MCP 服务返回了无法解析的事件流响应。',
      );
    }

    return parsedSse;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw createMcpError(
      'INVALID_JSON_RESPONSE',
      'MCP 服务没有返回有效的 JSON-RPC 数据。',
      { rawText: rawText.slice(0, 500) },
    );
  }
};

const getErrorMessage = async (response) => {
  try {
    const payload = await parseMcpResponse(response);

    return (
      payload?.error?.message ||
      payload?.message ||
      response.statusText ||
      'MCP 服务请求失败。'
    );
  } catch {
    return response.statusText || 'MCP 服务请求失败。';
  }
};

const normalizeJsonRpcResult = (payload, expectedId) => {
  if (!payload || payload.jsonrpc !== '2.0') {
    throw createMcpError(
      'INVALID_JSON_RPC',
      '目标地址没有返回有效的 MCP JSON-RPC 响应。',
      payload,
    );
  }

  if (
    expectedId !== undefined &&
    expectedId !== null &&
    payload.id !== undefined &&
    payload.id !== expectedId
  ) {
    throw createMcpError(
      'JSON_RPC_ID_MISMATCH',
      'MCP 响应与当前请求不匹配。',
      payload,
    );
  }

  if (payload.error) {
    throw createMcpError(
      `MCP_RPC_${payload.error.code || 'ERROR'}`,
      payload.error.message || 'MCP 服务拒绝了该请求。',
      payload.error,
    );
  }

  return payload.result;
};

const getSession = (connection = {}) => {
  return activeSessions.get(getConnectionKey(connection)) || null;
};

const saveSession = (connection, session) => {
  activeSessions.set(getConnectionKey(connection), session);
};

const clearSession = (connection = {}) => {
  activeSessions.delete(getConnectionKey(connection));
};

const buildHeaders = async (connection, session = null) => {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    ...(await getAuthHeaders(connection)),
  };

  if (session?.sessionId) {
    headers['Mcp-Session-Id'] = session.sessionId;
  }

  return headers;
};


const sendJsonRpcRequest = async ({
  connection,
  method,
  params,
  requestId = createRequestId(),
  notification = false,
  session = null,
}) => {
      assertMcpTransportSupported(connection);

  const endpoint = cleanEndpoint(connection?.endpoint);

  if (!endpoint) {
    throw createMcpError('ENDPOINT_MISSING', '请先填写 MCP 服务地址。');
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(endpoint);
  } catch {
    throw createMcpError(
      'ENDPOINT_INVALID',
      'MCP 服务地址格式无效，请填写完整的 HTTP 或 HTTPS 地址。',
    );
  }

  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw createMcpError(
      'ENDPOINT_PROTOCOL_UNSUPPORTED',
      '当前仅支持 HTTP 或 HTTPS 的远程 MCP 地址。',
    );
  }

  const controller = new AbortController();
 const timeoutId = setTimeout(
  () => controller.abort(),
  REQUEST_TIMEOUT_MS,
);


  const requestBody = {
    jsonrpc: '2.0',
    method,
  };

  if (!notification) {
    requestBody.id = requestId;
  }

  if (params !== undefined) {
    requestBody.params = params;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await buildHeaders(connection, session),
  
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorMessage = await getErrorMessage(response);

      throw createMcpError(
        `HTTP_${response.status}`,
        `[MCP ${response.status}] ${errorMessage}`,
      );
    }

    const responseSessionId = response.headers.get('mcp-session-id');
    const payload = await parseMcpResponse(response);

    if (notification) {
      return {
        payload: null,
        sessionId: responseSessionId || session?.sessionId || null,
      };
    }

    return {
  payload,
  requestId,
  sessionId: responseSessionId || session?.sessionId || null,
};

  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createMcpError(
        'MCP_TIMEOUT',
        '等待 MCP 服务响应超时，请检查服务是否在线。',
      );
    }

    if (error?.code) {
      throw error;
    }

    throw createMcpError(
      'MCP_NETWORK_ERROR',
      `无法连接 MCP 服务：${error?.message || '未知网络错误'}`,
    );
  } finally {
   clearTimeout(timeoutId);
  }
};

/**
 * 建立一个 MCP Streamable HTTP 会话。
 *
 * 连接本身仅保存在内存；页面刷新后会重新 initialize。
 * 可持久化的连接配置请由 mcpConnectionService 管理。
 */
export const initializeMcpClient = async (connection) => {
  const existingSession = getSession(connection);

  if (existingSession?.initialized) {
    return existingSession;
  }

  const protocolVersion =
    connection?.protocolVersion || DEFAULT_PROTOCOL_VERSION;

  const initializeRequest = await sendJsonRpcRequest({
    connection,
    method: 'initialize',
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: {
        name: 'WHEN I with U',
        version: '1.0.0',
      },
    },
  });

  const initializeResult = normalizeJsonRpcResult(
    initializeRequest.payload,
    initializeRequest.requestId,
  );

  if (!initializeResult?.protocolVersion) {
    throw createMcpError(
      'INITIALIZE_FAILED',
      '目标地址未返回 MCP 协议版本，无法确认它是否为兼容的 MCP 服务。',
      initializeResult,
    );
  }

  const session = {
    sessionId: initializeRequest.sessionId,
    protocolVersion: initializeResult.protocolVersion,
    serverInfo: initializeResult.serverInfo || null,
    capabilities: initializeResult.capabilities || {},
    initialized: false,
    initializedAt: new Date().toISOString(),
  };

  await sendJsonRpcRequest({
    connection,
    method: 'notifications/initialized',
    notification: true,
    session,
  });

  session.initialized = true;
  saveSession(connection, session);

  return session;
};

export const listMcpTools = async (connection, cursor = null) => {
  const session = await initializeMcpClient(connection);

  const response = await sendJsonRpcRequest({
    connection,
    method: 'tools/list',
    params: cursor ? { cursor } : {},
    session,
  });

  const result = normalizeJsonRpcResult(
    response.payload,
    response.requestId,
  );

  return {
    tools: Array.isArray(result?.tools) ? result.tools : [],
    nextCursor: result?.nextCursor || null,
    serverInfo: session.serverInfo,
    capabilities: session.capabilities,
  };
};



export const callMcpTool = async ({
  connection,
  toolName,
  arguments: toolArguments = {},
}) => {
  if (!toolName) {
    throw createMcpError('TOOL_NAME_MISSING', '缺少需要调用的 MCP 工具名称。');
  }

  const session = await initializeMcpClient(connection);

  const response = await sendJsonRpcRequest({
    connection,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: toolArguments || {},
    },
    session,
  });

  const result = normalizeJsonRpcResult(
    response.payload,
    response.requestId,
  );

  return {
    content: Array.isArray(result?.content) ? result.content : [],
    isError: result?.isError === true,
    structuredContent: result?.structuredContent,
    rawResult: result,
  };
};


export const getMcpClientSession = (connection) => getSession(connection);

export const disconnectMcpClient = async (connection) => {
  clearSession(connection);
};

export const getMcpErrorMessage = (error) => {
  if (!error) return 'MCP 操作未完成。';

  return error.message || 'MCP 操作未完成。';
};

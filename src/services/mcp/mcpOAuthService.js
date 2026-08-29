import db from '../../db';

const OAUTH_SESSION_LIFETIME_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000;

const nowIso = () => new Date().toISOString();

const createOAuthError = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const normalizeText = (value = '') => String(value || '').trim();

const createRandomValue = () => {
  const bytes = new Uint8Array(32);

  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw createOAuthError(
      'OAUTH_CRYPTO_UNAVAILABLE',
      '当前浏览器不支持 OAuth 所需的安全随机数功能。',
    );
  }

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const base64UrlEncode = (bytes) => {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const createCodeChallenge = async (codeVerifier) => {
  if (!crypto?.subtle?.digest) {
    throw createOAuthError(
      'OAUTH_CRYPTO_UNAVAILABLE',
      '当前浏览器不支持 OAuth PKCE 所需的加密能力。',
    );
  }

  const encoded = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', encoded);

  return base64UrlEncode(new Uint8Array(hash));
};

const validateHttpUrl = (value, fieldLabel) => {
  const rawValue = normalizeText(value);

  if (!rawValue) {
    throw createOAuthError(
      'OAUTH_CONFIGURATION_MISSING',
      `请填写 OAuth ${fieldLabel}。`,
    );
  }

  let url;

  try {
    url = new URL(rawValue);
  } catch {
    throw createOAuthError(
      'OAUTH_CONFIGURATION_INVALID',
      `OAuth ${fieldLabel}不是有效的 HTTP 或 HTTPS 地址。`,
    );
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw createOAuthError(
      'OAUTH_CONFIGURATION_INVALID',
      `OAuth ${fieldLabel}仅支持 HTTP 或 HTTPS 地址。`,
    );
  }

  return url.toString();
};

const normalizeScopes = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join(' ');
  }

  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
};

const getOAuthConfig = (connection = {}) => {
  const auth = connection.auth || {};

  if (auth.type !== 'oauth') {
    throw createOAuthError(
      'OAUTH_NOT_CONFIGURED',
      '这条连接尚未配置 OAuth 认证。',
    );
  }

  const clientId = normalizeText(auth.clientId);

  if (!clientId) {
    throw createOAuthError(
      'OAUTH_CONFIGURATION_MISSING',
      '请填写 OAuth Client ID。',
    );
  }

  return {
    clientId,
    authorizationEndpoint: validateHttpUrl(
      auth.authorizationEndpoint,
      '授权端点',
    ),
    tokenEndpoint: validateHttpUrl(
      auth.tokenEndpoint,
      'Token 端点',
    ),
    scopes: normalizeScopes(auth.scopes),
    resource: normalizeText(auth.resource) || connection.endpoint,
  };
};

const getRedirectUri = () => {
  if (typeof window === 'undefined') {
    throw createOAuthError(
      'OAUTH_BROWSER_REQUIRED',
      'OAuth 授权只能在浏览器中发起。',
    );
  }

  /*
   * 不额外添加 OAuth 回调路径，避免 GitHub Pages 等静态托管出现 404。
   * OAuth 提供方应将当前应用地址登记为 Redirect URI。
   */
  return `${window.location.origin}${window.location.pathname}`;
};

const getConnection = async (connectionId) => {
  const connection = await db.mcpConnections.get(connectionId);

  if (!connection) {
    throw createOAuthError(
      'MCP_CONNECTION_NOT_FOUND',
      '没有找到需要授权的 MCP 连接。',
    );
  }

  return connection;
};

const getTokenErrorMessage = async (response) => {
  try {
    const payload = await response.json();

    return (
      payload?.error_description ||
      payload?.error ||
      payload?.message ||
      response.statusText ||
      'OAuth 服务拒绝了请求。'
    );
  } catch {
    return response.statusText || 'OAuth 服务拒绝了请求。';
  }
};

const requestToken = async ({
  tokenEndpoint,
  body,
}) => {
  let response;

  try {
    response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    });
  } catch (error) {
    throw createOAuthError(
      'OAUTH_TOKEN_NETWORK_ERROR',
      `无法连接 OAuth Token 服务：${error?.message || '网络错误'}`,
    );
  }

  if (!response.ok) {
    const message = await getTokenErrorMessage(response);

    throw createOAuthError(
      `OAUTH_TOKEN_HTTP_${response.status}`,
      `OAuth Token 请求失败：${message}`,
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw createOAuthError(
      'OAUTH_TOKEN_INVALID_RESPONSE',
      'OAuth Token 服务没有返回有效的 JSON 数据。',
    );
  }

  if (!normalizeText(payload?.access_token)) {
    throw createOAuthError(
      'OAUTH_TOKEN_MISSING',
      'OAuth Token 服务未返回 access token。',
    );
  }

  return payload;
};

const buildStoredTokenFields = (tokenPayload, previousAuth = {}) => {
  const expiresInSeconds = Number(tokenPayload?.expires_in);
  const expiresAt = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  return {
    accessToken: normalizeText(tokenPayload.access_token),
    refreshToken:
      normalizeText(tokenPayload.refresh_token) ||
      normalizeText(previousAuth.refreshToken),
    tokenType: normalizeText(tokenPayload.token_type) || 'Bearer',
    expiresAt,
  };
};

const markOAuthSession = async (sessionId, patch) => {
  await db.mcpOAuthSessions.update(sessionId, {
    ...patch,
    updatedAt: nowIso(),
  });
};

export const startMcpOAuthAuthorization = async (connectionId) => {
  const connection = await getConnection(connectionId);
  const config = getOAuthConfig(connection);

  const state = createRandomValue();
  const codeVerifier = createRandomValue();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const redirectUri = getRedirectUri();

  const createdAt = nowIso();
  const expiresAt = new Date(
    Date.now() + OAUTH_SESSION_LIFETIME_MS,
  ).toISOString();

  const session = {
    id: `mcp_oauth_${state}`,
    connectionId,
    state,
    status: 'pending',
    codeVerifier,
    redirectUri,
    authorizationEndpoint: config.authorizationEndpoint,
    tokenEndpoint: config.tokenEndpoint,
    clientId: config.clientId,
    scopes: config.scopes,
    resource: config.resource,
    expiresAt,
    createdAt,
    updatedAt: createdAt,
  };

  await db.mcpOAuthSessions.put(session);

  const authorizationUrl = new URL(config.authorizationEndpoint);

  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('state', state);

  if (config.scopes) {
    authorizationUrl.searchParams.set('scope', config.scopes);
  }

  if (config.resource) {
    authorizationUrl.searchParams.set('resource', config.resource);
  }

  window.location.assign(authorizationUrl.toString());
};

export const consumeMcpOAuthCallback = async (url = window.location.href) => {
  const callbackUrl = new URL(url);
  const code = normalizeText(callbackUrl.searchParams.get('code'));
  const state = normalizeText(callbackUrl.searchParams.get('state'));
  const providerError = normalizeText(callbackUrl.searchParams.get('error'));

  /*
   * 当前 URL 不是 OAuth 回调，不做任何事。
   */
  if (!code && !state && !providerError) {
    return null;
  }

  if (!state) {
    throw createOAuthError(
      'OAUTH_STATE_MISSING',
      'OAuth 回调缺少 state，已拒绝继续处理。',
    );
  }

  const session = await db.mcpOAuthSessions
    .where('state')
    .equals(state)
    .first();

  if (!session) {
    throw createOAuthError(
      'OAUTH_SESSION_NOT_FOUND',
      '没有找到对应的 OAuth 授权会话。它可能已过期或来自另一台设备。',
    );
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await markOAuthSession(session.id, {
      status: 'expired',
      errorCode: 'OAUTH_SESSION_EXPIRED',
    });

    throw createOAuthError(
      'OAUTH_SESSION_EXPIRED',
      'OAuth 授权会话已过期，请重新发起授权。',
    );
  }

  if (providerError) {
    await markOAuthSession(session.id, {
      status: 'denied',
      errorCode: providerError,
    });

    throw createOAuthError(
      'OAUTH_PROVIDER_DENIED',
      callbackUrl.searchParams.get('error_description') ||
        'OAuth 服务拒绝了授权请求。',
    );
  }

  if (!code) {
    throw createOAuthError(
      'OAUTH_CODE_MISSING',
      'OAuth 回调没有提供授权码。',
    );
  }

  await markOAuthSession(session.id, {
    status: 'exchanging',
  });

  try {
    const tokenPayload = await requestToken({
      tokenEndpoint: session.tokenEndpoint,
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: session.redirectUri,
        client_id: session.clientId,
        code_verifier: session.codeVerifier,
        ...(session.resource ? { resource: session.resource } : {}),
      },
    });

    const connection = await getConnection(session.connectionId);
    const tokenFields = buildStoredTokenFields(
      tokenPayload,
      connection.auth,
    );

    await db.mcpConnections.update(session.connectionId, {
      auth: {
        ...connection.auth,
        type: 'oauth',
        ...tokenFields,
      },
      authStatus: 'authorized',
      authUpdatedAt: nowIso(),
      updatedAt: nowIso(),
    });

    await markOAuthSession(session.id, {
      status: 'completed',
      completedAt: nowIso(),
      /*
       * 授权码交换完成后，立即移除 PKCE verifier。
       */
      codeVerifier: '',
    });

    await db.settings.put({
      key: 'mcp_oauth_last_result',
      value: {
        type: 'success',
        connectionId: session.connectionId,
        message: 'OAuth 授权已完成。现在可以重新测试这条连接。',
        createdAt: nowIso(),
      },
    });

    return {
      connectionId: session.connectionId,
      status: 'authorized',
    };
  } catch (error) {
    await markOAuthSession(session.id, {
      status: 'error',
      errorCode: error?.code || 'OAUTH_TOKEN_EXCHANGE_FAILED',
      codeVerifier: '',
    });

    await db.settings.put({
      key: 'mcp_oauth_last_result',
      value: {
        type: 'error',
        connectionId: session.connectionId,
        message: error?.message || 'OAuth 授权未完成。',
        createdAt: nowIso(),
      },
    });

    throw error;
  }
};

export const getMcpOAuthAccessToken = async (connection) => {
  if (connection?.auth?.type !== 'oauth') {
    return '';
  }

  const storedConnection = await getConnection(connection.id);
  const auth = storedConnection.auth || {};

  if (!normalizeText(auth.accessToken)) {
    throw createOAuthError(
      'OAUTH_AUTHORIZATION_REQUIRED',
      '这条 MCP 连接尚未完成 OAuth 授权。',
    );
  }

  const expiresAt = auth.expiresAt
    ? new Date(auth.expiresAt).getTime()
    : null;

  const stillValid =
    !expiresAt ||
    expiresAt > Date.now() + TOKEN_REFRESH_LEEWAY_MS;

  if (stillValid) {
    return normalizeText(auth.accessToken);
  }

  if (!normalizeText(auth.refreshToken)) {
    await db.mcpConnections.update(storedConnection.id, {
      authStatus: 'expired',
      updatedAt: nowIso(),
    });

    throw createOAuthError(
      'OAUTH_REAUTHORIZATION_REQUIRED',
      'OAuth 授权已过期，请重新完成授权。',
    );
  }

  const config = getOAuthConfig(storedConnection);

  const tokenPayload = await requestToken({
    tokenEndpoint: config.tokenEndpoint,
    body: {
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
      client_id: config.clientId,
      ...(config.resource ? { resource: config.resource } : {}),
    },
  });

  const tokenFields = buildStoredTokenFields(tokenPayload, auth);

  await db.mcpConnections.update(storedConnection.id, {
    auth: {
      ...auth,
      ...tokenFields,
    },
    authStatus: 'authorized',
    authUpdatedAt: nowIso(),
    updatedAt: nowIso(),
  });

  return tokenFields.accessToken;
};

export const clearMcpOAuthAuthorization = async (connectionId) => {
  const connection = await getConnection(connectionId);

  await db.transaction(
    'rw',
    db.mcpConnections,
    db.mcpOAuthSessions,
    async () => {
      await db.mcpConnections.update(connectionId, {
        auth: {
          ...connection.auth,
          type: 'oauth',
          accessToken: '',
          refreshToken: '',
          tokenType: '',
          expiresAt: null,
        },
        authStatus: 'unauthorized',
        authUpdatedAt: nowIso(),
        updatedAt: nowIso(),
      });

      const sessions = await db.mcpOAuthSessions
        .where('connectionId')
        .equals(connectionId)
        .toArray();

      await db.mcpOAuthSessions.bulkDelete(
        sessions.map((session) => session.id),
      );
    },
  );
};

export const getMcpOAuthStatus = (connection = {}) => {
  if (connection?.auth?.type !== 'oauth') {
    return {
      configured: false,
      authorized: false,
      expired: false,
    };
  }

  const hasAccessToken = Boolean(normalizeText(connection.auth.accessToken));
  const expiresAt = connection.auth.expiresAt
    ? new Date(connection.auth.expiresAt).getTime()
    : null;

  const expired = Boolean(expiresAt && expiresAt <= Date.now());

  return {
    configured: true,
    authorized: hasAccessToken && !expired,
    expired,
    expiresAt: connection.auth.expiresAt || null,
  };
};

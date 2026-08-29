
import {
  createMcpConnection,
  getMcpToolsForConnection,
  setMcpToolEnabled,
  setMcpToolRiskLevel,
} from './mcpConnectionService';

const MCP_EXPORT_FORMAT = 'when-i-with-u-mcp-connection';
const MCP_EXPORT_VERSION = 2;
const LEGACY_MCP_EXPORT_VERSION = 1;

const safeText = (value = '') => String(value || '').trim();

const isValidRiskLevel = (value) =>
  ['read', 'write', 'unknown'].includes(value);

const normalizeToolPreference = (tool = {}) => {
  const toolName = safeText(tool.toolName);

  if (!toolName) {
    return null;
  }

  return {
    toolName,
    enabled: tool.enabled === true,
    riskLevel: isValidRiskLevel(tool.riskLevel)
      ? tool.riskLevel
      : 'unknown',
  };
};

const makeFileName = (name = '') => {
  const safeName = safeText(name)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48);

  return `${safeName || 'bond-connection'}.bond-connection.json`;
};

export const createMcpConnectionExport = async ({
  connection,
  tools = [],
}) => {
  if (!connection?.endpoint) {
    throw new Error('缺少 MCP 连接地址，无法导出。');
  }

  return {
    format: MCP_EXPORT_FORMAT,
    version: MCP_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),

    connection: {
      name: safeText(connection.name) || '未命名连接',
      endpoint: safeText(connection.endpoint),

      provider: safeText(connection.provider) || 'generic',
      transport: safeText(connection.transport) || 'streamable-http',
      executionMode:
        safeText(connection.executionMode) || 'browser-direct',

      bridge:
        connection.executionMode === 'user-bridge' ||
        connection.provider === 'bridge'
          ? {
              id: safeText(connection.bridge?.id) || null,
              label: safeText(connection.bridge?.label) || '',
            }
          : null,

      /*
       * 仅导出可安全分享的 stdio 描述。
       * 不包含环境变量值。
       */
      source:
        connection.source?.kind === 'stdio'
          ? {
              kind: 'stdio',
              command: safeText(connection.source.command),
              args: Array.isArray(connection.source.args)
                ? connection.source.args
                    .map((item) => safeText(item))
                    .filter(Boolean)
                : [],
              envKeys: Array.isArray(connection.source.envKeys)
                ? connection.source.envKeys
                    .map((item) => safeText(item))
                    .filter(Boolean)
                : [],
            }
          : {
              kind: 'endpoint',
            },

      authType:
        connection.auth?.type === 'bearer'
          ? 'user-provided'
          : connection.auth?.type === 'oauth'
            ? 'oauth-required'
            : connection.auth?.type === 'bridge-managed'
              ? 'bridge-managed'
              : 'none',
    },

    tools: tools
      .map(normalizeToolPreference)
      .filter(Boolean),
  };
};

export const downloadMcpConnectionExport = async ({
  connection,
  tools = [],
}) => {
  const data = await createMcpConnectionExport({
    connection,
    tools,
  });

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = makeFileName(connection?.name);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);

  return data;
};

export const parseMcpConnectionImport = async (file) => {
  if (!file) {
    throw new Error('请选择需要导入的连接文件。');
  }

  const rawText = await file.text();

  let payload;

  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error('该文件不是有效的 JSON 连接配置。');
  }

  const isSupportedVersion = [
    LEGACY_MCP_EXPORT_VERSION,
    MCP_EXPORT_VERSION,
  ].includes(payload?.version);

  if (
    payload?.format !== MCP_EXPORT_FORMAT ||
    !isSupportedVersion
  ) {
    throw new Error('这不是可识别的 The Bond Connection 配置文件。');
  }

  const endpoint = safeText(payload?.connection?.endpoint);

  if (!endpoint) {
    throw new Error('导入文件中没有 MCP 服务地址。');
  }

  const legacyImport = payload.version === LEGACY_MCP_EXPORT_VERSION;

  const transport = legacyImport
    ? 'streamable-http'
    : safeText(payload?.connection?.transport) || 'streamable-http';

  const provider = legacyImport
    ? 'generic'
    : safeText(payload?.connection?.provider) || 'generic';

  const executionMode = legacyImport
    ? 'browser-direct'
    : safeText(payload?.connection?.executionMode) || 'browser-direct';

  const source = payload?.connection?.source || {};

  return {
    connection: {
      name: safeText(payload?.connection?.name) || '导入的连接',
      endpoint,

      provider,
      transport,
      executionMode,

      bridge: {
        id: safeText(payload?.connection?.bridge?.id) || null,
        label: safeText(payload?.connection?.bridge?.label) || '',
      },

      source: {
        kind:
          safeText(source.kind) === 'stdio'
            ? 'stdio'
            : 'endpoint',

        command:
          safeText(source.kind) === 'stdio'
            ? safeText(source.command)
            : '',

        args:
          safeText(source.kind) === 'stdio' &&
          Array.isArray(source.args)
            ? source.args.map((item) => safeText(item)).filter(Boolean)
            : [],

        envKeys:
          safeText(source.kind) === 'stdio' &&
          Array.isArray(source.envKeys)
            ? source.envKeys
                .map((item) => safeText(item))
                .filter(Boolean)
            : [],
      },

      /*
       * 无论导入文件内容为何，绝不恢复认证信息。
       */
      auth: {
        type: 'none',
        token: '',
      },

      enabled: false,
    },

    toolPreferences: Array.isArray(payload?.tools)
      ? payload.tools
          .map(normalizeToolPreference)
          .filter(Boolean)
      : [],

    requiresAuthentication:
      payload?.connection?.authType === 'user-provided' ||
      payload?.connection?.authType === 'oauth-required',

    requiresBridge:
      executionMode === 'user-bridge' ||
      executionMode === 'user-executor' ||
      transport === 'bridge-http' ||
      transport === 'bridge-websocket',
  };
};

export const createImportedMcpConnection = async (parsedImport) => {
  if (!parsedImport?.connection) {
    throw new Error('没有可导入的 MCP 连接内容。');
  }

  return createMcpConnection(parsedImport.connection);
};

/*
 * 连接测试成功、工具已同步后，才应用导入文件中的工具开关偏好。
 * 只对 MCP Server 实际存在的工具生效。
 */
export const applyImportedToolPreferences = async ({
  connectionId,
  toolPreferences = [],
}) => {
  if (!connectionId || !Array.isArray(toolPreferences)) {
    return;
  }

  const preferenceByToolName = new Map(
    toolPreferences.map((item) => [
      item.toolName,
      item,
    ]),
  );

  const availableTools = await getMcpToolsForConnection(connectionId);

  await Promise.all(
    availableTools.map(async (tool) => {
      const preference = preferenceByToolName.get(tool.toolName);

      if (!preference) return;

      await setMcpToolEnabled(tool.id, preference.enabled);
      await setMcpToolRiskLevel(tool.id, preference.riskLevel);
    }),
  );
};

export {
  MCP_EXPORT_FORMAT,
  MCP_EXPORT_VERSION,
};

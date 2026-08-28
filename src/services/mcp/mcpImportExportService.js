import {
  createMcpConnection,
  getMcpToolsForConnection,
  setMcpToolEnabled,
  setMcpToolRiskLevel,
} from './mcpConnectionService';

const MCP_EXPORT_FORMAT = 'when-i-with-u-mcp-connection';
const MCP_EXPORT_VERSION = 1;

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
      transport: 'streamable-http',

      /*
       * 不导出 token。
       * 导入者若需要认证，必须自行填写自己的认证信息。
       */
      authType:
        connection.auth?.type === 'bearer'
          ? 'user-provided'
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

  if (
    payload?.format !== MCP_EXPORT_FORMAT ||
    payload?.version !== MCP_EXPORT_VERSION
  ) {
    throw new Error('这不是可识别的 The Bond Connection 配置文件。');
  }

  const endpoint = safeText(payload?.connection?.endpoint);

  if (!endpoint) {
    throw new Error('导入文件中没有 MCP 服务地址。');
  }

  return {
    connection: {
      name: safeText(payload?.connection?.name) || '导入的连接',
      endpoint,
      transport: 'streamable-http',

      /*
       * 导入时永远不恢复认证信息；
       * 即使文件被人为改写，也不会读取 token。
       */
      auth: {
        type: 'none',
        token: '',
      },

      /*
       * 新导入连接默认关闭，且需要先经过测试。
       */
      enabled: false,
    },

    toolPreferences: Array.isArray(payload?.tools)
      ? payload.tools
          .map(normalizeToolPreference)
          .filter(Boolean)
      : [],

    requiresAuthentication:
      payload?.connection?.authType === 'user-provided',
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

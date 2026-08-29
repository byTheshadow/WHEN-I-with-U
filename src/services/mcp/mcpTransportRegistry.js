export const MCP_TRANSPORTS = {
  STREAMABLE_HTTP: 'streamable-http',
  BRIDGE_HTTP: 'bridge-http',
  SSE: 'sse',
  BRIDGE_WEBSOCKET: 'bridge-websocket',
  CUSTOM: 'custom',
};


const SUPPORTED_TRANSPORTS = new Set([
  MCP_TRANSPORTS.STREAMABLE_HTTP,
  MCP_TRANSPORTS.BRIDGE_HTTP,
]);

export const isMcpTransportSupported = (transport) =>
  SUPPORTED_TRANSPORTS.has(transport);

export const getMcpTransportLabel = (transport) => {
  switch (transport) {
    case MCP_TRANSPORTS.STREAMABLE_HTTP:
      return '远程 HTTP MCP';

    case MCP_TRANSPORTS.BRIDGE_HTTP:
      return '我的 Bridge';

    case MCP_TRANSPORTS.SSE:
      return 'SSE 兼容 MCP';

    case MCP_TRANSPORTS.BRIDGE_WEBSOCKET:
      return 'Bridge WebSocket';

    case MCP_TRANSPORTS.CUSTOM:
      return '自定义兼容入口';

    default:
      return '未知连接方式';
  }
};

export const getMcpTransportSupportState = (transport) => {
  if (isMcpTransportSupported(transport)) {
    return {
      supported: true,
      message: '',
    };
  }

  switch (transport) {
    case MCP_TRANSPORTS.SSE:
      return {
        supported: false,
        message:
          '这条连接使用 SSE 兼容传输。已保留配置兼容性，客户端适配器将在后续更新中接入。',
      };

    case MCP_TRANSPORTS.BRIDGE_WEBSOCKET:
      return {
        supported: false,
        message:
          '这条连接需要与用户 Bridge 匹配的 WebSocket 协议适配器，当前尚不能测试或调用。',
      };

    case MCP_TRANSPORTS.CUSTOM:
      return {
        supported: false,
        message:
          '这条连接需要自定义 Transport Adapter，当前尚未注册对应实现。',
      };

    default:
      return {
        supported: false,
        message: '当前版本尚未实现这条连接所需的传输方式。',
      };
  }
};

export const assertMcpTransportSupported = (connection = {}) => {
  const state = getMcpTransportSupportState(connection.transport);

  if (!state.supported) {
    const error = new Error(state.message);
    error.code = 'MCP_TRANSPORT_NOT_IMPLEMENTED';
    error.transport = connection.transport;
    throw error;
  }
};

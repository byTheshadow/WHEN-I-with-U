import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Power,
    Play,
  RefreshCw,
  Trash2,
  Upload,
  Wrench,
  X,
  XCircle,
  Bot,
Cable,
CircleHelp,
FileCode2,
HardDrive,


} from 'lucide-react';

import GlassCard from '../../../components/GlassCard';
import ConfirmModal from '../../../components/ConfirmModal';
import {
  getMcpTransportLabel,
} from '../../../services/mcp/mcpTransportRegistry';


import {
  createMcpConnection,
  deleteMcpConnection,
  getMcpConnections,
  getMcpToolsForConnection,
  setMcpConnectionEnabled,
  setMcpToolEnabled,
  setMcpToolRiskLevel,
  testAndSyncMcpConnection,
  updateMcpConnection,
  MCP_EXECUTION_MODES,
MCP_PROVIDERS,
MCP_TRANSPORTS,

} from '../../../services/mcp/mcpConnectionService';

import {
  applyImportedToolPreferences,
  createImportedMcpConnection,
  downloadMcpConnectionExport,
  parseMcpConnectionImport,
} from '../../../services/mcp/mcpImportExportService';
import ManualMcpToolCallModal from './ManualMcpToolCallModal';
import McpActivityTrace from './McpActivityTrace';




const EMPTY_DRAFT = {
  name: '',
  endpoint: '',

  connectionKind: 'remote',

  provider: MCP_PROVIDERS.GENERIC,
  transport: MCP_TRANSPORTS.STREAMABLE_HTTP,
  executionMode: MCP_EXECUTION_MODES.BROWSER_DIRECT,

  bridgeLabel: '',

  sourceKind: 'endpoint',
  stdioCommand: '',
  stdioArgsText: '',
  stdioEnvKeysText: '',

  authType: 'none',
  token: '',
};


const getStatusLabel = (status) => {
  switch (status) {
    case 'connected':
      return '已接通';
    case 'connecting':
      return '正在辨认';
    case 'error':
      return '未能接通';
    default:
      return '尚未测试';
  }
};

const Toggle = ({
  checked,
  disabled = false,
  label,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45"
    style={{
      background: checked
        ? 'var(--accent-color)'
        : 'var(--divider)',
    }}
  >
    <span
      className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform"
      style={{
        transform: checked
          ? 'translateX(18px)'
          : 'translateX(3px)',
      }}
    />
  </button>
);

const getStatusClassName = (status) => {
  switch (status) {
    case 'connected':
      return 'text-emerald-500';
    case 'connecting':
      return 'text-amber-500';
    case 'error':
      return 'text-rose-500';
    default:
      return 'opacity-50';
  }
};

const getRiskLabel = (riskLevel) => {
  switch (riskLevel) {
    case 'read':
      return '仅查看';
    case 'write':
      return '可能改变外部内容';
    default:
      return '尚未判断';
  }
};

const makeDraftFromConnection = (connection) => {
  const isBridge =
    connection?.transport === MCP_TRANSPORTS.BRIDGE_HTTP ||
    connection?.executionMode === MCP_EXECUTION_MODES.USER_BRIDGE;

  return {
    name: connection?.name || '',
    endpoint: connection?.endpoint || '',

    connectionKind: isBridge ? 'bridge' : 'remote',

    provider:
      connection?.provider ||
      (isBridge
        ? MCP_PROVIDERS.BRIDGE
        : MCP_PROVIDERS.GENERIC),

    transport:
      connection?.transport ||
      (isBridge
        ? MCP_TRANSPORTS.BRIDGE_HTTP
        : MCP_TRANSPORTS.STREAMABLE_HTTP),

    executionMode:
      connection?.executionMode ||
      (isBridge
        ? MCP_EXECUTION_MODES.USER_BRIDGE
        : MCP_EXECUTION_MODES.BROWSER_DIRECT),

    bridgeLabel: connection?.bridge?.label || '',

    sourceKind:
      connection?.source?.kind === 'stdio'
        ? 'stdio'
        : 'endpoint',

    stdioCommand: connection?.source?.command || '',
    stdioArgsText: Array.isArray(connection?.source?.args)
      ? connection.source.args.join('\n')
      : '',

    stdioEnvKeysText: Array.isArray(connection?.source?.envKeys)
      ? connection.source.envKeys.join('\n')
      : '',

    authType:
      connection?.auth?.type === 'bearer'
        ? 'bearer'
        : 'none',

    token: connection?.auth?.token || '',
  };
};

const parseLineList = (value = '') =>
  String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const updateDraftConnectionKind = (kind) => {
  if (kind === 'bridge') {
    return {
      connectionKind: 'bridge',
      provider: MCP_PROVIDERS.BRIDGE,
      transport: MCP_TRANSPORTS.BRIDGE_HTTP,
      executionMode: MCP_EXECUTION_MODES.USER_BRIDGE,
    };
  }

  return {
    connectionKind: 'remote',
    provider: MCP_PROVIDERS.GENERIC,
    transport: MCP_TRANSPORTS.STREAMABLE_HTTP,
    executionMode: MCP_EXECUTION_MODES.BROWSER_DIRECT,
    bridgeLabel: '',
    sourceKind: 'endpoint',
    stdioCommand: '',
    stdioArgsText: '',
    stdioEnvKeysText: '',
  };
};

const getConnectionKindCopy = (kind) => {
  if (kind === 'bridge') {
    return {
      title: '使用我的 Bridge',
      description:
        '连接你自行运行的 Bridge 所暴露的标准 MCP HTTP 地址。',
    };
  }

  return {
    title: '远程 MCP 地址',
    description:
      '连接可由当前浏览器访问的远程 Streamable HTTP MCP 服务。',
  };
};



const StatusMark = ({ status }) => {
  if (status === 'connecting') {
    return (
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
    );
  }

  if (status === 'connected') {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (status === 'error') {
    return <XCircle className="h-3.5 w-3.5" />;
  }

  return <Link2 className="h-3.5 w-3.5" />;
};

export const BondConnection = () => {
  const importInputRef = useRef(null);

  const [connections, setConnections] = useState([]);
  const [toolsByConnection, setToolsByConnection] = useState({});
  const [expandedConnectionIds, setExpandedConnectionIds] = useState(
    new Set(),
  );

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingConnectionId, setEditingConnectionId] = useState(null);

  const [workingConnectionId, setWorkingConnectionId] = useState(null);
  const [notice, setNotice] = useState({
    type: 'idle',
    message: '',
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
    const [manualCallTarget, setManualCallTarget] = useState(null);

  const loadConnections = async () => {
    try {
      const nextConnections = await getMcpConnections();

      const toolEntries = await Promise.all(
        nextConnections.map(async (connection) => [
          connection.id,
          await getMcpToolsForConnection(connection.id),
        ]),
      );

      setConnections(nextConnections);
      setToolsByConnection(Object.fromEntries(toolEntries));
    } catch (error) {
      console.error('[MCP] 无法读取连接：', error);
      setNotice({
        type: 'error',
        message: '无法读取已保存的外接连接。',
      });
    }
  };

  useEffect(() => {
    void loadConnections();
  }, []);

  const showNotice = (type, message) => {
    setNotice({ type, message });
  };

  const clearComposer = () => {
    setDraft(EMPTY_DRAFT);
    setEditingConnectionId(null);
    setIsComposerOpen(false);
  };

  const openCreateComposer = () => {
    setDraft(EMPTY_DRAFT);
    setEditingConnectionId(null);
    setIsComposerOpen(true);
    setNotice({ type: 'idle', message: '' });
  };

  const openEditComposer = (connection) => {
    setDraft(makeDraftFromConnection(connection));
    setEditingConnectionId(connection.id);
    setIsComposerOpen(true);
    setNotice({ type: 'idle', message: '' });
  };

  const toggleExpanded = (connectionId) => {
    setExpandedConnectionIds((previous) => {
      const next = new Set(previous);

      if (next.has(connectionId)) {
        next.delete(connectionId);
      } else {
        next.add(connectionId);
      }

      return next;
    });
  };

  const handleSaveConnection = async () => {
    if (!draft.endpoint.trim()) {
      showNotice('error', '请填写 MCP 服务地址。');
      return;
    }

    setWorkingConnectionId(editingConnectionId || 'creating');

    try {
      const payload = {
  name: draft.name,
  endpoint: draft.endpoint,

  provider: draft.provider,
  transport: draft.transport,
  executionMode: draft.executionMode,

  bridge: {
    label:
      draft.connectionKind === 'bridge'
        ? draft.bridgeLabel
        : '',
  },

  source: {
    kind:
      draft.connectionKind === 'bridge' &&
      draft.sourceKind === 'stdio'
        ? 'stdio'
        : 'endpoint',

    command:
      draft.connectionKind === 'bridge' &&
      draft.sourceKind === 'stdio'
        ? draft.stdioCommand
        : '',

    args:
      draft.connectionKind === 'bridge' &&
      draft.sourceKind === 'stdio'
        ? parseLineList(draft.stdioArgsText)
        : [],

    envKeys:
      draft.connectionKind === 'bridge' &&
      draft.sourceKind === 'stdio'
        ? parseLineList(draft.stdioEnvKeysText)
        : [],
  },

  auth: {
    type: draft.authType,
    token: draft.authType === 'bearer' ? draft.token : '',
  },
};


      let connection;

      if (editingConnectionId) {
        connection = await updateMcpConnection(
          editingConnectionId,
          payload,
        );
      } else {
        connection = await createMcpConnection(payload);
      }

      const result = await testAndSyncMcpConnection(connection.id);

      setExpandedConnectionIds((previous) => {
        const next = new Set(previous);
        next.add(connection.id);
        return next;
      });

      clearComposer();
      await loadConnections();

      showNotice(
        'success',
        `已辨认「${result.connection?.name || connection.name}」，发现 ${
          result.tools?.length || 0
        } 项工具。请逐项决定是否启用。`,
      );
    } catch (error) {
      showNotice(
        'error',
        error?.message || '未能连接此 MCP 服务。',
      );
    } finally {
      setWorkingConnectionId(null);
    }
  };

  const handleRetest = async (connection) => {
    setWorkingConnectionId(connection.id);

    try {
      const result = await testAndSyncMcpConnection(connection.id);
      await loadConnections();

      showNotice(
        'success',
        `已重新同步，共找到 ${result.tools?.length || 0} 项工具。`,
      );
    } catch (error) {
      await loadConnections();

      showNotice(
        'error',
        error?.message || '重新测试连接失败。',
      );
    } finally {
      setWorkingConnectionId(null);
    }
  };

  const handleConnectionEnabledChange = async (
    connection,
    enabled,
  ) => {
    setWorkingConnectionId(connection.id);

    try {
      await setMcpConnectionEnabled(connection.id, enabled);
      await loadConnections();

      showNotice(
        'success',
        enabled
          ? `「${connection.name}」已重新接入。`
          : `「${connection.name}」已暂时断开，AI 不会看见其工具。`,
      );
    } catch (error) {
      showNotice(
        'error',
        error?.message || '更新连接状态失败。',
      );
    } finally {
      setWorkingConnectionId(null);
    }
  };

  const handleToolEnabledChange = async (tool, enabled) => {
    try {
      await setMcpToolEnabled(tool.id, enabled);
      await loadConnections();

      showNotice(
        'success',
        enabled
          ? `已允许 AI 看见「${tool.displayName}」。`
          : `已隐藏「${tool.displayName}」，AI 将无法调用它。`,
      );
    } catch (error) {
      showNotice(
        'error',
        error?.message || '更新工具状态失败。',
      );
    }
  };

  const handleRiskChange = async (tool, riskLevel) => {
    try {
      await setMcpToolRiskLevel(tool.id, riskLevel);
      await loadConnections();

      showNotice('success', '工具权限类别已更新。');
    } catch (error) {
      showNotice(
        'error',
        error?.message || '无法更新工具权限类别。',
      );
    }
  };

  const handleExport = async (connection) => {
    try {
      await downloadMcpConnectionExport({
        connection,
        tools: toolsByConnection[connection.id] || [],
      });

      showNotice(
        'success',
        '已导出连接配置。认证信息没有包含在文件中。',
      );
    } catch (error) {
      showNotice(
        'error',
        error?.message || '导出连接配置失败。',
      );
    }
  };

  const handleImportFile = async (event) => {
    const [file] = Array.from(event.target.files || []);

    /*
     * 同一个文件可再次选择。
     */
    event.target.value = '';

    if (!file) return;

    setWorkingConnectionId('importing');

    try {
      const parsed = await parseMcpConnectionImport(file);

      const connection = await createImportedMcpConnection(parsed);

      const result = await testAndSyncMcpConnection(connection.id);

      await applyImportedToolPreferences({
        connectionId: connection.id,
        toolPreferences: parsed.toolPreferences,
      });

      /*
       * 导入的连接即使测试成功，也不自动启用。
       * 用户必须手动开启总连接开关。
       */
      await setMcpConnectionEnabled(connection.id, false);

      setExpandedConnectionIds((previous) => {
        const next = new Set(previous);
        next.add(connection.id);
        return next;
      });

      await loadConnections();

      showNotice(
        'success',
        `已导入「${result.connection?.name || connection.name}」。连接和工具目前保持关闭，请检查后自行开启。`,
      );
    } catch (error) {
      showNotice(
        'error',
        error?.message || '导入连接配置失败。',
      );
    } finally {
      setWorkingConnectionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setWorkingConnectionId(deleteTarget.id);

    try {
      await deleteMcpConnection(deleteTarget.id);
      await loadConnections();

      showNotice(
        'success',
        `已移除「${deleteTarget.name}」及其本地工具和权限记录。`,
      );
    } catch (error) {
      showNotice(
        'error',
        error?.message || '移除连接失败。',
      );
    } finally {
      setWorkingConnectionId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'var(--control-soft-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <Link2 className="h-4 w-4" />
            </div>

            <div>
              <h3 className="font-serif text-sm font-bold">
                The Bond Connection
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed opacity-60">
                让角色在你的允许下，借用一些来自外部的感官与工具。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateComposer}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-black px-3 py-2 text-[11px] font-semibold text-white transition-transform active:scale-95 dark:bg-white dark:text-black"
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </button>
        </div>

        <div
          className="rounded-2xl px-3 py-2.5 text-[10px] leading-relaxed opacity-65"
          style={{
            background: 'var(--control-soft-bg)',
            border: '1px solid var(--divider)',
          }}
        >
          可连接浏览器可访问的远程 MCP，也可使用你自行运行的 Bridge
所提供的兼容入口。连接文件不会包含 Token；私密工具在首次调用时仍需要你的确认。
        </div>

        {notice.type !== 'idle' && (
          <div
            className={`flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[11px] leading-relaxed ${
              notice.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}

            <span>{notice.message}</span>
          </div>
        )}

        <input
          ref={importInputRef}
          type="file"
          accept=".json,.bond-connection.json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={workingConnectionId === 'importing'}
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-opacity disabled:opacity-50"
            style={{
              borderColor: 'var(--divider)',
              background: 'var(--control-soft-bg)',
            }}
          >
            {workingConnectionId === 'importing' ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            导入连接
          </button>

          <span className="text-[10px] opacity-45">
            可分享的是地址与工具偏好，不是密钥。
          </span>
        </div>

        {connections.length === 0 ? (
          <div
            className="rounded-[1.4rem] px-4 py-6 text-center"
            style={{
              background: 'var(--control-soft-bg)',
              border: '1px dashed var(--divider)',
            }}
          >
            <Wrench className="mx-auto h-4 w-4 opacity-35" />
            <p className="mt-2 text-[11px] opacity-55">
              这里还没有接入任何外部工具。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => {
              const tools = toolsByConnection[connection.id] || [];
              const isExpanded = expandedConnectionIds.has(connection.id);
              const isWorking =
                workingConnectionId === connection.id;

              return (
                <section
                  key={connection.id}
                  className="overflow-hidden rounded-[1.45rem]"
                  style={{
                    background: 'var(--control-soft-bg)',
                    border: '1px solid var(--divider)',
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(connection.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`flex items-center gap-1 text-[10px] font-medium ${getStatusClassName(
                              connection.status,
                            )}`}
                          >
                            <StatusMark status={connection.status} />
                            {getStatusLabel(connection.status)}
                          </span>

                          {!connection.enabled && (
                            <span className="text-[10px] opacity-45">
                              已停用
                            </span>
                          )}
                        </div>

                        <p className="mt-1 truncate text-xs font-semibold">
                          {connection.name}
                        </p>

                      <p className="mt-0.5 truncate text-[10px] opacity-45">
  {connection.serverInfo?.name || connection.endpoint}
</p>

<div className="mt-1 flex flex-wrap items-center gap-1.5">
  <span
    className="rounded-full px-1.5 py-0.5 text-[9px] opacity-60"
    style={{
      background: 'var(--card-bg-gradient)',
      border: '1px solid var(--divider)',
    }}
  >
    {getMcpTransportLabel(connection.transport)}
  </span>

  {connection.executionMode === 'user-bridge' && (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] opacity-60"
      style={{
        background: 'var(--card-bg-gradient)',
        border: '1px solid var(--divider)',
      }}
    >
      用户 Bridge
    </span>
  )}
</div>

                      </button>

                      <Toggle
                        checked={connection.enabled === true}
                        disabled={isWorking}
                        label={`切换 ${connection.name} 的连接状态`}
                        onChange={(enabled) =>
                          handleConnectionEnabledChange(
                            connection,
                            enabled,
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() => toggleExpanded(connection.id)}
                        className="p-1 opacity-55"
                        aria-label={
                          isExpanded ? '收起连接详情' : '展开连接详情'
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {connection.status === 'error' &&
                      connection.lastError && (
                        <p className="mt-2 rounded-xl bg-rose-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-rose-600 dark:text-rose-300">
                          {connection.lastError}
                        </p>
                      )}
                  </div>

                  {isExpanded && (
                    <div
                      className="space-y-3 border-t px-3 pb-3 pt-3"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => handleRetest(connection)}
                          className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-medium disabled:opacity-45"
                          style={{
                            borderColor: 'var(--divider)',
                            background: 'var(--card-bg-gradient)',
                          }}
                        >
                          {isWorking ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          重新同步
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditComposer(connection)}
                          className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-medium"
                          style={{
                            borderColor: 'var(--divider)',
                            background: 'var(--card-bg-gradient)',
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          编辑
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExport(connection)}
                          className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-medium"
                          style={{
                            borderColor: 'var(--divider)',
                            background: 'var(--card-bg-gradient)',
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          导出
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(connection)}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-500/25 px-2.5 py-2 text-[10px] font-medium text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          移除
                        </button>
                      </div>


                      {connection.source?.kind === 'stdio' && (
  <div
    className="rounded-2xl p-3"
    style={{
      background: 'var(--card-bg-gradient)',
      border: '1px solid var(--divider)',
    }}
  >
    <div className="flex items-start gap-2">
      <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />

      <div className="min-w-0">
        <p className="text-[10px] font-medium">
          交给 Bridge 的本机启动描述
        </p>

        <p className="mt-1 break-all font-mono text-[9px] leading-relaxed opacity-55">
          {[connection.source.command, ...(connection.source.args || [])]
            .filter(Boolean)
            .join(' ')}
        </p>

        {connection.source.envKeys?.length > 0 && (
          <p className="mt-1 text-[9px] opacity-45">
            需要由 Bridge 自行提供：
            {connection.source.envKeys.join('、')}
          </p>
        )}

        <p className="mt-2 text-[9px] leading-relaxed opacity-45">
          本应用不会运行这条命令，也不会保存任何环境变量值。
        </p>
      </div>
    </div>
  </div>
)}
 <McpActivityTrace
                        connectionId={connection.id}
                      />

                      <div className="space-y-2">
                        <p className="text-[10px] font-medium opacity-50">
                          已辨认的工具
                        </p>

                        {tools.length === 0 ? (
                          <p className="rounded-xl px-2.5 py-2 text-[10px] opacity-50">
                            此服务尚未返回工具；也可能只提供资源或提示词。
                          </p>
                        ) : (
                          tools.map((tool) => (
                            <div
                              key={tool.id}
                              className="rounded-2xl px-3 py-2.5"
                              style={{
                                background: 'var(--card-bg-gradient)',
                                border: '1px solid var(--divider)',
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold">
                                    {tool.displayName}
                                  </p>

                                  {tool.description && (
                                    <p className="mt-1 text-[10px] leading-relaxed opacity-55">
                                      {tool.description}
                                    </p>
                                  )}
                                </div>

                                <Toggle
                                  checked={tool.enabled === true}
                                  disabled={
                                    connection.enabled !== true ||
                                    tool.isAvailable === false
                                  }
                                  label={`切换工具 ${tool.displayName}`}
                                  onChange={(enabled) =>
                                    handleToolEnabledChange(
                                      tool,
                                      enabled,
                                    )
                                  }
                                />
                              </div>


                                <div className="mt-2 flex items-center gap-2">
  <select
    value={tool.riskLevel || 'unknown'}
    onChange={(event) =>
      handleRiskChange(
        tool,
        event.target.value,
      )
    }
    className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[10px] outline-none"
    style={{
      background: 'var(--control-soft-bg)',
      border: '1px solid var(--divider)',
      color: 'var(--text-main)',
    }}
  >
    <option value="read">仅查看</option>
    <option value="write">
      可能改变外部内容
    </option>
    <option value="unknown">
      尚未判断
    </option>
  </select>

  <button
    type="button"
    disabled={
      connection.enabled !== true ||
      tool.enabled !== true ||
      tool.isAvailable === false
    }
    onClick={() =>
      setManualCallTarget({
        connection,
        tool,
      })
    }
    className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
    style={{
      background: 'var(--control-soft-bg)',
      borderColor: 'var(--divider)',
    }}
  >
    <Play className="h-3 w-3" />
    试用
  </button>
</div>

<span className="mt-1.5 block text-[9px] opacity-45">
  {getRiskLabel(tool.riskLevel)}
</span>


                              {tool.isAvailable === false && (
                                <p className="mt-2 text-[10px] text-rose-500">
                                  此工具已不在服务最新返回的清单中。
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </GlassCard>

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="fixed inset-0 cursor-default bg-white/5 backdrop-blur-md dark:bg-black/5"
            onClick={clearComposer}
            aria-label="关闭连接编辑"
          />

          <div
            className="relative z-10 w-full max-w-sm space-y-4 rounded-[2rem] p-5 shadow-2xl"
            style={{
              background: 'var(--card-bg-gradient)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-sm font-bold">
                  {editingConnectionId
                    ? '整理这条连接'
                    : '添加一条连接'}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed opacity-55">
                  可直接连接远程 MCP，也可使用你自行运行的 Bridge 所提供的兼容入口。
                </p>
              </div>

              <button
                type="button"
                onClick={clearComposer}
                className="rounded-full p-1 opacity-55"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>

            <div>
  <label className="mb-1 block text-[10px] opacity-60">
    连接方式
  </label>

  <div className="grid grid-cols-2 gap-2">
    {[
      {
        id: 'remote',
        icon: Link2,
      },
      {
        id: 'bridge',
        icon: HardDrive,
      },
    ].map(({ id, icon: Icon }) => {
      const copy = getConnectionKindCopy(id);
      const active = draft.connectionKind === id;

      return (
        <button
          key={id}
          type="button"
          onClick={() =>
            setDraft((previous) => ({
              ...previous,
              ...updateDraftConnectionKind(id),
            }))
          }
          className="rounded-2xl p-3 text-left transition-opacity"
          style={{
            background: active
              ? 'var(--control-soft-bg)'
              : 'var(--card-bg-gradient)',
            border: active
              ? '1px solid var(--accent-color)'
              : '1px solid var(--divider)',
          }}
        >
          <Icon className="h-3.5 w-3.5 opacity-65" />
          <p className="mt-2 text-[10px] font-semibold">
            {copy.title}
          </p>
          <p className="mt-1 text-[9px] leading-relaxed opacity-50">
            {copy.description}
          </p>
        </button>
      );
    })}
  </div>
</div>

                <label className="mb-1 block text-[10px] opacity-60">
                  留给自己的名字
                </label>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="例如：共读漫画"
                  className="w-full rounded-xl p-3 outline-none"
                  style={{
                    background: 'var(--control-soft-bg)',
                    border: '1px solid var(--divider)',
                  }}
                />
              </div>

             <div>
  <label className="mb-1 block text-[10px] opacity-60">
    {draft.connectionKind === 'bridge'
      ? 'Bridge 暴露的 MCP 地址'
      : 'MCP 地址'}
  </label>

  <input
    value={draft.endpoint}
    onChange={(event) =>
      setDraft((previous) => ({
        ...previous,
        endpoint: event.target.value,
      }))
    }
    placeholder={
      draft.connectionKind === 'bridge'
        ? 'http://127.0.0.1:3000/mcp'
        : 'https://example.com/mcp'
    }
    inputMode="url"
    className="w-full rounded-xl p-3 outline-none"
    style={{
      background: 'var(--control-soft-bg)',
      border: '1px solid var(--divider)',
    }}
  />
</div>

{draft.connectionKind === 'bridge' && (
  <>
    <div>
      <label className="mb-1 block text-[10px] opacity-60">
        Bridge 名称
      </label>

      <input
        value={draft.bridgeLabel}
        onChange={(event) =>
          setDraft((previous) => ({
            ...previous,
            bridgeLabel: event.target.value,
          }))
        }
        placeholder="例如：我的桌面 Bridge"
        className="w-full rounded-xl p-3 outline-none"
        style={{
          background: 'var(--control-soft-bg)',
          border: '1px solid var(--divider)',
        }}
      />
    </div>

    <div
      className="rounded-2xl p-3"
      style={{
        background: 'var(--control-soft-bg)',
        border: '1px solid var(--divider)',
      }}
    >
      <div className="flex items-start gap-2">
        <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-65" />

        <div>
          <p className="text-[10px] font-medium">
            你的 Bridge 需要做什么
          </p>

          <p className="mt-1 text-[9px] leading-relaxed opacity-50">
            它应将本机工具、stdio MCP 或你自己的服务，暴露为可访问的标准 MCP HTTP 地址。
            本应用不会启动程序、运行命令或读取本机环境变量。
          </p>

          <p className="mt-2 text-[9px] leading-relaxed opacity-45">
            如果此应用通过 HTTPS 打开，浏览器可能阻止访问 HTTP 本机地址；
            Bridge 需自行处理 HTTPS、CORS、Private Network Access 或浏览器限制。
          </p>
        </div>
      </div>
    </div>

    <div>
      <label className="mb-1 block text-[10px] opacity-60">
        Bridge 来源
      </label>

      <select
        value={draft.sourceKind}
        onChange={(event) =>
          setDraft((previous) => ({
            ...previous,
            sourceKind: event.target.value,
          }))
        }
        className="w-full rounded-xl p-3 text-xs outline-none"
        style={{
          background: 'var(--control-soft-bg)',
          border: '1px solid var(--divider)',
          color: 'var(--text-main)',
        }}
      >
        <option value="endpoint">
          仅连接 Bridge 已提供的 MCP 地址
        </option>

        <option value="stdio">
          同时保留 stdio 启动描述
        </option>
      </select>
    </div>

    {draft.sourceKind === 'stdio' && (
      <div
        className="space-y-3 rounded-2xl p-3"
        style={{
          background: 'var(--control-soft-bg)',
          border: '1px solid var(--divider)',
        }}
      >
        <div className="flex items-start gap-2">
          <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-55" />

          <p className="text-[9px] leading-relaxed opacity-50">
            以下内容只是提供给你自己的 Bridge 或启动器参考。
            浏览器不会执行这条命令；环境变量只填写名称，不填写值。
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] opacity-60">
            命令
          </label>

          <input
            value={draft.stdioCommand}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                stdioCommand: event.target.value,
              }))
            }
            placeholder="例如：npx"
            className="w-full rounded-xl p-3 font-mono text-xs outline-none"
            style={{
              background: 'var(--card-bg-gradient)',
              border: '1px solid var(--divider)',
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] opacity-60">
            参数，每行一项
          </label>

          <textarea
            value={draft.stdioArgsText}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                stdioArgsText: event.target.value,
              }))
            }
            placeholder={'-y\n@example/mcp-server'}
            rows={3}
            className="w-full resize-none rounded-xl p-3 font-mono text-xs outline-none"
            style={{
              background: 'var(--card-bg-gradient)',
              border: '1px solid var(--divider)',
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] opacity-60">
            需要的环境变量名称，每行一项
          </label>

          <textarea
            value={draft.stdioEnvKeysText}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                stdioEnvKeysText: event.target.value,
              }))
            }
            placeholder={'API_KEY\nSERVICE_URL'}
            rows={2}
            className="w-full resize-none rounded-xl p-3 font-mono text-xs outline-none"
            style={{
              background: 'var(--card-bg-gradient)',
              border: '1px solid var(--divider)',
            }}
          />
        </div>
      </div>
    )}
  </>
)}



              <div
                className="rounded-2xl p-3"
                style={{
                  background: 'var(--control-soft-bg)',
                  border: '1px solid var(--divider)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="h-3.5 w-3.5 opacity-65" />
                    <span className="text-[11px] font-medium">
                      此服务需要 Token
                    </span>
                  </div>

                  <Toggle
                    checked={draft.authType === 'bearer'}
                    label="切换 Bearer Token 认证"
                    onChange={(enabled) =>
                      setDraft((previous) => ({
                        ...previous,
                        authType: enabled ? 'bearer' : 'none',
                        token: enabled ? previous.token : '',
                      }))
                    }
                  />
                </div>

                {draft.authType === 'bearer' && (
                  <input
                    type="password"
                    value={draft.token}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        token: event.target.value,
                      }))
                    }
                    placeholder="Bearer Token"
                    className="mt-3 w-full rounded-xl p-3 text-xs outline-none"
                    style={{
                      background: 'var(--card-bg-gradient)',
                      border: '1px solid var(--divider)',
                    }}
                  />
                )}

                <p className="mt-2 text-[9px] leading-relaxed opacity-50">
                  认证信息只保存在当前设备的浏览器中，导出连接时不会包含。
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={workingConnectionId !== null}
              onClick={handleSaveConnection}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-xs font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-55"
            >
              {workingConnectionId ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              {workingConnectionId
                ? '正在辨认连接'
                : editingConnectionId
                  ? '保存并重新测试'
                  : '保存并测试'}
            </button>
          </div>
        </div>
      )}

     {manualCallTarget && (
  <ManualMcpToolCallModal
    connection={manualCallTarget.connection}
    tool={manualCallTarget.tool}
    onClose={() => {
      setManualCallTarget(null);
      void loadConnections();
    }}
  />
)}



      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="移除这条连接？"
        message={
          deleteTarget
            ? `「${deleteTarget.name}」的工具、本地授权和调用记录都会被移除。外部服务中的数据不会被删除。`
            : ''
        }
        confirmText="移除"
        cancelText="保留"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default BondConnection;

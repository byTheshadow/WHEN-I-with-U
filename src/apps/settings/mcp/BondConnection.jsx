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
  RefreshCw,
  Trash2,
  Upload,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';

import GlassCard from '../../../components/GlassCard';
import ConfirmModal from '../../../components/ConfirmModal';

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
} from '../../../services/mcp/mcpConnectionService';

import {
  applyImportedToolPreferences,
  createImportedMcpConnection,
  downloadMcpConnectionExport,
  parseMcpConnectionImport,
} from '../../../services/mcp/mcpImportExportService';

const EMPTY_DRAFT = {
  name: '',
  endpoint: '',
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

const makeDraftFromConnection = (connection) => ({
  name: connection?.name || '',
  endpoint: connection?.endpoint || '',
  authType: connection?.auth?.type === 'bearer' ? 'bearer' : 'none',
  token: connection?.auth?.token || '',
});

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
    className={`relative h-6 w-11 rounded-full transition-colors ${
      checked
        ? 'bg-rose-500'
        : 'bg-black/15 dark:bg-white/15'
    } disabled:cursor-not-allowed disabled:opacity-40`}
  >
    <span
      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

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
          仅支持可由浏览器直接访问的远程 MCP 服务。连接文件不会包含
          Token；私密工具在首次调用时仍需要你的确认。
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
                          {connection.serverInfo?.name ||
                            connection.endpoint}
                        </p>
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

                                <span className="text-[9px] opacity-45">
                                  {getRiskLabel(tool.riskLevel)}
                                </span>
                              </div>

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
                  只接入浏览器可直接访问的远程 MCP 地址。
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
                  MCP 地址
                </label>
                <input
                  value={draft.endpoint}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      endpoint: event.target.value,
                    }))
                  }
                  placeholder="https://example.com/mcp"
                  inputMode="url"
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

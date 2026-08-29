import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Eye,
  LoaderCircle,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';

import {
  callMcpToolRuntime,
} from '../../../services/mcp/mcpRuntimeService';

const getInitialArgumentsText = (tool) => {
  const properties = tool?.inputSchema?.properties;

  if (!properties || typeof properties !== 'object') {
    return '{}';
  }

  const initialArguments = Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => {
      if (schema?.default !== undefined) {
        return [key, schema.default];
      }

      return [key, ''];
    }),
  );

  return JSON.stringify(initialArguments, null, 2);
};

const getRiskCopy = (riskLevel) => {
  switch (riskLevel) {
    case 'read':
      return '仅查看';

    case 'write':
      return '可能改变外部内容';

    default:
      return '尚未判断';
  }
};

const getResultTypeLabel = (type) => {
  switch (type) {
    case 'text':
      return '文字';

    case 'image':
      return '图片';

    case 'audio':
      return '音频';

    case 'resource':
      return '资源';

    default:
      return '其他内容';
  }
};

const getArgumentError = (rawArguments) => {
  const trimmed = String(rawArguments || '').trim();

  if (!trimmed) {
    return {
      value: {},
      error: null,
    };
  }

  try {
    const value = JSON.parse(trimmed);

    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {
        value: null,
        error: '工具参数必须是一个 JSON 对象。',
      };
    }

    return {
      value,
      error: null,
    };
  } catch {
    return {
      value: null,
      error: '工具参数不是有效的 JSON。',
    };
  }
};

export const ManualMcpToolCallModal = ({
  connection,
  tool,
  onClose,
}) => {
  const approvalResolverRef = useRef(null);

  const [argumentsText, setArgumentsText] = useState(() =>
    getInitialArgumentsText(tool),
  );

  const [argumentError, setArgumentError] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [result, setResult] = useState(null);
  const [callError, setCallError] = useState('');
  const [approvalRequest, setApprovalRequest] = useState(null);

  useEffect(() => {
    setArgumentsText(getInitialArgumentsText(tool));
    setArgumentError('');
    setCallError('');
    setResult(null);
    setApprovalRequest(null);
  }, [tool?.id]);

  const parameterHint = useMemo(() => {
    const properties = tool?.inputSchema?.properties;

    if (!properties || typeof properties !== 'object') {
      return '这项工具没有提供可识别的参数定义。可保留为空对象。';
    }

    const keys = Object.keys(properties);

    if (keys.length === 0) {
      return '这项工具不需要参数。';
    }

    return `可填写的字段：${keys.join('、')}`;
  }, [tool?.inputSchema]);

  const requestApproval = ({
    tool: requestTool,
    arguments: requestArguments,
  }) => {
    return new Promise((resolve) => {
      approvalResolverRef.current = resolve;

      setApprovalRequest({
        tool: requestTool,
        arguments: requestArguments,
      });
    });
  };

  const resolveApproval = ({
    decision,
    scope,
  }) => {
    const resolve = approvalResolverRef.current;

    approvalResolverRef.current = null;
    setApprovalRequest(null);

    resolve?.({
      decision,
      scope,
    });
  };

  const handleCall = async () => {
    const parsed = getArgumentError(argumentsText);

    if (parsed.error) {
      setArgumentError(parsed.error);
      setResult(null);
      return;
    }

    setArgumentError('');
    setCallError('');
    setResult(null);
    setIsCalling(true);

    try {
      const runtimeResult = await callMcpToolRuntime({
        connectionId: connection.id,
        toolName: tool.toolName,
        arguments: parsed.value,
        source: 'manual',
        requestApproval,
      });

      setResult(runtimeResult.result);
    } catch (error) {
      setCallError(
        error?.message || '这项外接工具没有完成调用。',
      );
    } finally {
      setIsCalling(false);
    }
  };

  const closeModal = () => {
    if (isCalling) return;

    if (approvalResolverRef.current) {
      resolveApproval({
        decision: 'deny',
        scope: 'once',
      });
    }

    onClose?.();
  };

  if (!connection || !tool) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
        <button
          type="button"
          className="fixed inset-0 cursor-default bg-white/5 backdrop-blur-md dark:bg-black/5"
          onClick={closeModal}
          aria-label="关闭工具试用"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-mcp-call-title"
          className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] shadow-2xl"
          style={{
            background: 'var(--card-bg-gradient)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-main)',
          }}
        >
          <header
            className="flex items-start justify-between gap-3 border-b p-5"
            style={{ borderColor: 'var(--divider)' }}
          >
            <div className="min-w-0">
              <p
                id="manual-mcp-call-title"
                className="font-serif text-sm font-bold"
              >
                试用一项外接工具
              </p>

              <p className="mt-1 text-[10px] leading-relaxed opacity-55">
                {connection.name} · {tool.displayName || tool.toolName}
              </p>
            </div>

            <button
              type="button"
              onClick={closeModal}
              disabled={isCalling}
              className="rounded-full p-1 opacity-55 transition-opacity hover:opacity-100 disabled:opacity-30"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 space-y-4 overflow-y-auto p-5">
            <div
              className="rounded-2xl p-3"
              style={{
                background: 'var(--control-soft-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <div className="flex items-start gap-2">
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />

                <div className="min-w-0">
                  <p className="text-[10px] font-medium">
                    {getRiskCopy(tool.riskLevel)}
                  </p>

                  {tool.description && (
                    <p className="mt-1 text-[10px] leading-relaxed opacity-55">
                      {tool.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium opacity-65">
                调用参数
              </label>

              <textarea
                value={argumentsText}
                onChange={(event) => {
                  setArgumentsText(event.target.value);
                  setArgumentError('');
                }}
                rows={8}
                spellCheck={false}
                className="w-full resize-y rounded-2xl p-3 font-mono text-[11px] leading-relaxed outline-none"
                style={{
                  background: 'var(--control-soft-bg)',
                  border: `1px solid ${
                    argumentError
                      ? 'rgb(244 63 94 / 0.55)'
                      : 'var(--divider)'
                  }`,
                  color: 'var(--text-main)',
                }}
              />

              {argumentError ? (
                <p className="mt-1.5 text-[10px] text-rose-500">
                  {argumentError}
                </p>
              ) : (
                <p className="mt-1.5 text-[9px] leading-relaxed opacity-45">
                  {parameterHint}
                </p>
              )}
            </div>

            {callError && (
              <div className="flex items-start gap-2 rounded-2xl bg-rose-500/10 px-3 py-2.5 text-[10px] leading-relaxed text-rose-600 dark:text-rose-300">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>{callError}</p>
              </div>
            )}

            {result && (
              <div
                className="space-y-3 rounded-2xl p-3"
                style={{
                  background: result.isError
                    ? 'rgb(244 63 94 / 0.08)'
                    : 'var(--control-soft-bg)',
                  border: result.isError
                    ? '1px solid rgb(244 63 94 / 0.25)'
                    : '1px solid var(--divider)',
                }}
              >
                <div className="flex items-center gap-2">
                  {result.isError ? (
                    <CircleAlert className="h-3.5 w-3.5 text-rose-500" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}

                  <p className="text-[10px] font-medium">
                    {result.isError
                      ? '工具返回了错误'
                      : '工具已完成调用'}
                  </p>
                </div>

                {result.items?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.items.map((item, index) => (
                      <span
                        key={`${item.type}-${index}`}
                        className="rounded-full px-2 py-1 text-[9px] opacity-60"
                        style={{
                          background: 'var(--card-bg-gradient)',
                          border: '1px solid var(--divider)',
                        }}
                      >
                        {getResultTypeLabel(item.type)}
                      </span>
                    ))}
                  </div>
                )}

                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-[10px] leading-relaxed opacity-75">
                  {result.text}
                </pre>

                {result.structuredContent && (
                  <details
                    className="rounded-xl px-2.5 py-2"
                    style={{
                      background: 'var(--card-bg-gradient)',
                      border: '1px solid var(--divider)',
                    }}
                  >
                    <summary className="cursor-pointer list-none text-[9px] font-medium opacity-60">
                      查看结构化结果
                    </summary>

                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed opacity-55">
                      {String(result.structuredContent)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          <footer
            className="border-t p-4"
            style={{ borderColor: 'var(--divider)' }}
          >
            <button
              type="button"
              disabled={
                isCalling ||
                connection.enabled !== true ||
                tool.enabled !== true ||
                tool.isAvailable === false
              }
              onClick={handleCall}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-xs font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isCalling ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              {isCalling ? '正在借用…' : '试用这项工具'}
            </button>
          </footer>
        </section>
      </div>

      {approvalRequest && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="fixed inset-0 cursor-default bg-white/10 backdrop-blur-md dark:bg-black/10"
            onClick={() =>
              resolveApproval({
                decision: 'deny',
                scope: 'once',
              })
            }
            aria-label="拒绝本次外接工具调用"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-mcp-approval-title"
            className="relative z-10 w-full max-w-sm space-y-4 rounded-[2rem] p-5 shadow-2xl"
            style={{
              background: 'var(--card-bg-gradient)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: 'var(--control-soft-bg)',
                  border: '1px solid var(--divider)',
                }}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>

              <div>
                <h3
                  id="manual-mcp-approval-title"
                  className="font-serif text-sm font-bold"
                >
                  允许试用这项工具？
                </h3>

                <p className="mt-1 text-[10px] leading-relaxed opacity-55">
                  本次调用会把下方参数发送至你连接的外部 MCP 服务。
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl p-3"
              style={{
                background: 'var(--control-soft-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <p className="text-[10px] font-semibold">
                {approvalRequest.tool?.displayName ||
                  approvalRequest.tool?.toolName}
              </p>

              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed opacity-55">
                {JSON.stringify(
                  approvalRequest.arguments || {},
                  null,
                  2,
                )}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() =>
                  resolveApproval({
                    decision: 'deny',
                    scope: 'once',
                  })
                }
                className="rounded-xl border px-3 py-2.5 font-medium opacity-75"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)',
                }}
              >
                拒绝
              </button>

              <button
                type="button"
                onClick={() =>
                  resolveApproval({
                    decision: 'allow',
                    scope: 'once',
                  })
                }
                className="rounded-xl bg-rose-500 px-3 py-2.5 font-semibold text-white"
              >
                仅本次允许
              </button>

              <button
                type="button"
                onClick={() =>
                  resolveApproval({
                    decision: 'allow',
                    scope: 'global',
                  })
                }
                className="col-span-2 rounded-xl border px-3 py-2.5 font-medium"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)',
                }}
              >
                始终允许此工具
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default ManualMcpToolCallModal;

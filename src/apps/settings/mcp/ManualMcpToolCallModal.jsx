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

const MAX_SCHEMA_PREVIEW_LENGTH = 12_000;

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

  try {
    return JSON.stringify(initialArguments, null, 2);
  } catch {
    return '{}';
  }
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

    if (
      !value ||
      Array.isArray(value) ||
      typeof value !== 'object'
    ) {
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

const getValueTypeLabel = (value) => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
};

const isExpectedSchemaType = (value, schemaType) => {
  switch (schemaType) {
    case 'object':
      return Boolean(
        value &&
          !Array.isArray(value) &&
          typeof value === 'object',
      );

    case 'array':
      return Array.isArray(value);

    case 'string':
      return typeof value === 'string';

    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value)
      );

    case 'integer':
      return Number.isInteger(value);

    case 'boolean':
      return typeof value === 'boolean';

    case 'null':
      return value === null;

    default:
      /*
       * 未识别的 Schema type 不阻止用户调用。
       * MCP Server 仍然会作为最终参数校验方。
       */
      return true;
  }
};

const getSchemaTypeList = (schema = {}) => {
  if (Array.isArray(schema.type)) {
    return schema.type.filter(Boolean);
  }

  return schema.type ? [schema.type] : [];
};

const valuesAreEqual = (left, right) => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
};

const validateArgumentsWithSchema = (
  value,
  schema,
  path = '参数',
) => {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const errors = [];
  const schemaTypes = getSchemaTypeList(schema);

  if (
    schemaTypes.length > 0 &&
    !schemaTypes.some((type) =>
      isExpectedSchemaType(value, type),
    )
  ) {
    errors.push(
      `${path}应为 ${schemaTypes.join(
        ' 或 ',
      )}，当前是 ${getValueTypeLabel(value)}。`,
    );

    return errors;
  }

  if (
    Array.isArray(schema.enum) &&
    schema.enum.length > 0 &&
    !schema.enum.some((candidate) =>
      valuesAreEqual(candidate, value),
    )
  ) {
    errors.push(`${path}不在工具允许的选项中。`);
  }

  if (typeof value === 'string') {
    if (
      Number.isFinite(schema.minLength) &&
      value.length < schema.minLength
    ) {
      errors.push(
        `${path}至少需要 ${schema.minLength} 个字符。`,
      );
    }

    if (
      Number.isFinite(schema.maxLength) &&
      value.length > schema.maxLength
    ) {
      errors.push(
        `${path}最多只能有 ${schema.maxLength} 个字符。`,
      );
    }

    if (
      typeof schema.pattern === 'string' &&
      schema.pattern.length > 0
    ) {
      try {
        const pattern = new RegExp(schema.pattern);

        if (!pattern.test(value)) {
          errors.push(`${path}格式不符合要求。`);
        }
      } catch {
        // 无效的 pattern 交由服务端处理，不阻止本地调用。
      }
    }
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    if (
      Number.isFinite(schema.minimum) &&
      value < schema.minimum
    ) {
      errors.push(`${path}不能小于 ${schema.minimum}。`);
    }

    if (
      Number.isFinite(schema.maximum) &&
      value > schema.maximum
    ) {
      errors.push(`${path}不能大于 ${schema.maximum}。`);
    }

    if (
      Number.isFinite(schema.multipleOf) &&
      schema.multipleOf !== 0
    ) {
      const quotient = value / schema.multipleOf;

      if (!Number.isInteger(quotient)) {
        errors.push(
          `${path}必须是 ${schema.multipleOf} 的倍数。`,
        );
      }
    }
  }

  if (
    value &&
    !Array.isArray(value) &&
    typeof value === 'object'
  ) {
    const requiredKeys = Array.isArray(schema.required)
      ? schema.required
      : [];

    requiredKeys.forEach((key) => {
      if (
        !Object.prototype.hasOwnProperty.call(value, key) ||
        value[key] === undefined
      ) {
        errors.push(`${path}.${key}是必填项。`);
      }
    });

    const properties = schema.properties;

    if (properties && typeof properties === 'object') {
      Object.entries(properties).forEach(
        ([key, propertySchema]) => {
          if (
            !Object.prototype.hasOwnProperty.call(
              value,
              key,
            ) ||
            value[key] === undefined
          ) {
            return;
          }

          errors.push(
            ...validateArgumentsWithSchema(
              value[key],
              propertySchema,
              `${path}.${key}`,
            ),
          );
        },
      );
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(
        ...validateArgumentsWithSchema(
          item,
          schema.items,
          `${path}[${index}]`,
        ),
      );
    });
  }

  return errors.slice(0, 4);
};

const getSchemaValidationError = (
  tool,
  argumentsValue,
) => {
  const errors = validateArgumentsWithSchema(
    argumentsValue,
    tool?.inputSchema,
  );

  if (errors.length === 0) {
    return '';
  }

  return errors.join(' ');
};

const stringifyForDisplay = (
  value,
  fallback = '没有可显示的数据。',
) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  try {
    const text = JSON.stringify(value, null, 2);

    if (typeof text !== 'string') {
      return fallback;
    }

    if (text.length <= MAX_SCHEMA_PREVIEW_LENGTH) {
      return text;
    }

    return `${text.slice(
      0,
      MAX_SCHEMA_PREVIEW_LENGTH,
    )}\n\n… 内容过长，已截断显示。`;
  } catch {
    return '数据无法安全格式化显示。';
  }
};

export const ManualMcpToolCallModal = ({
  connection,
  tool,
  onClose,
}) => {
  const approvalResolverRef = useRef(null);
  const isMountedRef = useRef(true);

  const [argumentsText, setArgumentsText] = useState(() =>
    getInitialArgumentsText(tool),
  );
  const [argumentError, setArgumentError] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [result, setResult] = useState(null);
  const [callError, setCallError] = useState('');
  const [approvalRequest, setApprovalRequest] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (approvalResolverRef.current) {
        const resolve = approvalResolverRef.current;
        approvalResolverRef.current = null;

        resolve({
          decision: 'deny',
          scope: 'once',
        });
      }
    };
  }, []);

  useEffect(() => {
    setArgumentsText(getInitialArgumentsText(tool));
    setArgumentError('');
    setCallError('');
    setResult(null);
    setApprovalRequest(null);
  }, [tool?.id, tool?.toolName]);

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

      if (!isMountedRef.current) {
        resolve({
          decision: 'deny',
          scope: 'once',
        });
        return;
      }

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

    if (isMountedRef.current) {
      setApprovalRequest(null);
    }

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

    const schemaValidationError =
      getSchemaValidationError(tool, parsed.value);

    if (schemaValidationError) {
      setArgumentError(schemaValidationError);
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

      if (!isMountedRef.current) {
        return;
      }

      setResult(runtimeResult?.result || null);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setCallError(
        error?.message || '这项外接工具没有完成调用。',
      );
    } finally {
      if (isMountedRef.current) {
        setIsCalling(false);
      }
    }
  };

  const closeModal = () => {
    if (isCalling) {
      return;
    }

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

  const isCallDisabled =
    isCalling ||
    connection.enabled !== true ||
    tool.enabled !== true ||
    tool.isAvailable === false;

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
                {connection.name} ·{' '}
                {tool.displayName || tool.toolName}
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

            <details
              className="rounded-2xl px-3 py-2.5"
              style={{
                background: 'var(--control-soft-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <summary className="cursor-pointer list-none text-[10px] font-medium opacity-70">
                查看这项工具的定义
              </summary>

              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[9px] leading-relaxed">
                  <span className="opacity-45">
                    工具名称
                  </span>

                  <code className="break-all font-mono opacity-75">
                    {tool.toolName}
                  </code>

                  <span className="opacity-45">
                    本地状态
                  </span>

                  <span className="opacity-75">
                    {tool.enabled === true
                      ? '已允许使用'
                      : '尚未启用'}
                    {tool.isAvailable === false
                      ? '；服务最新清单中已不存在'
                      : ''}
                  </span>

                  <span className="opacity-45">
                    风险判断
                  </span>

                  <span className="opacity-75">
                    {getRiskCopy(tool.riskLevel)}
                  </span>
                </div>

                <div>
                  <p className="text-[9px] opacity-45">
                    服务声明的参数 Schema
                  </p>

                  <pre
                    className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl p-2.5 font-mono text-[9px] leading-relaxed opacity-65"
                    style={{
                      background: 'var(--card-bg-gradient)',
                      border: '1px solid var(--divider)',
                    }}
                  >
                    {stringifyForDisplay(
                      tool.inputSchema,
                      '{}',
                    )}
                  </pre>
                </div>
              </div>
            </details>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="manual-mcp-call-arguments"
                  className="block text-[10px] font-medium opacity-65"
                >
                  调用参数
                </label>

                <span className="text-[9px] opacity-40">
                  仅在确认后发送
                </span>
              </div>

              <textarea
                id="manual-mcp-call-arguments"
                value={argumentsText}
                onChange={(event) => {
                  setArgumentsText(event.target.value);
                  setArgumentError('');
                  setCallError('');
                }}
                rows={8}
                spellCheck={false}
                aria-invalid={Boolean(argumentError)}
                aria-describedby={
                  argumentError
                    ? 'manual-mcp-call-arguments-error'
                    : 'manual-mcp-call-arguments-hint'
                }
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
                <p
                  id="manual-mcp-call-arguments-error"
                  className="mt-1.5 text-[10px] leading-relaxed text-rose-500"
                >
                  {argumentError}
                </p>
              ) : (
                <p
                  id="manual-mcp-call-arguments-hint"
                  className="mt-1.5 text-[9px] leading-relaxed opacity-45"
                >
                  {parameterHint}
                </p>
              )}

              {!argumentError && (
                <details
                  className="mt-2 rounded-xl px-2.5 py-2"
                  style={{
                    background: 'var(--card-bg-gradient)',
                    border: '1px solid var(--divider)',
                  }}
                >
                  <summary className="cursor-pointer list-none text-[9px] font-medium opacity-60">
                    查看将发送到外部服务的参数
                  </summary>

                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed opacity-60">
                    {(() => {
                      const preview =
                        getArgumentError(argumentsText);

                      return preview.error
                        ? '参数尚不是有效 JSON。'
                        : stringifyForDisplay(
                            preview.value,
                            '{}',
                          );
                    })()}
                  </pre>
                </details>
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

                {Array.isArray(result.items) &&
                  result.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.items.map((item, index) => (
                        <span
                          key={`${item?.type || 'unknown'}-${index}`}
                          className="rounded-full px-2 py-1 text-[9px] opacity-60"
                          style={{
                            background:
                              'var(--card-bg-gradient)',
                            border:
                              '1px solid var(--divider)',
                          }}
                        >
                          {getResultTypeLabel(item?.type)}
                        </span>
                      ))}
                    </div>
                  )}

                {result.text !== undefined &&
                  result.text !== null && (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-[10px] leading-relaxed opacity-75">
                      {String(result.text)}
                    </pre>
                  )}

                {result.structuredContent !== undefined &&
                  result.structuredContent !== null && (
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
                        {stringifyForDisplay(
                          result.structuredContent,
                        )}
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
              disabled={isCallDisabled}
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
                {stringifyForDisplay(
                  approvalRequest.arguments,
                  '{}',
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


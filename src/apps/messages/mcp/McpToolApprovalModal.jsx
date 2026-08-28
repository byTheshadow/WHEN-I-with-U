import React from 'react';
import {
  BookOpen,
  CircleAlert,
  Eye,
  PenLine,
  ShieldCheck,
  X,
} from 'lucide-react';

const getRiskCopy = (riskLevel) => {
  switch (riskLevel) {
    case 'read':
      return {
        icon: Eye,
        label: '仅查看',
        description:
          '这项工具预计只会读取外部服务中的信息，但仍可能接触你的私人数据。',
      };

    case 'write':
      return {
        icon: PenLine,
        label: '可能改变外部内容',
        description:
          '这项工具可能在外部服务中创建、修改、发送或删除内容。',
      };

    default:
      return {
        icon: CircleAlert,
        label: '尚未判断',
        description:
          '无法确定这项工具会带来哪些外部影响，将按需要谨慎确认的操作处理。',
      };
  }
};

const getArgumentPreview = (toolArguments) => {
  if (!toolArguments || typeof toolArguments !== 'object') {
    return '';
  }

  try {
    const text = JSON.stringify(toolArguments, null, 2);

    if (text.length <= 700) {
      return text;
    }

    return `${text.slice(0, 700)}…`;
  } catch {
    return '';
  }
};

export const McpToolApprovalModal = ({
  request,
  onResolve,
}) => {
  if (!request) return null;

  const tool = request.tool || {};
  const connection = tool.connection || {};
  const risk = getRiskCopy(tool.riskLevel);
  const RiskIcon = risk.icon;

  const toolArguments = getArgumentPreview(request.arguments);

  const resolve = (decision, scope) => {
    onResolve?.({
      decision,
      scope,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 animate-fade-in-up sm:items-center">
      <button
        type="button"
        className="fixed inset-0 cursor-default bg-white/5 backdrop-blur-md dark:bg-black/5"
        onClick={() => resolve('deny', 'once')}
        aria-label="拒绝本次外接工具调用"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-approval-title"
        className="relative z-10 w-full max-w-sm space-y-4 rounded-[2rem] p-5 shadow-2xl"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'var(--control-soft-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <BookOpen className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h3
                id="mcp-approval-title"
                className="font-serif text-sm font-bold"
              >
                角色想借用一项外接工具
              </h3>

              <p className="mt-1 text-[10px] leading-relaxed opacity-55">
                这次请求会离开当前 PWA，前往你连接的外部 MCP 服务。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => resolve('deny', 'once')}
            className="rounded-full p-1 opacity-55 transition-opacity hover:opacity-100"
            aria-label="拒绝本次调用"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="space-y-2 rounded-2xl p-3"
          style={{
            background: 'var(--control-soft-bg)',
            border: '1px solid var(--divider)',
          }}
        >
          <p className="text-[10px] opacity-50">
            来自 {connection.name || '未命名连接'}
          </p>

          <p className="text-xs font-semibold">
            {tool.displayName || tool.toolName || '未命名工具'}
          </p>

          {tool.description && (
            <p className="text-[10px] leading-relaxed opacity-60">
              {tool.description}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
          <RiskIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">{risk.label}</p>
            <p className="mt-0.5 opacity-80">{risk.description}</p>
          </div>
        </div>

        {toolArguments && (
          <details
            className="rounded-2xl px-3 py-2.5"
            style={{
              background: 'var(--control-soft-bg)',
              border: '1px solid var(--divider)',
            }}
          >
            <summary className="cursor-pointer list-none text-[10px] font-medium opacity-70">
              查看本次传出的参数
            </summary>

            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-relaxed opacity-55">
              {toolArguments}
            </pre>
          </details>
        )}

        <div
          className="flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[10px] leading-relaxed opacity-60"
          style={{
            background: 'var(--control-soft-bg)',
            border: '1px solid var(--divider)',
          }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            即使选择长期允许，之后仍可以在 The Bond Connection
            中关闭连接、停用工具或修改权限类别。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => resolve('deny', 'once')}
            className="rounded-xl border px-3 py-2.5 font-medium opacity-75 transition-opacity hover:opacity-100"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)',
            }}
          >
            拒绝
          </button>

          <button
            type="button"
            onClick={() => resolve('allow', 'once')}
            className="rounded-xl bg-rose-500 px-3 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
          >
            仅本次允许
          </button>

          <button
            type="button"
            onClick={() => resolve('allow', 'chat')}
            className="rounded-xl border px-3 py-2.5 font-medium transition-opacity hover:opacity-75"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)',
            }}
          >
            此聊天中允许
          </button>

          <button
            type="button"
            onClick={() => resolve('allow', 'character')}
            className="rounded-xl border px-3 py-2.5 font-medium transition-opacity hover:opacity-75"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)',
            }}
          >
            对此角色允许
          </button>

          <button
            type="button"
            onClick={() => resolve('allow', 'global')}
            className="col-span-2 rounded-xl border px-3 py-2.5 font-medium transition-opacity hover:opacity-75"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)',
            }}
          >
            始终允许
          </button>
        </div>
      </section>
    </div>
  );
};

export default McpToolApprovalModal;

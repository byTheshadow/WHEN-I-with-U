import React, {
  useMemo,
  useState,
} from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  PlugZap,
  ShieldX,
} from 'lucide-react';

const getStatusPresentation = (status) => {
  switch (status) {
    case 'success':
      return {
        label: '已完成',
        Icon: CheckCircle2,
        className: 'text-emerald-600 dark:text-emerald-400',
      };

    case 'denied':
      return {
        label: '未获允许',
        Icon: ShieldX,
        className: 'opacity-55',
      };

    case 'tool-error':
      return {
        label: '工具返回错误',
        Icon: CircleAlert,
        className: 'text-amber-600 dark:text-amber-300',
      };

    case 'invalid-arguments':
      return {
        label: '参数未能识别',
        Icon: CircleAlert,
        className: 'text-rose-600 dark:text-rose-300',
      };

    case 'failed':
    default:
      return {
        label: '未完成',
        Icon: CircleAlert,
        className: 'text-rose-600 dark:text-rose-300',
      };
  }
};

const getItemTypeLabel = (itemTypes = []) => {
  const labels = {
    text: '文字',
    image: '图片摘要',
    audio: '音频摘要',
    resource: '资源摘要',
    unknown: '其他内容',
  };

  return itemTypes
    .map((item) => labels[item] || '')
    .filter(Boolean)
    .join('、');
};

export const McpUsageTraceCard = ({
  trace,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const calls = useMemo(
    () => (
      Array.isArray(trace?.calls)
        ? trace.calls
        : []
    ),
    [trace],
  );

  if (calls.length === 0) {
    return null;
  }

  const successCount = calls.filter(
    (call) => call.status === 'success',
  ).length;

  return (
    <section
      className="mt-2 w-full max-w-[85%] overflow-hidden rounded-2xl"
      style={{
        background: 'var(--control-soft-bg)',
        border: '1px solid var(--divider)',
        color: 'var(--text-main)',
      }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'var(--card-bg-gradient)',
            border: '1px solid var(--divider)',
          }}
        >
          <PlugZap className="h-3.5 w-3.5 opacity-65" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium">
            外接痕迹 · 借用了 {calls.length} 项能力
          </p>

          <p className="mt-0.5 truncate text-[9px] opacity-50">
            {successCount > 0
              ? `${successCount} 项已完成`
              : '本次没有完成的外接调用'}
          </p>
        </div>

        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-50" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>

      {isExpanded && (
        <div
          className="space-y-2 border-t px-3 py-2.5"
          style={{
            borderColor: 'var(--divider)',
          }}
        >
          {calls.map((call) => {
            const status = getStatusPresentation(call.status);
            const StatusIcon = status.Icon;
            const itemTypeLabel = getItemTypeLabel(call.itemTypes);

            return (
              <div
                key={call.id}
                className="flex items-start gap-2 rounded-xl p-2"
                style={{
                  background: 'var(--card-bg-gradient)',
                  border: '1px solid var(--divider)',
                }}
              >
                <StatusIcon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${status.className}`}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-medium">
                    {call.connectionName}
                  </p>

                  <p className="mt-0.5 truncate font-mono text-[9px] opacity-55">
                    {call.toolName}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[8px] opacity-45">
                    <span>{status.label}</span>

                    {itemTypeLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{itemTypeLabel}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <p className="pt-0.5 text-[8px] leading-relaxed opacity-40">
            这里只保留本次借用的名称、状态与结果类型；不会展示参数、认证信息或外部服务的原始内容。
          </p>
        </div>
      )}
    </section>
  );
};

export default McpUsageTraceCard;

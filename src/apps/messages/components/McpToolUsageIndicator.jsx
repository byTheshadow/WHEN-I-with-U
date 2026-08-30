import React from 'react';
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  PlugZap,
  ShieldX,
} from 'lucide-react';

const getStatusCopy = (status) => {
  switch (status) {
    case 'success':
      return {
        label: '已完成',
        Icon: CheckCircle2,
      };

    case 'tool-error':
      return {
        label: '工具未完成',
        Icon: CircleAlert,
      };

    case 'denied':
      return {
        label: '未获允许',
        Icon: ShieldX,
      };

    case 'failed':
    case 'invalid-arguments':
      return {
        label: '未完成',
        Icon: CircleAlert,
      };

    case 'calling':
    default:
      return {
        label: '正在借用',
        Icon: LoaderCircle,
      };
  }
};

export const McpToolUsageIndicator = ({
  trace = null,
}) => {
  const calls = Array.isArray(trace?.calls)
    ? trace.calls
    : [];

  if (calls.length === 0) {
    return null;
  }

  const activeCall =
    [...calls].reverse().find(
      (call) => call.status === 'calling',
    ) || calls[calls.length - 1];

  const completedCount = calls.filter(
    (call) =>
      call.status === 'success' ||
      call.status === 'tool-error' ||
      call.status === 'denied' ||
      call.status === 'failed' ||
      call.status === 'invalid-arguments',
  ).length;

  const status = getStatusCopy(activeCall.status);
  const StatusIcon = status.Icon;

  const title = activeCall.status === 'calling'
    ? `正在借用「${activeCall.connectionName}」`
    : `外接能力已完成 ${completedCount} 项`;

  const detail = activeCall.status === 'calling'
    ? activeCall.toolLabel
    : calls.length > 1
      ? `本次回复已借用 ${calls.length} 项能力`
      : `${activeCall.connectionName} · ${activeCall.toolLabel}`;

  return (
    <div
      className="mb-2 flex max-w-[85%] items-center gap-2 rounded-2xl px-3 py-2 text-[10px]"
      style={{
        background: 'var(--control-soft-bg)',
        border: '1px solid var(--divider)',
        color: 'var(--text-main)',
      }}
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--divider)',
        }}
      >
        {activeCall.status === 'calling' ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin opacity-70" />
        ) : (
          <PlugZap className="h-3.5 w-3.5 opacity-65" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[9px] opacity-50">
          {detail}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 text-[9px] opacity-50">
        <StatusIcon
          className={`h-3 w-3 ${
            activeCall.status === 'calling'
              ? 'animate-spin'
              : ''
          }`}
        />
        {status.label}
      </div>
    </div>
  );
};

export default McpToolUsageIndicator;

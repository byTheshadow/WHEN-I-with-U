import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import Dexie from 'dexie';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  ShieldX,
} from 'lucide-react';

import db from '../../../db';

const POLL_INTERVAL_MS = 15_000;
const DEFAULT_LIMIT = 8;

const getStatusCopy = (status) => {
  switch (status) {
    case 'success':
      return {
        label: '已完成',
        Icon: CheckCircle2,
        className: 'text-emerald-600 dark:text-emerald-400',
      };

    case 'calling':
      return {
        label: '正在调用',
        Icon: LoaderCircle,
        className: 'text-amber-600 dark:text-amber-400',
        spinning: true,
      };

    case 'denied':
      return {
        label: '未被允许',
        Icon: ShieldX,
        className: 'text-[var(--text-muted)] opacity-70',
      };

    case 'tool-error':
      return {
        label: '工具返回错误',
        Icon: CircleAlert,
        className: 'text-rose-600 dark:text-rose-300',
      };

    case 'failed':
      return {
        label: '调用未完成',
        Icon: CircleAlert,
        className: 'text-rose-600 dark:text-rose-300',
      };

    case 'invalid-arguments':
      return {
        label: '参数未能识别',
        Icon: CircleAlert,
        className: 'text-rose-600 dark:text-rose-300',
      };

    default:
      return {
        label: '留下了一次记录',
        Icon: Clock3,
        className: 'opacity-60',
      };
  }
};

const getSourceLabel = (source) => {
  switch (source) {
    case 'manual':
      return '手动试用';

    case 'automation':
      return '自动化';

    case 'executor':
      return '外部执行器';

    case 'bridge':
      return 'Bridge';

    case 'chat':
    default:
      return '角色对话';
  }
};

const formatActivityTime = (value) => {
  if (!value) return '刚刚';

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return '时间未知';
  }

  const difference = Date.now() - timestamp;

  if (difference < 60_000) {
    return '刚刚';
  }

  if (difference < 3_600_000) {
    return `${Math.max(1, Math.floor(difference / 60_000))} 分钟前`;
  }

  if (difference < 86_400_000) {
    return `${Math.max(1, Math.floor(difference / 3_600_000))} 小时前`;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const loadActivitiesForConnection = async (
  connectionId,
  limit,
) => {
  if (!connectionId || !db.mcpActivities) {
    return [];
  }

  return db.mcpActivities
    .where('[connectionId+createdAt]')
    .between(
      [connectionId, Dexie.minKey],
      [connectionId, Dexie.maxKey],
      true,
      true,
    )
    .reverse()
    .limit(limit)
    .toArray();
};

export const McpActivityTrace = ({
  connectionId,
  limit = DEFAULT_LIMIT,
}) => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshActivities = useCallback(async () => {
    if (!connectionId) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    try {
      const nextActivities = await loadActivitiesForConnection(
        connectionId,
        limit,
      );

      setActivities(nextActivities);
    } catch (error) {
      console.warn('[MCP] 无法读取活动痕迹：', error);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, limit]);

  useEffect(() => {
    let isActive = true;

    const refresh = async () => {
      if (!isActive) return;
      await refreshActivities();
    };

    void refresh();

    const intervalId = window.setInterval(
      refresh,
      POLL_INTERVAL_MS,
    );

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [refreshActivities]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium opacity-50">
          最近留下的痕迹
        </p>

        <span className="text-[9px] opacity-40">
          仅保留调用状态
        </span>
      </div>

      {isLoading ? (
        <div
          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[10px] opacity-45"
          style={{
            background: 'var(--card-bg-gradient)',
            border: '1px solid var(--divider)',
          }}
        >
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          正在查看…
        </div>
      ) : activities.length === 0 ? (
        <div
          className="rounded-xl px-2.5 py-2 text-[10px] leading-relaxed opacity-45"
          style={{
            background: 'var(--card-bg-gradient)',
            border: '1px solid var(--divider)',
          }}
        >
          这条连接还没有留下调用痕迹。
        </div>
      ) : (
        <div
          className="divide-y overflow-hidden rounded-2xl"
          style={{
            background: 'var(--card-bg-gradient)',
            border: '1px solid var(--divider)',
            borderColor: 'var(--divider)',
          }}
        >
          {activities.map((activity) => {
            const status = getStatusCopy(activity.status);
            const StatusIcon = status.Icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-2 px-3 py-2.5"
                style={{
                  borderColor: 'var(--divider)',
                }}
              >
                <StatusIcon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${status.className} ${
                    status.spinning ? 'animate-spin' : ''
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="truncate text-[10px] font-medium">
                      {activity.toolName || '未命名工具'}
                    </p>

                    <time className="shrink-0 text-[9px] opacity-40">
                      {formatActivityTime(activity.createdAt)}
                    </time>
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] opacity-50">
                    <span>{getSourceLabel(activity.source)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{status.label}</span>

                    {activity.errorCode && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">
                          {activity.errorCode}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default McpActivityTrace;

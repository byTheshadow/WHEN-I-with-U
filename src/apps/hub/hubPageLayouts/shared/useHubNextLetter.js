// src/apps/hub/hubPageLayouts/shared/useHubNextLetter.js
//
// 「下一封定时消息」：从已启用的定时工作流里算出下一次最先触发的那一条。
// 工作流列表复用 useHubWorkflows（liveQuery 订阅），触发时间的计算复用
// widgets/nextWorkflowRun.js 里的 getNearestUpcomingWorkflow，和首页
// 「定时消息倒计时」小组件是同一套规则。每分钟重新算一次下一次是哪条。

import { useEffect, useMemo, useState } from 'react';
import { useHubWorkflows } from '../../useHubWorkflows';
import { getNearestUpcomingWorkflow } from '../../widgets/nextWorkflowRun';

const pad2 = (value) => String(value).padStart(2, '0');

// 剩余时间的时钟文字：不到 100 小时用 HH:MM:SS，更久用「N 天 HH:MM」。
export const formatRemainingClock = (target, now = Date.now()) => {
  const ms = target.getTime() - now;
  if (ms <= 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours >= 100) {
    const days = Math.floor(hours / 24);
    return `${days} 天 ${pad2(hours % 24)}:${pad2(minutes)}`;
  }
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
};

// 触发时刻本身（HH:MM），漂流版式的小物件直接显示这个。
export const formatOccurrenceTime = (occurrence) =>
  `${pad2(occurrence.getHours())}:${pad2(occurrence.getMinutes())}`;

export const useHubNextLetter = () => {
  const { ready, workflows } = useHubWorkflows();
  const [minuteTick, setMinuteTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setMinuteTick((value) => value + 1), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hasEnabled = workflows.some((workflow) => workflow.enabled);

  const nearest = useMemo(
    () =>
      getNearestUpcomingWorkflow(
        workflows.filter((workflow) => workflow.enabled),
        new Date()
      ),
    // minuteTick 只是为了每分钟重新算一次，不参与计算本身。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workflows, minuteTick]
  );

  return {
    ready,
    hasEnabled,
    nearest,
    occurrence: nearest ? nearest.occurrence : null,
    characterName: nearest?.workflow?.character?.name || '',
  };
};

export default useHubNextLetter;

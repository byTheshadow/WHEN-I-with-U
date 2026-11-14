// src/apps/characterArea/characterTaskSchedule.js
//
// 角色自我任务——时间计算（切片 D1）。纯函数，不碰数据库。所有"几点"都按设备本地时间。
import { TASK_KINDS } from './characterTaskParse';

// 任务到点时 App 没开：下次打开时，如果已经错过超过这个时间，就不再补跑。
export const MISSED_GRACE_MS = 3 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

// 严格晚于 now 的下一个 HH:MM。
export const nextDailyOccurrence = (timeOfDay, now = new Date()) => {
  const [hours, minutes] = String(timeOfDay).split(':').map(Number);

  const next = new Date(now.getTime());
  next.setHours(hours, minutes, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
};

// 新布置的任务第一次什么时候该执行（ISO 字符串）。
export const computeFirstTriggerAt = (task, now = new Date()) => {
  if (task.kind === TASK_KINDS.ONCE) {
    return new Date(now.getTime() + task.delayMinutes * MINUTE_MS).toISOString();
  }

  if (task.kind === TASK_KINDS.DAILY) {
    return nextDailyOccurrence(task.timeOfDay, now).toISOString();
  }

  return new Date(now.getTime() + task.intervalMinutes * MINUTE_MS).toISOString();
};

// 重复任务执行（或被判定错过）之后，下一次什么时候执行。一次性任务没有下一次，返回 null。
export const computeNextTriggerAt = (storedTask, now = new Date()) => {
  if (storedTask.triggerKind === TASK_KINDS.DAILY) {
    return nextDailyOccurrence(storedTask.timeOfDay, now).toISOString();
  }

  if (storedTask.triggerKind === TASK_KINDS.INTERVAL) {
    return new Date(now.getTime() + storedTask.intervalMinutes * MINUTE_MS).toISOString();
  }

  return null;
};

// 到点已经过去多久，超过宽限就算错过。
export const isMissed = (storedTask, nowMs = Date.now()) => {
  const triggerMs = Date.parse(storedTask.triggerAt);
  if (!Number.isFinite(triggerMs)) return false;
  return nowMs - triggerMs > MISSED_GRACE_MS;
};

export const describeTaskSchedule = (storedTask) => {
  if (storedTask.triggerKind === TASK_KINDS.DAILY) return `每天 ${storedTask.timeOfDay}`;
  if (storedTask.triggerKind === TASK_KINDS.INTERVAL) {
    const minutes = storedTask.intervalMinutes;
    return minutes % 60 === 0 ? `每隔 ${minutes / 60} 小时` : `每隔 ${minutes} 分钟`;
  }
  return '一次性';
};
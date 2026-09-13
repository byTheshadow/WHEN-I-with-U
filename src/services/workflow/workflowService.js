import db from '../../db';

const nowIso = () => new Date().toISOString();
const normalizeText = (value) => String(value || '').trim();

const normalizeTime = (value) => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

export const getWorkflowsForChat = async (chatId) => {
  if (!chatId) return [];
  return db.workflows.where('chatId').equals(chatId).sortBy('id');
};

export const createWorkflow = async ({
  chatId,
  characterId,
  name = '',
  time,
  weekdays = [0, 1, 2, 3, 4, 5, 6],
  goal = '',
  enabled = true
}) => {
  const normalizedTime = normalizeTime(time);

  if (!chatId || !characterId || !normalizedTime) {
    throw new Error('缺少必要的工作流参数（聊天、角色或时间）。');
  }

  const timestamp = nowIso();

  const id = await db.workflows.add({
    chatId,
    characterId,
    name: normalizeText(name) || '未命名工作流',
    time: normalizedTime,
    weekdays: Array.isArray(weekdays) && weekdays.length > 0
      ? weekdays
      : [0, 1, 2, 3, 4, 5, 6],
    goal: normalizeText(goal),
    enabled: Boolean(enabled),
    lastRunDate: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return db.workflows.get(id);
};

export const updateWorkflow = async (id, patch = {}) => {
  const existing = await db.workflows.get(id);
  if (!existing) throw new Error('未找到需要更新的工作流。');

  const next = { ...existing, ...patch, updatedAt: nowIso() };

  if (patch.time !== undefined) {
    const normalizedTime = normalizeTime(patch.time);
    if (!normalizedTime) throw new Error('时间格式无效，请使用 HH:mm。');
    next.time = normalizedTime;
  }

  await db.workflows.put(next);
  return next;
};

export const deleteWorkflow = async (id) => {
  await db.workflows.delete(id);
};

export const setWorkflowEnabled = async (id, enabled) => {
  await db.workflows.update(id, { enabled: Boolean(enabled), updatedAt: nowIso() });
};

/**
 * 找出此刻应该触发的工作流：今天允许的星期 + 当前本地时间已到 +
 * 今天还没跑过。失败也会标记今天跑过，不做当天重试。
 */
export const getDueWorkflows = async () => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentWeekday = now.getDay();

  const allWorkflows = await db.workflows.toArray();

  return allWorkflows.filter((workflow) => {
    if (!workflow.enabled) return false;
    if (workflow.lastRunDate === todayKey) return false;

    if (
      !Array.isArray(workflow.weekdays) ||
      !workflow.weekdays.includes(currentWeekday)
    ) {
      return false;
    }

    const [hourStr, minuteStr] = String(workflow.time || '').split(':');
    const targetMinutes = Number(hourStr) * 60 + Number(minuteStr);

    if (!Number.isFinite(targetMinutes)) return false;

    return currentMinutes >= targetMinutes;
  });
};

export const markWorkflowRun = async (id, { success = true } = {}) => {
  const now = new Date();

  await db.workflows.update(id, {
    lastRunDate: now.toISOString().slice(0, 10),
    lastRunAt: now.toISOString(),
    lastRunStatus: success ? 'sent' : 'error',
    updatedAt: now.toISOString()
  });
};
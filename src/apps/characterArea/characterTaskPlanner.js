// src/apps/characterArea/characterTaskPlanner.js
//
// 角色自我任务——"布置任务"这一半（切片 D1）：
//   - buildTaskPromptSection：拼进"整理"那次单独AI调用提示词里的任务说明（现在安排着
//     哪几件、还剩几个名额、能用哪些只读工具、输出格式）。
//   - applyTaskOutput：把AI输出里的 [TASK] / [TASK_DELETE] 落库，并强制每个聊天最多
//     同时 3 件没做完的任务。
//
// 任务由角色自己决定内容和时间，用户不在这里干预；用户查看/暂停/删除在切片 E 的面板里做。
// "没做完的任务"= 待执行 + 暂停 + 正在执行，一次性任务做完或错过后释放名额。
import db from '../../db';
import { getEnabledMcpTools } from '../../services/mcp/mcpConnectionService';
import { filterToolsForTask } from './characterTaskToolFilter';
import { MAX_ACTIVE_TASKS, parseTaskOutput } from './characterTaskParse';
import { computeFirstTriggerAt, describeTaskSchedule } from './characterTaskSchedule';

export const TASKS_UPDATED_EVENT = 'character-tasks-updated';

export const ACTIVE_TASK_STATUSES = ['pending', 'paused', 'running'];

const MAX_TOOL_NAMES_IN_PROMPT = 8;

const dispatchTasksUpdated = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASKS_UPDATED_EVENT, { detail: { chatId } }));
};

export const getActiveTasks = async (chatId) => {
  if (!chatId) return [];

  const rows = await db.characterTasks.where('chatId').equals(chatId).toArray();

  return rows
    .filter((task) => ACTIVE_TASK_STATUSES.includes(task.status))
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
};

const listAvailableToolNames = async (chatId, character) => {
  try {
    const enabled = await getEnabledMcpTools();
    const usable = await filterToolsForTask(enabled, { chatId, characterId: character.id });

    return usable
      .slice(0, MAX_TOOL_NAMES_IN_PROMPT)
      .map((tool) => tool.displayName || tool.toolName)
      .filter(Boolean);
  } catch (error) {
    console.warn('[characterTask] 读取可用工具失败，按没有工具处理：', error);
    return [];
  }
};

const describeTask = (task) => {
  const flags = [describeTaskSchedule(task)];
  if (task.needsTools) flags.push('需要查外部信息');
  if (task.status === 'paused') flags.push('已被暂停');
  return `编号${task.id}：${task.content}（${flags.join('，')}）`;
};

// 返回追加在"整理"提示词末尾的一段文字（以换行开头）。
export const buildTaskPromptSection = async ({ chatId, character }) => {
  const [active, toolNames] = await Promise.all([
    getActiveTasks(chatId),
    listAvailableToolNames(chatId, character),
  ]);

  const slots = Math.max(0, MAX_ACTIVE_TASKS - active.length);

  const nowText = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const activeText = active.length ? active.map(describeTask).join('\n') : '（目前一件都没有）';

  const toolText = toolNames.length
    ? `你可以让自己去用这些只读工具查信息：${toolNames.join('、')}。`
    : '目前没有任何可用的外部工具，所以不要安排需要查外部信息的事。';

  return `

【另外：你也可以给自己布置"要去做的事"】
你可以给自己安排一件到时间要去做的事（比如每天早上看看用户那边的天气，晚上提醒用户早点休息）。到点时你会自己去做，并像平时聊天一样把结果告诉用户。这是你自己想做的事，不是用户要求的。
现在的时间：${nowText}
你现在安排着的事：
${activeText}
同时最多只能有 ${MAX_ACTIVE_TASKS} 件还没做完的事，目前还能再安排 ${slots} 件。想多安排，就得先取消一件旧的。
${toolText}

要安排新的事，在上面的条目之外，另起一段，格式：
[TASK]
内容：（一句话写清楚你要去做什么，不超过40个字）
类型：（一次 / 每天 / 每隔，三选一）
时间：（类型是"一次"：多少分钟之后，写整数；是"每天"：几点，24小时制，如 08:30；是"每隔"：每隔多少分钟，写整数，至少60）
需要工具：（是 / 否。要去查天气、搜索之类的外部信息才写"是"）
[/TASK]
要取消某件旧的事，单独写一行：[TASK_DELETE: 编号]（编号就是上面列表里的数字）

大多数时候不需要安排或取消任何事，没想法就什么都不写。
输出规则补充：条目和任务可以只出现其中一种。如果这次只想安排任务、没有想写的条目，就只输出任务相关内容，不要写 [NO_ACTION]；只有条目和任务都没有时，才只输出 [NO_ACTION]。`;
};

// 把AI输出里的任务落库。返回 { applied, added, deleted }，applied 为 0 表示没有任何任务相关改动。
export const applyTaskOutput = async ({ chatId, character, rawText }) => {
  const { tasks, deleteIds } = parseTaskOutput(rawText);

  if (tasks.length === 0 && deleteIds.length === 0) return { applied: 0, added: 0, deleted: 0 };

  let active = await getActiveTasks(chatId);

  const activeIds = new Set(active.map((task) => task.id));
  const idsToDelete = deleteIds.filter((id) => activeIds.has(id));

  if (idsToDelete.length > 0) {
    await db.characterTasks.bulkDelete(idsToDelete);
    active = active.filter((task) => !idsToDelete.includes(task.id));
  }

  const knownContents = new Set(active.map((task) => String(task.content).trim()));
  const slots = Math.max(0, MAX_ACTIVE_TASKS - active.length);
  const now = new Date();

  const accepted = [];

  for (const task of tasks) {
    if (accepted.length >= slots) break;
    if (knownContents.has(task.content)) continue;

    knownContents.add(task.content);
    accepted.push(task);
  }

  const rows = accepted.map((task, index) => ({
    chatId,
    characterId: character.id,
    content: task.content,
    triggerKind: task.kind,
    triggerAt: computeFirstTriggerAt(task, now),
    timeOfDay: task.timeOfDay || null,
    intervalMinutes: task.intervalMinutes || null,
    needsTools: task.needsTools === true,
    status: 'pending',
    lastRunAt: null,
    lastResultSummary: '',
    failCount: 0,
    failReason: '',
    cloudSynced: false,
    createdAt: new Date(now.getTime() + index).toISOString(),
  }));

  if (rows.length > 0) await db.characterTasks.bulkAdd(rows);

  const applied = rows.length + idsToDelete.length;
  if (applied > 0) dispatchTasksUpdated(chatId);

  return { applied, added: rows.length, deleted: idsToDelete.length };
};
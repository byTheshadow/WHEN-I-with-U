// src/apps/focus/focusTodoLink.js
//
// 心流和待办（db.todos）的联动：
// - 设置页第二屏给出任务建议：今天到期和已逾期的未完成待办优先，不够再补其他未完成的，最多 5 条。
// - 点选一条建议，把标题填进任务名（仍可修改），并记下这条待办的 id；开始专注时写到专注记录的 todoId 上。
// - 结束后（完成或提前结束，放弃不问）问一句，用户点了才把待办标记完成。
// 这个文件只读写 todos 的 isCompleted，不改待办的其他任何字段。
//
// 待办字段：id, title, dueDate（本地时间字符串，可能为空）, priority, category,
//          characterId（关联的角色，可能为空）, isCompleted, createdAt

import db from '../../db';

export const MAX_TODO_SUGGESTIONS = 5;

const isDone = (todo) => todo?.isCompleted === true || todo?.isCompleted === 1;

const toTime = (value) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

const endOfDay = (now) => {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const startOfDay = (now) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * 纯函数：从待办里挑建议。
 * 先挑"今天到期或已逾期"的（按到期时间从早到晚），不够再从其余未完成的里补
 * （有到期时间的在前，没有的在后）。返回的每一项带 due 标记：'overdue' | 'today' | 'later' | 'none'。
 */
export const pickTodoSuggestions = (
  todos,
  characters = [],
  now = Date.now(),
  limit = MAX_TODO_SUGGESTIONS,
) => {
  const nameById = new Map((characters || []).map((c) => [c.id, String(c.name || '')]));
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const open = (Array.isArray(todos) ? todos : []).filter(
    (todo) => !isDone(todo) && String(todo?.title || '').trim(),
  );

  const decorate = (todo) => {
    const due = toTime(todo.dueDate);
    let tag = 'none';
    if (due !== null) {
      if (due < dayStart) tag = 'overdue';
      else if (due <= dayEnd) tag = 'today';
      else tag = 'later';
    }
    return {
      id: todo.id,
      title: String(todo.title).trim(),
      dueDate: todo.dueDate || '',
      due: tag,
      dueTime: due,
      characterId: todo.characterId ?? null,
      characterName: todo.characterId != null ? nameById.get(todo.characterId) || '' : '',
    };
  };

  const all = open.map(decorate);
  const byDue = (a, b) => (a.dueTime ?? Infinity) - (b.dueTime ?? Infinity);

  const first = all.filter((item) => item.due === 'overdue' || item.due === 'today').sort(byDue);
  const rest = all.filter((item) => item.due === 'later' || item.due === 'none').sort(byDue);

  return [...first, ...rest].slice(0, Math.max(0, limit));
};

export const loadFocusTodoSuggestions = async (now = Date.now()) => {
  try {
    const [todos, characters] = await Promise.all([db.todos.toArray(), db.characters.toArray()]);
    return pickTodoSuggestions(todos, characters, now);
  } catch (error) {
    console.warn('[focus] 读取待办建议失败:', error);
    return [];
  }
};

/* ---------- 选中的待办：只在页面内存里暂存，开始专注时才写进专注记录 ---------- */

let pendingTodoId = null;

export const setPendingFocusTodo = (todoId) => {
  pendingTodoId = todoId ?? null;
};

export const clearPendingFocusTodo = () => {
  pendingTodoId = null;
};

/**
 * 开始专注后调用：把选中的待办 id 记到这次专注上，然后清掉暂存。
 * 任务名被清空就不再算关联。永远不会抛错，调用方不用 await。
 */
export const linkFocusSessionTodo = async (sessionId, task) => {
  const todoId = pendingTodoId;
  pendingTodoId = null;

  try {
    if (todoId === null || sessionId === undefined || sessionId === null) return false;
    if (!String(task || '').trim()) return false;

    await db.focusSessions.update(sessionId, { todoId });
    return true;
  } catch (error) {
    console.warn('[focus] 记录关联待办失败:', error);
    return false;
  }
};

/** 结束页用：这次专注关联的、还没完成的待办。放弃的不问，所以放弃返回 null。 */
export const getTodoToConfirm = async (session) => {
  try {
    if (!session || session.todoId === undefined || session.todoId === null) return null;
    if (session.status !== 'completed') return null;

    const todo = await db.todos.get(session.todoId);
    if (!todo || isDone(todo)) return null;

    return { id: todo.id, title: String(todo.title || '') };
  } catch (error) {
    console.warn('[focus] 读取关联待办失败:', error);
    return null;
  }
};

/** 用户点了"标记完成"才调用。只改 isCompleted。 */
export const markTodoCompleted = async (todoId) => {
  await db.todos.update(todoId, { isCompleted: true });
};
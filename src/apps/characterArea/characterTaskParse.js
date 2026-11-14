// src/apps/characterArea/characterTaskParse.js
//
// 角色自我任务——"整理"那次单独AI调用里，任务相关输出的解析（切片 D1）。纯函数，
// 不碰数据库。任务块和条目块（[ENTRY]）出现在同一次输出里，互不干扰：
//
//   [TASK]
//   内容：...
//   类型：一次 / 每天 / 每隔
//   时间：一次=多少分钟之后（整数）；每天=几点（24小时制，如 08:30）；每隔=每隔多少分钟（整数）
//   需要工具：是 / 否
//   [/TASK]
//
//   [TASK_DELETE: 12]        取消编号为 12 的旧任务
//
// 解析尽量宽松（全角冒号、"8点半以外的 8点/08:30"、"每天/每日" 都认），但字段不合法的
// 任务块整块丢弃，不拿默认值编造。

const EMOJI_RE = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;

// 每个聊天同时最多几件没做完的任务（待执行 + 暂停 + 正在执行）。
export const MAX_ACTIVE_TASKS = 3;

export const TASK_KINDS = {
  ONCE: 'once',
  DAILY: 'daily',
  INTERVAL: 'interval',
};

const MAX_CONTENT_LENGTH = 60;
const MIN_CONTENT_LENGTH = 2;

const ONCE_MIN_MINUTES = 5;
const ONCE_MAX_MINUTES = 7 * 24 * 60;
const INTERVAL_MIN_MINUTES = 60;
const INTERVAL_MAX_MINUTES = 7 * 24 * 60;

const cleanLine = (value) =>
  String(value || '')
    .replace(EMOJI_RE, '')
    .replace(/^[\s"'「」『』“”]+|[\s"'「」『』“”]+$/g, '')
    .trim();

const readField = (body, label) => {
  const match = body.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]*)`));
  return match ? match[1].trim() : '';
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseKind = (rawValue) => {
  const text = String(rawValue || '');
  if (/每天|每日|daily/i.test(text)) return TASK_KINDS.DAILY;
  if (/每隔|间隔|interval/i.test(text)) return TASK_KINDS.INTERVAL;
  if (/一次|单次|once/i.test(text)) return TASK_KINDS.ONCE;
  return null;
};

// "08:30" / "8:30" / "8点" / "8点30" / "20点半"
export const parseTimeOfDay = (rawValue) => {
  const text = String(rawValue || '');
  const match = text.match(/(\d{1,2})\s*(?:[:：点时])\s*(\d{1,2})?/);
  if (!match) return null;

  const hours = Number(match[1]);
  let minutes = match[2] === undefined ? 0 : Number(match[2]);

  if (match[2] === undefined && /半/.test(text.slice(match.index + match[0].length - 1))) {
    minutes = 30;
  }

  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
};

const parseMinutes = (rawValue) => {
  const match = String(rawValue || '').match(/\d+/);
  if (!match) return null;

  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const parseTaskBlock = (block) => {
  const content = cleanLine(readField(block, '内容')).slice(0, MAX_CONTENT_LENGTH);
  if (content.length < MIN_CONTENT_LENGTH) return null;

  const kind = parseKind(readField(block, '类型'));
  if (!kind) return null;

  const timeText = readField(block, '时间');
  const needsTools = /是|需要|true|yes/i.test(readField(block, '需要工具'));

  if (kind === TASK_KINDS.DAILY) {
    const timeOfDay = parseTimeOfDay(timeText);
    if (!timeOfDay) return null;
    return { content, kind, timeOfDay, needsTools };
  }

  const minutes = parseMinutes(timeText);
  if (!minutes) return null;

  if (kind === TASK_KINDS.ONCE) {
    return {
      content,
      kind,
      delayMinutes: clamp(minutes, ONCE_MIN_MINUTES, ONCE_MAX_MINUTES),
      needsTools,
    };
  }

  return {
    content,
    kind,
    intervalMinutes: clamp(minutes, INTERVAL_MIN_MINUTES, INTERVAL_MAX_MINUTES),
    needsTools,
  };
};

// 返回 { tasks: [...], deleteIds: [数字...] }。没有任何任务相关输出时两个数组都是空的。
export const parseTaskOutput = (rawText) => {
  const text = String(rawText || '');

  const tasks = [];
  const blockPattern = /\[TASK\]([\s\S]*?)(?=\[\/TASK\]|\[TASK\]|\[TASK_DELETE|\[ENTRY\]|$)/gi;
  let match = blockPattern.exec(text);

  while (match) {
    const task = parseTaskBlock(match[1]);
    if (task) tasks.push(task);
    match = blockPattern.exec(text);
  }

  const deleteIds = [];
  const deletePattern = /\[TASK_DELETE:\s*#?(\d+)\s*\]/gi;
  let deleteMatch = deletePattern.exec(text);

  while (deleteMatch) {
    const id = Number(deleteMatch[1]);
    if (Number.isInteger(id) && !deleteIds.includes(id)) deleteIds.push(id);
    deleteMatch = deletePattern.exec(text);
  }

  return { tasks, deleteIds };
};
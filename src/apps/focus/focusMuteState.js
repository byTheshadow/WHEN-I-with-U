// src/apps/focus/focusMuteState.js
//
// 专注静音状态的纯计算。思路和 apps/messages/away/awayState.js 一致：
// 所有函数只依赖聊天窗（chat 记录）上的字段和当前时间，不读写数据库、
// 不启动定时器、不订阅事件，可以放心地在任何调度器里频繁同步调用。
//
// chat 记录上相关的字段（都是新增的可选字段，不需要升级数据库版本）：
//   focusMuteUntil   ISO 字符串，静音持续到什么时候（专注结束时间加缓冲）；没有专注时为空
//   focusEndsAt      ISO 字符串，这一次专注计划结束（或提前结束）的时刻
//   focusStartedAt   ISO 字符串，这一次专注开始的时刻
//   focusTaskName    这一次专注的任务名
//   focusPlace       这一次专注的地点标签
//   focusSessionId   对应 focusSessions 表里的记录 id
//
// 静音分两段：
//   专注中   现在 < focusEndsAt          不主动打扰，普通回复里会带上专注状态说明
//   缓冲期   focusEndsAt <= 现在 < focusMuteUntil
//                                         仍然不主动打扰（避免专注一结束，被静音的东西一口气全弹出来），
//                                         但普通回复里不再带专注状态说明
// 到了 focusMuteUntil 自动解除，不需要任何定时器，应用被关掉也一样。

export const FOCUS_MUTE_BUFFER_MINUTES = 10;

const MINUTE_MS = 60 * 1000;

const NOT_MUTED = Object.freeze({
  muted: false,
  focusing: false,
  until: null,
  endsAt: null,
  startedAt: null,
  task: '',
  place: '',
  sessionId: null,
});

const toDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * 这个聊天窗现在是不是被专注静音。
 * 返回 { muted, focusing, until, endsAt, startedAt, task, place, sessionId }。
 * until 是静音解除的时刻（Date）。
 */
export const getFocusMuteState = (chat, now = new Date()) => {
  const until = toDate(chat?.focusMuteUntil);

  if (!until || until.getTime() <= now.getTime()) return NOT_MUTED;

  const endsAt = toDate(chat.focusEndsAt);
  const startedAt = toDate(chat.focusStartedAt);

  return {
    muted: true,
    focusing: Boolean(endsAt && endsAt.getTime() > now.getTime()),
    until,
    endsAt,
    startedAt,
    task: String(chat.focusTaskName || ''),
    place: String(chat.focusPlace || ''),
    sessionId: chat.focusSessionId ?? null,
  };
};

export const isFocusMuted = (chat, now = new Date()) => getFocusMuteState(chat, now).muted;

/**
 * 专注开始时，写到被通知聊天窗上的字段。
 * 静音解除时刻 = 计划结束时刻 + 缓冲。
 */
export const buildFocusMuteFields = ({
  sessionId,
  task = '',
  place = '',
  startedAt,
  endsAt,
  bufferMinutes = FOCUS_MUTE_BUFFER_MINUTES,
}) => {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  const until = new Date(end.getTime() + bufferMinutes * MINUTE_MS);

  return {
    focusSessionId: sessionId,
    focusTaskName: String(task || ''),
    focusPlace: String(place || ''),
    focusStartedAt: start.toISOString(),
    focusEndsAt: end.toISOString(),
    focusMuteUntil: until.toISOString(),
  };
};

/**
 * 提前结束（放弃）时，改写被通知聊天窗上的结束字段：
 * 专注在 endedAt 这一刻结束，缓冲从这一刻开始算。
 */
export const buildFocusEndFields = ({
  endedAt = new Date(),
  bufferMinutes = FOCUS_MUTE_BUFFER_MINUTES,
}) => {
  const end = endedAt instanceof Date ? endedAt : new Date(endedAt);
  const until = new Date(end.getTime() + bufferMinutes * MINUTE_MS);

  return {
    focusEndsAt: end.toISOString(),
    focusMuteUntil: until.toISOString(),
  };
};
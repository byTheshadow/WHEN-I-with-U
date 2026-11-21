// src/apps/focus/focusSessionService.js
//
// 专注记录的存取，以及专注开始、结束时对被通知聊天窗静音字段的读写。
// 不新增定时器：专注是否还在进行，永远是拿"现在的时间"和记录上的计划结束时间比出来的。
//
// focusSessions 表（db.version(115)）：
//   id, status, startedAt, dayKey 是索引字段，其余是不建索引的普通字段：
//   task, place, durationMinutes, plannedEndAt, endedAt, chatIds[], restEnabled,
//   abandonReason, bufferMinutes, actualMinutes, recordedToChat

import db from '../../db';
import {
  FOCUS_MUTE_BUFFER_MINUTES,
  buildFocusMuteFields,
  buildFocusEndFields,
} from './focusMuteState';

export const FOCUS_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
});

export const FOCUS_PLACES_KEY = 'focusPlaces';
export const DEFAULT_FOCUS_PLACES = ['家', '图书馆', '自习室', '咖啡店'];
const MAX_FOCUS_PLACES = 12;
const MAX_PLACE_LENGTH = 12;

const MINUTE_MS = 60 * 1000;

const pad = (value) => String(value).padStart(2, '0');

// 本地时区的 YYYY-MM-DD，日历按这个归到某一天。
export const toDayKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const uniqueChatIds = (chatIds) => {
  const out = [];

  (Array.isArray(chatIds) ? chatIds : []).forEach((raw) => {
    const id = Number(raw);

    if (Number.isFinite(id) && !out.includes(id)) out.push(id);
  });

  return out;
};

export const getRunningFocusSession = async () => {
  const rows = await db.focusSessions.where('status').equals(FOCUS_STATUS.RUNNING).toArray();

  return rows.length ? rows[rows.length - 1] : null;
};

/**
 * 把"计划结束时间已经过了、却还停在进行中"的记录结算成已完成。
 * 用户切出 App、锁屏、关掉页面都不算中断，只有自己点放弃才算，所以时间到了就是完成。
 * 这里只改记录本身，不动聊天窗上的静音字段（它们到点已经自己解除了）。
 * 返回刚结算掉的记录，调用方可以据此补写聊天里的专注记录（recordedToChat 为 false 的那些）。
 */
export const settleExpiredFocusSessions = async (now = new Date()) => {
  const rows = await db.focusSessions.where('status').equals(FOCUS_STATUS.RUNNING).toArray();
  const settled = [];

  for (const row of rows) {
    const plannedEnd = new Date(row.plannedEndAt);

    if (Number.isNaN(plannedEnd.getTime()) || plannedEnd.getTime() > now.getTime()) continue;

    const patch = {
      status: FOCUS_STATUS.COMPLETED,
      endedAt: plannedEnd.toISOString(),
      actualMinutes: row.durationMinutes,
    };

    await db.focusSessions.update(row.id, patch);
    settled.push({ ...row, ...patch });
  }

  return settled;
};

/**
 * 开始一次专注：写一条进行中的记录，并给每个被通知的聊天窗写上静音字段。
 * 已经有一次还没到时间的专注在进行时，抛出错误，由界面决定怎么处理。
 */
export const startFocusSession = async ({
  task = '',
  durationMinutes,
  place = '',
  chatIds = [],
  restEnabled = true,
  bufferMinutes = FOCUS_MUTE_BUFFER_MINUTES,
  now = new Date(),
}) => {
  const minutes = Math.round(Number(durationMinutes));

  if (!Number.isFinite(minutes) || minutes < 1) {
    throw new Error('focus_invalid_duration');
  }

  await settleExpiredFocusSessions(now);

  const running = await getRunningFocusSession();

  if (running) throw new Error('focus_session_already_running');

  const startedAt = now;
  const plannedEndAt = new Date(startedAt.getTime() + minutes * MINUTE_MS);
  const ids = uniqueChatIds(chatIds);
  let sessionId = null;

  await db.transaction('rw', db.focusSessions, db.chats, async () => {
    sessionId = await db.focusSessions.add({
      status: FOCUS_STATUS.RUNNING,
      startedAt: startedAt.toISOString(),
      dayKey: toDayKey(startedAt),
      task: String(task || '').trim(),
      place: String(place || '').trim(),
      durationMinutes: minutes,
      plannedEndAt: plannedEndAt.toISOString(),
      endedAt: null,
      chatIds: ids,
      restEnabled: Boolean(restEnabled),
      abandonReason: '',
      bufferMinutes,
      actualMinutes: 0,
      recordedToChat: false,
    });

    for (const chatId of ids) {
      await db.chats.update(
        chatId,
        buildFocusMuteFields({
          sessionId,
          task,
          place,
          startedAt,
          endsAt: plannedEndAt,
          bufferMinutes,
        }),
      );
    }
  });

  return sessionId;
};

/**
 * 结束一次专注。
 *   status = 'abandoned'：用户自己点了放弃。记录在此刻结束，被通知聊天窗的静音从此刻起再走一段缓冲。
 *   status = 'completed'：正常完成。时间已到时只改记录；还没到时间（例如预览里的"直接完成"）
 *                         按提前结束处理，聊天窗上的结束字段同样改写。
 * 只改写 focusSessionId 还指着这一次的聊天窗，不会误伤之后新开的专注。
 */
export const finishFocusSession = async (
  sessionId,
  { status = FOCUS_STATUS.COMPLETED, reason = '', now = new Date() } = {},
) => {
  const session = await db.focusSessions.get(sessionId);

  if (!session || session.status !== FOCUS_STATUS.RUNNING) return null;

  const plannedEnd = new Date(session.plannedEndAt);
  const reachedPlannedEnd = plannedEnd.getTime() <= now.getTime();
  const abandoned = status === FOCUS_STATUS.ABANDONED;
  const endedAt = !abandoned && reachedPlannedEnd ? plannedEnd : now;
  const startedAt = new Date(session.startedAt);
  const actualMinutes = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / MINUTE_MS),
  );

  const patch = {
    status: abandoned ? FOCUS_STATUS.ABANDONED : FOCUS_STATUS.COMPLETED,
    endedAt: endedAt.toISOString(),
    actualMinutes,
    abandonReason: abandoned ? String(reason || '').trim() : '',
  };

  await db.transaction('rw', db.focusSessions, db.chats, async () => {
    await db.focusSessions.update(sessionId, patch);

    if (!abandoned && reachedPlannedEnd) return;

    const endFields = buildFocusEndFields({
      endedAt,
      bufferMinutes: session.bufferMinutes ?? FOCUS_MUTE_BUFFER_MINUTES,
    });

    for (const chatId of session.chatIds || []) {
      const chat = await db.chats.get(chatId);

      if (chat && chat.focusSessionId === sessionId) {
        await db.chats.update(chatId, endFields);
      }
    }
  });

  return { ...session, ...patch };
};

/** 标记这一次专注的记录已经写进聊天（第三轮写聊天记录时使用，避免重复写）。 */
export const markFocusSessionRecorded = async (sessionId) => {
  await db.focusSessions.update(sessionId, { recordedToChat: true });
};

/* ---------- 地点：用户自己写，每次开始时选一个，不做任何定位 ---------- */

const cleanPlaces = (list) => {
  const out = [];

  (Array.isArray(list) ? list : []).forEach((raw) => {
    const name = String(raw || '').trim().slice(0, MAX_PLACE_LENGTH);

    if (name && !out.includes(name)) out.push(name);
  });

  return out.slice(0, MAX_FOCUS_PLACES);
};

export const getFocusPlaces = async () => {
  const row = await db.settings.get(FOCUS_PLACES_KEY);

  // 从没保存过才用默认；用户把地点删空了就是空的。
  if (!row || !Array.isArray(row.value)) return [...DEFAULT_FOCUS_PLACES];

  return cleanPlaces(row.value);
};

export const saveFocusPlaces = async (places) => {
  const cleaned = cleanPlaces(places);

  await db.settings.put({ key: FOCUS_PLACES_KEY, value: cleaned });

  return cleaned;
};
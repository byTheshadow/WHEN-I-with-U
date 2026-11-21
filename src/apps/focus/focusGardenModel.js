// src/apps/focus/focusGardenModel.js
//
// 花园日历的纯函数：月历格子、一天里挑哪一株放进格子、每次专注对应的图标样子。
// 不碰数据库，可以单独测试。

import { growthStageFromProgress } from './focusGrowthIcons';

export const GARDEN_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const pad = (value) => String(value).padStart(2, '0');

// month 用 0 到 11，和 Date 一致。
export const toMonthPrefix = (year, month) => `${year}-${pad(month + 1)}`;

export const toDayKeyOf = (year, month, day) => `${toMonthPrefix(year, month)}-${pad(day)}`;

/**
 * 一个月的格子，周一开头。返回的数组长度是 7 的倍数，
 * 月初前、月末后的空位是 null，其余是 { day, dayKey }。
 */
export const buildMonthGrid = (year, month) => {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push({ day, dayKey: toDayKeyOf(year, month, day) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
};

/** 上一个月 / 下一个月，处理跨年。 */
export const shiftMonth = (year, month, delta) => {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/**
 * 一次专注在花园里的样子，和结束页的规则一致：
 * 放弃是枯萎版，停在当时的阶段；提前结束停在当时的阶段；完整完成是最后一阶段。
 */
export const getSessionVisual = (session) => {
  const planned = Math.max(1, Number(session?.durationMinutes) || 1);
  const actual = Math.max(0, Number(session?.actualMinutes) || 0);

  if (session?.status === 'abandoned') {
    return {
      kind: 'abandoned',
      stage: growthStageFromProgress(Math.min(1, actual / planned)),
      withered: true,
    };
  }
  if (actual < planned) {
    return { kind: 'early', stage: growthStageFromProgress(actual / planned), withered: false };
  }
  return { kind: 'completed', stage: 5, withered: false };
};

const KIND_RANK = { completed: 3, early: 2, abandoned: 1 };

/** 一天里挑一株放进月历格子：完整完成优先，其次提前结束，最后才是枯萎的；同类取时间更长的。 */
export const pickDayBest = (sessions) => {
  const list = Array.isArray(sessions) ? sessions : [];
  let best = null;
  let bestRank = -1;

  list.forEach((session) => {
    const rank = KIND_RANK[getSessionVisual(session).kind] || 0;
    const longer = Number(session.actualMinutes) > Number(best?.actualMinutes || 0);

    if (rank > bestRank || (rank === bestRank && longer)) {
      best = session;
      bestRank = rank;
    }
  });

  return best;
};

/** 把一批专注记录按 dayKey 分组，组内按开始时间从早到晚。 */
export const groupSessionsByDay = (sessions) => {
  const map = new Map();

  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    if (!session?.dayKey) return;
    if (!map.has(session.dayKey)) map.set(session.dayKey, []);
    map.get(session.dayKey).push(session);
  });

  map.forEach((list) => {
    list.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  });

  return map;
};

export const getSessionKindLabel = (session) => {
  const { kind } = getSessionVisual(session);
  if (kind === 'abandoned') return '放弃';
  if (kind === 'early') return '提前结束';
  return '完成';
};

/** 本月汇总：只统计没有放弃的，次数和总分钟。 */
export const summarizeMonth = (sessions) => {
  let count = 0;
  let minutes = 0;

  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    if (session?.status === 'abandoned') return;
    count += 1;
    minutes += Math.max(0, Math.round(Number(session?.actualMinutes) || 0));
  });

  return { count, minutes };
};
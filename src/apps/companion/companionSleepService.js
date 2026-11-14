/*
 * 小伙伴睡觉（2026-11 新增）
 *
 * 规则（已跟用户确认）：
 *   1. 按手机本地时钟自动睡：每天 SLEEP_START_HOUR 点到次日 SLEEP_END_HOUR 点
 *      是睡觉时段，不需要用户操作，也没有后台计时器——跟饱食度/心情的衰减
 *      一样，等有人读取这只小伙伴时按"过去了多久"一次性结算。
 *   2. 睡觉不加新的"能量"数值，直接回复现有数值：睡觉时段内
 *      饱食度衰减变慢（乘以 SLEEP_SATIETY_DECAY_FACTOR），心情不降反升
 *      （每小时 +SLEEP_MOOD_GAIN_PER_HOUR）；清洁度照常衰减。
 *      具体的结算算术在 companionService.js 的 applyTimeDecay 里，这里只负责
 *      算"这段时间里有多少小时在睡"。
 *   3. 喂食/清洁/玩耍（含背包道具）会把它吵醒；戳一戳不会吵醒，但会被嫌弃。
 *      被吵醒后，当晚剩下的睡觉时段都不再睡（记在 companion.sleepWokenAt），
 *      睡眠回复只按被吵醒之前已经睡的那段算。
 *   4. 睡到早上自动醒来时，如果这一觉睡够了 MIN_WAKE_TIP_HOURS 小时，会攒下
 *      一条"早安小提示"（companion.pendingWakeTip），用户下次打开小伙伴页面
 *      时取走显示一次，取走即清空。
 *
 * 本文件只 import db，不 import companionService.js —— companionService.js
 * 反过来 import 这里，避免循环引用（写法同 companionStatusPrompt.js）。
 *
 * 新增的都是 companions 记录上的可选未索引字段（sleepWokenAt、sleepAccumHours、
 * pendingWakeTip），不需要升 Dexie 版本号。
 */

import db from '../../db';

export const SLEEP_START_HOUR = 22;
export const SLEEP_END_HOUR = 7;
// 睡觉时饱食度的衰减速度是醒着时的几分之几。
export const SLEEP_SATIETY_DECAY_FACTOR = 0.25;
// 睡觉时心情每小时回升多少（醒着时是每小时下降）。
export const SLEEP_MOOD_GAIN_PER_HOUR = 3;
// 这一觉至少睡够多少小时，醒来才留早安提示。
const MIN_WAKE_TIP_HOURS = 1;
// 早安提示超过这么久没被看到就作废，避免晚上才看到一句"早安"。
const WAKE_TIP_EXPIRE_MS = 12 * 3600000;

const HOUR_MS = 3600000;
// 离开太久时最多往前扫这么多天的睡眠时段，防止极端情况下循环过长。
const MAX_SCAN_DAYS = 60;

export const SLEEP_WINDOW_LABEL = `${String(SLEEP_START_HOUR).padStart(2, '0')}:00 - ${String(SLEEP_END_HOUR).padStart(2, '0')}:00`;

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

// ---- 文案池：纯本地，不调用 AI ----

// 页面气泡：睡觉时代替"状态很不错"之类的状态句。
export const SLEEPING_STATUS_LINE = '呼……呼……睡得正香，别吵醒它。';

// 睡觉时点喂食/清洁/玩耍，第一次点的提示（再点一次才会真的叫醒）。
export const SLEEP_WAKE_CONFIRM_LINE = '它正睡着呢，再点一次就会把它叫醒哦。';

// 睡觉时戳一戳：被嫌弃。
export const SLEEP_POKE_REPLIES = [
  '嘟囔了一声，把脸转向了另一边。',
  '皱了皱鼻子，往被子里缩了缩。',
  '迷迷糊糊地拍开了你的手。',
  '哼唧了一下，翻了个身背对着你。',
  '眼睛都没睁开，只是不满地抖了抖耳朵。',
  '含糊地念叨了句什么，又睡过去了。',
];

// 被喂食/清洁/玩耍叫醒时，接在原来反馈文案前面的一句。
const WOKEN_UP_PREFIXES = [
  '被你叫醒了，揉着眼睛——',
  '迷迷糊糊地睁开了眼睛——',
  '打着哈欠被叫醒了——',
  '睡眼惺忪地爬了起来——',
];
export const pickWokenUpPrefix = () => pickRandom(WOKEN_UP_PREFIXES);

const WAKE_TIP_LINES = [
  (name, hours) => `${name}睡了大约 ${hours} 小时，醒来精神多了，早安。`,
  (name, hours) => `${name}伸了个大大的懒腰，一觉睡了约 ${hours} 小时，早安。`,
  (name, hours) => `早安，${name}睡饱了（大约 ${hours} 小时），看起来心情不错。`,
];

export const buildWakeTipLine = (tip, name) => {
  const safeName = name || '它';
  const hours = tip?.hours ? Number(tip.hours).toFixed(1).replace(/\.0$/, '') : '';
  const line = pickRandom(WAKE_TIP_LINES);
  return line(safeName, hours || '一整晚');
};

// ---- 睡眠时段计算 ----

/*
 * 返回与 [fromMs, toMs] 有重叠的所有睡眠时段（每个是 { start, end }，毫秒）。
 * 用 Date 的"年月日时"构造而不是加固定毫秒数，这样夏令时切换那天也不会错位。
 */
const getSleepWindowsOverlapping = (fromMs, toMs) => {
  const windows = [];
  const first = new Date(fromMs);
  // 从 from 所在那天的前一天开始扫：前一天 22:00 开始的那一觉可能跨到 from 当天早上。
  const baseYear = first.getFullYear();
  const baseMonth = first.getMonth();
  const baseDay = first.getDate() - 1;

  for (let offset = 0; offset <= MAX_SCAN_DAYS; offset += 1) {
    const start = new Date(baseYear, baseMonth, baseDay + offset, SLEEP_START_HOUR, 0, 0, 0).getTime();
    if (start > toMs) break;
    const end = new Date(baseYear, baseMonth, baseDay + offset + 1, SLEEP_END_HOUR, 0, 0, 0).getTime();
    if (end > fromMs) windows.push({ start, end });
  }

  return windows;
};

// 某个时间点所在的睡眠时段，不在睡觉时段内返回 null。
const findSleepWindowAt = (ms) => {
  const windows = getSleepWindowsOverlapping(ms, ms);
  return windows.find((w) => ms >= w.start && ms < w.end) || null;
};

// 纯时钟判断：现在是不是睡觉时段（不考虑有没有被吵醒）。
export const isSleepTime = (ms = Date.now()) => Boolean(findSleepWindowAt(ms));

// 这个睡眠时段里，这只小伙伴被吵醒了吗？是的话返回被吵醒的时间戳。
const getWokenAtWithinWindow = (companion, window) => {
  const wokenAt = companion?.sleepWokenAt;
  if (!wokenAt) return null;
  return wokenAt >= window.start && wokenAt <= window.end ? wokenAt : null;
};

/*
 * 这只小伙伴现在是不是在睡觉：处在睡眠时段内，并且当晚没被吵醒过。
 */
export const isCompanionSleeping = (companion, now = Date.now()) => {
  if (!companion) return false;
  const window = findSleepWindowAt(now);
  if (!window) return false;
  return getWokenAtWithinWindow(companion, window) === null;
};

/*
 * [fromMs, toMs] 这段时间里这只小伙伴实际睡了多少小时。
 * 被吵醒的那一晚，只算到被吵醒的那一刻为止。
 */
export const computeSleepHours = (companion, fromMs, toMs) => {
  if (!(toMs > fromMs)) return 0;

  let totalMs = 0;
  for (const window of getSleepWindowsOverlapping(fromMs, toMs)) {
    const wokenAt = getWokenAtWithinWindow(companion, window);
    const effectiveEnd = wokenAt === null ? window.end : Math.min(window.end, wokenAt);
    const overlapStart = Math.max(window.start, fromMs);
    const overlapEnd = Math.min(effectiveEnd, toMs);
    if (overlapEnd > overlapStart) totalMs += overlapEnd - overlapStart;
  }

  return totalMs / HOUR_MS;
};

/*
 * 每次衰减结算后，要顺带写回 companions 记录的睡眠相关字段。
 *   - 还在睡：把这段睡的小时数累加起来。
 *   - 已经醒了：如果累计睡够了，留一条早安提示，然后清零累计。
 * 为什么要累计而不是只看这一次结算：调度器会隔一阵就读一次小伙伴并结算衰减，
 * 一觉会被切成很多小段，单看某一段永远凑不够 1 小时。
 */
export const buildSleepBookkeepingPatch = (companion, sleepHoursInThisSegment, now = Date.now()) => {
  const accumulated = (companion.sleepAccumHours || 0) + sleepHoursInThisSegment;

  if (isCompanionSleeping(companion, now)) {
    return { sleepAccumHours: accumulated };
  }

  if (accumulated >= MIN_WAKE_TIP_HOURS) {
    return {
      sleepAccumHours: 0,
      pendingWakeTip: { hours: Math.round(accumulated * 10) / 10, at: now },
    };
  }

  return { sleepAccumHours: 0 };
};

// ---- 被吵醒 ----

/*
 * 如果正在睡觉就把它叫醒，返回"刚才是不是真的在睡觉"。
 * 喂食/清洁/玩耍（含背包道具）的入口在真正改数值之前调用一次。
 */
export const wakeCompanionIfSleeping = async (companionId) => {
  const companion = await db.companions.get(companionId);
  if (!companion) return false;

  const now = Date.now();
  if (!isCompanionSleeping(companion, now)) return false;

  await db.companions.update(companionId, {
    sleepWokenAt: now,
    sleepAccumHours: 0,
    pendingWakeTip: null,
    updatedAt: now,
  });
  return true;
};

// ---- 早安提示：打开页面时取走一次 ----

export const takePendingWakeTip = async (companionId) => {
  const companion = await db.companions.get(companionId);
  const tip = companion?.pendingWakeTip || null;
  if (!tip) return null;

  await db.companions.update(companionId, { pendingWakeTip: null });

  if (!tip.at || Date.now() - tip.at > WAKE_TIP_EXPIRE_MS) return null;
  return buildWakeTipLine(tip, companion.name);
};

// ---- 给聊天提示词用的一句话描述（没在睡觉返回空字符串）----

export const describeSleepForPrompt = (companion, now = Date.now()) => (
  isCompanionSleeping(companion, now)
    ? `现在是深夜，${companion.name}正睡着，不要说它醒着或在玩。`
    : ''
);

export default {
  isSleepTime,
  isCompanionSleeping,
  computeSleepHours,
  wakeCompanionIfSleeping,
  takePendingWakeTip,
};
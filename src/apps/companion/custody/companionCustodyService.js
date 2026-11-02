/*
 * companionCustodyService.js —— "托管给角色"（拜托TA帮忙照顾小伙伴）。
 *
 * 规则（跟用户确认过的设计一致）：
 *   - 一个开关，打开后持续生效，不是在线/离线触发式。
 *   - 打开后，每天自动帮忙做完当天还没做的免费日常（喂食/清洁/玩耍）。
  *   - 做完免费动作后某项数值还低，按"离补到 CUSTODY_LOW_THRESHOLD 还差多少"
 *     挑对应道具：买得起的里面，最便宜且一次能补够的；没有能补够的，就买
 *     加得最多的。然后使用，每天最多自动买 CUSTODY_DAILY_BUY_CAP 次。
 *   - 心心不够就不买、不强制，只在信里温和提示一句。
 *   - 跟现有"角色自主照顾"（triggerCompanionAutonomousCare）并存，互不影响。
 *
 * 数据：全部是 db.companions 上"不建索引"的新字段，不升级 schema 版本：
 *   custodyEnabled       boolean  开关
 *   custodyDaily         { dateStr, buyCount, shortNotified }  当天计数
 *   custodyPendingLetter { id, timestamp, kinds, purchases, short }  还没弹过的信
 *
 * 依赖方向：本文件 import companionService.js / companionBackpackService.js，
 * 反过来它们都不 import 本文件，所以没有循环依赖。调度入口
 * runCustodyTick 由 scheduledMessageService.js 现有的 60 秒调度器顺路调用。
 */

import db from '../../../db';
import { performFreeAction, applyTimeDecay, buyShopItem } from '../companionService';
import { useBackpackItem as consumeBackpackItem } from '../backpack/companionBackpackService';
import {
  SHOP_FOOD_ITEMS,
  SHOP_CLEAN_ITEMS,
  SHOP_TOY_ITEMS,
  FOOD_TIERS,
} from '../companionShopData';
import { runCustodySchoolLesson } from './companionCustodySchoolService';

// 每天自动购买次数上限（用户确认：3 次）。
export const CUSTODY_DAILY_BUY_CAP = 3;
// 做完免费动作后，数值低于这个值才会考虑自动买道具补上。
const CUSTODY_LOW_THRESHOLD = 50;
// 调度器每次 tick 最少间隔，避免 60 秒 + 切回前台连续触发时重复查库。
const TICK_MIN_GAP_MS = 2 * 60 * 1000;

export const CUSTODY_SHORT_HEARTS_TEXT = '心心还差一点，下次再给TA补上';

const FREE_KEYS = ['feed', 'clean', 'play'];

// 数值 -> 对应的道具池。food/clean/toy 三类，各自的稀有解锁字段不同。
const STAT_PLAN = [
  { stat: 'satiety', kind: 'feed', effectKey: 'satiety', unlockField: 'unlockedRareFoodIds', pool: SHOP_FOOD_ITEMS },
  { stat: 'cleanliness', kind: 'clean', effectKey: 'cleanliness', unlockField: 'unlockedRareCleanIds', pool: SHOP_CLEAN_ITEMS },
  { stat: 'mood', kind: 'play', effectKey: 'mood', unlockField: 'unlockedRareToyIds', pool: SHOP_TOY_ITEMS },
];

const KIND_OF_CATEGORY = { food: 'feed', clean: 'clean', toy: 'play' };

const todayDateStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 按"缺口"挑道具。候选：普通档直接可买，稀有档要已解锁，传说档不参与。
//   1) 先筛掉心心买不起的；
//   2) 买得起的里面，有一次能补够缺口的，就挑最便宜的（同价挑加得多的）；
//   3) 没有能补够的，就挑加得最多的（同样多挑便宜的），下一轮巡检再接着补；
//   4) 有候选但一个都买不起，返回 short: true，信里温和提示；没有候选返回 item: null。
const pickItemForGap = (plan, companion, gap) => {
  const unlocked = companion[plan.unlockField] || [];
  const hearts = companion.hearts || 0;
  const effectOf = (item) => item.effects?.[plan.effectKey] || 0;

  const eligible = plan.pool
    .filter((item) => (
      item.tier === FOOD_TIERS.COMMON
      || (item.tier === FOOD_TIERS.RARE && unlocked.includes(item.id))
    ))
    .filter((item) => effectOf(item) > 0);
  if (eligible.length === 0) return { item: null, short: false };

  const affordable = eligible.filter((item) => item.price <= hearts);
  if (affordable.length === 0) return { item: null, short: true };

  const enough = affordable
    .filter((item) => effectOf(item) >= gap)
    .sort((a, b) => (a.price - b.price) || (effectOf(b) - effectOf(a)));
  if (enough.length > 0) return { item: enough[0], short: false };

  const best = [...affordable]
    .sort((a, b) => (effectOf(b) - effectOf(a)) || (a.price - b.price));
  return { item: best[0], short: false };
};

// 给"最近的动态"写的一句话。
const KIND_TEXT = { feed: '喂饱了', clean: '洗香香了', play: '陪着玩了一会儿' };
const composeLogText = (kinds, purchases) => {
  const parts = FREE_KEYS.filter((key) => kinds.includes(key)).map((key) => KIND_TEXT[key]);
  if (purchases.length > 0) {
    parts.push(`还为小伙伴买了${purchases.map((p) => `「${p.name}」`).join('、')}`);
  }
  return `${parts.join('，')}～`;
};

const runningIds = new Set();

const runCustodyInner = async (companionId) => {
  let companion = await db.companions.get(companionId);
  if (!companion || !companion.custodyEnabled) return false;

  const dateStr = todayDateStr();
  const daily = companion.custodyDaily?.dateStr === dateStr
    ? companion.custodyDaily
    : { dateStr, buyCount: 0, shortNotified: false };

  const doneKinds = [];
  const purchases = [];
  let shortOfHearts = false;

  // 1) 当天还没做的免费动作，替用户做掉。
  const freeDaily = companion.freeActionDaily?.dateStr === dateStr ? companion.freeActionDaily : {};
  for (const key of FREE_KEYS) {
    if ((freeDaily[key] || 0) >= 1) continue;
    try {
      await performFreeAction(companionId, key);
      doneKinds.push(key);
    } catch (error) {
      // 已经用完/小伙伴不在了：直接跳过这一项。
    }
  }

  // 2) 数值还低，就按缺口挑够用的对应道具并使用（每天最多 3 次）。
  companion = await db.companions.get(companionId);
  if (!companion) return false;
  companion = await applyTimeDecay(companion);

  let buyCount = daily.buyCount || 0;
  for (const plan of STAT_PLAN) {
    if (buyCount >= CUSTODY_DAILY_BUY_CAP) break;
    if ((companion[plan.stat] ?? 100) >= CUSTODY_LOW_THRESHOLD) continue;

    const gap = CUSTODY_LOW_THRESHOLD - (companion[plan.stat] ?? 100);
    const { item, short } = pickItemForGap(plan, companion, gap);
    if (short) {
      shortOfHearts = true; // 不强制购买，只记一笔，信里温和提示。
      continue;
    }
    if (!item) continue;

    try {
      const afterBuy = await buyShopItem(companionId, item.id);
      buyCount += 1;
      if (afterBuy) companion = afterBuy;
      const used = await consumeBackpackItem(companionId, item.id);
      if (used?.companion) companion = used.companion;
      purchases.push({ itemId: item.id, name: item.name });
      doneKinds.push(KIND_OF_CATEGORY[item.category] || plan.kind);
    } catch (error) {
      console.error('[Companion] 托管自动购买失败:', error);
    }
  }

  // 3) 整理结果：只有真的做了事，或者第一次需要提示"心心不够"，才留信。
  const newShort = shortOfHearts && !daily.shortNotified;
  if (doneKinds.length === 0 && purchases.length === 0 && !newShort) {
    return false;
  }

  const now = Date.now();
  const fresh = await db.companions.get(companionId);
  if (!fresh) return false;

  const prev = fresh.custodyPendingLetter || null;
  const kinds = Array.from(new Set([...(prev?.kinds || []), ...doneKinds]));
  const allPurchases = [...(prev?.purchases || []), ...purchases];

  await db.companions.update(companionId, {
    custodyDaily: { dateStr, buyCount, shortNotified: daily.shortNotified || newShort },
    custodyPendingLetter: {
      id: prev?.id || now,
      timestamp: now,
      kinds,
      purchases: allPurchases,
      short: Boolean(prev?.short || newShort),
    },
    updatedAt: now,
  });

  if (doneKinds.length > 0 || purchases.length > 0) {
    await db.companionLogs.add({
      companionId,
      logType: 'custody_care',
      actionType: 'custody_care',
      content: composeLogText(Array.from(new Set(doneKinds)), purchases),
      timestamp: now,
    });
  }

  return true;
};

/*
 * 对一只小伙伴执行一轮托管。同一只同时只会跑一轮（开关刚打开的那一下
 * 和调度器 tick 可能撞车），出错只打日志，绝不往外抛。
 */
export const runCustodyForCompanion = async (companionId) => {
  if (runningIds.has(companionId)) return false;
  runningIds.add(companionId);
  try {
    const didCare = await runCustodyInner(companionId);
    // 上学的课跟喂食清洁玩耍是两件独立的事（各自的信、各自的每日名额），
    // 这里只是顺路带一下，失败不影响上面已经做完的照顾结果。
    let didSchool = false;
    try {
      didSchool = await runCustodySchoolLesson(companionId);
    } catch (error) {
      console.error('[Companion] 托管上课失败:', error);
    }
    return didCare || didSchool;
  } catch (error) {
    console.error('[Companion] 托管执行失败:', error);
    return false;
  } finally {
    runningIds.delete(companionId);
  }
};

/*
 * 打开/关闭托管。打开时立刻跑一轮，让用户马上看到效果；返回最新的 companion。
 */
export const setCustodyEnabled = async (companionId, enabled) => {
  await db.companions.update(companionId, {
    custodyEnabled: Boolean(enabled),
    updatedAt: Date.now(),
  });
  if (enabled) await runCustodyForCompanion(companionId);
  return db.companions.get(companionId);
};

/*
 * 取走还没弹过的信（取走即清空，保证"弹一次"）。没有就返回 null。
 */
export const takePendingCustodyLetter = async (companionId) => {
  const companion = await db.companions.get(companionId);
  const letter = companion?.custodyPendingLetter || null;
  if (!letter) return null;
  await db.companions.update(companionId, { custodyPendingLetter: null });
  return letter;
};

let lastTickAt = 0;

/*
 * 调度入口：挂在 scheduledMessageService.js 现有的 60 秒 + 切回前台调度器上，
 * 不新增任何定时器。只处理开着托管的小伙伴。
 */
export const runCustodyTick = async () => {
  const now = Date.now();
  if (now - lastTickAt < TICK_MIN_GAP_MS) return;
  lastTickAt = now;

  try {
    const companions = await db.companions.toArray();
    for (const companion of companions) {
      if (companion.custodyEnabled) {
        await runCustodyForCompanion(companion.id);
      }
    }
  } catch (error) {
    console.error('[Companion] 托管巡检失败:', error);
  }
};
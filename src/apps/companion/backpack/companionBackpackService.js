/*
 * 小伙伴背包：食物（common/rare）、清洁道具、玩具购买后不再立即生效，
 * 存进这里，点击使用才真正生效。
 *
 * 完全新建的一套，不 import companionService.js（避免循环依赖——
 * companionService.js 的 buyShopItem 需要调用这里的 addToBackpack），
 * 这个文件里凡是要动 companion 本身数值的地方，直接操作 db.companions，
 * 不反过来 import companionService.js 里的函数。
 */

import db from '../../../db';
import { findShopItem, FOOD_TIERS } from '../companionShopData';
import { recordTaskEvent } from '../tasks/companionTaskService';
import { pickWokenUpPrefix, wakeCompanionIfSleeping } from '../companionSleepService';

const clamp100 = (value) => Math.max(0, Math.min(100, Math.round(value)));

// 玩具固定会让清洁度 -5，跟免费玩耍的效果一致（见启动包确认过的规则），
// 不需要每个玩具自己在 effects 里重复写这个数字。
const TOY_CLEANLINESS_COST = 5;

/*
 * 把一件商品加进背包：已经有这个 itemId 的行就 quantity+1，
 * 没有就新建一行 quantity:1。
 */
export const addToBackpack = async (companionId, itemId, category) => {
  const existing = await db.companionBackpack
    .where({ companionId, itemId })
    .first();

  if (existing) {
    await db.companionBackpack.update(existing.id, {
      quantity: (existing.quantity || 0) + 1,
    });
    return;
  }

  await db.companionBackpack.add({
    companionId,
    itemId,
    category,
    quantity: 1,
  });
};

/*
 * 背包列表：返回每一行的数量 + 对应的商品静态数据（名字/效果/图片等），
 * 找不到对应商品数据（比如商品后续被下架）的行直接过滤掉，不展示脏数据。
 */
export const getBackpack = async (companionId) => {
  const rows = await db.companionBackpack.where('companionId').equals(companionId).toArray();

  return rows
    .map((row) => {
      const item = findShopItem(row.itemId);
      if (!item) return null;
      return { ...item, quantity: row.quantity, backpackRowId: row.id };
    })
    .filter(Boolean);
};

/*
 * 使用一件背包道具：
 *   - food：按 effects 加饱食/心情，清洁度 -2（跟免费喂食一致）。
 *   - clean：按 effects 加清洁度（可能也带心情加成，看道具自己定义）。
 *   - toy：按 effects 加心情，清洁度固定 -5（跟免费玩耍一致）。
 *
 * 用完数量 -1，数量到 0 就把这一行物理删除，不留空行。
 * 返回 { companion, feedbackText, item }，feedbackText 优先用道具自己
 * 的 useLine，没有就退回通用兜底文案，供 UI 弹气泡/浮动数字用。
 */
export const useBackpackItem = async (companionId, itemId) => {
  const row = await db.companionBackpack.where({ companionId, itemId }).first();
  if (!row || (row.quantity || 0) <= 0) {
    throw new Error('背包里没有这个东西了。');
  }

  const item = findShopItem(itemId);
  if (!item) throw new Error('这件道具的数据不见了，没法使用。');
  const wasWoken = await wakeCompanionIfSleeping(companionId);
  const companion = await db.companions.get(companionId);

  if (!companion) throw new Error('小伙伴不存在');

  const effects = item.effects || {};
  const now = Date.now();

  const satietyDelta = effects.satiety || 0;
  const moodDelta = effects.mood || 0;
  let cleanlinessDelta = effects.cleanliness || 0;

  if (item.category === 'food') {
    cleanlinessDelta += -2;
  } else if (item.category === 'toy') {
    cleanlinessDelta += -TOY_CLEANLINESS_COST;
  }

  const updated = {
    ...companion,
    satiety: clamp100(companion.satiety + satietyDelta),
    mood: clamp100(companion.mood + moodDelta),
    cleanliness: clamp100((companion.cleanliness ?? 100) + cleanlinessDelta),
    lastInteractionAt: now,
    updatedAt: now,
    totalInteractionCount: (companion.totalInteractionCount || 0) + 1,
    feedCount: (companion.feedCount || 0) + (item.category === 'food' ? 1 : 0),
  };

  await db.companions.put(updated);

  if ((row.quantity || 0) <= 1) {
    await db.companionBackpack.delete(row.id);
  } else {
    await db.companionBackpack.update(row.id, { quantity: row.quantity - 1 });
  }

  const defaultLine = item.category === 'food'
    ? `吃掉了「${item.name}」，看起来很满足。`
    : item.category === 'clean'
      ? `用「${item.name}」打理了一下，干净多了。`
      : `玩了一会儿「${item.name}」，很开心。`;

    const baseFeedbackText = item.useLine || defaultLine;
  const feedbackText = wasWoken ? `${pickWokenUpPrefix()}${baseFeedbackText}` : baseFeedbackText;

  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType: `backpack_${item.category}`,
    content: feedbackText,
    timestamp: now,
  });

  // 每日任务：用一次背包里的道具。
  await recordTaskEvent(companionId, 'backpack_use');
  const latestCompanion = await db.companions.get(companionId);

  return { companion: latestCompanion || updated, feedbackText, item };
};
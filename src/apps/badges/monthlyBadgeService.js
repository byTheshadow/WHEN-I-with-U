// src/apps/badges/monthlyBadgeService.js
//
// 每月限定聊天成就图标——数据读写与解锁判定。
//
// 用到两张新表（db v73）：
//   monthlyBadgeUnlocks —— 每个聊天窗口 × 每个赛季(seasonKey) 一行，记录
//     这个赛季有没有解锁、什么时候解锁、靠哪个条件解锁、AI 自定条件的内容、
//     以及"解锁动画有没有播过一次"。
//   monthlyBadgeEquips —— 每个聊天窗口一行，记录"现在戴着哪个图标"。
//     图标是跨赛季全局唯一 id，佩戴记录单独存一张表，这样即使赛季已经
//     翻篇（比如从十月进入十一月），之前解锁过的图标依然能继续戴着，
//     不会因为 monthlyBadgeUnlocks 那一行"属于上个月"而受影响。
//
// 条件的判定（thanks_card_triggered：本赛季月份内有文字消息命中感恩节
// 「谢谢」彩蛋关键词，见 hasThanksInSeason）：
//   messages_total  —— 跟 Almanac 的 'messages' 里程碑完全同一套算法：
//     这个聊天窗口里全部消息（不分谁发的）的总条数。
//   trick_triggered —— 本赛季月份内，这个聊天窗口有没有出现过
//     type === 'trick' 的消息（恶作剧按钮本来就只在万圣节季节开放）。
//   ai_custom —— 读取这一行已经生成好的 aiCondition，按它的 templateId
//     去查对应的信号（见 evaluateAiCondition）。还没生成就视为未达成。

import db from '../../db';
import { getDateKey } from '../almanac/services/almanacService';
import {
  getSeasonDefByKey,
  findBadgeInSeason,
  getSeasonKey,
  MONTHLY_BADGE_SEASONS,
} from './monthlyBadgeCatalog';
import { addBackgroundUpdate } from '../hub/newThingsService';
import { matchThanksKeyword } from '../../services/festivalService';

const toMs = (value) => {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/** 消息的本地日期（YYYY-MM-DD）是否落在 seasonKey（YYYY-MM）这个月里。 */
const isInSeasonMonth = (timestamp, seasonKey) => {
  const dateKey = getDateKey(timestamp);
  return typeof dateKey === 'string' && dateKey.startsWith(seasonKey);
};

export const getSeasonUnlockRow = async (chatId, seasonKey) => {
  if (!chatId || !seasonKey) return null;

  const rows = await db.monthlyBadgeUnlocks
    .where('[chatId+seasonKey]')
    .equals([chatId, seasonKey])
    .toArray();

  return rows[0] || null;
};

const createSeasonUnlockRow = async (chatId, seasonKey) => {
  const created = {
    chatId,
    seasonKey,
     unlocked: false,
    unlockedAt: null,
    unlockedConditionIds: [],
    unlockAnimationSeen: false,
    aiCondition: null,
    characterWantedBadgeId: null,
  };

  const id = await db.monthlyBadgeUnlocks.add(created);
  return { id, ...created };
};

export const getOrCreateSeasonUnlockRow = async (chatId, seasonKey) => {
  const existing = await getSeasonUnlockRow(chatId, seasonKey);
  if (existing) return existing;
  return createSeasonUnlockRow(chatId, seasonKey);
};

/** 这个聊天窗口里全部消息的总条数（不区分发送者），同 Almanac 的算法。 */
const getMessagesTotal = async (chatId) => db.messages.where('chatId').equals(chatId).count();

/** 本赛季月份内，是否出现过一次恶作剧消息。 */
const hasTrickInSeason = async (chatId, seasonKey) => {
  const rows = await db.messages.where('chatId').equals(chatId).toArray();
  return rows.some((row) => row?.type === 'trick' && isInSeasonMonth(row.timestamp, seasonKey));
};

/**
 * 本赛季月份内，是否出现过一次感恩节「谢谢」彩蛋。
 * 彩蛋卡片本身不写入消息记录，所以这里扫描本赛季月份内的文字消息
 * （用户和角色说的都算），只要有一条命中 matchThanksKeyword 就算达成——
 * 跟卡片的触发条件一致，也不需要新增任何存储字段。
 */
const hasThanksInSeason = async (chatId, seasonKey) => {
  const rows = await db.messages.where('chatId').equals(chatId).toArray();
  return rows.some((row) => {
    if (row?.type !== 'text') return false;
    if (!isInSeasonMonth(row.timestamp, seasonKey)) return false;
    const ms = toMs(row.timestamp);
    if (ms === null) return false;
    return matchThanksKeyword(row.content, new Date(ms));
  });
};

/** 本赛季月份内，用户发的表情包条数。 */
const getStickersInSeasonCount = async (chatId, seasonKey) => {
  const rows = await db.messages.where('chatId').equals(chatId).toArray();
  return rows.filter(
    (row) => row?.type === 'sticker' && row?.sender === 'user' && isInSeasonMonth(row.timestamp, seasonKey)
  ).length;
};

/** 本赛季月份内，是否有一次本地时间 0-4 点之间的消息。 */
const hasLateNightInSeason = async (chatId, seasonKey) => {
  const rows = await db.messages.where('chatId').equals(chatId).toArray();
  return rows.some((row) => {
    if (!isInSeasonMonth(row?.timestamp, seasonKey)) return false;
    const date = new Date(row.timestamp);
    if (Number.isNaN(date.getTime())) return false;
    const hour = date.getHours();
    return hour >= 0 && hour <= 4;
  });
};

const evaluateAiCondition = async ({ chatId, seasonKey, aiCondition }) => {
  if (!aiCondition?.templateId) return false;

  if (aiCondition.templateId === 'extra_messages') {
    const target = Number(aiCondition.target);
    if (!Number.isFinite(target) || target <= 0) return false;
    const rows = await db.messages.where('chatId').equals(chatId).toArray();
    const countInSeason = rows.filter((row) => isInSeasonMonth(row?.timestamp, seasonKey)).length;
    return countInSeason >= target;
  }

  if (aiCondition.templateId === 'stickers_in_month') {
    const target = Number(aiCondition.target);
    if (!Number.isFinite(target) || target <= 0) return false;
    const count = await getStickersInSeasonCount(chatId, seasonKey);
    return count >= target;
  }

  if (aiCondition.templateId === 'late_night_chat') {
    return hasLateNightInSeason(chatId, seasonKey);
  }

  return false;
};

/**
 * 逐一检查这个赛季的三个条件，返回每个条件当前"是否已达成"，
 * 不负责写入解锁状态（见 checkAndUnlockSeason）。
 */
export const evaluateSeasonConditions = async ({ chatId, seasonKey, seasonDef, unlockRow }) => {
  const results = {};

  for (const condition of seasonDef.conditions) {
    if (condition.type === 'messages_total') {
      // eslint-disable-next-line no-await-in-loop
      const total = await getMessagesTotal(chatId);
      results[condition.id] = total >= condition.threshold;
    } else if (condition.type === 'trick_triggered') {
      // eslint-disable-next-line no-await-in-loop
      results[condition.id] = await hasTrickInSeason(chatId, seasonKey);
    } else if (condition.type === 'thanks_card_triggered') {
      // eslint-disable-next-line no-await-in-loop
      results[condition.id] = await hasThanksInSeason(chatId, seasonKey);
    } else if (condition.kind === 'ai') {
      if (!unlockRow?.aiCondition) {
        results[condition.id] = false;
      } else {
        // eslint-disable-next-line no-await-in-loop
        results[condition.id] = await evaluateAiCondition({
          chatId,
          seasonKey,
          aiCondition: unlockRow.aiCondition,
        });
      }
    } else {
      results[condition.id] = false;
    }
  }

  return results;
};

/**
 * 检查并（必要时）写入这个赛季的解锁状态。三个条件必须全部达成才能解锁整套图标，
 * 不是任意一个。已经解锁过的赛季不会重复判定，直接返回已有状态。
 */
export const checkAndUnlockSeason = async (chatId, seasonKey) => {
  const seasonDef = getSeasonDefByKey(seasonKey);
  if (!chatId || !seasonDef) return null;

  const unlockRow = await getOrCreateSeasonUnlockRow(chatId, seasonKey);

  if (unlockRow.unlocked) {
    return { ...unlockRow, conditionResults: await evaluateSeasonConditions({ chatId, seasonKey, seasonDef, unlockRow }), justUnlocked: false };
  }

  const conditionResults = await evaluateSeasonConditions({ chatId, seasonKey, seasonDef, unlockRow });
  const allConditionIds = seasonDef.conditions.map((condition) => condition.id);
  const allMet = allConditionIds.every((id) => conditionResults[id]);

  if (!allMet) {
    return { ...unlockRow, conditionResults, justUnlocked: false };
  }

  const nowIso = new Date().toISOString();
  const updated = {
    ...unlockRow,
    unlocked: true,
    unlockedAt: nowIso,
    unlockedConditionIds: allConditionIds,
  };

    await db.monthlyBadgeUnlocks.put(updated);

  await addBackgroundUpdate({
    source: 'badge',
    chatId,
    title: `解锁徽章「${seasonDef.seasonTitle}」`,
    sub: `${seasonDef.badges.length} 枚图标已放进徽章墙`,
    extra: null,
  });

  return { ...updated, conditionResults, justUnlocked: true };
};

/** 解锁动画只播一次：播放完之后由界面调用这个函数标记"已看过"。 */
export const markUnlockAnimationSeen = async (chatId, seasonKey) => {
  const row = await getSeasonUnlockRow(chatId, seasonKey);
  if (!row || row.unlockAnimationSeen) return;
  await db.monthlyBadgeUnlocks.put({ ...row, unlockAnimationSeen: true });
};

export const getEquipRow = async (chatId) => {
  if (!chatId) return null;
  const rows = await db.monthlyBadgeEquips.where('chatId').equals(chatId).toArray();
  return rows[0] || null;
};

/**
 * 佩戴一个图标。会校验这个图标所属的赛季确实已经解锁过，
 * 防止因为界面状态过期而误佩戴一个其实还没解锁的图标。
 * badgeId 为空则表示"摘下来，不戴任何图标"。
 */
export const equipBadge = async (chatId, badgeId) => {
  if (!chatId) return null;

  if (!badgeId) {
    const existing = await getEquipRow(chatId);
    if (existing) {
      await db.monthlyBadgeEquips.put({ ...existing, badgeId: null, updatedAt: new Date().toISOString() });
    }
    return null;
  }

  const unlockRows = await db.monthlyBadgeUnlocks.where('chatId').equals(chatId).toArray();
  const unlockedSeasons = unlockRows.filter((row) => row.unlocked);

  const ownsBadge = unlockedSeasons.some((row) => {
    const seasonDef = getSeasonDefByKey(row.seasonKey);
    return Boolean(findBadgeInSeason(seasonDef, badgeId));
  });

  if (!ownsBadge) {
    throw new Error('这个图标还没有解锁，不能佩戴。');
  }

  const existing = await getEquipRow(chatId);
  const nowIso = new Date().toISOString();

  if (existing) {
    await db.monthlyBadgeEquips.put({ ...existing, badgeId, updatedAt: nowIso });
    return { ...existing, badgeId, updatedAt: nowIso };
  }

  const created = { chatId, badgeId, updatedAt: nowIso };
  const id = await db.monthlyBadgeEquips.add(created);
  return { id, ...created };
};

/**
 * 兑换页需要的完整视图模型：所有已经有过记录（或正在进行）的赛季，
 * 每个赛季下 7 个图标各自的解锁状态，以及当前佩戴的是哪一个。
 */
export const getBadgeBoardForChat = async (chatId, activeSeasonKey) => {
  if (!chatId) return { seasons: [], equippedBadgeId: null };

  const [unlockRows, equipRow] = await Promise.all([
    db.monthlyBadgeUnlocks.where('chatId').equals(chatId).toArray(),
    getEquipRow(chatId),
  ]);

  const seasonKeys = new Set(unlockRows.map((row) => row.seasonKey));
  if (activeSeasonKey) seasonKeys.add(activeSeasonKey);

  const seasons = Array.from(seasonKeys)
    .map((seasonKey) => {
      const seasonDef = getSeasonDefByKey(seasonKey);
      if (!seasonDef) return null;

      const unlockRow = unlockRows.find((row) => row.seasonKey === seasonKey) || null;
      const isCurrent = seasonKey === activeSeasonKey;

      return {
        seasonKey,
        seasonDef,
        isCurrent,
        unlocked: Boolean(unlockRow?.unlocked),
        unlockedAt: unlockRow?.unlockedAt || null,
        unlockedConditionIds: unlockRow?.unlockedConditionIds || [],
        unlockAnimationSeen: Boolean(unlockRow?.unlockAnimationSeen),
        aiCondition: unlockRow?.aiCondition || null,
        characterWantedBadgeId: unlockRow?.characterWantedBadgeId || null,
        unlockRow,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.seasonKey < b.seasonKey ? 1 : -1));

  // 每个条件现在"达成了没有"，用来在兑换页逐条打勾——即使已经解锁，
  // 也一起算出来，方便显示"全部已达成"。
  await Promise.all(
    seasons.map(async (season) => {
      season.conditionResults = await evaluateSeasonConditions({
        chatId,
        seasonKey: season.seasonKey,
        seasonDef: season.seasonDef,
        unlockRow: season.unlockRow,
      });
      delete season.unlockRow;
    })
  );

  return { seasons, equippedBadgeId: equipRow?.badgeId || null };
};

/**
 * 批量取出多个聊天窗口当前佩戴的图标（图标 id 全局唯一，跨赛季查找），
 * 给会话列表那种"一次要展示一串聊天"的地方用，避免逐条聊天单独查询。
 * 返回 Map：chatId -> { id, title, imageUrl, seasonKey } | undefined。
 */
export const getEquippedBadgesForChats = async (chatIds = []) => {
  const ids = (chatIds || []).filter((id) => id !== null && id !== undefined);
  const map = new Map();
  if (ids.length === 0) return map;

  const equipRows = await db.monthlyBadgeEquips.where('chatId').anyOf(ids).toArray();

  equipRows.forEach((row) => {
    if (!row?.badgeId) return;

    for (const seasonDef of Object.values(MONTHLY_BADGE_SEASONS)) {
      const badge = findBadgeInSeason(seasonDef, row.badgeId);
      if (badge) {
        map.set(row.chatId, { ...badge, seasonTitle: seasonDef.seasonTitle });
        break;
      }
    }
  });

  return map;
};

/**
 * 给聊天主提示词用的一小段纯文本：角色现在戴着哪个图标、这个月
 * 想要哪一个、本月条件有没有全部达成。由 aiService.js 的
 * buildChatSystemPrompt 调用，拼进主提示词末尾的【限定图标】小节。
 */
export const getMonthlyBadgeContextForPrompt = async (chatId) => {
  const activeSeasonKey = getSeasonKey();
  const board = await getBadgeBoardForChat(chatId, activeSeasonKey);
  const current = board.seasons.find((season) => season.isCurrent);

  if (!current) return '';

  const equipped = current.seasonDef.badges.find((badge) => badge.id === board.equippedBadgeId);
  const wanted = current.seasonDef.badges.find((badge) => badge.id === current.characterWantedBadgeId);

  const lines = [`本月（${current.seasonDef.seasonTitle}）限定聊天成就图标：`];

  lines.push(equipped ? `你现在佩戴的是「${equipped.title}」。` : '你现在没有佩戴任何限定图标。');

  if (wanted) {
    lines.push(`你心里想要的是「${wanted.title}」，如果合适可以自然地提一句。`);
  }

  lines.push(current.unlocked ? '这个月的整套图标已经解锁，可以自由更换佩戴。' : '这个月的图标还没解锁。');

  return lines.join('\n');
};
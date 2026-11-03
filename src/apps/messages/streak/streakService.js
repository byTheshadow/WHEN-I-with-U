/**
 * streakService.js
 *
 * 聊天窗口打卡火花（Streak）逻辑。
 *
 * 数据模型（chatStreaks 表）：
 *   id          自增主键
 *   chatId      关联的聊天窗口 id
 *   count       当前连续天数
 *   lastDateStr 最近一次打卡的日期字符串（'YYYY-MM-DD'）
 *   freezeCards 剩余冻结卡数量（每张可阻止一天衰减）
 *
 * 冻结卡购买：5心心一张，通过 buyFreezeCard(chatId, companionId) 购买。
 * 打卡判定：每天只打一次。当天第一次在聊天室发消息（文字/图片/转账/表情包等），
 * 或点"回应"收到角色回复时触发。角色在用户不在时主动发来的消息不算。
 * 展示判定：库里的 count 只在下一次打卡时才重置，所以读取时要过一遍
 * resolveDisplayStreak——最近一次打卡不是今天也不是昨天，就算断了。
 *
 * 与 companionService 的职责分离：
 *   - streakService 只管 chatStreaks 表 + 调用 db.companions 扣心心
 *   - companionService 不感知 streak，streak 的心心扣费由 streakService 自行操作
 */

import { db } from '../../../db/index';

/* ------------------------------------------------------------------ */
/* 工具函数                                                               */
/* ------------------------------------------------------------------ */

/** 返回今天的日期字符串 'YYYY-MM-DD'（本地时区） */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 返回昨天的日期字符串 */
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* 冻结卡单价（心心）*/
export const FREEZE_CARD_PRICE = 5;

/**
 * 把库里存的 streak 行换算成"此刻实际展示的值"（只用于读取展示，不写库）。
 * 最近一次打卡不是今天也不是昨天，就算断了：
 *   - 没有冻结卡：count 显示为 0（界面按 count < 2 隐藏火花）；
 *   - 有冻结卡：维持原数字，等下一次打卡再消耗一张卡（规则不变）。
 * recordStreakCheckin / buyFreezeCard 仍然直接读库里的原始行，不经过这里。
 */
function resolveDisplayStreak(row) {
  if (!row) return null;
  const last = row.lastDateStr;
  const isBroken = Boolean(last) && last !== todayStr() && last !== yesterdayStr();
  if (isBroken && (row.freezeCards ?? 0) <= 0) {
    return { ...row, count: 0 };
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* 核心 API                                                              */
/* ------------------------------------------------------------------ */

/**
 * 读取指定 chatId 的 streak 数据。
 * 如果记录不存在，返回默认空对象（不写库，懒初始化）。
 * @returns {{ chatId, count, lastDateStr, freezeCards } | null}
 */
export async function getStreakForChat(chatId) {
  if (!chatId) return null;
  const row = await db.chatStreaks.where('chatId').equals(chatId).first();
  return resolveDisplayStreak(row);
}

/**
 * 批量读取多个 chatId 的 streak，返回 Map<chatId, row>。
 * MessagesApp 用于在列表里一次性批量显示火花。
 */
export async function getStreakMapForChats(chatIds) {
  if (!chatIds?.length) return new Map();
  const rows = await db.chatStreaks.where('chatId').anyOf(chatIds).toArray();
  return new Map(rows.map((r) => [r.chatId, resolveDisplayStreak(r)]));
}

/**
 * 当角色AI回复发出时调用，执行一次打卡。
 *
 * 规则：
 *   - 今天已打卡 → 什么都不做，直接返回当前数据
 *   - 昨天打卡过（连续）→ count + 1
 *   - 更早（断签）：
 *       如果 freezeCards > 0 → 消耗一张冻结卡，count 保持不动
 *       否则 → count 重置为 1
 *
 * @returns {object} 更新后的 streak 行（含 isBump: true 表示发生了变化）
 */
export async function recordStreakCheckin(chatId) {
  if (!chatId) return null;

  const today = todayStr();
  const yesterday = yesterdayStr();

  return db.transaction('rw', db.chatStreaks, async () => {
    let row = await db.chatStreaks.where('chatId').equals(chatId).first();

    if (!row) {
      // 第一次打卡
      const id = await db.chatStreaks.add({
        chatId,
        count: 1,
        lastDateStr: today,
        freezeCards: 0,
      });
      return { ...(await db.chatStreaks.get(id)), isBump: true };
    }

    // 今天已打卡 → 幂等返回
    if (row.lastDateStr === today) {
      return { ...row, isBump: false };
    }

    let newCount = row.count;
    let newFreeze = row.freezeCards ?? 0;
    let consumed = false;

    if (row.lastDateStr === yesterday) {
      // 昨天打过，连续
      newCount += 1;
    } else {
      // 断了
      if (newFreeze > 0) {
        // 冻结卡救场：保住 count，消耗一张卡
        newFreeze -= 1;
        consumed = true;
      } else {
        // 没卡，重置
        newCount = 1;
      }
    }

    const updates = {
      count: newCount,
      lastDateStr: today,
      freezeCards: newFreeze,
    };
    await db.chatStreaks.update(row.id, updates);
    return { ...row, ...updates, isBump: true, usedFreezeCard: consumed };
  });
}

/**
 * 购买冻结卡：从指定 companion 扣 5 心心，给 chatStreak 加 1 张卡。
 *
 * @param {number} chatId       聊天窗口 id
 * @param {number} companionId  小伙伴的 Dexie id（不是 chatId）
 * @throws 如果心心不够
 */
export async function buyFreezeCard(chatId, companionId) {
  if (!chatId || !companionId) throw new Error('缺少 chatId 或 companionId');

  return db.transaction('rw', db.chatStreaks, db.companions, async () => {
    const companion = await db.companions.get(companionId);
    if (!companion) throw new Error('小伙伴不存在');

    if ((companion.hearts ?? 0) < FREEZE_CARD_PRICE) {
      throw new Error(`心心不足，需要 ${FREEZE_CARD_PRICE} 心心`);
    }

    // 扣心心
    await db.companions.update(companionId, {
      hearts: Math.round((companion.hearts - FREEZE_CARD_PRICE) * 10) / 10,
    });

    // 加冻结卡
    let row = await db.chatStreaks.where('chatId').equals(chatId).first();
    if (!row) {
      await db.chatStreaks.add({
        chatId,
        count: 0,
        lastDateStr: '',
        freezeCards: 1,
      });
    } else {
      await db.chatStreaks.update(row.id, {
        freezeCards: (row.freezeCards ?? 0) + 1,
      });
    }
  });
}
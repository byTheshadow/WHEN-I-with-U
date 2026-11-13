/*
 * companionStatusAlertService.js —— #4 状态不佳卡片。
 *
 * 小伙伴的 mood（心情）/satiety（饱食度）/cleanliness（整洁度）三项里，
 * 只要同时有 2 项以上掉到阈值以下，就往聊天室发一张提醒卡片（类型
 * 'companion_status_alert'），点击卡片跳转到小伙伴页面——具体渲染和
 * 跳转见 CompanionStatusAlertCard.jsx / MessageRow.jsx，这里只管"要不要
 * 发、发什么内容"。
 *
 * 冷却记在 companion.lastStatusAlertAt 上（不是记在 chat 上——冷却是
 * "这只小伙伴"的冷却，不是"这个聊天窗"的）：发过一次之后，不管这期间
 * 状态有没有好转，都要等满 ALERT_COOLDOWN_HOURS 才会再发下一张，写法
 * 照抄 companionOfferService.js 的冷却记录思路。
 *
 * 跟 companionMoodScheduler.js 一样，这种"每隔几分钟扫一遍所有聊天窗"
 * 的检查并入 globalChatScheduler.js 的共享基准 tick，这里只导出
 * checkCompanionStatusAlerts(chats)，不自己起 setInterval。
 */

import db from '../../db';
import { getCompanionByChat } from './companionService';
import { isCompanionSleeping } from './companionSleepService';

const LOW_THRESHOLD = 20;
const ALERT_COOLDOWN_HOURS = 12;

const LOW_STAT_LABELS = {
  mood: '心情',
  satiety: '饱食度',
  cleanliness: '整洁度',
};

const hoursSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  return (now - timestamp) / 3600000;
};

const getLowStatKeys = (companion) => (
  Object.keys(LOW_STAT_LABELS).filter((key) => (companion[key] ?? 100) < LOW_THRESHOLD)
);

const buildAlertText = (companion, lowKeys) => {
  const labelText = lowKeys.map((key) => LOW_STAT_LABELS[key]).join('、');
  return `${companion.name}最近的${labelText}都不太好，要不要去看看TA？`;
};

const processChat = async (chat) => {
  // getCompanionByChat 内部会先结算时间衰减，拿到的是实时数值，不是
  // 上次打开页面时的旧值。
  const companion = await getCompanionByChat(chat.id);
  if (!companion) return; // 没养小伙伴，跳过
    if (isCompanionSleeping(companion)) return;

  if (hoursSince(companion.lastStatusAlertAt) < ALERT_COOLDOWN_HOURS) return; // 还在冷却

  const lowKeys = getLowStatKeys(companion);
  if (lowKeys.length < 2) return; // 没有同时满足"多项偏低"

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const content = buildAlertText(companion, lowKeys);

  await db.messages.add({
    chatId: chat.id,
    characterId: chat.characterId,
    sender: 'character',
    type: 'companion_status_alert',
    content,
    metadata: { lowKeys },
    versions: [{
      type: 'companion_status_alert',
      content,
      metadata: { lowKeys },
      timestamp: nowIso,
    }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: nowIso,
  });

  await db.companions.update(companion.id, { lastStatusAlertAt: now });
};

const schedulerState = { processing: false };

export const checkCompanionStatusAlerts = async (providedChats = null) => {
  if (schedulerState.processing) return;

  schedulerState.processing = true;

  try {
    const chats = providedChats || (await db.chats.toArray());

    for (const chat of chats) {
      try {
        await processChat(chat);
      } catch (error) {
        console.warn('[CompanionStatusAlert] 检查失败：', error);
      }
    }
  } finally {
    schedulerState.processing = false;
  }
};

export default {
  checkCompanionStatusAlerts,
};
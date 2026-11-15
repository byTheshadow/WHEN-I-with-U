// src/apps/messages/scheduledCloudReconcile.js
//
// 云服务器代发的预约消息，回写本地预约单的状态。
//
// 背景：
// 预约单到点时，如果手机在后台，是云服务器（pwa-push-server）替本地把消息发出来的。
// 这条消息会被 Service Worker 直接写进本地 messages 表，metadata 里带着
// isDueSchedule: true（服务器 deliverMessage 的第 5 个参数）。
// 但本地 scheduledMessages 表里对应的那张预约单没有人去更新：
//   - 一直停在"等待抵达"，等本地调度器再补发一遍（可能重复发）；
//   - 或者用户回复了云端那条消息，本地的"用户回复后收回"逻辑把它标成"已收回"。
// 两种结果都和"消息其实已经发出去了"不符。
//
// 做法：
// 找出本地"已到期、但还显示未发送/已收回"的预约单，再找同一个聊天窗里
// isDueSchedule 为 true、还没被认领的云端消息，按时间对上，把预约单标成 sent。
//
// 匹配依据：服务器只有一个预约槽位，到点后每分钟巡检才发，加上模型生成时间，
// 消息时间通常比预约时间晚 0 到 2 分钟；服务器自己逾期 30 分钟内仍会补发。
// 所以允许消息时间落在"预约时间之后 35 分钟内"，多张候选时取预约时间最接近的一张。
//
// 本文件只依赖 db 和 awayState，不引用 scheduledMessageService / cloudPushService，
// 避免循环引用。周期性提醒"发完要再排下一次"的动作由调用方通过 onMarkedSent 传入。

import Dexie from 'dexie';
import db from '../../db';
import { AWAY_RETURN_TYPE } from './away/awayState';

// 允许云端消息比预约时间早到的容差（时钟误差）。
const EARLY_TOLERANCE_MS = 5 * 1000;

// 云端消息最晚比预约时间晚多久，仍认为是这张预约单。
const MAX_LATE_MS = 35 * 60 * 1000;

// 只处理最近 48 小时内到期的预约单，不扫整张表。
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

// 这三种原因都是"用户在聊天里说话了，所以本地把预约收回"，
// 云端消息其实已经发出时，可以把它们恢复成已发送。
// 不包含 replaced_by_new_follow_up：那是被新预约顶掉的，云端也已经被新预约覆盖。
const USER_RETURN_CANCEL_REASONS = new Set([
  'user_sent_new_message',
  'user_returned_to_chat',
  'user_sent_message_after_schedule'
]);

const toMs = (value) => {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
};

let inFlight = null;

const runReconcile = async (onMarkedSent) => {
  const nowMs = Date.now();
  const sinceIso = new Date(nowMs - LOOKBACK_MS).toISOString();

  const candidates = await db.scheduledMessages
    .where('status')
    .anyOf(['pending', 'cancelled'])
    .filter((item) => {
      if (item.scheduleType === AWAY_RETURN_TYPE) {
        return false;
      }

      if (!item.scheduledFor || item.scheduledFor < sinceIso) {
        return false;
      }

      // 还没到期的预约，云端不可能已经发了。
      if (toMs(item.scheduledFor) > nowMs + EARLY_TOLERANCE_MS) {
        return false;
      }

      if (
        item.status === 'cancelled' &&
        !USER_RETURN_CANCEL_REASONS.has(item.cancelledReason)
      ) {
        return false;
      }

      return true;
    })
    .toArray();

  if (candidates.length === 0) {
    return 0;
  }

  const recordsByChat = new Map();

  for (const record of candidates) {
    const list = recordsByChat.get(record.chatId) || [];

    list.push(record);
    recordsByChat.set(record.chatId, list);
  }

  let markedCount = 0;

  for (const [chatId, records] of recordsByChat) {
    const earliestMs = Math.min(
      ...records.map((record) => toMs(record.scheduledFor))
    );

    const lowerIso = new Date(
      earliestMs - EARLY_TOLERANCE_MS
    ).toISOString();

    const recentMessages = await db.messages
      .where('[chatId+timestamp]')
      .between(
        [chatId, lowerIso],
        [chatId, Dexie.maxKey]
      )
      .toArray();

    const cloudMessages = recentMessages
      .filter((message) => (
        message.sender === 'character' &&
        message.metadata?.isDueSchedule === true &&
        !message.metadata?.scheduledMessageId
      ))
      .sort((left, right) => (
        toMs(left.timestamp) - toMs(right.timestamp)
      ));

    const remaining = [...records];

    for (const message of cloudMessages) {
      const messageMs = toMs(message.timestamp);

      let best = null;

      for (const record of remaining) {
        const dueMs = toMs(record.scheduledFor);

        if (dueMs > messageMs + EARLY_TOLERANCE_MS) {
          continue;
        }

        if (messageMs - dueMs > MAX_LATE_MS) {
          continue;
        }

        if (!best || dueMs > toMs(best.scheduledFor)) {
          best = record;
        }
      }

      if (!best) {
        continue;
      }

      const matched = best;
      const index = remaining.indexOf(matched);

      if (index >= 0) {
        remaining.splice(index, 1);
      }

      let didMark = false;

      await db.transaction(
        'rw',
        db.scheduledMessages,
        db.messages,
        async () => {
          const current = await db.scheduledMessages.get(matched.id);

          // 并发时可能已被别处处理，重新确认一次再写。
          if (
            !current ||
            (current.status !== 'pending' && current.status !== 'cancelled')
          ) {
            return;
          }

          await db.scheduledMessages.update(matched.id, {
            status: 'sent',
            sentMessageId: message.id,
            sentVia: 'cloud',
            cancelledReason: '',
            updatedAt: new Date().toISOString()
          });

          await db.messages.update(message.id, {
            metadata: {
              ...(message.metadata || {}),
              scheduledMessageId: matched.id
            }
          });

          didMark = true;
        }
      );

      if (!didMark) {
        continue;
      }

      markedCount += 1;

      if (typeof onMarkedSent === 'function') {
        try {
          await onMarkedSent({ ...matched, status: 'sent' });
        } catch (error) {
          console.warn(
            '[ScheduledCloudReconcile] 处理已发送回调失败：',
            error
          );
        }
      }
    }
  }

  if (markedCount > 0) {
    console.log(
      '[ScheduledCloudReconcile] 已把云端代发的预约单标记为已抵达：',
      markedCount
    );
  }

  return markedCount;
};

/**
 * 把云服务器已经代发出去的预约单，在本地标记为已抵达。
 *
 * 可以随时重复调用，没有可对上的记录时几乎不花时间。
 * 同一时刻只会跑一次，并发调用共用同一次结果。
 *
 * onMarkedSent(record)：每标记一张后调用，用来给周期性提醒排下一次。
 */
export const reconcileCloudDeliveredScheduledMessages = async ({
  onMarkedSent
} = {}) => {
  if (inFlight) {
    return inFlight;
  }

  inFlight = runReconcile(onMarkedSent)
    .catch((error) => {
      console.warn(
        '[ScheduledCloudReconcile] 对账失败：',
        error
      );

      return 0;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};
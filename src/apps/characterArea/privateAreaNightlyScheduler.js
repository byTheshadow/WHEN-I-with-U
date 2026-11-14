// src/apps/characterArea/privateAreaNightlyScheduler.js
//
// 角色专属区域——"每晚自动整理"（切片 C）。
//
// 挂进 globalChatScheduler.js 的共享基准 tick（不另起 setInterval），只处理在
// 区域页里选了"每晚自动"的聊天（chats.privateAreaAutoOrganize === 'nightly'）。
//
// 时间：晚上 22 点之后开始，一直到凌晨 5 点之前都算"这一晚"。一晚最多整理一次，
// 靠 chats.privateAreaLastNightlyDate 记"这一晚"的日期（凌晨 5 点前算前一天晚上，
// 所以熬夜到 1 点才打开 App，不会在同一晚里补跑第二次）。尝试一开始就记，不管
// 结果成功还是失败——失败了这一晚也不再重试，避免接口一直出错时每隔几分钟重复
// 请求。App 要开着才会跑，这是定好的限制。
//
// 检查本身只比较小时数和一个字段，不调AI；真正整理时才调用一次
// runPrivateAreaSession（还没有区域的聊天，角色可以选择这一晚先不创建）。
import db from '../../db';
import { runPrivateAreaSession } from './privateAreaSession';
import { AUTO_ORGANIZE_NIGHTLY } from './characterAreaService';

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

let isRunning = false;

const pad = (value) => String(value).padStart(2, '0');

// "这一晚"的日期标记：往前推 5 小时再取日期，22 点到次日 5 点之间都落在同一天。
export const getNightKey = (now = new Date()) => {
  const shifted = new Date(now.getTime() - NIGHT_END_HOUR * HOUR_MS);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
};

export const isNightTime = (now = new Date()) => {
  const hour = now.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
};

export const runPrivateAreaNightly = async (providedChats = null) => {
  if (isRunning) return;

  const now = new Date();
  if (!isNightTime(now)) return;

  isRunning = true;

  try {
    const chats = providedChats || (await db.chats.toArray());
    const nightKey = getNightKey(now);

    for (const chat of chats) {
      if (!chat?.id || !chat?.characterId) continue;
      if (chat.privateAreaAutoOrganize !== AUTO_ORGANIZE_NIGHTLY) continue;
      if (chat.privateAreaLastNightlyDate === nightKey) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        const character = await db.characters.get(chat.characterId);
        if (!character) continue;

        // 先记下这一晚已经尝试过，再去整理。
        // eslint-disable-next-line no-await-in-loop
        await db.chats.update(chat.id, { privateAreaLastNightlyDate: nightKey });

        // eslint-disable-next-line no-await-in-loop
        await runPrivateAreaSession({ chatId: chat.id, character, source: 'nightly' });
      } catch (error) {
        console.warn(`[characterArea] 夜间整理失败 chatId=${chat.id}：`, error);
      }
    }
  } catch (error) {
    console.warn('[characterArea] 夜间整理调度失败：', error);
  } finally {
    isRunning = false;
  }
};
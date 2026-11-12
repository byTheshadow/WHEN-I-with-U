// src/apps/messages/toys/toySession.js
//
// 角色自己决定做小玩具之后的后台一步：由 aiService.js 在回复写入之后动态 import 调用，
// 不等待结果，失败也不影响已经保存的回复（和 greetingSession.js 同一套做法）。
// 真正的生成、写卡片都在 toyService.js 里，这里只负责记冷却和选来源。

import db from '../../../db';
import { startToyMaking, TOY_SOURCE } from './toyService';

/**
 * explicit 为 true 表示用户在聊天里直接点名要的：不算角色自己主动做的，不占冷却。
 * 返回 startToyMaking 的结果；任何报错都只在控制台提示，不往外抛。
 */
export const runToySession = async ({ chatId, character, idea = '', explicit = false }) => {
  try {
    if (!chatId || !character?.id) return { started: false, reason: 'invalid' };

    const result = await startToyMaking({
      chatId,
      character,
      request: idea,
      source: explicit ? TOY_SOURCE.USER_ASK : TOY_SOURCE.CHARACTER,
    });

    // 只有真的开始做了，才记冷却起点。制作失败也算（它已经花掉了一次生成）。
    if (result.started && !explicit) {
      await db.chats.update(chatId, { toyLastAutoAt: Date.now() });
    }

    return result;
  } catch (error) {
    console.warn('[ToySession] 开始制作失败：', error);
    return { started: false, reason: 'error' };
  }
};
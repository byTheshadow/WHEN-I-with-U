// src/apps/focus/focusMuteGuard.js
//
// 给"手里只有 chatId、没有聊天对象"的入口用的异步判断。
// 手里已经有聊天对象的入口，直接用 focusMuteState.js 里同步的 isFocusMuted(chat)。
// 任何失败都当作"没有静音"，绝不能因为这个判断出错而阻断原本的功能。

import db from '../../db';
import { isFocusMuted } from './focusMuteState';

export const isChatIdFocusMuted = async (chatId) => {
  try {
    const id = Number(chatId);

    if (!Number.isFinite(id)) return false;

    const chat = await db.chats.get(id);

    return isFocusMuted(chat);
  } catch (error) {
    console.warn('[focusMuteGuard] 读取专注静音状态失败，按未静音处理：', error);
    return false;
  }
};
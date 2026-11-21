// src/apps/focus/focusScheduledDefer.js
//
// 预约消息到点时，如果这个聊天窗正被专注静音，就把这一条顺延到静音结束之后再发，
// 不丢，也不会让聊天上下文断层。做法和角色"暂时不在线"结束后顺延自动回复一致。
//
// 由 scheduledMessageService.js 的 executeScheduledMessage 在领取预约单之后、
// 生成消息之前调用。返回 true 表示这一条已经被顺延，调用方应当直接返回。
// 任何失败都返回 false（按没有静音处理），不能因为这里出错而让预约消息发不出去。

import db from '../../db';
import { getFocusMuteState } from './focusMuteState';

// 静音一结束就发，会和别的东西撞在同一分钟里，多等一分钟错开。
const DEFER_PAD_MS = 60 * 1000;

export const deferScheduledMessageIfFocusMuted = async (scheduledMessage) => {
  try {
    if (!scheduledMessage?.id || scheduledMessage.chatId == null) return false;

    const chat = await db.chats.get(scheduledMessage.chatId);
    const state = getFocusMuteState(chat);

    if (!state.muted) return false;

    await db.scheduledMessages.update(scheduledMessage.id, {
      status: 'pending',
      // 领取时 attemptCount 加过一，这一次不是生成失败，把它还回去。
      attemptCount: 0,
      scheduledFor: new Date(state.until.getTime() + DEFER_PAD_MS).toISOString(),
      focusDeferred: true,
      updatedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.warn('[focusScheduledDefer] 顺延预约消息失败，按未静音处理：', error);
    return false;
  }
};
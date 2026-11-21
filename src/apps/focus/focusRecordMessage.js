// src/apps/focus/focusRecordMessage.js
//
// 把一次专注的结果写进被通知的聊天窗，作为一条普通消息（type: 'focus_record'）。
// 写法和 harpChatService / completeTaskWithNote 一致：往 db.messages 插一条真实消息，
// 再派发 'new-local-message-inserted' 让聊天窗刷新。
//
// 注意：这里不会触发角色回复。专注刚结束时用户可能还想休息或写总结，
// 角色的下一次回复由用户之后正常发消息来触发，那时它已经读到这条记录。
//
// recordedToChat 保证同一次专注只写一次，即使页面被反复打开也不会重复。

import db from '../../db';
import { markFocusSessionRecorded } from './focusSessionService';
import { buildFocusRecordMeta, describeFocusRecordForUser } from './focusRecordDescribe';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

/**
 * 给这次专注涉及的每个聊天窗各写一条记录。返回实际写入的条数。
 * session 需要是已经结束（completed / abandoned）的记录。
 */
export const writeFocusRecordToChats = async (session) => {
  if (!session || session.id === undefined || session.id === null) return 0;
  if (session.status !== 'completed' && session.status !== 'abandoned') return 0;

  const fresh = await db.focusSessions.get(session.id);
  if (!fresh || fresh.recordedToChat) return 0;

  const merged = { ...fresh, ...session, id: fresh.id };
  const meta = buildFocusRecordMeta(merged);
  const content = describeFocusRecordForUser(meta);
  const timestamp = new Date().toISOString();
  let written = 0;

  for (const chatId of fresh.chatIds || []) {
    try {
      const chat = await db.chats.get(chatId);
      if (!chat?.characterId) continue;

      await db.messages.add({
        chatId,
        characterId: chat.characterId,
        sender: 'user',
        type: 'focus_record',
        content,
        metadata: meta,
        isRead: true,
        timestamp,
      });
      await db.chats.update(chatId, { updatedAt: timestamp });
      dispatchLocalMessageEvent(chatId);
      written += 1;
    } catch (error) {
      console.warn('[focus] 写入专注记录失败:', chatId, error);
    }
  }

  // 没通知任何人也算处理过，避免每次打开都重试。
  await markFocusSessionRecorded(fresh.id);

  return written;
};

/** 打开专注页时调用：把"已结算但还没写进聊天"的记录补上。 */
export const recordUnwrittenFocusSessions = async () => {
  const rows = await db.focusSessions.toArray();
  let total = 0;

  for (const row of rows) {
    if (row.status === 'running' || row.recordedToChat) continue;
    total += await writeFocusRecordToChats(row);
  }

  return total;
};

// src/apps/focus/focusNoteService.js
//
// 角色的"小纸条"：专注开始时留一张，专注完成（含提前结束）时留一张。
// 内容由 AI 现生成（复用 interactionAiService 里的取上下文和请求函数，走现有 apiConfig），
// 写成聊天里的一条 type 为 'focus_note' 的普通消息。
//
// 约定：
// - 不触发角色回复，写入时标记为已读，不产生未读提示，不算打扰。
// - 放弃不留结束纸条（那种时候安静最好，界面上只有一句预设的体贴话）。
// - 生成失败、返回空、带问句，都只是安静地没有这张纸条，不影响专注本身。
// - startNoteDone / endNoteDone 是写在专注记录上的不建索引字段，防止同一次重复写。

import db from '../../db';
import {
  getGenerationContext,
  requestAiText,
} from '../messages/interactions/interactionAiService';
import {
  FOCUS_NOTE_KINDS,
  buildFocusNoteMeta,
  buildFocusNotePrompt,
  cleanFocusNoteText,
} from './focusNoteDescribe';

const END_NOTE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

const writeNoteToChat = async (session, chatId, kind) => {
  try {
    const context = await getGenerationContext(chatId);
    if (!context) return false;

    const { character, apiConfig } = context;
    const systemPrompt = buildFocusNotePrompt({ character, session, kind });
    const text = cleanFocusNoteText(await requestAiText({ apiConfig, systemPrompt }));

    if (!text) return false;

    // 开始纸条要是在 AI 回来之前用户就已经结束了，再放进去就怪了，直接不写。
    if (kind === FOCUS_NOTE_KINDS.START) {
      const latest = await db.focusSessions.get(session.id);
      if (!latest || latest.status !== 'running') return false;
    }

    const timestamp = new Date().toISOString();

    await db.messages.add({
      chatId,
      characterId: character.id,
      sender: 'character',
      type: 'focus_note',
      content: text,
      metadata: buildFocusNoteMeta(session, kind),
      isRead: true,
      timestamp,
    });
    await db.chats.update(chatId, { updatedAt: timestamp });
    dispatchLocalMessageEvent(chatId);

    return true;
  } catch (error) {
    console.warn('[focus] 写入小纸条失败:', chatId, error);
    return false;
  }
};

/** 专注刚开始：给每个被通知的聊天各留一张开始纸条。永远不会抛错，调用方不用 await。 */
export const writeStartNotes = async (session) => {
  try {
    if (!session || session.id === undefined || session.id === null) return 0;

    const fresh = await db.focusSessions.get(session.id);
    if (!fresh || fresh.startNoteDone || !(fresh.chatIds || []).length) return 0;

    await db.focusSessions.update(fresh.id, { startNoteDone: true });

    const merged = { ...fresh, ...session, id: fresh.id };
    const results = await Promise.all(
      fresh.chatIds.map((chatId) => writeNoteToChat(merged, chatId, FOCUS_NOTE_KINDS.START)),
    );

    return results.filter(Boolean).length;
  } catch (error) {
    console.warn('[focus] 开始纸条处理失败:', error);
    return 0;
  }
};

/** 专注完成（含提前结束）：留结束纸条。放弃的不留。永远不会抛错。 */
export const writeEndNotes = async (session) => {
  try {
    if (!session || session.id === undefined || session.id === null) return 0;

    const fresh = await db.focusSessions.get(session.id);
    if (!fresh || fresh.status !== 'completed') return 0;
    if (fresh.endNoteDone || !(fresh.chatIds || []).length) return 0;

    await db.focusSessions.update(fresh.id, { endNoteDone: true });

    const merged = { ...fresh, ...session, id: fresh.id };
    const results = await Promise.all(
      fresh.chatIds.map((chatId) => writeNoteToChat(merged, chatId, FOCUS_NOTE_KINDS.END)),
    );

    return results.filter(Boolean).length;
  } catch (error) {
    console.warn('[focus] 结束纸条处理失败:', error);
    return 0;
  }
};

/**
 * 打开专注页时调用：用户在专注期间离开页面，到点时没人写结束纸条，
 * 回来后补上。只补最近 3 小时内结束的，太久以前的不再补。
 */
export const writeUnwrittenEndNotes = async () => {
  try {
    const rows = await db.focusSessions.where('status').equals('completed').toArray();
    const cutoff = Date.now() - END_NOTE_MAX_AGE_MS;
    let total = 0;

    for (const row of rows) {
      if (row.endNoteDone) continue;
      const endedAt = row.endedAt ? new Date(row.endedAt).getTime() : 0;
      if (!endedAt || endedAt < cutoff) continue;
      total += await writeEndNotes(row);
    }

    return total;
  } catch (error) {
    console.warn('[focus] 补写结束纸条失败:', error);
    return 0;
  }
};

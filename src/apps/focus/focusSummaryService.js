// src/apps/focus/focusSummaryService.js
//
// 专注结束后，用户给被通知的角色留几句总结。
// - 手写，或者"AI 起草"（走现有 apiConfig，用 aiService 的 generateResponse，会一并享受备用 API）。
// - 发送：每个被通知的聊天各写一条普通文字消息（sender 为 user，metadata.source 为 focus_summary），
//   然后才触发这些角色回应一次。这是整个专注流程里唯一会主动叫角色回复的地方。
// - summarySent 写在专注记录上，防止同一次专注发两遍。

import db from '../../db';
import { generateResponse, triggerAiResponse } from '../../services/aiService';

const MAX_SUMMARY_LENGTH = 300;

const removeEmoji = (text = '') =>
  String(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

const cleanText = (value, max = 60) => String(value || '').trim().slice(0, max);

/**
 * 让 AI 替用户起草一段总结，只返回文字，不写任何消息。失败会抛错，由界面显示提示。
 * 起草的是"用户对角色说的话"，第一人称，只依据专注记录里的事实，不编造细节。
 */
export const draftFocusSummary = async (session, names = []) => {
  const task = cleanText(session?.task);
  const place = cleanText(session?.place, 12);
  const planned = Math.max(0, Math.round(Number(session?.durationMinutes) || 0));
  const actual = Math.max(0, Math.round(Number(session?.actualMinutes) || 0));
  const abandoned = session?.status === 'abandoned';
  const early = !abandoned && planned > 0 && actual < planned;
  const reason = cleanText(session?.abandonReason, 80);
  const target = names.length ? names.join('、') : 'TA';

  const outcome = abandoned
    ? `中途放弃了，实际专注了 ${actual} 分钟`
    : early
      ? `提前结束了，实际专注了 ${actual} 分钟（原计划 ${planned} 分钟）`
      : `按计划完成了，共 ${actual} 分钟`;

  const system = `你在帮用户写一小段话，用户刚结束一次专注，想把这一轮的情况告诉${target}。

已知的事实只有这些，不要编造任何别的细节：
- 做的事：${task || '没有写具体内容'}
- 地点：${place || '没有写'}
- 结果：${outcome}
${abandoned && reason ? `- 用户自己写的放弃原因：${reason}` : ''}

要求：
- 以用户的第一人称，对${target}说话，像发给熟人的一条聊天消息；
- 一到三句话，总共 20 到 90 个汉字；
- 语气自然、轻松，不要浮夸；
- 放弃的情况下语气平和，不自责也不找借口；
- 不使用 Emoji；
- 不要输出标题、引号、Markdown 或任何说明，只输出这段话本身。`;

  const raw = await generateResponse([
    { role: 'system', content: system },
    { role: 'user', content: '请写这段话。' },
  ]);

  const text = removeEmoji(raw)
    .replace(/^["'「『“]+|["'」』”]+$/g, '')
    .trim()
    .slice(0, MAX_SUMMARY_LENGTH);

  if (!text) throw new Error('focus_summary_empty');

  return text;
};

/**
 * 把总结发给这次专注通知过的每个聊天，并让这些角色各回应一次。
 * 返回实际写入的聊天数。重复调用会直接返回 0。
 */
export const sendFocusSummary = async (session, text) => {
  const content = removeEmoji(text).slice(0, MAX_SUMMARY_LENGTH);
  if (!content || !session || session.id === undefined || session.id === null) return 0;

  const fresh = await db.focusSessions.get(session.id);
  if (!fresh || fresh.summarySent) return 0;

  await db.focusSessions.update(fresh.id, { summarySent: true });

  const sentChatIds = [];

  for (const chatId of fresh.chatIds || []) {
    try {
      const chat = await db.chats.get(chatId);
      if (!chat?.characterId) continue;

      const timestamp = new Date().toISOString();

      await db.messages.add({
        chatId,
        characterId: chat.characterId,
        sender: 'user',
        type: 'text',
        content,
        metadata: { source: 'focus_summary', sessionId: fresh.id },
        isRead: true,
        timestamp,
      });
      await db.chats.update(chatId, { updatedAt: timestamp });
      dispatchLocalMessageEvent(chatId);
      sentChatIds.push(chatId);
    } catch (error) {
      console.warn('[focus] 写入专注总结失败:', chatId, error);
    }
  }

  // 消息都写好之后才让角色回应，每个聊天一次；不等回复，界面立刻可以显示"已发送"。
  sentChatIds.forEach((chatId) => {
    Promise.resolve(triggerAiResponse(chatId)).catch((error) => {
      console.warn('[focus] 角色回应专注总结失败:', chatId, error);
    });
  });

  return sentChatIds.length;
};

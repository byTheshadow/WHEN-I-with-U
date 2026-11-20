import db from '../../db';
import { triggerAiResponse } from '../../services/aiService';
import { describeMelody } from './harpDescribe';
import { MIN_PHRASE_NOTES, isValidNoteIndex } from './harpNotes';
import { normalizeTimbreId, normalizeTune } from './harpTimbres';

// ============================================================
// 星光小竖琴 —— "弹给TA听"写回聊天。
//
// 跟"异地任务挑战"的 completeTaskWithNote 同一个写回方式：往 db.messages
// 插一条真实消息（type:'harp_melody'），再派发 'new-local-message-inserted'
// 让聊天窗刷新。aiService.js 的 formatMsgContentForPrompt 会把它变成一句
// 角色能读懂的话（见 harpDescribe.js 的 describeMelodyForPrompt），MessageRow.jsx 负责把它渲染成
// 可点击的旋律卡片。
//
// 文字描述见 harpDescribe.js（aiService.js 也从那里引用，避免循环依赖）。
// ============================================================

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

// 弹给 TA 听：写一条真实消息，然后立刻让角色回应一次。
// melody: { name, notes, delays, timbre? }（timbre 是音色 id，没有就是经典竖琴）
export const sendMelodyToCharacter = async ({ chatId, melody }) => {
  if (chatId === undefined || chatId === null) return null;

  const notes = Array.isArray(melody?.notes)
    ? melody.notes.filter(isValidNoteIndex)
    : [];
  if (notes.length < MIN_PHRASE_NOTES) return null;

  const chat = await db.chats.get(chatId);
  if (!chat?.characterId) return null;

  const name = String(melody?.name || '').trim().slice(0, 14) || '无名旋律';
  const delays = Array.isArray(melody?.delays) ? melody.delays.slice(0, notes.length) : [];
  const timbreId = normalizeTimbreId(melody?.timbre);
  // 收藏里角色写过的旋律可能带音色微调，发给 TA 时一起带上
  const tune = normalizeTune(melody?.tune);
  const timestamp = nowIso();

  const record = {
    chatId,
    characterId: chat.characterId,
    sender: 'user',
    type: 'harp_melody',
        content: `弹了一段旋律「${name}」：${describeMelody({ notes, delays, timbre: timbreId, tune })}`,
    metadata: {
      name,
      notes,
      delays,
      source: 'harp',
      ...(timbreId ? { timbre: timbreId } : {}),
      ...(tune ? { tune } : {}),
    },
    isRead: true,
    timestamp,
  };

  const id = await db.messages.add(record);
  // harpEnabled：之后这个聊天的系统提示词里才会带上 [HARP] 标签说明（见 harpPromptBlock.js）
  await db.chats.update(chatId, { updatedAt: timestamp, harpEnabled: true });
  dispatchLocalMessageEvent(chatId);

  // 立刻让角色回一条；失败不影响旋律已经写进聊天这件事
  try {
    void triggerAiResponse(chatId);
  } catch (error) {
    console.warn('[harp] 触发角色回应失败:', error);
  }

  return { ...record, id };
};
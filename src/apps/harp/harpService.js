import Dexie from 'dexie';
import db from '../../db';
import {
  MAX_MELODY_NOTES,
  MIN_PHRASE_NOTES,
  clampScoreGap,
  isValidNoteIndex,
} from './harpNotes';

import { normalizeTimbreId, normalizeTune } from './harpTimbres';
// ============================================================
// 星光小竖琴 —— 数据层。
//
// 跟"异地任务挑战"/DIY小屋一样挂在"这个聊天"（chatId）上，不挂在角色身上，
// 每个聊天有自己的一份收藏旋律。一张表：
//   harpMelodies：一首收藏的旋律一行。
//     { chatId, name, createdBy: 'user' | 'character',
//       notes: number[]   音符编号（0-9 是十根弦，10-13 是角色作曲用的 4、7，见 harpNotes.js），
//       delays: number[]  每个音距离上一个音的毫秒数，第一个是 0,
//       timbre?: string   音色 id（见 harpTimbres.js），没有这个字段就是经典竖琴,
//       createdAt }
//   只存音符编号和间隔，不存音频。createdBy 现在只会是 'user'，留给之后
//   "角色弹给你听、你把它收藏下来"的那一版用（那时写成 'character'）。
//
// 这一版（Slice A）只有"用户自己弹、自己收藏、自己重听"。"弹给TA听"
// 写回聊天、角色自己弹奏，是后面的切片，这个文件里没有任何 AI 调用。
// ============================================================

const nowIso = () => new Date().toISOString();

const MAX_NAME_LENGTH = 14;

// 把外面传进来的 notes/delays 整理干净：只留合法的音符编号，长度截到
// MAX_MELODY_NOTES，间隔限制在范围里，第一个间隔固定 0。
const normalizeMelody = (notes, delays) => {
  const cleanNotes = [];
  const cleanDelays = [];
  const sourceNotes = Array.isArray(notes) ? notes : [];
  const sourceDelays = Array.isArray(delays) ? delays : [];

  for (let k = 0; k < sourceNotes.length && cleanNotes.length < MAX_MELODY_NOTES; k += 1) {
    if (!isValidNoteIndex(sourceNotes[k])) continue;
    cleanNotes.push(sourceNotes[k]);
    // 间隔为 0 是和弦里同时响的音，要原样保留（clampScoreGap 对 0 返回 0）
    cleanDelays.push(cleanNotes.length === 1 ? 0 : clampScoreGap(sourceDelays[k]));
  }

  return { notes: cleanNotes, delays: cleanDelays };
};

export const getHarpMelodies = async (chatId) => {
  if (chatId === undefined || chatId === null) return [];

  return db.harpMelodies
    .where('[chatId+createdAt]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .toArray();
};

export const saveHarpMelody = async ({
  chatId,
  name,
  notes,
  delays,
  createdBy = 'user',
  timbre,
  tune,
}) => {
  if (chatId === undefined || chatId === null) return null;

  const melody = normalizeMelody(notes, delays);
  if (melody.notes.length < MIN_PHRASE_NOTES) return null;

  const existingCount = await db.harpMelodies.where('chatId').equals(chatId).count();
  const trimmedName = String(name || '').trim().slice(0, MAX_NAME_LENGTH);

  const record = {
    chatId,
    name: trimmedName || `无名旋律 ${existingCount + 1}`,
    createdBy: createdBy === 'character' ? 'character' : 'user',
    notes: melody.notes,
    delays: melody.delays,
    createdAt: nowIso(),
  };
  // 只在认得出音色时才写字段，没写的就是经典竖琴
  const timbreId = normalizeTimbreId(timbre);
   if (timbreId) record.timbre = timbreId;
  // 音色微调同理：三项都是中档就不写字段
  const tuneValue = normalizeTune(tune);
  if (tuneValue) record.tune = tuneValue;

  const id = await db.harpMelodies.add(record);
  return { ...record, id };
};

export const deleteHarpMelody = async (id) => {
  if (id === undefined || id === null) return;
  await db.harpMelodies.delete(id);
};
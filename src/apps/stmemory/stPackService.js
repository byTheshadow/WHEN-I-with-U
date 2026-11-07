// src/apps/stmemory/stPackService.js
//
// 记忆包库的数据层：包的增删改查 + 纯文本/Markdown 导入。
//
// 数据形状（见 db.version(110)）：
//   stMemoryPacks  一份包一行，只放元信息：标题、概览、块数、字数、
//                  chunkTokens（每块的 token 估算，选范围/算预算不用读原文）、
//                  imports（每次导入一条记录，带 importId）。
//   stPackChunks   原文切块，一块一行 {packId, importId, index, text, tokenEstimate}，
//                  用 [packId+index] 取一段范围。原文绝不放进包记录里。
//
// 导入时文件分块流式读取，不整份读进内存；写入分批 bulkAdd。
import db from '../../db';
import {
  CHUNK_TARGET_CHARS,
  FILE_READ_PIECE_BYTES,
  PLACEHOLDER_CHAR,
  PLACEHOLDER_USER,
  SOURCE_TYPE_TEXT,
} from './stPackConstants';
import { estimateTokens } from './stPackBudget';

const WRITE_BATCH_SIZE = 40;

const makeImportId = () => (
  `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
);

/**
 * 按"流"的方式把来源一段一段交给回调。来源可以是整段文本，也可以是 File。
 * File 用 slice + TextDecoder(stream) 分块读，跨块的多字节字符也能正确拼接。
 */
const readSourceInPieces = async (source, onPiece) => {
  if (typeof source?.text === 'string') {
    await onPiece(source.text);
    return;
  }

  const file = source?.file;
  if (!file) return;

  const decoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset < file.size) {
    const end = Math.min(offset + FILE_READ_PIECE_BYTES, file.size);
    const buffer = await file.slice(offset, end).arrayBuffer();
    offset = end;
    const piece = decoder.decode(buffer, { stream: offset < file.size });
    if (piece) await onPiece(piece);
  }
};

/**
 * 从缓冲区里按段落边界切出若干块。final=true 时把剩余的全部吐完。
 * 返回 { chunks, rest }。
 */
const takeChunks = (buffer, final) => {
  const chunks = [];
  let rest = buffer;

  while (rest.length >= CHUNK_TARGET_CHARS * 2 || (final && rest.length > 0)) {
    if (rest.length <= CHUNK_TARGET_CHARS) {
      chunks.push(rest);
      rest = '';
      break;
    }

    let cut = rest.lastIndexOf('\n', CHUNK_TARGET_CHARS);
    cut = cut < CHUNK_TARGET_CHARS * 0.5 ? CHUNK_TARGET_CHARS : cut + 1;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }

  return { chunks, rest };
};

// 把角色名/用户名换成占位符。长名字先换，避免短名字是长名字的一部分。
const buildNameReplacer = (charName, userName) => {
  const pairs = [
    [String(charName || '').trim(), PLACEHOLDER_CHAR],
    [String(userName || '').trim(), PLACEHOLDER_USER],
  ]
    .filter(([name]) => name.length > 0)
    .sort((a, b) => b[0].length - a[0].length);

  if (pairs.length === 0) return (text) => text;

  return (text) => pairs.reduce(
    (current, [name, placeholder]) => current.split(name).join(placeholder),
    text,
  );
};

export const getAllPacks = async () => (
  db.stMemoryPacks.orderBy('updatedAt').reverse().toArray()
);

export const getPack = async (packId) => db.stMemoryPacks.get(packId);

export const getPacksByIds = async (packIds) => {
  const ids = [...new Set((packIds || []).filter((id) => id != null))];
  if (ids.length === 0) return {};
  const rows = await db.stMemoryPacks.bulkGet(ids);
  const map = {};
  rows.forEach((row) => {
    if (row) map[row.id] = row;
  });
  return map;
};

/** 取一段范围内的原文块（含两端），按下标顺序。 */
export const getChunksInRange = async (packId, from, to) => (
  db.stPackChunks
    .where('[packId+index]')
    .between([packId, from], [packId, to], true, true)
    .toArray()
);

export const updatePackMeta = async (packId, fields) => {
  const patch = { updatedAt: new Date().toISOString() };
  if (typeof fields.title === 'string') patch.title = fields.title.trim() || '未命名记忆包';
  if (typeof fields.overview === 'string') patch.overview = fields.overview;
  await db.stMemoryPacks.update(packId, patch);
};

/**
 * 删除一个包：原文块、包记录，以及所有聊天上指向它的挂载。
 * 聊天用 filter 先筛出真正挂了它的，只改这些，不去重写其余聊天（聊天记录上
 * 可能带着背景图等大字段）。
 */
export const deletePack = async (packId) => {
  await db.stPackChunks.where('packId').equals(packId).delete();
  await db.chats
    .filter((chat) => (
      Array.isArray(chat.stPackLinks)
      && chat.stPackLinks.some((link) => link.packId === packId)
    ))
    .modify((chat) => {
      chat.stPackLinks = chat.stPackLinks.filter((link) => link.packId !== packId);
    });
  await db.stMemoryPacks.delete(packId);
};

/**
 * 导入前先数一遍字数和 token（同样是流式读，不占内存）。
 * 返回 { chars, tokens }。
 */
export const estimateSource = async (source) => {
  let chars = 0;
  let tokens = 0;

  await readSourceInPieces(source, async (piece) => {
    chars += piece.length;
    tokens += estimateTokens(piece);
    // 大文件时让出一下主线程，避免界面卡住。
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { chars, tokens };
};

/**
 * 把纯文本 / Markdown 导入成一个新的记忆包。
 *
 * source: { text } 或 { file }
 * options: { title, charName, userName, onProgress }
 * 返回新包的 id。出错时会清理已经写进去的半成品，再把错误抛出去。
 */
export const importTextAsPack = async (source, options = {}) => {
  const { title, charName, userName, onProgress } = options;
  const replaceNames = buildNameReplacer(charName, userName);
  const now = new Date().toISOString();
  const importId = makeImportId();

  const packId = await db.stMemoryPacks.add({
    title: String(title || '').trim() || '未命名记忆包',
    sourceType: SOURCE_TYPE_TEXT,
    createdAt: now,
    updatedAt: now,
    overview: '',
    chunkCount: 0,
    charCount: 0,
    tokenEstimate: 0,
    chunkTokens: [],
    imports: [],
  });

  try {
    const chunkTokens = [];
    let charCount = 0;
    let pending = [];
    let buffer = '';

    const flush = async () => {
      if (pending.length === 0) return;
      await db.stPackChunks.bulkAdd(pending);
      pending = [];
    };

    const pushChunk = async (rawText) => {
      const text = replaceNames(rawText);
      const tokenEstimate = estimateTokens(text);
      const index = chunkTokens.length;

      chunkTokens.push(tokenEstimate);
      charCount += text.length;
      pending.push({ packId, importId, index, text, tokenEstimate });

      if (pending.length >= WRITE_BATCH_SIZE) await flush();
    };

    await readSourceInPieces(source, async (piece) => {
      buffer += piece;
      const { chunks, rest } = takeChunks(buffer, false);
      buffer = rest;
      for (const chunk of chunks) {
        await pushChunk(chunk);
      }
      if (onProgress) onProgress({ chunks: chunkTokens.length, chars: charCount });
    });

    const { chunks: lastChunks } = takeChunks(buffer, true);
    for (const chunk of lastChunks) {
      await pushChunk(chunk);
    }
    await flush();

    if (chunkTokens.length === 0) {
      throw new Error('没有读到任何文字内容');
    }

    const tokenEstimate = chunkTokens.reduce((sum, value) => sum + value, 0);

    await db.stMemoryPacks.update(packId, {
      chunkCount: chunkTokens.length,
      charCount,
      tokenEstimate,
      chunkTokens,
      imports: [{
        importId,
        createdAt: now,
        label: '纯文本',
        firstIndex: 0,
        chunkCount: chunkTokens.length,
      }],
      updatedAt: new Date().toISOString(),
    });

    if (onProgress) onProgress({ chunks: chunkTokens.length, chars: charCount });

    return packId;
  } catch (error) {
    // 清理半成品，不留下读到一半的包。
    try {
      await db.stPackChunks.where('packId').equals(packId).delete();
      await db.stMemoryPacks.delete(packId);
    } catch (cleanupError) {
      console.warn('[stmemory] 清理未完成的导入失败：', cleanupError);
    }
    throw error;
  }
};

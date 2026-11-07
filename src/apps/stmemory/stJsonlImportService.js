// src/apps/stmemory/stJsonlImportService.js
//
// ST 聊天记录（.jsonl）导入：试跑预览 + 正式导入（新建包 / 追加新内容到已有包）。
//
// 流水线：解析（stJsonlParser）-> 清洗（stCleaning，每条消息单独做）-> 切块写库。
// 原文默认保留；说话人写成 {{user}} / {{char}} 占位符，名字也换成占位符，
// 这样同一个包可以挂到任何聊天。
//
// 增量导入：用聊天头里的 integrity（没有就用首条消息的时间+内容哈希）认出"同一份聊天"。
// 包上记着已经导入了多少条消息，以及这些消息的整体滚动摘要（lastHash）；再次导入同一份
// 聊天时，先确认新文件里前 N 条的整体摘要和上次一致（前面没有被改、删、换位置），
// 确认了才只处理后面新增的部分，否则拒绝追加，避免重复或错位。
// 序号和摘要都是清洗前的原始消息，所以改清洗规则不会影响增量判断。
import db from '../../db';
import { SOURCE_TYPE_ST_JSONL } from './stPackConstants';
import { estimateTokens } from './stPackBudget';
import {
  buildNameReplacer,
  makeImportId,
  writeStreamToPack,
} from './stPackService';
import {
  cleanMessageText,
  compileRules,
  scanPairedTags,
  summarizeTagScan,
} from './stCleaning';
import {
  formatMessageLine,
  hashMessage,
  readChatIdentity,
  rollHash,
  streamStChat,
} from './stJsonlParser';

const SAMPLE_LIMIT = 3;
const SAMPLE_CHARS = 160;

export const APPEND_STATUS = {
  OK: 'ok',
  CHANGED: 'changed',
  NONE: 'none',
};

export const findPackByIdentity = async (identityKey) => {
  if (!identityKey) return null;
  const found = await db.stMemoryPacks
    .filter((pack) => pack.source?.identityKey === identityKey)
    .first();
  return found || null;
};

const topKey = (counts) => {
  let best = '';
  let bestCount = 0;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  });
  return best;
};

const shorten = (text) => (
  text.length > SAMPLE_CHARS ? `${text.slice(0, SAMPLE_CHARS)}……` : text
);

/**
 * 试跑：整份文件走一遍，统计清洗后的结果，但不写任何东西。
 * 返回的数字都是"套用当前规则之后"的。
 */
export const previewStJsonl = async (file, rules) => {
  const { header, identityKey } = await readChatIdentity(file);
  const existingPack = await findPackByIdentity(identityKey);
  const compiled = compileRules(rules);

  const charNames = new Map();
  const userNames = new Map();
  const tagScan = new Map();
  const samples = [];
  const stats = {
    totalKept: 0,
    userMessages: 0,
    charMessages: 0,
    droppedEmpty: 0,
    cleanedChars: 0,
    cleanedTokens: 0,
    tailMessages: 0,
    tailChars: 0,
    tailTokens: 0,
  };

  const previous = existingPack?.source || null;
  const previousCount = previous?.messageCount || 0;
  let lastHashMatched = false;
  let running = '';

  const { skippedLines } = await streamStChat(file, {
    onMessage: (message, index) => {
      stats.totalKept += 1;
      const names = message.isUser ? userNames : charNames;
      if (message.name) names.set(message.name, (names.get(message.name) || 0) + 1);
      if (message.isUser) stats.userMessages += 1;
      else stats.charMessages += 1;

      running = rollHash(running, hashMessage(message));
      if (previous && index === previousCount - 1) {
        lastHashMatched = running === previous.lastHash;
      }

      // 标签扫描看的是清洗前的原文，已经加进规则的标签也照常列出。
      scanPairedTags(message.raw, tagScan);

      const cleaned = cleanMessageText(message.raw, compiled);
      const isTail = !previous || index >= previousCount;

      if (!cleaned) {
        stats.droppedEmpty += 1;
        if (samples.length < SAMPLE_LIMIT) {
          samples.push({ before: shorten(message.raw), after: '' });
        }
        return true;
      }

      const line = formatMessageLine(message, cleaned);
      const tokens = estimateTokens(line);
      stats.cleanedChars += line.length;
      stats.cleanedTokens += tokens;

      if (previous && isTail) {
        stats.tailMessages += 1;
        stats.tailChars += line.length;
        stats.tailTokens += tokens;
      }

      // 和不套任何规则时的整理结果比较，只有规则真的改动了的消息才拿来做示例。
      if (cleaned !== cleanMessageText(message.raw, []) && samples.length < SAMPLE_LIMIT) {
        samples.push({ before: shorten(message.raw), after: shorten(cleaned) });
      }
      return true;
    },
  });

  let appendStatus = null;
  if (previous) {
    if (stats.totalKept < previousCount || !lastHashMatched) appendStatus = APPEND_STATUS.CHANGED;
    else if (stats.totalKept === previousCount) appendStatus = APPEND_STATUS.NONE;
    else appendStatus = APPEND_STATUS.OK;
  }

  return {
    identityKey,
    existingPack,
    appendStatus,
    stats,
    samples,
    skippedLines,
    tagStats: summarizeTagScan(tagScan),
    // 说话人：群聊（角色一方不止一个名字）第一版不支持。
    charName: topKey(charNames) || header?.charName || '',
    charNames: [...charNames.keys()],
    userNames: [...userNames.keys()],
    headerUserName: header?.userName || '',
    isGroupChat: charNames.size > 1,
  };
};

class ImportAbort extends Error {}

/**
 * 正式导入。
 * options: { title, charName, userNames, rules, mode: 'new' | 'append', existingPackId, onProgress }
 * 返回 { packId, addedMessages, droppedEmpty }。出错时清理半成品再抛出。
 */
export const importStJsonl = async (file, options = {}) => {
  const {
    title, charName, userNames, rules, mode = 'new', existingPackId, onProgress,
  } = options;

  const isAppend = mode === 'append';
  const compiled = compileRules(rules);
  const replaceNames = buildNameReplacer(charName, userNames);
  const importId = makeImportId();
  const now = new Date().toISOString();

  const { identityKey } = await readChatIdentity(file);

  let existing = null;
  if (isAppend) {
    existing = await db.stMemoryPacks.get(existingPackId);
    if (!existing?.source) throw new ImportAbort('要追加的记忆包已经不存在了');
  }
  const previousCount = isAppend ? (existing.source.messageCount || 0) : 0;

  let packId = existingPackId;
  if (!isAppend) {
    packId = await db.stMemoryPacks.add({
      title: String(title || '').trim() || '未命名的 ST 聊天',
      sourceType: SOURCE_TYPE_ST_JSONL,
      createdAt: now,
      updatedAt: now,
      overview: '',
      chunkCount: 0,
      charCount: 0,
      tokenEstimate: 0,
      chunkTokens: [],
      imports: [],
    });
  }

  const run = {
    totalKept: 0,
    added: 0,
    droppedEmpty: 0,
    firstDate: '',
    lastDate: '',
    lastHash: '',
    checked: !isAppend,
  };

  try {
    const { chunkTokens, charCount } = await writeStreamToPack({
      packId,
      importId,
      startIndex: isAppend ? (existing.chunkCount || 0) : 0,
      replaceNames,
      onProgress,
      produce: async (emit) => {
        await streamStChat(file, {
          onMessage: async (message, index) => {
            run.totalKept += 1;
            if (!run.firstDate) run.firstDate = message.date;
            run.lastDate = message.date;
            run.lastHash = rollHash(run.lastHash, hashMessage(message));

            if (isAppend && index === previousCount - 1) {
              if (run.lastHash !== existing.source.lastHash) {
                throw new ImportAbort('这份聊天前面已导入的部分和上次不一样了，不能追加，请改为新建记忆包');
              }
              run.checked = true;
            }
            if (index < previousCount) return true;

            const cleaned = cleanMessageText(message.raw, compiled);
            if (!cleaned) {
              run.droppedEmpty += 1;
              return true;
            }
            run.added += 1;
            await emit(formatMessageLine(message, cleaned));
            return true;
          },
        });
      },
    });

    if (isAppend && (!run.checked || run.totalKept < previousCount)) {
      throw new ImportAbort('这份聊天前面已导入的部分和上次不一样了，不能追加，请改为新建记忆包');
    }
    if (chunkTokens.length === 0) {
      throw new ImportAbort(isAppend ? '没有新增的内容可以追加' : '清洗之后没有剩下任何内容，请检查清洗规则');
    }

    const source = {
      kind: SOURCE_TYPE_ST_JSONL,
      identityKey,
      firstDate: isAppend ? existing.source.firstDate : run.firstDate,
      lastDate: run.lastDate,
      messageCount: run.totalKept,
      lastHash: run.lastHash,
      charName: String(charName || ''),
      userNames: Array.isArray(userNames) ? userNames : [],
    };

    const baseTokens = isAppend ? (existing.chunkTokens || []) : [];
    const allTokens = baseTokens.concat(chunkTokens);

    await db.stMemoryPacks.update(packId, {
      source,
      chunkCount: allTokens.length,
      charCount: (isAppend ? (existing.charCount || 0) : 0) + charCount,
      tokenEstimate: allTokens.reduce((sum, value) => sum + value, 0),
      chunkTokens: allTokens,
      imports: (isAppend ? existing.imports || [] : []).concat([{
        importId,
        createdAt: now,
        label: isAppend ? 'ST 聊天记录（追加）' : 'ST 聊天记录',
        firstIndex: baseTokens.length,
        chunkCount: chunkTokens.length,
        charCount,
        messageCount: run.added,
        sourceBefore: isAppend ? existing.source : null,
      }]),
      updatedAt: new Date().toISOString(),
    });

    return { packId, addedMessages: run.added, droppedEmpty: run.droppedEmpty };
  } catch (error) {
    try {
      await db.stPackChunks.where('importId').equals(importId).delete();
      if (!isAppend) await db.stMemoryPacks.delete(packId);
    } catch (cleanupError) {
      console.warn('[stmemory] 清理未完成的导入失败：', cleanupError);
    }
    throw error;
  }
};
// src/apps/stmemory/stSummaryEngine.js
//
// 总结式导入的生成引擎：从记忆包已存的原文块里按消息条数分批，每批调一次 AI，
// 生成一条独立的总结条目（存进包的 summaryEntries）。
//
//   - 只支持 ST 聊天包（sourceType 'st-jsonl'）。原文块里每条消息以行首的
//     "{{user}}: " 或 "{{char}}: " 开头，引擎靠它把消息重新切出来。
//   - 原文块是按字数切的、不和消息对齐，所以顺序读块、边读边拼；同一时刻内存里
//     只有一小页块和一条没拼完的消息，不会把整个包读进内存。
//   - 进度游标不单独存：取最后一条带覆盖范围的总结的 coveredThrough + 1。
//     手写的总结没有覆盖范围，不参与。删掉最后一条总结 = 游标往回退，那一段会被重新总结。
//   - 暂停是"这一批做完后停下"（已经发出去的请求没法取消，结果照常保存）。
//   - 某一批失败：自动重试，仍失败就停在这一批并返回原因，已生成的条目保留；
//     再点继续会从这一批重来。
//
// 注意：这个文件会 import aiService，所以只能被界面组件引用，绝不能被
// aiService 的引用链（stPackInjectionService 等）引用，否则循环引用。
import db from '../../db';
import { generateResponse } from '../../services/aiService';
import { estimateTokens } from './stPackBudget';
import { SOURCE_TYPE_ST_JSONL } from './stPackConstants';
import { getPack } from './stPackService';
import { addSummaryEntry } from './stSummaryService';
import { buildBatchRequest, getEffectivePromptText } from './stSummaryConfig';

const CHUNK_PAGE_SIZE = 8;
const MAX_ATTEMPTS = 3; // 第一次 + 自动重试 2 次
const RETRY_DELAY_MS = 1500;

const MESSAGE_START = /^\{\{(?:user|char)\}\}: /gm;

const runningPacks = new Set();

export const isSummarizing = (packId) => runningPacks.has(packId);

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** 取"已总结到哪里"：最后一条带覆盖范围的总结的 coveredThrough + 1，没有就是 0。 */
export const getSummaryCursor = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(list[i]?.coveredThrough)) return list[i].coveredThrough + 1;
  }
  return 0;
};

/**
 * 顺序读出包里的消息。next() 每次返回下一条完整消息
 *   { ordinal, text, endChunk }
 * 读完返回 null。endChunk 是这条消息最后一个字落在的块下标。
 */
const createMessageReader = (packId, chunkCount) => {
  let nextChunk = 0;
  let ordinal = 0;
  let current = null; // { text, endChunk }
  const ready = [];

  const appendToCurrent = (piece, chunkIndex) => {
    if (!piece) return;
    if (!current) current = { text: '', endChunk: chunkIndex };
    current.text += piece;
    current.endChunk = chunkIndex;
  };

  const closeCurrent = () => {
    if (current && current.text.trim()) {
      ready.push({
        ordinal,
        text: current.text.replace(/\s+$/, ''),
        endChunk: current.endChunk,
      });
      ordinal += 1;
    }
    current = null;
  };

  const consumeChunk = (text, chunkIndex) => {
    MESSAGE_START.lastIndex = 0;
    let last = 0;
    let match = MESSAGE_START.exec(text);
    while (match) {
      appendToCurrent(text.slice(last, match.index), chunkIndex);
      closeCurrent();
      last = match.index;
      match = MESSAGE_START.exec(text);
    }
    appendToCurrent(text.slice(last), chunkIndex);
  };

  const fill = async () => {
    while (ready.length === 0 && nextChunk < chunkCount) {
      const from = nextChunk;
      const to = Math.min(chunkCount - 1, from + CHUNK_PAGE_SIZE - 1);
      const rows = await db.stPackChunks
        .where('[packId+index]')
        .between([packId, from], [packId, to], true, true)
        .toArray();
      rows.sort((a, b) => a.index - b.index);
      rows.forEach((row) => consumeChunk(String(row.text || ''), row.index));
      nextChunk = to + 1;
    }
    if (ready.length === 0 && nextChunk >= chunkCount) closeCurrent();
  };

  return {
    next: async () => {
      if (ready.length === 0) await fill();
      return ready.shift() || null;
    },
  };
};

/** 数一数包里实际存着多少条消息（读一遍块，只数行首标记，不留内容）。 */
export const countStoredMessages = async (packId, chunkCount) => {
  let count = 0;
  for (let from = 0; from < chunkCount; from += CHUNK_PAGE_SIZE) {
    const to = Math.min(chunkCount - 1, from + CHUNK_PAGE_SIZE - 1);
    const rows = await db.stPackChunks
      .where('[packId+index]')
      .between([packId, from], [packId, to], true, true)
      .toArray();
    rows.forEach((row) => {
      MESSAGE_START.lastIndex = 0;
      count += (String(row.text || '').match(MESSAGE_START) || []).length;
    });
  }
  return count;
};

const assertSupported = (pack) => {
  if (!pack) throw new Error('记忆包不存在');
  if (pack.sourceType !== SOURCE_TYPE_ST_JSONL) {
    throw new Error('这一步只支持 ST 聊天包生成总结');
  }
};

/** 从游标处读出下一批消息（最多 batchMessages 条）。 */
const readNextBatch = async (pack, cursor, batchMessages) => {
  const reader = createMessageReader(pack.id, pack.chunkCount || 0);

  for (let skipped = 0; skipped < cursor; skipped += 1) {
    // 跳过已经总结过的消息。
    // eslint-disable-next-line no-await-in-loop
    if (!(await reader.next())) return { reader, messages: [] };
  }

  const messages = [];
  while (messages.length < batchMessages) {
    // eslint-disable-next-line no-await-in-loop
    const message = await reader.next();
    if (!message) break;
    messages.push(message);
  }
  return { reader, messages };
};

const toBatchText = (messages) => messages.map((message) => message.text).join('\n\n');

const draftFromBatch = (text, messages) => ({
  text,
  coveredFrom: messages[0].ordinal,
  coveredThrough: messages[messages.length - 1].ordinal,
  coveredChunkThrough: messages[messages.length - 1].endChunk,
});

const requestSummary = async (promptText, batchText) => {
  const output = await generateResponse([
    { role: 'user', content: buildBatchRequest(promptText, batchText) },
  ]);
  const text = String(output || '').trim();
  if (!text) throw new Error('模型返回了空内容');
  return text;
};

/** 带自动重试的一次请求。control.stopped 为真时不再重试，直接抛出最后一次的错误。 */
const requestSummaryWithRetry = async (promptText, batchText, control) => {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await requestSummary(promptText, batchText);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS && !control?.stopped) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        break;
      }
    }
  }
  throw lastError || new Error('总结请求失败');
};

/**
 * 试跑：只做下一批，返回生成结果让用户看，不保存。
 * 返回 { draft, messageCount, inputTokens } ；没有可总结的内容时返回 null。
 */
export const previewNextBatch = async ({ packId, settings }) => {
  const pack = await getPack(packId);
  assertSupported(pack);

  const cursor = getSummaryCursor(pack.summaryEntries);
  const { messages } = await readNextBatch(pack, cursor, settings.batchMessages);
  if (messages.length === 0) return null;

  const batchText = toBatchText(messages);
  const text = await requestSummaryWithRetry(getEffectivePromptText(settings), batchText, null);

  return {
    draft: draftFromBatch(text, messages),
    messageCount: messages.length,
    inputTokens: estimateTokens(batchText),
  };
};

/**
 * 正式批量生成。control = { stopped: false }，界面把 stopped 置 true 即"暂停"。
 * onProgress({ entries, cursor }) 每完成一批调用一次。
 * 返回 { status: 'done' | 'paused' | 'failed', error?, cursor }。
 */
export const runSummarization = async ({
  packId, settings, control, onProgress,
}) => {
  if (runningPacks.has(packId)) throw new Error('这个记忆包正在生成总结');
  runningPacks.add(packId);

  try {
    const pack = await getPack(packId);
    assertSupported(pack);

    const promptText = getEffectivePromptText(settings);
    let cursor = getSummaryCursor(pack.summaryEntries);

    // 跳过已总结的部分只做一次，之后顺着同一个读取器往下取批。
    const reader = createMessageReader(pack.id, pack.chunkCount || 0);
    for (let skipped = 0; skipped < cursor; skipped += 1) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await reader.next())) return { status: 'done', cursor };
    }

    for (;;) {
      if (control?.stopped) return { status: 'paused', cursor };

      const messages = [];
      while (messages.length < settings.batchMessages) {
        // eslint-disable-next-line no-await-in-loop
        const message = await reader.next();
        if (!message) break;
        messages.push(message);
      }
      if (messages.length === 0) return { status: 'done', cursor };

      let text;
      try {
        // eslint-disable-next-line no-await-in-loop
        text = await requestSummaryWithRetry(promptText, toBatchText(messages), control);
      } catch (error) {
        return { status: 'failed', error: error?.message || '总结请求失败', cursor };
      }

      // eslint-disable-next-line no-await-in-loop
      await addSummaryEntry(packId, draftFromBatch(text, messages));
      cursor = messages[messages.length - 1].ordinal + 1;

      // eslint-disable-next-line no-await-in-loop
      const latest = await getPack(packId);
      onProgress?.({ entries: latest?.summaryEntries || [], cursor });
    }
  } finally {
    runningPacks.delete(packId);
  }
};
// src/apps/stmemory/stSummaryService.js
//
// 记忆包上的总结条目：存在包记录的 summaryEntries 数组里（条目数量少，和长 RP 的
// summaryEntries 同样的做法），每条独立、可编辑、可删除。
//
//   entry = {
//     id, text, tokenEstimate,
//     coveredFrom, coveredThrough,   // 覆盖的消息序号（0 起，指包里实际存着的消息，清洗后为空的不算）；手写条目为 null
//     coveredChunkThrough,           // 覆盖到的最后一个原文块下标；撤销导入时靠它判断这条总结要不要一起去掉
//     createdAt, updatedAt,
//   }
//
// 每次改动都在一个事务里"读出来 -> 改 -> 写回"，避免两处同时改互相覆盖。
// 注意：这个文件不要 import aiService，避免循环引用（生成总结的逻辑放在别的文件里）。
import db from '../../db';
import { estimateTokens } from './stPackBudget';

const makeEntryId = () => (
  `sum_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
);

const readEntries = (pack) => (
  Array.isArray(pack?.summaryEntries) ? pack.summaryEntries : []
);

const mutateEntries = async (packId, mutate) => (
  db.transaction('rw', db.stMemoryPacks, async () => {
    const pack = await db.stMemoryPacks.get(packId);
    if (!pack) throw new Error('记忆包不存在');
    const next = mutate(readEntries(pack));
    await db.stMemoryPacks.update(packId, {
      summaryEntries: next,
      updatedAt: new Date().toISOString(),
    });
    return next;
  })
);

/** 追加一条总结条目，返回新条目。 */
export const addSummaryEntry = async (packId, {
  text, coveredFrom = null, coveredThrough = null, coveredChunkThrough = null,
} = {}) => {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('总结内容不能为空');

  const now = new Date().toISOString();
  const entry = {
    id: makeEntryId(),
    text: clean,
    tokenEstimate: estimateTokens(clean),
    coveredFrom,
    coveredThrough,
    coveredChunkThrough,
    createdAt: now,
    updatedAt: now,
  };
  await mutateEntries(packId, (entries) => [...entries, entry]);
  return entry;
};

/** 改一条总结的正文。正文清空时不保存（要删请用 deleteSummaryEntry）。 */
export const updateSummaryEntryText = async (packId, entryId, text) => {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('总结内容不能为空，想去掉请直接删除这一条');

  const now = new Date().toISOString();
  return mutateEntries(packId, (entries) => entries.map((entry) => (
    entry.id === entryId
      ? {
        ...entry, text: clean, tokenEstimate: estimateTokens(clean), updatedAt: now,
      }
      : entry
  )));
};

export const deleteSummaryEntry = async (packId, entryId) => (
  mutateEntries(packId, (entries) => entries.filter((entry) => entry.id !== entryId))
);
// src/apps/stmemory/stPackProgress.js
//
// 总结进度：已总结几批 / 一共几批。只有 ST 聊天往事有。
// 一共几批 = ceil(消息总数 / 每批条数)，已总结几批 = ceil(已总结到第几条 / 每批条数)。
// 首页的雪花亮几条臂、详情页的进度卡都用这一份，数字一定一致。
import { SOURCE_TYPE_ST_JSONL } from './stPackConstants';
import { getSummaryCursor } from './stSummaryEngine';

/**
 * @param pack            往事记录
 * @param batchMessages   每批取多少条消息（总结设置里的值）
 * @param entries         总结条目（缺省用 pack.summaryEntries；详情页编辑时传最新的）
 * @param totalMessages   消息总数（缺省用导入时记下的 source.messageCount；详情页数过实际存着的会传进来）
 * @returns null（纯文本往事）或 { done, total, cursor, totalMessages }
 */
export const getSummaryProgress = (pack, batchMessages, entries, totalMessages) => {
  if (pack?.sourceType !== SOURCE_TYPE_ST_JSONL) return null;

  const messages = Number.isFinite(totalMessages) ? totalMessages : (pack.source?.messageCount || 0);
  const cursor = getSummaryCursor(entries ?? pack.summaryEntries);
  const total = batchMessages > 0 ? Math.ceil(messages / batchMessages) : 0;
  if (!total) return { done: 0, total: 0, cursor, totalMessages: messages };

  return {
    done: Math.min(total, Math.ceil(cursor / batchMessages)),
    total,
    cursor,
    totalMessages: messages,
  };
};
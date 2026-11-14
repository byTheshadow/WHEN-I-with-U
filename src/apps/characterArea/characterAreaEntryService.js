// src/apps/characterArea/characterAreaEntryService.js
//
// 角色专属区域——条目的读取，以及"用户点标题想翻开正文"时的同意/拒绝判定（切片 B）。
//
// 同意/拒绝完全不调用AI：创建区域时已经一次性生成好一批拒绝话术
// （area.refusalLines）和这个角色的护食程度（area.refuseProb），用户每点一次
// 标题，只是掷一次概率——没有冷却，也不会重新生成任何东西。
//
// 本文件只负责读和判定。写条目在切片 C（整理）里做，这里不预先实现。
import db from '../../db';

const ENTRY_LIST_LIMIT = 200;

// 只有 refusalLines 为空这种"理论上不会出现"的情况才会用到。
const FALLBACK_REFUSAL_LINE = '现在不想给你看。';
const FALLBACK_REFUSE_PROB = 0.3;

// 最新的在前面。createdAt 是 ISO 字符串，直接比较字符串就是时间顺序。
export const getAreaEntries = async (chatId) => {
  if (!chatId) return [];

  const rows = await db.characterAreaEntries.where('chatId').equals(chatId).toArray();

  return rows
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, ENTRY_LIST_LIMIT);
};

// 掷一次：返回 { agreed, refusalLine }。
//   agreed 为 true：展开正文，refusalLine 为空字符串
//   agreed 为 false：显示 refusalLine（从话术池随机取一句）
// lastRefusalLine：上一次显示过的话术，话术池不止一句时尽量不连着重复同一句。
// random：测试时可以传入固定的随机函数。
export const rollEntryAccess = (area, { lastRefusalLine = '', random = Math.random } = {}) => {
  const prob = Number.isFinite(area?.refuseProb) ? area.refuseProb : FALLBACK_REFUSE_PROB;

  if (random() >= prob) return { agreed: true, refusalLine: '' };

  const lines = Array.isArray(area?.refusalLines)
    ? area.refusalLines.filter((line) => typeof line === 'string' && line.trim())
    : [];

  if (lines.length === 0) return { agreed: false, refusalLine: FALLBACK_REFUSAL_LINE };

  const candidates = lines.length > 1 ? lines.filter((line) => line !== lastRefusalLine) : lines;
  const pool = candidates.length > 0 ? candidates : lines;

  return { agreed: false, refusalLine: pool[Math.floor(random() * pool.length)] };
};
// src/apps/stmemory/stPackBudget.js
//
// 记忆包的范围与预算计算（纯函数，不碰数据库）。
// 聊天里的管理面板和真正注入提示词的 service 共用这里的同一套算法，
// 所以面板上显示"会被注入 / 超预算不会注入"和实际行为一定一致。
//
// token 估算沿用项目里已有的粗略算法（secretCodeTokenEstimate.js），
// 界面上凡是用到这些数字的地方都必须写明"估算"。
import { estimateTokens } from '../messages/secretCode/secretCodeTokenEstimate';
import {
  DEFAULT_FRAMING,
  FRAMING_TEXTS,
  INJECT_MODE_FULL,
  INJECT_MODE_OVERVIEW,
  OVERVIEW_MODE_NOTE,
  PINNED_MAX_TOKENS,
} from './stPackConstants';

export { estimateTokens };

/**
 * 把连接上的范围整理成合法的 {from, to}（含两端，块下标）。
 * range 为空 = 全部。块数为 0 时返回 null。
 */
export const normalizeRange = (range, chunkCount) => {
  if (!chunkCount || chunkCount <= 0) return null;

  const last = chunkCount - 1;
  if (!range) return { from: 0, to: last };

  const rawFrom = Number(range.from);
  const rawTo = Number(range.to);
  let from = Number.isFinite(rawFrom) ? Math.floor(rawFrom) : 0;
  let to = Number.isFinite(rawTo) ? Math.floor(rawTo) : last;

  from = Math.min(Math.max(from, 0), last);
  to = Math.min(Math.max(to, 0), last);
  if (to < from) [from, to] = [to, from];

  return { from, to };
};

export const getRangeTokens = (pack, range) => {
  const tokens = Array.isArray(pack?.chunkTokens) ? pack.chunkTokens : [];
  const normalized = normalizeRange(range, tokens.length);
  if (!normalized) return 0;

  let sum = 0;
  for (let i = normalized.from; i <= normalized.to; i += 1) {
    sum += tokens[i] || 0;
  }
  return sum;
};

// 总结条目：存在包记录的 summaryEntries 上（[{ id, text, tokenEstimate, ... }]）。
// 包里只要有总结条目，注入和预算就只算总结条目（总结条目优先）；没有才用原文块。
export const getSummaryEntries = (pack) => (
  Array.isArray(pack?.summaryEntries) ? pack.summaryEntries : []
);

export const hasSummaryEntries = (pack) => getSummaryEntries(pack).length > 0;

export const getEntryRangeTokens = (pack, range) => {
  const entries = getSummaryEntries(pack);
  const normalized = normalizeRange(range, entries.length);
  if (!normalized) return 0;

  let sum = 0;
  for (let i = normalized.from; i <= normalized.to; i += 1) {
    const entry = entries[i];
    sum += Number.isFinite(entry?.tokenEstimate)
      ? entry.tokenEstimate
      : estimateTokens(entry?.text || '');
  }
  return sum;
};

export const getFramingText = (link) => {
  const preset = FRAMING_TEXTS[link?.framing] || FRAMING_TEXTS[DEFAULT_FRAMING];
  const extra = String(link?.framingText || '').trim();
  return extra ? `${preset}\n${extra}` : preset;
};

// 连接的注入模式。旧连接没有这个字段，按 full 处理。
export const getInjectMode = (link) => (
  link?.injectMode === INJECT_MODE_OVERVIEW ? INJECT_MODE_OVERVIEW : INJECT_MODE_FULL
);

export const isOverviewMode = (link) => getInjectMode(link) === INJECT_MODE_OVERVIEW;

/**
 * 新挂载一个包时的默认模式：有总结条目默认只带概览，没有就沿用原文。
 * （没有总结的包概览通常是空的，默认只带概览等于挂上去什么都不注入。）
 */
export const getDefaultInjectMode = (pack) => (
  hasSummaryEntries(pack) ? INJECT_MODE_OVERVIEW : INJECT_MODE_FULL
);

/**
 * 钉住范围的校验（块下标，含两端）。返回 { range, tokens, ok, reason }。
 * 面板和注入共用：超过 PINNED_MAX_TOKENS 的钉住既不允许保存，也不会被注入。
 */
export const inspectPinnedRange = (pack, pinnedRange) => {
  const chunkCount = Number(pack?.chunkCount) || 0;
  if (!pinnedRange || chunkCount <= 0) {
    return { range: null, tokens: 0, ok: false, reason: 'none' };
  }

  const range = normalizeRange(pinnedRange, chunkCount);
  const tokens = getRangeTokens(pack, range);
  if (tokens > PINNED_MAX_TOKENS) {
    return { range, tokens, ok: false, reason: 'too_big' };
  }
  return { range, tokens, ok: true, reason: '' };
};

/**
 * 当前真正会被注入的钉住范围；没有、超上限、或不在概览模式下都返回 null。
 * （full 模式下已经在注入总结或原文，再钉原文会重复，所以只在概览模式生效。）
 */
export const getActivePinnedRange = (pack, link) => {
  if (!isOverviewMode(link)) return null;
  const info = inspectPinnedRange(pack, link?.pinnedRange);
  return info.ok ? info.range : null;
};

// 概览模式下，概览为空又没有钉住原文：这个连接没有任何实际内容可注入。
export const isOverviewLinkEmpty = (pack, link) => (
  isOverviewMode(link)
  && !String(pack?.overview || '').trim()
  && !getActivePinnedRange(pack, link)
);

// 一个连接注入时的总 token（正文范围 + 概览 + 定位说明 + 标题等固定开销）。
const BLOCK_OVERHEAD_TOKENS = 30;

export const getLinkTokens = (pack, link) => {
  if (isOverviewLinkEmpty(pack, link)) return 0;

  const base = estimateTokens(pack?.overview || '')
    + estimateTokens(getFramingText(link))
    + BLOCK_OVERHEAD_TOKENS;

  if (isOverviewMode(link)) {
    const pinned = getActivePinnedRange(pack, link);
    return base
      + estimateTokens(OVERVIEW_MODE_NOTE)
      + (pinned ? getRangeTokens(pack, pinned) : 0);
  }

  return base + (hasSummaryEntries(pack)
    ? getEntryRangeTokens(pack, link?.entryRange)
    : getRangeTokens(pack, link?.range));
};

export const sortLinks = (links) => (
  [...(Array.isArray(links) ? links : [])]
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
);

/**
 * 按顺序决定哪些连接会被注入。
 * 超预算的连接整条跳过，不做静默截断（跟用户确认过：超了要明确提示，
 * 由用户手动缩小范围）。
 *
 * 返回 { items, usedTokens, budget, overBudgetCount }
 * items[i].status: 'included' | 'disabled' | 'over_budget' | 'missing'
 */
export const planStPackInjection = ({ links, packsById, budget }) => {
  const items = [];
  let used = 0;
  let overBudgetCount = 0;

  sortLinks(links).forEach((link) => {
    const pack = packsById?.[link.packId] || null;

    if (!pack) {
      items.push({ link, pack: null, tokens: 0, status: 'missing' });
      return;
    }

    const tokens = getLinkTokens(pack, link);

    if (!link.enabled) {
      items.push({ link, pack, tokens, status: 'disabled' });
      return;
    }

    if (used + tokens > budget) {
      overBudgetCount += 1;
      items.push({ link, pack, tokens, status: 'over_budget' });
      return;
    }

    used += tokens;
    items.push({ link, pack, tokens, status: 'included' });
  });

  return { items, usedTokens: used, budget, overBudgetCount };
};
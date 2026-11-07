// src/apps/stmemory/stPackBudget.js
//
// 记忆包的范围与预算计算（纯函数，不碰数据库）。
// 聊天里的管理面板和真正注入提示词的 service 共用这里的同一套算法，
// 所以面板上显示"会被注入 / 超预算不会注入"和实际行为一定一致。
//
// token 估算沿用项目里已有的粗略算法（secretCodeTokenEstimate.js），
// 界面上凡是用到这些数字的地方都必须写明"估算"。
import { estimateTokens } from '../messages/secretCode/secretCodeTokenEstimate';
import { DEFAULT_FRAMING, FRAMING_TEXTS } from './stPackConstants';

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

export const getFramingText = (link) => {
  const preset = FRAMING_TEXTS[link?.framing] || FRAMING_TEXTS[DEFAULT_FRAMING];
  const extra = String(link?.framingText || '').trim();
  return extra ? `${preset}\n${extra}` : preset;
};

// 一个连接注入时的总 token（正文范围 + 概览 + 定位说明 + 标题等固定开销）。
const BLOCK_OVERHEAD_TOKENS = 30;

export const getLinkTokens = (pack, link) => (
  getRangeTokens(pack, link?.range)
  + estimateTokens(pack?.overview || '')
  + estimateTokens(getFramingText(link))
  + BLOCK_OVERHEAD_TOKENS
);

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

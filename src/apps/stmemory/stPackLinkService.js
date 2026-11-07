// src/apps/stmemory/stPackLinkService.js
//
// 聊天侧的记忆包挂载：只读写 chats 表上的两个无索引字段，不需要新表。
//   chat.stPackLinks        [{ packId, framing, framingText, enabled, order, range }]
//   chat.stPackBudgetTokens 这个聊天的记忆包总预算（估算 token）
//
// range 为 null 表示整包；否则是 { from, to }（块下标，含两端）。
// entryRange 同样的形状，但下标是总结条目：包里有总结条目时用它，没有才用 range。
// 旧的连接没有 entryRange 字段，读出来是 undefined，按"全部"处理。
// 范围存在连接上，不存在包上——同一个包挂到不同聊天可以选不同范围。
import db from '../../db';
import { DEFAULT_BUDGET_TOKENS, DEFAULT_FRAMING } from './stPackConstants';

export const getChatLinks = (chat) => (
  Array.isArray(chat?.stPackLinks) ? chat.stPackLinks : []
);

export const getChatBudget = (chat) => {
  const value = Number(chat?.stPackBudgetTokens);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_BUDGET_TOKENS;
};

export const makeLink = (packId, order) => ({
  packId,
  framing: DEFAULT_FRAMING,
  framingText: '',
  enabled: true,
  order,
  range: null,
  entryRange: null,
});

export const saveChatLinks = async (chatId, links) => {
  await db.chats.update(chatId, { stPackLinks: links });
};

export const saveChatBudget = async (chatId, budgetTokens) => {
  await db.chats.update(chatId, { stPackBudgetTokens: Math.max(1, Math.floor(budgetTokens)) });
};

// 把 order 重新整理成 0,1,2...（拖动/删除之后保持连续）。
export const renumberLinks = (links) => (
  [...links]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((link, index) => ({ ...link, order: index }))
);
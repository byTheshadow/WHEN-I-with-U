// src/apps/messages/secretCode/secretCodePrompt.js
//
// 专属暗号词典拼进系统提示词的纯函数，不碰 DB。
//
// 词典是空的时候返回空字符串，对没用到这个功能的聊天零成本。
// 词典太大时只放一部分：切片A先用最简单的规则（常用的优先，其次是
// 最近改动的），切片D再换成真正按使用情况筛选的策略。
import { normalizeSecretCodes } from './secretCodeService';

// 注入提示词的条数上限。词典本身是为了省 token，不能让词典比省下的还长。
export const SECRET_CODE_PROMPT_MAX_ENTRIES = 20;

export const selectSecretCodesForPrompt = (
  entries,
  maxEntries = SECRET_CODE_PROMPT_MAX_ENTRIES
) =>
  normalizeSecretCodes(entries)
    .slice()
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, maxEntries);

export const buildSecretCodePromptBlock = (character) => {
  const selected = selectSecretCodesForPrompt(character?.secretCodes);

  if (selected.length === 0) {
    return '';
  }

  const lines = selected.map((item) => `- ${item.code} = ${item.meaning}`).join('\n');

  return `
【专属暗号词典（只有你和用户之间的日常约定，跟触发屏幕特效的口令无关）】：
${lines}
- 想表达某个含义时，可以用对应的暗号代替完整的句子。要自然，不要每句话都用，也不要硬塞。
- 暗号要原样书写，不要改字，也不要在后面附带解释；用户没问，就不要解释暗号的意思。
- 用户的消息里出现这些暗号时，按上面的含义理解。
- 不要自己编造词典里没有的暗号。
`;
};
// src/apps/messages/secretCode/secretCodeTokenEstimate.js
//
// 粗略的 token 估算（纯函数）。项目里没有现成的估算工具，各家模型的分词也
// 不一样，所以这里只按字符类型折算，误差大约在三到四成以内。
// 所有用到这个数字的界面都必须写明"估算"，不能当成真实用量。
//
//   - 汉字、全角符号：按每字 1.2 个 token
//   - 其他字符（字母、数字、半角符号、空白）：按每字 0.3 个 token
const CJK_LIKE = /[⺀-鿿豈-﫿＀-￯]/u;

export const CJK_TOKENS_PER_CHAR = 1.2;
export const OTHER_TOKENS_PER_CHAR = 0.3;

export const estimateTokens = (text) => {
  const source = String(text || '');
  if (!source) return 0;

  let total = 0;
  for (const ch of source) {
    total += CJK_LIKE.test(ch) ? CJK_TOKENS_PER_CHAR : OTHER_TOKENS_PER_CHAR;
  }
  return Math.ceil(total);
};
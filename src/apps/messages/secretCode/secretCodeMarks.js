// src/apps/messages/secretCode/secretCodeMarks.js
//
// 聊天气泡里的暗号标记（切片C的纯逻辑部分，不碰数据库、不碰 React）。
//
// 两类暗号的识别方式：
//   - 符号型（没有任何字母、数字、汉字，比如 ~* 、 ::）：角色直接写，系统在
//     显示时按词典自动认出来，不额外花 token。
//   - 词语型（晚晚、海边这种日常词）：角色写成 [C:晚晚]。解析时把括号摘掉、
//     留下词本身，同时把"这条消息里确实用了哪些暗号"记进 metadata.secretCodes，
//     显示时只高亮这些，不会把日常聊天里碰巧出现的同一个词也标出来。
const MARK_PATTERN = /\[C:\s*([^\[\]\s|]{1,4})\s*\]/g;

const SYMBOL_ONLY_TEST = /[\p{L}\p{N}]/u;

/** 符号型：不含字母、数字、汉字，可以不加标记自动识别。 */
export const isSymbolOnlyCode = (code) => {
  const text = String(code || '');
  return text.length > 0 && !SYMBOL_ONLY_TEST.test(text);
};

/**
 * 摘掉 [C:xx] 标记，返回 { content, codes }。
 * content 里标记被替换成暗号本身；codes 是去重后的暗号数组。
 * 没有标记时原样返回，codes 为空数组。
 */
export const extractSecretCodeMarks = (rawContent) => {
  const source = typeof rawContent === 'string' ? rawContent : '';
  if (!source) return { content: source, codes: [] };

  const codes = [];
  const content = source.replace(MARK_PATTERN, (whole, code) => {
    if (!codes.includes(code)) codes.push(code);
    return code;
  });

  return { content, codes };
};

const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 决定一条消息里"哪些暗号该被高亮"。
 *   - 用户自己发的：词典里所有暗号都参与匹配（接受日常词的误伤）。
 *   - 角色发的：符号型自动参与 + metadata.secretCodes 里标过的词语型。
 * 返回按长度从长到短排序的暗号数组（长的优先，避免 :: 被 : 抢先吃掉）。
 */
export const pickHighlightCodes = ({ entries, isUser, markedCodes }) => {
  const list = Array.isArray(entries) ? entries : [];
  const marked = new Set(Array.isArray(markedCodes) ? markedCodes : []);

  const picked = list
    .map((entry) => entry.code)
    .filter((code) => {
      if (!code) return false;
      if (isUser) return true;
      return isSymbolOnlyCode(code) || marked.has(code);
    });

  return Array.from(new Set(picked)).sort((a, b) => b.length - a.length);
};

/** 由暗号数组生成全局匹配的正则；没有暗号时返回 null。 */
export const buildSecretCodeRegExp = (codes) => {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  return new RegExp(codes.map(escapeRegExp).join('|'), 'g');
};

/**
 * 在一段文本里按正则切开，返回片段数组：
 *   [{ text, code: false }, { text: '晚晚', code: true }, ...]
 * 没有任何命中时返回 null，调用方可以直接跳过。
 */
export const splitTextByCodes = (text, regexp) => {
  if (!regexp || !text) return null;

  const re = new RegExp(regexp.source, 'g');
  const parts = [];
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    if (match.index > last) parts.push({ text: text.slice(last, match.index), code: false });
    parts.push({ text: match[0], code: true });
    last = match.index + match[0].length;
  }

  if (parts.length === 0) return null;
  if (last < text.length) parts.push({ text: text.slice(last), code: false });
  return parts;
};

/**
 * 统计一条消息里每个暗号用了几次，返回 { 暗号: 次数 }。
 * 和高亮用同一套匹配规则，保证"看到几个高亮就记几次"。
 */
export const countCodeUses = (text, regexp) => {
  const totals = {};
  const parts = splitTextByCodes(text, regexp);
  if (!parts) return totals;
  parts.forEach((part) => {
    if (part.code) totals[part.text] = (totals[part.text] || 0) + 1;
  });
  return totals;
};
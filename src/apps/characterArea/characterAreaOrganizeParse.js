// src/apps/characterArea/characterAreaOrganizeParse.js
//
// 角色专属区域——"整理"那次单独AI调用的输出解析（切片 C）。纯函数，不碰数据库。
//
// AI要么输出：
//   [NO_ACTION]
// 要么输出 1 到 3 条：
//   [ENTRY]
//   标题：...
//   关于：...            （可以留空）
//   关键词：词1，词2，词3
//   正文：
//   ...（可以多行）
//   [/ENTRY]
//
// 解析尽量宽松：标签前后允许多说几句、冒号全角半角都行、缺少 [/ENTRY] 时按下一条
// [ENTRY] 或文末截断。标题和正文都有才算一条有效条目；一条都解析不出、又没有
// 明确写 [NO_ACTION]，就当作格式不对（invalid），由调用方当"这次没成功"处理，
// 不拿编造的内容兜底。
//
// 后面的切片 D 会往同一个输出格式里加"布置任务"的标签，这里先不处理。

const EMOJI_RE = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;

export const MAX_ENTRIES_PER_ORGANIZE = 3;

const MAX_TITLE_LENGTH = 16;
const MAX_ABOUT_LENGTH = 12;
const MAX_KEYWORDS = 4;
const MAX_KEYWORD_LENGTH = 8;
const MIN_CONTENT_LENGTH = 2;
const MAX_CONTENT_LENGTH = 400;

const stripEmoji = (value) => String(value || '').replace(EMOJI_RE, '');

const cleanLine = (value) =>
  stripEmoji(value)
    .replace(/^[\s"'「」『』“”]+|[\s"'「」『』“”]+$/g, '')
    .trim();

const readField = (body, label) => {
  const match = body.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]*)`));
  return match ? match[1].trim() : '';
};

const parseKeywords = (rawValue) => {
  const seen = new Set();
  const keywords = [];

  String(rawValue || '')
    .split(/[,，、;；\s]+/)
    .map(cleanLine)
    .forEach((word) => {
      if (!word || word.length > MAX_KEYWORD_LENGTH) return;
      const key = word.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      keywords.push(word);
    });

  return keywords.slice(0, MAX_KEYWORDS);
};

const parseEntryBlock = (block) => {
  const title = cleanLine(readField(block, '标题')).slice(0, MAX_TITLE_LENGTH);
  if (!title) return null;

  const contentMatch = block.match(/正文\s*[:：]\s*([\s\S]*)$/);
  const content = stripEmoji(contentMatch ? contentMatch[1] : '')
    .replace(/\[\/ENTRY\]/gi, '')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);

  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    title,
    aboutWho: cleanLine(readField(block, '关于')).slice(0, MAX_ABOUT_LENGTH),
    keywords: parseKeywords(readField(block, '关键词')),
    content,
  };
};

// 返回：
//   { kind: 'none' }                      角色这次没有想写的
//   { kind: 'invalid' }                   格式不对，当作失败
//   { kind: 'entries', entries: [...] }   1 到 3 条有效条目
export const parseOrganizeOutput = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) return { kind: 'invalid' };

  const blocks = [];
  const blockPattern = /\[ENTRY\]([\s\S]*?)(?=\[ENTRY\]|$)/gi;
  let match = blockPattern.exec(text);

  while (match) {
    blocks.push(match[1]);
    match = blockPattern.exec(text);
  }

  const entries = blocks
    .map(parseEntryBlock)
    .filter(Boolean)
    .slice(0, MAX_ENTRIES_PER_ORGANIZE);

  if (entries.length > 0) return { kind: 'entries', entries };

  if (/\[NO_ACTION\]/i.test(text)) return { kind: 'none' };

  return { kind: 'invalid' };
};
// src/apps/characterArea/characterAreaEntryFormats.js
//
// 角色专属区域——条目版式（切片 F2）。纯函数，不碰数据库。
//
// 角色整理时，每条 [ENTRY] 可以多写一行"版式："，从下面 6 种里选一种；
// 选不对、没写，一律退回 plain（普通文字）。版式只决定"正文怎么摆"，
// 条目本身的数据（标题、正文、关键词）不变，所以注入聊天、关键词匹配这些
// 老逻辑完全不受影响。版式存在条目行的无索引追加字段 format 上，不用升
// 数据库版本；老条目没有这个字段，就按 plain 显示。
//
// 清单和账本的"行解析"也放在这里（纯函数，可以单独测），渲染组件只负责摆。

export const DEFAULT_ENTRY_FORMAT = 'plain';

// tag：目录那一行左边的小标记，一个字。plain 没有标记。
export const ENTRY_FORMATS = {
  plain: { label: '普通文字', tag: '', hint: '随手记的几句话' },
  note: { label: '便签', tag: '签', hint: '一张小便签，短短几句' },
  list: { label: '清单', tag: '单', hint: '每行一项，做完的行开头写 [x]，没做的写 [ ]' },
  letter: { label: '信件', tag: '信', hint: '写给某个人，有称呼和落款，分两三段，字数可到200' },
  quote: { label: '语录', tag: '言', hint: '只有一句话，越精炼越好' },
  ledger: { label: '账本', tag: '账', hint: '每行一笔，写成"日期 | 内容"，像记账一样' },
};

export const ENTRY_FORMAT_KEYS = Object.keys(ENTRY_FORMATS);

const FORMAT_ALIASES = [
  ['plain', /普通|文字/],
  ['note', /便签|便利贴|小纸条/],
  ['list', /清单|列表|待办/],
  ['letter', /信件|书信|信/],
  ['quote', /语录|一句话|金句/],
  ['ledger', /账本|记账|流水/],
];

// 把角色写的"版式"那一行归一成 6 个键之一，认不出就是 plain。
export const normalizeEntryFormat = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return DEFAULT_ENTRY_FORMAT;

  const exact = ENTRY_FORMAT_KEYS.find((key) => text === key);
  if (exact) return exact;

  const byWord = ENTRY_FORMAT_KEYS.find((key) => text.includes(key));
  if (byWord) return byWord;

  const alias = FORMAT_ALIASES.find(([, pattern]) => pattern.test(text));
  return alias ? alias[0] : DEFAULT_ENTRY_FORMAT;
};

// 整理提示词里"版式"那一段。
export const buildEntryFormatPromptLine = () =>
  `版式：（只能选一个，拿不准就选 plain：
${ENTRY_FORMAT_KEYS.map((key) => `- ${key} ${ENTRY_FORMATS[key].label}：${ENTRY_FORMATS[key].hint}`).join('\n')}
按这条内容本来的样子选，不用每次都换。正文要照着所选版式的样子写）`;

// ---------------- 行解析（给渲染用） ----------------

const MAX_LINES = 14;

const splitLines = (content) =>
  String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

// 清单：每行一项。行首的 - * • 数字序号 会被去掉；[x] [X] [√] [✓] 算做完，
// [ ] 或没写算没做完。返回 [{ text, checked }]。
export const parseListItems = (content) => {
  const items = [];

  splitLines(content).forEach((line) => {
    const withoutBullet = line.replace(/^(?:[-*•·]|\d+\s*[.、)）])\s*/, '');
    const match = withoutBullet.match(/^[[［]\s*([xX√✓]?)\s*[\]］]\s*(.*)$/);

    const checked = Boolean(match && match[1]);
    const text = (match ? match[2] : withoutBullet).trim();

    if (text) items.push({ text, checked });
  });

  return items.slice(0, MAX_LINES);
};

// 账本：每行"日期 | 内容"，竖线半角全角都行。没有竖线的行，左边留空。
// 返回 [{ left, right }]。
export const parseLedgerRows = (content) => {
  const rows = [];

  splitLines(content).forEach((line) => {
    const separatorIndex = line.search(/[|｜]/);

    const left = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : '';
    const right = (separatorIndex >= 0 ? line.slice(separatorIndex + 1) : line).trim();

    if (right) rows.push({ left, right });
  });

  return rows.slice(0, MAX_LINES);
};

// 信件：按行分段。
export const parseLetterParagraphs = (content) => splitLines(content).slice(0, MAX_LINES);
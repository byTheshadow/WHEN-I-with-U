// src/apps/characterArea/characterAreaSections.js
//
// 角色专属区域——栏目（切片 F3）。纯函数，不碰数据库。
//
// "栏目"是区域目录上方的一个分类页，比如记仇本里长出一页"账本"、收藏册里长出
// 一页"清单"。每个栏目有名字、排列方式（列表/格子/时间线）、默认版式（沿用
// F2 的 6 种）和一句简介。条目通过自己的 sectionId 归到某个栏目；没归到任何
// 栏目的条目只在"全部"这一页出现。
//
// 栏目整个存在 characterAreas 那一行的无索引追加字段 sections 里（数组，最多
// 4 个），不需要升数据库版本；条目上多一个无索引的 sectionId。
//
// 角色建栏目的方式：整理时偶尔（约 12% 的概率，且距离上次建栏目满 3 天、
// 还没到 4 个）提示它可以写一段 [SECTION_NEW]；就算它没被提示、自己写了，
// 落库前也会再按同样的规则卡一遍。一次整理最多建一个。
import {
  DEFAULT_ENTRY_FORMAT,
  ENTRY_FORMAT_KEYS,
  normalizeEntryFormat,
} from './characterAreaEntryFormats';

const EMOJI_RE = /[\p{Extended_Pictographic}‍️]/gu;

export const MAX_SECTIONS = 4;
export const SECTION_MIN_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
export const SECTION_HINT_PROBABILITY = 0.12;

const MAX_NAME_LENGTH = 6;
const MAX_INTRO_LENGTH = 15;
const ALL_TAB_NAME = '全部';

export const SECTION_LAYOUTS = {
  list: { label: '列表' },
  grid: { label: '格子' },
  timeline: { label: '时间线' },
};

export const SECTION_LAYOUT_KEYS = Object.keys(SECTION_LAYOUTS);
export const DEFAULT_SECTION_LAYOUT = 'list';

const LAYOUT_ALIASES = [
  ['grid', /格子|宫格|方格/],
  ['timeline', /时间线|时间轴|日程/],
  ['list', /列表|清单|条目/],
];

const cleanText = (value) =>
  String(value || '')
    .replace(EMOJI_RE, '')
    .replace(/^[\s"'「」『』“”《》]+|[\s"'「」『』“”《》]+$/g, '')
    .trim();

const readField = (body, label) => {
  const match = body.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]*)`));
  return match ? match[1].trim() : '';
};

export const normalizeLayout = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return DEFAULT_SECTION_LAYOUT;

  const byKey = SECTION_LAYOUT_KEYS.find((key) => text === key || text.includes(key));
  if (byKey) return byKey;

  const alias = LAYOUT_ALIASES.find(([, pattern]) => pattern.test(text));
  return alias ? alias[0] : DEFAULT_SECTION_LAYOUT;
};

// 取出区域上有效的栏目（防止手改数据库、旧备份里混进坏数据）。
export const getSections = (area) => {
  const list = Array.isArray(area?.sections) ? area.sections : [];

  return list
    .filter((section) => section && typeof section.id === 'string' && cleanText(section.name))
    .map((section) => ({
      id: section.id,
      name: cleanText(section.name).slice(0, MAX_NAME_LENGTH),
      layout: normalizeLayout(section.layout),
      defaultFormat: ENTRY_FORMAT_KEYS.includes(section.defaultFormat)
        ? section.defaultFormat
        : DEFAULT_ENTRY_FORMAT,
      intro: cleanText(section.intro).slice(0, MAX_INTRO_LENGTH),
      createdAt: section.createdAt || '',
    }))
    .slice(0, MAX_SECTIONS);
};

// ---------------- 解析 ----------------

export const hasSectionTag = (rawText) => /\[SECTION_NEW\]/i.test(String(rawText || ''));

// 从整理输出里取出所有 [SECTION_NEW] 块。返回 [{ name, layout, defaultFormat, intro }]，
// 没有名字的块丢掉。
export const parseSectionDefinitions = (rawText) => {
  const text = String(rawText || '');
  const pattern =
    /\[SECTION_NEW\]([\s\S]*?)(?=\[\/SECTION_NEW\]|\[SECTION_NEW\]|\[ENTRY\]|\[TASK|\[NO_ACTION\]|\[RESTYLE\]|$)/gi;

  const definitions = [];
  let match = pattern.exec(text);

  while (match) {
    const block = match[1];
    const name = cleanText(readField(block, '名称')).slice(0, MAX_NAME_LENGTH);

    if (name) {
      const formatRaw = readField(block, '默认版式');

      definitions.push({
        name,
        layout: normalizeLayout(readField(block, '排列')),
        defaultFormat: formatRaw ? normalizeEntryFormat(formatRaw) : DEFAULT_ENTRY_FORMAT,
        intro: cleanText(readField(block, '简介')).slice(0, MAX_INTRO_LENGTH),
      });
    }

    match = pattern.exec(text);
  }

  return definitions;
};

// ---------------- 数量和间隔 ----------------

export const canCreateSection = (area, now = Date.now()) => {
  const sections = getSections(area);

  if (sections.length >= MAX_SECTIONS) return false;

  const latest = sections
    .map((section) => Date.parse(section.createdAt))
    .filter(Number.isFinite)
    .reduce((max, time) => Math.max(max, time), 0);

  return latest === 0 || now - latest >= SECTION_MIN_INTERVAL_MS;
};

const makeSectionId = () => `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// 把解析出的定义加进现有栏目。一次最多加一个，重名（包括叫"全部"）的跳过，
// 超过上限或间隔不够就不加。返回 { sections, created }。
export const addSections = (existingSections, definitions, { now = Date.now(), makeId = makeSectionId } = {}) => {
  const current = getSections({ sections: existingSections });

  if (!canCreateSection({ sections: current }, now)) return { sections: current, created: 0 };

  const takenNames = new Set([ALL_TAB_NAME, ...current.map((section) => section.name.toLowerCase())]);
  const fresh = (definitions || []).find((definition) => !takenNames.has(definition.name.toLowerCase()));

  if (!fresh) return { sections: current, created: 0 };

  const added = { ...fresh, id: makeId(), createdAt: new Date(now).toISOString() };
  return { sections: [...current, added], created: 1 };
};

// ---------------- 提示词片段 ----------------

// 整理提示词末尾偶尔追加的一段。大多数时候返回空字符串。
export const buildSectionHint = (area, { random = Math.random, now = Date.now() } = {}) => {
  if (!canCreateSection(area, now)) return '';
  if (random() >= SECTION_HINT_PROBABILITY) return '';

  return `\n\n另外：如果你觉得这本小本子里该多开一页新栏目（比如专门放清单、账、语录的一页），可以在输出的最前面加一段：
[SECTION_NEW]
名称：（不超过6个字）
排列：（${SECTION_LAYOUT_KEYS.join(' / ')} 三选一，分别是列表、格子、时间线）
默认版式：（${ENTRY_FORMAT_KEYS.join(' / ')} 选一个，这个栏目里的条目没特别写版式时就用它）
简介：（可以留空，不超过15个字）
[/SECTION_NEW]
之后写条目时，可以用"栏目：名称"把它放进去。大多数时候不需要，只有真的想开新栏目时才写。`;
};

// 条目格式说明里的"栏目"一行。区域还没有栏目时返回空字符串，不占提示词。
export const buildSectionEntryPromptLine = (area) => {
  const sections = getSections(area);
  if (sections.length === 0) return '';

  return `\n栏目：（这条要放进哪个栏目，就写它的名字：${sections.map((section) => section.name).join('、')}。不放进任何栏目就留空）`;
};

// ---------------- 条目归属 ----------------

// 按名字找栏目：先完全一致，再允许一方包含另一方。找不到返回 ''。
export const resolveSectionId = (sections, nameText) => {
  const name = cleanText(nameText).toLowerCase();
  if (!name) return '';

  const list = getSections({ sections });
  const exact = list.find((section) => section.name.toLowerCase() === name);
  if (exact) return exact.id;

  const loose = list.find(
    (section) =>
      section.name.toLowerCase().includes(name) || name.includes(section.name.toLowerCase())
  );
  return loose ? loose.id : '';
};

// 决定一条新条目落库时的 { format, sectionId? }。
// 条目自己写了版式就用它的；没写就用栏目的默认版式；都没有就是 plain。
// 没归到任何栏目时不带 sectionId 字段。
export const placeEntry = (sections, entry) => {
  const sectionId = resolveSectionId(sections, entry?.sectionName);
  const section = sectionId ? getSections({ sections }).find((item) => item.id === sectionId) : null;

  const format = entry?.format || section?.defaultFormat || DEFAULT_ENTRY_FORMAT;

  return sectionId ? { format, sectionId } : { format };
};

// 页面用：按栏目过滤条目。sectionId 为空表示"全部"。
export const filterEntriesBySection = (entries, sectionId) => {
  const list = Array.isArray(entries) ? entries : [];
  if (!sectionId) return list;
  return list.filter((entry) => entry.sectionId === sectionId);
};
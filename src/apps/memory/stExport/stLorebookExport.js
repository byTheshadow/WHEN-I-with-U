// src/apps/memory/stExport/stLorebookExport.js
//
// M4：把一个消息框的"前情总结 + 稳定记忆"带去 SillyTavern。两个出口：
//   1. ST 世界书 JSON（每个分段一条常驻条目，可在 ST 里单独关闭或改字）
//   2. 一段可复制的纯文本（分段和世界书完全一致）
//
// 世界书格式对照的是 ST 当前源码（public/scripts/world-info.js 的
// newWorldInfoEntryDefinition）：单独导出的世界书是 { entries: { "<uid>": {...} } }，
// 不是角色卡内嵌的 character_book（那个是 keys / enabled / insertion_order 的另一套）。
// ST 导入只检查顶层有 entries，但这里仍然写出完整的默认字段，避免缺字段。
//
// 只导出"生效中"的正式记忆；名字原样保留，不替换成 {{char}} / {{user}}。
// 只支持单个消息框（世界书本来就是按角色一份）。
import db from '../../../db';
import { MEMORY_STATUSES, MEMORY_TYPES, MEMORY_TYPE_OPTIONS } from '../memoryConstants';
import { getChatMemory } from '../memoryService';

export const ST_EXPORT_SUMMARY_DEFAULT_COUNT = 5;
export const ST_EXPORT_SUMMARY_MAX_COUNT = 50;

// 弹窗里可勾选的记忆类型（其余类型是角色内心、情绪痕迹这类内部记录，不适合带去 ST）。
export const ST_EXPORT_TYPE_IDS = [
  MEMORY_TYPES.FACT,
  MEMORY_TYPES.PREFERENCE,
  MEMORY_TYPES.RELATIONSHIP,
  MEMORY_TYPES.EPISODE,
  MEMORY_TYPES.BELIEF,
];

export const ST_EXPORT_DEFAULT_TYPE_IDS = [
  MEMORY_TYPES.FACT,
  MEMORY_TYPES.PREFERENCE,
  MEMORY_TYPES.RELATIONSHIP,
];

export const ST_EXPORT_TYPE_OPTIONS = MEMORY_TYPE_OPTIONS.filter(
  (option) => ST_EXPORT_TYPE_IDS.includes(option.id),
);

const SUMMARY_SECTION_ID = 'summary';
const SUMMARY_SECTION_TITLE = '前情总结';

// ST 的插入位置：0 角色定义之前，1 角色定义之后（影响更强）。
const ST_POSITION_AFTER_CHAR = 1;
const ST_ORDER_START = 100;
const ST_ORDER_STEP = 10;

const clampSummaryCount = (value) => {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, ST_EXPORT_SUMMARY_MAX_COUNT);
};

const formatSummaryDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const readSummaryEntries = (chat) => {
  if (Array.isArray(chat?.summary)) return chat.summary;
  if (typeof chat?.summary === 'string' && chat.summary.trim()) {
    return [{ id: 'legacy', content: chat.summary, createdAt: '早期记录' }];
  }
  return [];
};

const sortMemories = (a, b) => {
  const importance = Number(b.importance || 0) - Number(a.importance || 0);
  if (importance !== 0) return importance;
  return new Date(b.updatedAt || b.createdAt || 0).getTime()
    - new Date(a.updatedAt || a.createdAt || 0).getTime();
};

/**
 * 取出要导出的分段。每个分段 { id, title, lines[] }，没有内容的分段不出现。
 *   options.summaryCount  取最近几条前情总结，0 表示不要
 *   options.types         要导出的记忆类型 id 数组
 */
export const collectStExportContent = async (chatId, options = {}) => {
  if (chatId === null || chatId === undefined || chatId === '') {
    throw new Error('请先选择一个消息框。');
  }

  const summaryCount = clampSummaryCount(options.summaryCount);
  const typeIds = (Array.isArray(options.types) ? options.types : [])
    .filter((id) => ST_EXPORT_TYPE_IDS.includes(id));

  const chat = await db.chats.get(chatId);
  const sections = [];

  if (summaryCount > 0) {
    const entries = readSummaryEntries(chat)
      .filter((entry) => String(entry?.content || '').trim());
    // 取最近的 N 条，输出时仍按时间从早到晚。
    const recent = entries.slice(-summaryCount);
    if (recent.length > 0) {
      sections.push({
        id: SUMMARY_SECTION_ID,
        title: SUMMARY_SECTION_TITLE,
        lines: recent.map((entry, index) => {
          const date = formatSummaryDate(entry.createdAt);
          const text = String(entry.content).trim();
          return date ? `${index + 1}. [${date}] ${text}` : `${index + 1}. ${text}`;
        }),
      });
    }
  }

  if (typeIds.length > 0) {
    const memories = (await getChatMemory(chatId))
      .filter((memory) => (
        memory?.status === MEMORY_STATUSES.ACTIVE
        && String(memory.content || '').trim()
      ))
      .sort(sortMemories);

    ST_EXPORT_TYPE_OPTIONS
      .filter((option) => typeIds.includes(option.id))
      .forEach((option) => {
        const lines = memories
          .filter((memory) => memory.type === option.id)
          .map((memory) => `- ${String(memory.content).trim().replace(/\s*\n\s*/g, ' ')}`);
        if (lines.length > 0) {
          sections.push({ id: option.id, title: option.label, lines });
        }
      });
  }

  return {
    chatId,
    chatTitle: String(chat?.title || '').trim() || `消息框 ${chatId}`,
    sections,
    itemCount: sections.reduce((sum, section) => sum + section.lines.length, 0),
  };
};

const assertHasContent = (content) => {
  if (!content.sections.length) {
    throw new Error('这个消息框里没有符合勾选条件的内容。可以换一下勾选，或先让记忆整理一些内容。');
  }
};

const sectionToText = (section) => `【${section.title}】\n${section.lines.join('\n')}`;

/** 纯文本：每个分段一块，块之间空一行。 */
export const buildStPlainText = (content) => (
  content.sections.map(sectionToText).join('\n\n')
);

// ST 条目的默认字段（对照 newWorldInfoEntryDefinition）。
const buildStEntry = ({ uid, title, text, order }) => ({
  uid,
  key: [],
  keysecondary: [],
  comment: title,
  content: text,
  constant: true,
  vectorized: false,
  selective: true,
  selectiveLogic: 0,
  addMemo: true,
  order,
  position: ST_POSITION_AFTER_CHAR,
  disable: false,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
  delayUntilRecursion: 0,
  probability: 100,
  useProbability: true,
  depth: 4,
  outletName: '',
  group: '',
  groupOverride: false,
  groupWeight: 100,
  scanDepth: null,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  automationId: '',
  role: 0,
  sticky: null,
  cooldown: null,
  delay: null,
  displayIndex: uid,
});

/** ST 世界书：每个分段一条常驻（constant）条目。 */
export const buildStLorebook = (content) => {
  const entries = {};
  content.sections.forEach((section, index) => {
    entries[String(index)] = buildStEntry({
      uid: index,
      title: section.title,
      text: sectionToText(section),
      order: ST_ORDER_START + index * ST_ORDER_STEP,
    });
  });
  return { entries };
};

const sanitizeFileName = (value) => (
  String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 60) || '未命名消息框'
);

const triggerBlobDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/** 下载 ST 世界书 .json，返回 { itemCount, sectionCount, fileName }。 */
export const downloadStLorebook = async (chatId, options = {}) => {
  const content = await collectStExportContent(chatId, options);
  assertHasContent(content);

  const lorebook = buildStLorebook(content);
  const fileName = `${sanitizeFileName(content.chatTitle)}-记忆.json`;
  const blob = new Blob(
    [JSON.stringify(lorebook, null, 2)],
    { type: 'application/json;charset=utf-8' },
  );
  triggerBlobDownload(blob, fileName);

  return { itemCount: content.itemCount, sectionCount: content.sections.length, fileName };
};

const writeClipboard = async (text) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 落到下面的兜底做法。
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
};

/** 复制纯文本到剪贴板，返回 { itemCount, sectionCount, charCount }。 */
export const copyStPlainText = async (chatId, options = {}) => {
  const content = await collectStExportContent(chatId, options);
  assertHasContent(content);

  const text = buildStPlainText(content);
  const copied = await writeClipboard(text);
  if (!copied) {
    throw new Error('浏览器没有允许复制到剪贴板，请改用下载世界书，或稍后重试。');
  }

  return {
    itemCount: content.itemCount,
    sectionCount: content.sections.length,
    charCount: text.length,
  };
};
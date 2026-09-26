// Obsidian markdown note parser.
//
// Pure, synchronous, defensive: turns one .md file's raw text into a note
// title + frontmatter + a flat list of heading-based sections. No DB access
// and no File/Blob APIs here on purpose - see obsidianImportService.js for
// reading files and writing parsed sections into memories.

import { MEMORY_TYPES } from '../memoryConstants';

const VALID_MEMORY_TYPES = new Set(Object.values(MEMORY_TYPES));

const FRONTMATTER_DELIMITER = /^---\s*$/;

const stripQuotes = (value) => {
  const trimmed = String(value || '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const parseInlineListValue = (value) => {
  const trimmed = value.trim();

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const inner = trimmed.slice(1, -1).trim();

  if (!inner) return [];

  return inner
    .split(',')
    .map((item) => stripQuotes(item))
    .filter(Boolean);
};

// A minimal, defensive frontmatter reader - handles the common Obsidian
// shapes (scalar values, inline "[a, b]" lists, and simple "- item" block
// lists) without pulling in a full YAML parser. Anything it can't
// confidently parse is left as a raw string rather than thrown away, and a
// missing/malformed frontmatter block never blocks parsing the note body.
export const parseFrontmatter = (rawText) => {
  const text = String(rawText || '').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);

  if (!FRONTMATTER_DELIMITER.test(lines[0] || '')) {
    return { frontmatter: {}, body: text };
  }

  let endIndex = -1;

  for (let i = 1; i < lines.length; i += 1) {
    if (FRONTMATTER_DELIMITER.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    // Unterminated "---" block - treat the whole thing as body rather
    // than silently dropping the note's content.
    return { frontmatter: {}, body: text };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const bodyLines = lines.slice(endIndex + 1);
  const frontmatter = {};

  let currentListKey = null;

  for (const line of frontmatterLines) {
    const listItemMatch = line.match(/^\s*-\s+(.*)$/);

    if (listItemMatch && currentListKey) {
      if (!Array.isArray(frontmatter[currentListKey])) {
        frontmatter[currentListKey] = [];
      }

      frontmatter[currentListKey].push(stripQuotes(listItemMatch[1]));
      continue;
    }

    const keyValueMatch = line.match(
      /^\s*([A-Za-z0-9_\-一-鿿]+)\s*:\s*(.*)$/
    );

    if (!keyValueMatch) {
      currentListKey = null;
      continue;
    }

    const [, key, rawValue] = keyValueMatch;

    if (!rawValue.trim()) {
      // Empty value on this line usually means a "- item" block list
      // follows on the next lines.
      currentListKey = key;
      frontmatter[key] = [];
      continue;
    }

    currentListKey = null;

    const inlineList = parseInlineListValue(rawValue);

    frontmatter[key] = inlineList !== null
      ? inlineList
      : stripQuotes(rawValue);
  }

  return {
    frontmatter,
    body: bodyLines.join('\n')
  };
};

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

const cleanHeadingText = (value) => (
  String(value || '')
    .replace(/#+\s*$/, '')
    .trim()
);

// Splits a note body into heading-based sections. Every heading line (any
// level) starts a new section, and a section's content is everything up to
// the next heading line regardless of level - this keeps the mapping
// predictable (each heading becomes its own memory entry) rather than
// nesting subsections' text inside their parent's entry. Content that
// appears before the first heading becomes its own leading section, using
// the note's own title as a fallback heading.
export const splitBodyIntoSections = (body, fallbackTitle = '') => {
  const lines = String(body || '').split(/\r?\n/);
  const sections = [];

  const leadingLines = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;

    const content = current.contentLines.join('\n').trim();

    if (content) {
      sections.push({
        title: current.title,
        level: current.level,
        content
      });
    }

    current = null;
  };

  for (const line of lines) {
    const headingMatch = line.match(HEADING_PATTERN);

    if (headingMatch) {
      pushCurrent();

      current = {
        title: cleanHeadingText(headingMatch[2]) || '未命名标题',
        level: headingMatch[1].length,
        contentLines: []
      };

      continue;
    }

    if (current) {
      current.contentLines.push(line);
    } else {
      leadingLines.push(line);
    }
  }

  pushCurrent();

  const leadingContent = leadingLines.join('\n').trim();

  if (leadingContent) {
    sections.unshift({
      title: fallbackTitle || '笔记正文',
      level: 0,
      content: leadingContent
    });
  }

  return sections;
};

const deriveNoteTitle = (fileName, frontmatter) => {
  const fmTitle = String(frontmatter?.title || '').trim();

  if (fmTitle) return fmTitle;

  const baseName = String(fileName || '')
    .split('/')
    .pop()
    .replace(/\.md$/i, '')
    .trim();

  return baseName || '未命名笔记';
};

const normalizeFrontmatterType = (value) => {
  const raw = String(value || '').trim().toLowerCase();

  return VALID_MEMORY_TYPES.has(raw) ? raw : null;
};

const normalizeFrontmatterImportance = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return null;

  return Math.min(5, Math.max(1, Math.round(numberValue)));
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

// Parses one note's raw markdown text into a title, its frontmatter, and a
// flat list of importable entries (one per heading-level section, per the
// confirmed "按标题分块" design). Each entry carries its own client-side id
// so the import UI can let the user pick which ones to bring in, and an
// optional per-entry type/importance when the note's frontmatter specifies
// one (falling back to whatever default the import screen picks otherwise).
export const parseObsidianNote = (fileName, rawText) => {
  const { frontmatter, body } = parseFrontmatter(rawText);
  const noteTitle = deriveNoteTitle(fileName, frontmatter);
  const rawSections = splitBodyIntoSections(body, noteTitle);

  const entries = rawSections.map((section, index) => ({
    clientEntryId: `${fileName}::${index}::${section.title}`,
    title: section.title,
    content: section.content,
    level: section.level,
    type: normalizeFrontmatterType(frontmatter.type),
    importance: normalizeFrontmatterImportance(frontmatter.importance)
  }));

  return {
    fileName,
    noteTitle,
    frontmatter,
    tags: normalizeTags(frontmatter.tags),
    entries
  };
};
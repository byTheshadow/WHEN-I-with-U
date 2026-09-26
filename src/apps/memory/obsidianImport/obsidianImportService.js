// Obsidian note import - manual-upload entry point.
//
// This is entry point 1 from the confirmed OB import design: a plain file
// picker over one or more .md files, run through the shared parser
// (obsidianMarkdownParser.js) and written into this project's existing
// memory system via memoryService.js's createMemory/updateMemory, exactly
// like any other memory. Entry point 2 (File System Access polling) is a
// separate, later piece of work and does not live here.

import db from '../../../db';
import { createMemory, updateMemory } from '../memoryService';
import {
  MEMORY_CONFIDENCES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STATUSES,
  MEMORY_TYPES
} from '../memoryConstants';
import { parseObsidianNote } from './obsidianMarkdownParser';

const readFileText = (file) => (
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(
        reader.error || new Error('读取文件失败。')
      );

      reader.readAsText(file);
    })
);

// Reads and parses every .md file the user picked. Never throws for a
// single bad file - a note that fails to read/parse is kept in the result
// with its own `error`, so one broken file doesn't block importing the
// rest of the batch.
export const parseObsidianFiles = async (fileList) => {
  const files = Array.from(fileList || []).filter(
    (file) => /\.md$/i.test(file.name)
  );

  const notes = [];

  for (const file of files) {
    try {
      const text = await readFileText(file);

      notes.push(parseObsidianNote(file.name, text));
    } catch (error) {
      notes.push({
        fileName: file.name,
        noteTitle: file.name,
        frontmatter: {},
        tags: [],
        entries: [],
        error: error?.message || '解析这篇笔记失败。'
      });
    }
  }

  const totalEntryCount = notes.reduce(
    (sum, note) => sum + note.entries.length,
    0
  );

  const failedNoteCount = notes.filter((note) => note.error).length;

  return {
    notes,
    summary: {
      noteCount: notes.length,
      totalEntryCount,
      failedNoteCount
    }
  };
};

// A stable-ish key for "this heading, in this file" so re-importing the
// same note (e.g. after editing it in Obsidian) updates the existing
// memory instead of creating a duplicate every time. Renaming the file or
// the heading breaks the match on purpose - there is no reliable way to
// tell a rename apart from "this is actually new content" from a plain
// markdown file alone.
const buildObsidianKey = (fileName, entry) => (
  `obsidian::${fileName}::${entry.level}::${entry.title}`
);

// obsidianKey is a small additive field, same convention as this project's
// other lightweight per-record tags (see the dev skill's note on additive
// Dexie fields) - written directly rather than teaching memoryService.js's
// shared createMemory/updateMemory about a field only this feature needs.
const tagObsidianKey = async (memoryId, obsidianKey) => {
  await db.memories
    .where('memoryId')
    .equals(memoryId)
    .modify({ obsidianKey });
};

export const importObsidianEntries = async ({
  chatId,
  notes,
  selectedEntryIds,
  defaultType = MEMORY_TYPES.FACT,
  defaultImportance = 3,
  defaultStatus = MEMORY_STATUSES.ACTIVE
}) => {
  if (chatId === null || chatId === undefined || chatId === '') {
    throw new Error('请选择要导入到的消息框。');
  }

  const selectedIdSet = new Set(selectedEntryIds || []);

  const jobs = [];

  for (const note of notes || []) {
    if (note.error) continue;

    for (const entry of note.entries) {
      if (!selectedIdSet.has(entry.clientEntryId)) continue;

      jobs.push({
        note,
        entry,
        obsidianKey: buildObsidianKey(note.fileName, entry)
      });
    }
  }

  if (jobs.length === 0) {
    throw new Error('请至少选择一条要导入的内容。');
  }

  const existingMemories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  const existingByKey = new Map(
    existingMemories
      .filter((memory) => memory.obsidianKey)
      .map((memory) => [memory.obsidianKey, memory])
  );

  let insertedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const { note, entry, obsidianKey } of jobs) {
    const type = entry.type || defaultType;
    const importance = entry.importance || defaultImportance;

    try {
      const existing = existingByKey.get(obsidianKey);

      if (existing) {
        await updateMemory(existing.memoryId, {
          title: entry.title,
          content: entry.content,
          type,
          importance
        }, {
          note: `重新从 Obsidian 笔记《${note.noteTitle}》导入并更新`
        });

        updatedCount += 1;
        continue;
      }

      const created = await createMemory({
        chatId,
        title: entry.title,
        content: entry.content,
        type,
        importance,
        status: defaultStatus,
        confidence: MEMORY_CONFIDENCES.CONFIRMED,
        sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
        sourceKind: MEMORY_SOURCE_KINDS.OBSIDIAN_IMPORT,
        note: `从 Obsidian 笔记《${note.noteTitle}》导入`
      });

      await tagObsidianKey(created.memoryId, obsidianKey);

      insertedCount += 1;
    } catch (error) {
      failedCount += 1;
      errors.push({
        fileName: note.fileName,
        title: entry.title,
        message: error?.message || '导入这一条时出错。'
      });
    }
  }

  return {
    insertedCount,
    updatedCount,
    failedCount,
    errors
  };
};
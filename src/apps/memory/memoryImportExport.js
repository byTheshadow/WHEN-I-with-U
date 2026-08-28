import db from '../../db';
import {
  MEMORY_CANDIDATE_STATUSES,
  MEMORY_IMPORT_FORMAT,
  MEMORY_IMPORT_FORMAT_VERSION,
  MEMORY_IMPORT_MODES,
  MEMORY_REVISION_ACTIONS,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STATUSES
} from './memoryConstants';

const nowIso = () => new Date().toISOString();

const createStableId = (prefix) => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const cleanText = (value) => String(value || '').trim();

const isValidMemory = (memory) => (
  memory &&
  typeof memory.memoryId === 'string' &&
  memory.memoryId.trim() &&
  typeof memory.chatId !== 'undefined' &&
  cleanText(memory.content)
);

const normalizeMemory = (memory, targetChatId) => {
  const now = nowIso();

  return {
    ...memory,
    memoryId: memory.memoryId.trim(),
    chatId: targetChatId,
    title: cleanText(memory.title),
    content: cleanText(memory.content),
    type: cleanText(memory.type) || 'fact',
    status: Object.values(MEMORY_STATUSES).includes(memory.status)
      ? memory.status
      : MEMORY_STATUSES.ACTIVE,
    importance: Math.min(
      5,
      Math.max(1, Math.round(Number(memory.importance) || 3))
    ),
    confidence: cleanText(memory.confidence) || 'suggested',
    sourceMessageIds: asArray(memory.sourceMessageIds)
      .map(Number)
      .filter(Number.isFinite),
    sourceMessageTimestamps: asArray(memory.sourceMessageTimestamps)
      .filter(Boolean),
    sourceState: cleanText(memory.sourceState)
      || MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
    sourceKind: MEMORY_SOURCE_KINDS.IMPORTED,
    createdAt: memory.createdAt || now,
    updatedAt: memory.updatedAt || now,
    lastUsedAt: memory.lastUsedAt || null,
    useCount: Number(memory.useCount) || 0
  };
};

const normalizeCandidate = (candidate, targetChatId) => {
  const now = nowIso();

  return {
    ...candidate,
    candidateId: cleanText(candidate.candidateId) || createStableId('memory_candidate'),
    chatId: targetChatId,
    title: cleanText(candidate.title),
    content: cleanText(candidate.content),
    type: cleanText(candidate.type) || 'fact',
    priority: Math.min(
      5,
      Math.max(1, Math.round(Number(candidate.priority) || 3))
    ),
    status: Object.values(MEMORY_CANDIDATE_STATUSES).includes(candidate.status)
      ? candidate.status
      : MEMORY_CANDIDATE_STATUSES.PENDING,
    sourceMessageIds: asArray(candidate.sourceMessageIds)
      .map(Number)
      .filter(Number.isFinite),
    sourceMessageTimestamps: asArray(candidate.sourceMessageTimestamps)
      .filter(Boolean),
    sourceKind: MEMORY_SOURCE_KINDS.IMPORTED,
    createdAt: candidate.createdAt || now,
    updatedAt: candidate.updatedAt || now
  };
};

const getChatReference = async (chatId) => {
  const chat = await db.chats.get(chatId);

  if (!chat) {
    return {
      chatId,
      title: '',
      mode: '',
      characterName: ''
    };
  }

  const character = chat.characterId
    ? await db.characters.get(chat.characterId)
    : null;

  return {
    chatId,
    title: chat.title || '',
    mode: chat.mode || '',
    characterName: character?.name || ''
  };
};

const getExportChatIds = async (scope = {}) => {
  if (scope.type === 'chat' && scope.chatId !== undefined) {
    return [scope.chatId];
  }

  if (Array.isArray(scope.chatIds) && scope.chatIds.length > 0) {
    return scope.chatIds;
  }

  const memories = await db.memories.toArray();
  return [...new Set(memories.map((memory) => memory.chatId))];
};

export const buildMemoryExport = async (scope = {}) => {
  const chatIds = await getExportChatIds(scope);

  const memories = (await db.memories.toArray())
    .filter((memory) => chatIds.includes(memory.chatId));

  const candidates = (await db.memoryCandidates.toArray())
    .filter((candidate) => chatIds.includes(candidate.chatId));

  const revisions = (await db.memoryRevisions.toArray())
    .filter((revision) => chatIds.includes(revision.chatId));

  const chatReferences = [];

  for (const chatId of chatIds) {
    chatReferences.push(await getChatReference(chatId));
  }

  return {
    format: MEMORY_IMPORT_FORMAT,
    formatVersion: MEMORY_IMPORT_FORMAT_VERSION,
    exportedAt: nowIso(),
    scope: {
      type: chatIds.length === 1 ? 'chat' : 'chats',
      chatIds
    },
    chatReferences,
    memories,
    candidates,
    revisions,
    metadata: {
      appName: 'WHEN I with U',
      includesSourceMessageContent: false
    }
  };
};

export const downloadMemoryExport = async (scope = {}) => {
  const payload = await buildMemoryExport(scope);
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json;charset=utf-8' }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `when-i-with-u-memory-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return payload;
};

export const parseMemoryImportFile = async (file) => {
  if (!file) {
    throw new Error('没有选择记忆文件。');
  }

  const text = await file.text();

  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('记忆文件不是有效的 JSON。');
  }

  if (!payload || payload.format !== MEMORY_IMPORT_FORMAT) {
    throw new Error('这不是 WHEN I with U 的记忆导出文件。');
  }

  if (payload.formatVersion !== MEMORY_IMPORT_FORMAT_VERSION) {
    throw new Error(
      `暂不支持此记忆文件版本：${payload.formatVersion || '未知'}。`
    );
  }

  const memories = asArray(payload.memories);
  const candidates = asArray(payload.candidates);
  const revisions = asArray(payload.revisions);

  const invalidMemoryCount = memories.filter(
    (memory) => !isValidMemory(memory)
  ).length;

  const validMemories = memories.filter(isValidMemory);
  const validCandidates = candidates.filter(
    (candidate) => candidate && cleanText(candidate.content)
  );
  const validRevisions = revisions.filter(
    (revision) => revision && cleanText(revision.memoryId)
  );

  const memoryIds = validMemories.map((memory) => memory.memoryId);
  const duplicateMemoryIds = memoryIds.filter(
    (id, index) => memoryIds.indexOf(id) !== index
  );

  const uniqueMemories = validMemories.filter(
    (memory, index, list) => (
      list.findIndex((item) => item.memoryId === memory.memoryId) === index
    )
  );

  const typeCounts = uniqueMemories.reduce((result, memory) => {
    result[memory.type || 'fact'] = (result[memory.type || 'fact'] || 0) + 1;
    return result;
  }, {});

  return {
    payload,
    memories: uniqueMemories,
    candidates: validCandidates,
    revisions: validRevisions,
    summary: {
      exportedAt: payload.exportedAt || '',
      sourceChatCount: asArray(payload.chatReferences).length,
      memoryCount: uniqueMemories.length,
      candidateCount: validCandidates.length,
      revisionCount: validRevisions.length,
      invalidMemoryCount,
      duplicateMemoryCount: duplicateMemoryIds.length,
      typeCounts
    }
  };
};

const getExistingByStableIds = async (table, field, items) => {
  const ids = items.map((item) => item[field]).filter(Boolean);

  if (ids.length === 0) return [];

  return table.where(field).anyOf(ids).toArray();
};

export const createMemoryImportPreview = async ({
  parsedImport,
  targetChatId
}) => {
  if (!parsedImport?.payload) {
    throw new Error('缺少已经解析的记忆文件。');
  }

  if (targetChatId === undefined || targetChatId === null) {
    throw new Error('请选择要绑定的消息框。');
  }

  const [existingMemories, existingCandidates, existingRevisions] =
    await Promise.all([
      getExistingByStableIds(
        db.memories,
        'memoryId',
        parsedImport.memories
      ),
      getExistingByStableIds(
        db.memoryCandidates,
        'candidateId',
        parsedImport.candidates
      ),
      getExistingByStableIds(
        db.memoryRevisions,
        'revisionId',
        parsedImport.revisions
      )
    ]);

  const existingMemoryIds = new Set(
    existingMemories
      .filter((item) => item.chatId === targetChatId)
      .map((item) => item.memoryId)
  );

  const newMemoryCount = parsedImport.memories.filter(
    (memory) => !existingMemoryIds.has(memory.memoryId)
  ).length;

  const sourceMessages = await db.messages
    .where('chatId')
    .equals(targetChatId)
    .toArray();

  const sourceMessageIdSet = new Set(sourceMessages.map((message) => message.id));

  const unavailableSourceCount = parsedImport.memories.filter((memory) => {
    const ids = asArray(memory.sourceMessageIds);

    return (
      ids.length === 0 ||
      ids.every((id) => !sourceMessageIdSet.has(Number(id)))
    );
  }).length;

  return {
    ...parsedImport.summary,
    targetChatId,
    existingMemoryCount: existingMemoryIds.size,
    newMemoryCount,
    existingCandidateCount: existingCandidates.filter(
      (item) => item.chatId === targetChatId
    ).length,
    existingRevisionCount: existingRevisions.filter(
      (item) => item.chatId === targetChatId
    ).length,
    unavailableSourceCount
  };
};

export const importMemoryData = async ({
  parsedImport,
  targetChatId,
  mode = MEMORY_IMPORT_MODES.MERGE
}) => {
  if (!parsedImport?.memories) {
    throw new Error('缺少已经解析的记忆文件。');
  }

  if (targetChatId === undefined || targetChatId === null) {
    throw new Error('请选择要绑定的消息框。');
  }

  if (!Object.values(MEMORY_IMPORT_MODES).includes(mode)) {
    throw new Error('无效的记忆导入模式。');
  }

  const normalizedMemories = parsedImport.memories.map((memory) => (
    normalizeMemory(memory, targetChatId)
  ));

  const normalizedCandidates = parsedImport.candidates.map((candidate) => (
    normalizeCandidate(candidate, targetChatId)
  ));

  const normalizedRevisions = parsedImport.revisions
    .filter((revision) => cleanText(revision.memoryId))
    .map((revision) => ({
      ...revision,
      revisionId: cleanText(revision.revisionId) || createStableId('memory_revision'),
      memoryId: cleanText(revision.memoryId),
      chatId: targetChatId,
      action: cleanText(revision.action) || MEMORY_REVISION_ACTIONS.IMPORTED,
      createdAt: revision.createdAt || nowIso()
    }));

  const counts = {
    insertedMemories: 0,
    updatedMemories: 0,
    skippedMemories: 0,
    insertedCandidates: 0,
    insertedRevisions: 0
  };

  await db.transaction(
    'rw',
    db.memories,
    db.memoryCandidates,
    db.memoryRevisions,
    async () => {
      if (mode === MEMORY_IMPORT_MODES.REPLACE_CHAT) {
        await db.memories.where('chatId').equals(targetChatId).delete();
        await db.memoryCandidates.where('chatId').equals(targetChatId).delete();
        await db.memoryRevisions.where('chatId').equals(targetChatId).delete();
      }

      const currentMemories = await db.memories
        .where('chatId')
        .equals(targetChatId)
        .toArray();

      const currentByMemoryId = new Map(
        currentMemories.map((memory) => [memory.memoryId, memory])
      );

      for (const memory of normalizedMemories) {
        const existing = currentByMemoryId.get(memory.memoryId);

        if (existing && mode === MEMORY_IMPORT_MODES.ONLY_NEW) {
          counts.skippedMemories += 1;
          continue;
        }

        if (existing && mode === MEMORY_IMPORT_MODES.MERGE) {
          const existingTime = new Date(existing.updatedAt || 0).getTime();
          const incomingTime = new Date(memory.updatedAt || 0).getTime();

          if (incomingTime <= existingTime) {
            counts.skippedMemories += 1;
            continue;
          }

          await db.memories.update(existing.id, {
            ...memory,
            id: existing.id,
            sourceState: memory.sourceState
              || MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE
          });

          counts.updatedMemories += 1;
          continue;
        }

        await db.memories.add(memory);
        counts.insertedMemories += 1;
        currentByMemoryId.set(memory.memoryId, memory);
      }

      const existingCandidateIds = new Set(
        (await db.memoryCandidates
          .where('chatId')
          .equals(targetChatId)
          .toArray())
          .map((candidate) => candidate.candidateId)
      );

      for (const candidate of normalizedCandidates) {
        if (existingCandidateIds.has(candidate.candidateId)) {
          continue;
        }

        await db.memoryCandidates.add(candidate);
        counts.insertedCandidates += 1;
      }

      const existingRevisionIds = new Set(
        (await db.memoryRevisions
          .where('chatId')
          .equals(targetChatId)
          .toArray())
          .map((revision) => revision.revisionId)
      );

      for (const revision of normalizedRevisions) {
        if (existingRevisionIds.has(revision.revisionId)) {
          continue;
        }

        await db.memoryRevisions.add(revision);
        counts.insertedRevisions += 1;
      }
    }
  );

  return counts;
};

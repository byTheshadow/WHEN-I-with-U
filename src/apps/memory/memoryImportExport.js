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

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
};

const asArray = (value) => (
  Array.isArray(value) ? value : []
);

const cleanText = (value) => (
  String(value || '').trim()
);

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

const isValidMemory = (memory) => (
  memory &&
  typeof memory.memoryId === 'string' &&
  memory.memoryId.trim() &&
  typeof memory.chatId !== 'undefined' &&
  cleanText(memory.content)
);

const removeLocalId = (record) => {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const {
    id,
    ...recordWithoutLocalId
  } = record;

  return recordWithoutLocalId;
};

const normalizeMessageIds = (value) => (
  asArray(value)
    .map(Number)
    .filter(Number.isFinite)
);

const normalizeMemory = (memory, targetChatId) => {
  const sourceMemory = removeLocalId(memory);
  const now = nowIso();

  return {
    ...sourceMemory,
    memoryId: cleanText(sourceMemory.memoryId),
    chatId: targetChatId,
    title: cleanText(sourceMemory.title),
    content: cleanText(sourceMemory.content),
    type: cleanText(sourceMemory.type) || 'fact',
    status: Object.values(MEMORY_STATUSES).includes(sourceMemory.status)
      ? sourceMemory.status
      : MEMORY_STATUSES.ACTIVE,
    importance: Math.min(
      5,
      Math.max(1, Math.round(Number(sourceMemory.importance) || 3))
    ),
    confidence: cleanText(sourceMemory.confidence) || 'suggested',

    // 导出文件不包含原始聊天正文。
    // 因此无法确认来源消息 ID 在目标消息框中仍然对应原消息。
    sourceMessageIds: [],
    sourceMessageTimestamps: [],
    sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
    sourceKind: MEMORY_SOURCE_KINDS.IMPORTED,

    createdAt: sourceMemory.createdAt || now,
    updatedAt: sourceMemory.updatedAt || now,
    lastUsedAt: sourceMemory.lastUsedAt || null,
    useCount: Number(sourceMemory.useCount) || 0
  };
};

const normalizeCandidate = (candidate, targetChatId) => {
  const sourceCandidate = removeLocalId(candidate);
  const now = nowIso();

  return {
    ...sourceCandidate,
    candidateId: cleanText(sourceCandidate.candidateId)
      || createStableId('memory_candidate'),
    chatId: targetChatId,
    title: cleanText(sourceCandidate.title),
    content: cleanText(sourceCandidate.content),
    type: cleanText(sourceCandidate.type) || 'fact',
    priority: Math.min(
      5,
      Math.max(1, Math.round(Number(sourceCandidate.priority) || 3))
    ),
    status: Object.values(MEMORY_CANDIDATE_STATUSES).includes(
      sourceCandidate.status
    )
      ? sourceCandidate.status
      : MEMORY_CANDIDATE_STATUSES.PENDING,

    // 与正式记忆相同，导入后的候选不继承其他 Chat 的来源消息。
    sourceMessageIds: [],
    sourceMessageTimestamps: [],
    sourceKind: MEMORY_SOURCE_KINDS.IMPORTED,

    createdAt: sourceCandidate.createdAt || now,
    updatedAt: sourceCandidate.updatedAt || now
  };
};

const normalizeRevisionSnapshot = ({
  snapshot,
  mappedMemoryId,
  targetChatId
}) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return snapshot || null;
  }

  const normalizedSnapshot = removeLocalId(snapshot);

  return {
    ...normalizedSnapshot,
    memoryId: mappedMemoryId,
    chatId: targetChatId,

    // 修订快照来自导出文件，不能继续声称拥有目标 Chat 的本地消息来源。
    sourceMessageIds: [],
    sourceMessageTimestamps: [],
    sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
    sourceKind: MEMORY_SOURCE_KINDS.IMPORTED
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
  if (
    scope.type === 'chat' &&
    isValidChatId(scope.chatId)
  ) {
    return [scope.chatId];
  }

  if (Array.isArray(scope.chatIds) && scope.chatIds.length > 0) {
    return [...new Set(scope.chatIds)];
  }

  const [
    memories,
    candidates,
    revisions
  ] = await Promise.all([
    db.memories.toArray(),
    db.memoryCandidates.toArray(),
    db.memoryRevisions.toArray()
  ]);

  return [
    ...new Set([
      ...memories.map((memory) => memory.chatId),
      ...candidates.map((candidate) => candidate.chatId),
      ...revisions.map((revision) => revision.chatId)
    ])
  ].filter(isValidChatId);
};

const stripExportLocalFields = (record) => {
  const normalizedRecord = removeLocalId(record);

  if (
    normalizedRecord &&
    typeof normalizedRecord === 'object' &&
    normalizedRecord.snapshot &&
    typeof normalizedRecord.snapshot === 'object'
  ) {
    return {
      ...normalizedRecord,
      snapshot: removeLocalId(normalizedRecord.snapshot)
    };
  }

  return normalizedRecord;
};

export const buildMemoryExport = async (scope = {}) => {
  const chatIds = await getExportChatIds(scope);

  const [
    allMemories,
    allCandidates,
    allRevisions
  ] = await Promise.all([
    db.memories.toArray(),
    db.memoryCandidates.toArray(),
    db.memoryRevisions.toArray()
  ]);

  const memories = allMemories
    .filter((memory) => chatIds.includes(memory.chatId))
    .map(stripExportLocalFields);

  const candidates = allCandidates
    .filter((candidate) => chatIds.includes(candidate.chatId))
    .map(stripExportLocalFields);

  const revisions = allRevisions
    .filter((revision) => chatIds.includes(revision.chatId))
    .map(stripExportLocalFields);

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
      includesSourceMessageContent: false,
      includesApiConfiguration: false,
      includesLocalDatabaseIds: false
    }
  };
};

export const downloadMemoryExport = async (scope = {}) => {
  const payload = await buildMemoryExport(scope);

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    {
      type: 'application/json;charset=utf-8'
    }
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

  if (
    !payload ||
    payload.format !== MEMORY_IMPORT_FORMAT
  ) {
    throw new Error('这不是 WHEN I with U 的记忆导出文件。');
  }

  if (
    payload.formatVersion !== MEMORY_IMPORT_FORMAT_VERSION
  ) {
    throw new Error(
      `暂不支持此记忆文件版本：${
        payload.formatVersion || '未知'
      }。`
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
    (candidate) => (
      candidate &&
      cleanText(candidate.content)
    )
  );

  const validRevisions = revisions.filter(
    (revision) => (
      revision &&
      cleanText(revision.memoryId)
    )
  );

  const memoryIds = validMemories
    .map((memory) => cleanText(memory.memoryId))
    .filter(Boolean);

  const duplicateMemoryIds = memoryIds.filter(
    (id, index) => memoryIds.indexOf(id) !== index
  );

  const uniqueMemories = validMemories.filter(
    (memory, index, list) => (
      list.findIndex(
        (item) => item.memoryId === memory.memoryId
      ) === index
    )
  );

  const typeCounts = uniqueMemories.reduce(
    (result, memory) => {
      const type = memory.type || 'fact';

      result[type] = (result[type] || 0) + 1;

      return result;
    },
    {}
  );

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

const getExistingByStableIds = async (
  table,
  field,
  items
) => {
  const ids = items
    .map((item) => cleanText(item?.[field]))
    .filter(Boolean);

  if (ids.length === 0) {
    return [];
  }

  return table
    .where(field)
    .anyOf(ids)
    .toArray();
};

export const createMemoryImportPreview = async ({
  parsedImport,
  targetChatId
}) => {
  if (!parsedImport?.payload) {
    throw new Error('缺少已经解析的记忆文件。');
  }

  if (!isValidChatId(targetChatId)) {
    throw new Error('请选择要绑定的消息框。');
  }

  const [
    existingMemories,
    existingCandidates,
    existingRevisions
  ] = await Promise.all([
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

  const sourceMessageIdSet = new Set(
    sourceMessages.map((message) => message.id)
  );

  const unavailableSourceCount = parsedImport.memories.filter(
    (memory) => {
      const ids = normalizeMessageIds(memory.sourceMessageIds);

      return (
        ids.length === 0 ||
        ids.every((id) => !sourceMessageIdSet.has(id))
      );
    }
  ).length;

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

const createImportIdMap = async ({
  targetChatId,
  memories,
  candidates,
  revisions
}) => {
  const incomingMemoryIds = memories
    .map((item) => cleanText(item?.memoryId))
    .filter(Boolean);

  const incomingCandidateIds = candidates
    .map((item) => cleanText(item?.candidateId))
    .filter(Boolean);

  const incomingRevisionIds = revisions
    .map((item) => cleanText(item?.revisionId))
    .filter(Boolean);

  const [
    existingMemories,
    existingCandidates,
    existingRevisions
  ] = await Promise.all([
    incomingMemoryIds.length > 0
      ? db.memories
        .where('memoryId')
        .anyOf(incomingMemoryIds)
        .toArray()
      : [],
    incomingCandidateIds.length > 0
      ? db.memoryCandidates
        .where('candidateId')
        .anyOf(incomingCandidateIds)
        .toArray()
      : [],
    incomingRevisionIds.length > 0
      ? db.memoryRevisions
        .where('revisionId')
        .anyOf(incomingRevisionIds)
        .toArray()
      : []
  ]);

  const memoryIdMap = new Map();
  const candidateIdMap = new Map();
  const revisionIdMap = new Map();

  for (const existingMemory of existingMemories) {
    if (existingMemory.chatId !== targetChatId) {
      memoryIdMap.set(
        existingMemory.memoryId,
        createStableId('memory')
      );
    }
  }

  for (const existingCandidate of existingCandidates) {
    if (existingCandidate.chatId !== targetChatId) {
      candidateIdMap.set(
        existingCandidate.candidateId,
        createStableId('memory_candidate')
      );
    }
  }

  for (const existingRevision of existingRevisions) {
    if (existingRevision.chatId !== targetChatId) {
      revisionIdMap.set(
        existingRevision.revisionId,
        createStableId('memory_revision')
      );
    }
  }

  return {
    memoryIdMap,
    candidateIdMap,
    revisionIdMap
  };
};

const createNormalizedImportData = ({
  parsedImport,
  targetChatId,
  idMap
}) => {
  const normalizedMemories = parsedImport.memories
    .map((memory) => {
      const normalized = normalizeMemory(
        memory,
        targetChatId
      );

      return {
        ...normalized,
        memoryId: idMap.memoryIdMap.get(normalized.memoryId)
          || normalized.memoryId
      };
    });

  const normalizedCandidates = parsedImport.candidates
    .map((candidate) => {
      const originalCandidate = removeLocalId(candidate);
      const normalized = normalizeCandidate(
        candidate,
        targetChatId
      );

      const originalCandidateId = normalized.candidateId;
      const originalAcceptedMemoryId = cleanText(
        originalCandidate.acceptedMemoryId
      );

      return {
        ...normalized,
        candidateId: idMap.candidateIdMap.get(
          originalCandidateId
        ) || originalCandidateId,

        // 候选若已经记录了正式记忆关联，
        // 跨 Chat 导入后也必须同步使用新的 memoryId。
        acceptedMemoryId: originalAcceptedMemoryId
          ? (
              idMap.memoryIdMap.get(originalAcceptedMemoryId)
              || originalAcceptedMemoryId
            )
          : undefined
      };
    });

  const normalizedRevisions = parsedImport.revisions
    .filter((revision) => cleanText(revision?.memoryId))
    .map((revision) => {
      const sourceRevision = removeLocalId(revision);
      const originalMemoryId = cleanText(
        sourceRevision.memoryId
      );
      const originalRevisionId = cleanText(
        sourceRevision.revisionId
      );

      const mappedMemoryId = idMap.memoryIdMap.get(
        originalMemoryId
      ) || originalMemoryId;

      return {
        ...sourceRevision,
        revisionId: idMap.revisionIdMap.get(
          originalRevisionId
        ) || originalRevisionId || createStableId(
          'memory_revision'
        ),
        memoryId: mappedMemoryId,
        chatId: targetChatId,
        action: cleanText(sourceRevision.action)
          || MEMORY_REVISION_ACTIONS.IMPORTED,
        snapshot: normalizeRevisionSnapshot({
          snapshot: sourceRevision.snapshot,
          mappedMemoryId,
          targetChatId
        }),
        createdAt: sourceRevision.createdAt || nowIso()
      };
    });

  return {
    normalizedMemories,
    normalizedCandidates,
    normalizedRevisions
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

  if (!isValidChatId(targetChatId)) {
    throw new Error('请选择要绑定的消息框。');
  }

  if (!Object.values(MEMORY_IMPORT_MODES).includes(mode)) {
    throw new Error('无效的记忆导入模式。');
  }

  const idMap = await createImportIdMap({
    targetChatId,
    memories: parsedImport.memories,
    candidates: parsedImport.candidates || [],
    revisions: parsedImport.revisions || []
  });

  const {
    normalizedMemories,
    normalizedCandidates,
    normalizedRevisions
  } = createNormalizedImportData({
    parsedImport,
    targetChatId,
    idMap
  });

  const counts = {
    insertedMemories: 0,
    updatedMemories: 0,
    skippedMemories: 0,
    insertedCandidates: 0,
    skippedCandidates: 0,
    insertedRevisions: 0,
    skippedRevisions: 0
  };

  await db.transaction(
    'rw',
    db.memories,
    db.memoryCandidates,
    db.memoryRevisions,
    async () => {
      if (mode === MEMORY_IMPORT_MODES.REPLACE_CHAT) {
        await db.memories
          .where('chatId')
          .equals(targetChatId)
          .delete();

        await db.memoryCandidates
          .where('chatId')
          .equals(targetChatId)
          .delete();

        await db.memoryRevisions
          .where('chatId')
          .equals(targetChatId)
          .delete();
      }

      const currentMemories = await db.memories
        .where('chatId')
        .equals(targetChatId)
        .toArray();

      const currentByMemoryId = new Map(
        currentMemories.map(
          (memory) => [memory.memoryId, memory]
        )
      );

      for (const memory of normalizedMemories) {
        const existing = currentByMemoryId.get(
          memory.memoryId
        );

        if (
          existing &&
          mode === MEMORY_IMPORT_MODES.ONLY_NEW
        ) {
          counts.skippedMemories += 1;
          continue;
        }

        if (
          existing &&
          mode === MEMORY_IMPORT_MODES.MERGE
        ) {
          const existingTime = new Date(
            existing.updatedAt || 0
          ).getTime();

          const incomingTime = new Date(
            memory.updatedAt || 0
          ).getTime();

          if (
            Number.isFinite(existingTime) &&
            Number.isFinite(incomingTime) &&
            incomingTime <= existingTime
          ) {
            counts.skippedMemories += 1;
            continue;
          }

          await db.memories.update(existing.id, {
            ...memory,
            id: existing.id,
            memoryId: existing.memoryId,
            chatId: targetChatId,
            sourceMessageIds: [],
            sourceMessageTimestamps: [],
            sourceState: MEMORY_SOURCE_STATES
              .IMPORTED_WITHOUT_SOURCE,
            sourceKind: MEMORY_SOURCE_KINDS.IMPORTED
          });

          counts.updatedMemories += 1;
          continue;
        }

        const {
          id,
          ...memoryWithoutLocalId
        } = memory;

        await db.memories.add(memoryWithoutLocalId);

        counts.insertedMemories += 1;
        currentByMemoryId.set(
          memory.memoryId,
          memoryWithoutLocalId
        );
      }

      const existingCandidates = await db.memoryCandidates
        .where('chatId')
        .equals(targetChatId)
        .toArray();

      const existingCandidateIds = new Set(
        existingCandidates.map(
          (candidate) => candidate.candidateId
        )
      );

      for (const candidate of normalizedCandidates) {
        if (existingCandidateIds.has(candidate.candidateId)) {
          counts.skippedCandidates += 1;
          continue;
        }

        const {
          id,
          ...candidateWithoutLocalId
        } = candidate;

        await db.memoryCandidates.add(
          candidateWithoutLocalId
        );

        existingCandidateIds.add(candidate.candidateId);
        counts.insertedCandidates += 1;
      }

      const existingRevisions = await db.memoryRevisions
        .where('chatId')
        .equals(targetChatId)
        .toArray();

      const existingRevisionIds = new Set(
        existingRevisions.map(
          (revision) => revision.revisionId
        )
      );

      for (const revision of normalizedRevisions) {
        if (existingRevisionIds.has(revision.revisionId)) {
          counts.skippedRevisions += 1;
          continue;
        }

        const {
          id,
          ...revisionWithoutLocalId
        } = revision;

        await db.memoryRevisions.add(
          revisionWithoutLocalId
        );

        existingRevisionIds.add(revision.revisionId);
        counts.insertedRevisions += 1;
      }
    }
  );

  return counts;
};

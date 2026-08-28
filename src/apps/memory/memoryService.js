import db from '../../db';

import {
  MEMORY_CANDIDATE_PROPOSALS,
  MEMORY_CANDIDATE_STATUSES,
  MEMORY_CONFIDENCES,
  MEMORY_JOB_STATUSES,
  MEMORY_REVISION_ACTIONS,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STATUSES
} from './memoryConstants';
import {
  normalizeComparableText
} from './memoryQuality';

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

const toIsoNow = () => new Date().toISOString();

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(numberValue)));
};

const normalizeText = (value) => String(value || '').trim();

const normalizeSourceMessageIds = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
};

const normalizeMemoryIdList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((memoryId) => normalizeText(memoryId))
      .filter(Boolean)
  )];
};

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

const assertChatId = (chatId) => {
  if (!isValidChatId(chatId)) {
    throw new Error('缺少消息框标识，无法处理记忆。');
  }
};

const assertMemoryContent = (content) => {
  if (!normalizeText(content)) {
    throw new Error('记忆内容不能为空。');
  }
};

const assertMemoryStatus = (status) => {
  if (!Object.values(MEMORY_STATUSES).includes(status)) {
    throw new Error('无效的记忆状态。');
  }
};

const createRevisionPayload = ({
  memoryId,
  chatId,
  action,
  snapshot,
  createdAt = toIsoNow(),
  note = ''
}) => ({
  revisionId: createStableId('memory_revision'),
  memoryId,
  chatId,
  action,
  snapshot,
  note: normalizeText(note),
  createdAt
});

const getSourceStateFromData = ({
  sourceKind,
  sourceMessageIds
}) => {
  if (
    sourceKind === MEMORY_SOURCE_KINDS.IMPORTED ||
    sourceKind === MEMORY_SOURCE_KINDS.USER_CREATED
  ) {
    return sourceKind === MEMORY_SOURCE_KINDS.IMPORTED
      ? MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE
      : MEMORY_SOURCE_STATES.USER_CREATED;
  }

  return sourceMessageIds.length > 0
    ? MEMORY_SOURCE_STATES.AVAILABLE
    : MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE;
};

const deleteMemoryRevisionsForChatInTransaction = async (chatId) => {
  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  const memoryIds = memories
    .map((memory) => memory.memoryId)
    .filter(Boolean);

  await db.memoryRevisions
    .where('chatId')
    .equals(chatId)
    .delete();

  // chatId 意外不一致时，仍按关联 memoryId 兜底清理修订。
  for (const memoryId of memoryIds) {
    await db.memoryRevisions
      .where('memoryId')
      .equals(memoryId)
      .delete();
  }
};

export const getChatMemory = async (chatId) => {
  assertChatId(chatId);

  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  return memories.sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();

    return bTime - aTime;
  });
};

export const getMemoryById = async (memoryId) => {
  if (!memoryId) {
    return null;
  }

  return db.memories
    .where('memoryId')
    .equals(memoryId)
    .first();
};

export const getMemoryRevisions = async (memoryId) => {
  if (!memoryId) {
    return [];
  }

  const revisions = await db.memoryRevisions
    .where('memoryId')
    .equals(memoryId)
    .toArray();

  return revisions.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();

    return bTime - aTime;
  });
};

export const createMemory = async ({
  chatId,
  title = '',
  content,
  type = 'fact',
  status = MEMORY_STATUSES.ACTIVE,
  importance = 3,
  confidence = MEMORY_CONFIDENCES.USER_WRITTEN,
  sourceMessageIds = [],
  sourceMessageTimestamps = [],
  sourceState = MEMORY_SOURCE_STATES.USER_CREATED,
  sourceKind = MEMORY_SOURCE_KINDS.USER_CREATED,
  supersedesMemoryId = null,
  supersededByMemoryId = null,
  duplicateOfMemoryId = null,
  conflictWithMemoryIds = [],
  note = ''
}) => {
  assertChatId(chatId);
  assertMemoryContent(content);
  assertMemoryStatus(status);

  const now = toIsoNow();

  const memory = {
    memoryId: createStableId('memory'),
    chatId,
    title: normalizeText(title),
    content: normalizeText(content),
    type,
    status,
    importance: normalizeImportance(importance),
    confidence,
    sourceMessageIds: normalizeSourceMessageIds(sourceMessageIds),
    sourceMessageTimestamps: Array.isArray(sourceMessageTimestamps)
      ? sourceMessageTimestamps.filter(Boolean)
      : [],
    sourceState,
    sourceKind,
    createdAt: now,
    updatedAt: now,

    normalizedContent: normalizeComparableText(content),

    userEditedAt: null,
    userConfirmedAt: confidence === MEMORY_CONFIDENCES.USER_WRITTEN
      ? now
      : null,

    supersedesMemoryId: normalizeText(supersedesMemoryId) || null,
    supersededByMemoryId: normalizeText(supersededByMemoryId) || null,
    duplicateOfMemoryId: normalizeText(duplicateOfMemoryId) || null,
    conflictWithMemoryIds: normalizeMemoryIdList(conflictWithMemoryIds),

    lastUsedAt: null,
    lastRetrievedAt: null,
    useCount: 0
  };

  await db.transaction(
    'rw',
    db.memories,
    db.memoryRevisions,
    async () => {
      await db.memories.add(memory);

      await db.memoryRevisions.add(createRevisionPayload({
        memoryId: memory.memoryId,
        chatId,
        action: MEMORY_REVISION_ACTIONS.CREATED,
        snapshot: memory,
        createdAt: now,
        note
      }));
    }
  );

  return memory;
};

export const updateMemory = async (
  memoryId,
  updates,
  { note = '' } = {}
) => {
  const currentMemory = await getMemoryById(memoryId);

  if (!currentMemory) {
    throw new Error('未找到需要修改的记忆。');
  }

  const nextContent = updates.content === undefined
    ? currentMemory.content
    : normalizeText(updates.content);

  assertMemoryContent(nextContent);

  if (
    updates.status !== undefined &&
    !Object.values(MEMORY_STATUSES).includes(updates.status)
  ) {
    throw new Error('无效的记忆状态。');
  }

  const now = toIsoNow();

  const nextMemory = {
    ...currentMemory,
    ...updates,
    title: updates.title === undefined
      ? currentMemory.title
      : normalizeText(updates.title),
    content: nextContent,
    importance: updates.importance === undefined
      ? currentMemory.importance
      : normalizeImportance(updates.importance),
    confidence: updates.confidence === undefined
      ? currentMemory.confidence
      : updates.confidence,
    sourceMessageIds: updates.sourceMessageIds === undefined
      ? currentMemory.sourceMessageIds
      : normalizeSourceMessageIds(updates.sourceMessageIds),
    sourceMessageTimestamps: updates.sourceMessageTimestamps === undefined
      ? currentMemory.sourceMessageTimestamps
      : Array.isArray(updates.sourceMessageTimestamps)
        ? updates.sourceMessageTimestamps.filter(Boolean)
        : [],
    supersedesMemoryId: updates.supersedesMemoryId === undefined
      ? currentMemory.supersedesMemoryId || null
      : normalizeText(updates.supersedesMemoryId) || null,
    supersededByMemoryId: updates.supersededByMemoryId === undefined
      ? currentMemory.supersededByMemoryId || null
      : normalizeText(updates.supersededByMemoryId) || null,
    duplicateOfMemoryId: updates.duplicateOfMemoryId === undefined
      ? currentMemory.duplicateOfMemoryId || null
      : normalizeText(updates.duplicateOfMemoryId) || null,
    conflictWithMemoryIds: updates.conflictWithMemoryIds === undefined
      ? normalizeMemoryIdList(currentMemory.conflictWithMemoryIds)
      : normalizeMemoryIdList(updates.conflictWithMemoryIds),

    normalizedContent: normalizeComparableText(nextContent),

    // 通过记忆空间的编辑动作，视为用户主动修订。
    // 后续 AI 整理只能提出更新候选，不能静默覆盖此记录。
    userEditedAt: now,
    userConfirmedAt: currentMemory.userConfirmedAt || now,
    updatedAt: now
  };

  await db.transaction(
    'rw',
    db.memories,
    db.memoryRevisions,
    async () => {
      await db.memoryRevisions.add(createRevisionPayload({
        memoryId: currentMemory.memoryId,
        chatId: currentMemory.chatId,
        action: MEMORY_REVISION_ACTIONS.EDITED,
        snapshot: currentMemory,
        createdAt: now,
        note
      }));

      await db.memories.update(currentMemory.id, nextMemory);
    }
  );

  return nextMemory;
};

export const setMemoryStatus = async (
  memoryId,
  status,
  { note = '' } = {}
) => {
  assertMemoryStatus(status);

  const currentMemory = await getMemoryById(memoryId);

  if (!currentMemory) {
    throw new Error('未找到需要更新的记忆。');
  }

  const actionByStatus = {
    [MEMORY_STATUSES.WITHDRAWN]: MEMORY_REVISION_ACTIONS.WITHDRAWN,
    [MEMORY_STATUSES.ARCHIVED]: MEMORY_REVISION_ACTIONS.ARCHIVED,
    [MEMORY_STATUSES.DORMANT]: MEMORY_REVISION_ACTIONS.DORMANT,
    [MEMORY_STATUSES.CORRECTED]: MEMORY_REVISION_ACTIONS.CORRECTED,
    [MEMORY_STATUSES.ACTIVE]: MEMORY_REVISION_ACTIONS.RESTORED
  };

  const now = toIsoNow();

  const nextMemory = {
    ...currentMemory,
    status,
    updatedAt: now,
    withdrawnAt: status === MEMORY_STATUSES.WITHDRAWN
      ? now
      : null,
    correctedAt: status === MEMORY_STATUSES.CORRECTED
      ? now
      : currentMemory.correctedAt || null
  };

  await db.transaction(
    'rw',
    db.memories,
    db.memoryRevisions,
    async () => {
      await db.memoryRevisions.add(createRevisionPayload({
        memoryId: currentMemory.memoryId,
        chatId: currentMemory.chatId,
        action: actionByStatus[status] || MEMORY_REVISION_ACTIONS.EDITED,
        snapshot: currentMemory,
        createdAt: now,
        note
      }));

      await db.memories.update(currentMemory.id, nextMemory);
    }
  );

  return nextMemory;
};

export const withdrawMemory = async (memoryId, options = {}) => (
  setMemoryStatus(memoryId, MEMORY_STATUSES.WITHDRAWN, options)
);

export const restoreMemory = async (memoryId, options = {}) => (
  setMemoryStatus(memoryId, MEMORY_STATUSES.ACTIVE, options)
);

export const archiveMemory = async (memoryId, options = {}) => (
  setMemoryStatus(memoryId, MEMORY_STATUSES.ARCHIVED, options)
);

export const permanentlyDeleteMemory = async (memoryId) => {
  const currentMemory = await getMemoryById(memoryId);

  if (!currentMemory) {
    return false;
  }

  await db.transaction(
    'rw',
    db.memories,
    db.memoryRevisions,
    async () => {
      await db.memories.delete(currentMemory.id);

      await db.memoryRevisions
        .where('memoryId')
        .equals(currentMemory.memoryId)
        .delete();
    }
  );

  return true;
};

export const refreshMemorySourceState = async (memoryId) => {
  const memory = await getMemoryById(memoryId);

  if (!memory) {
    return null;
  }

  if (
    memory.sourceKind === MEMORY_SOURCE_KINDS.IMPORTED ||
    memory.sourceKind === MEMORY_SOURCE_KINDS.USER_CREATED
  ) {
    return memory;
  }

  const sourceMessageIds = normalizeSourceMessageIds(memory.sourceMessageIds);

  if (sourceMessageIds.length === 0) {
    return memory;
  }

  const sourceMessages = await db.messages.bulkGet(sourceMessageIds);

  const validSourceMessages = sourceMessages.filter(
    (message) => (
      message &&
      message.chatId === memory.chatId
    )
  );

  const existingCount = validSourceMessages.length;

  let sourceState = MEMORY_SOURCE_STATES.AVAILABLE;

  if (existingCount === 0) {
    sourceState = MEMORY_SOURCE_STATES.DELETED;
  } else if (existingCount < sourceMessageIds.length) {
    sourceState = MEMORY_SOURCE_STATES.PARTIALLY_DELETED;
  }

  if (memory.sourceState !== sourceState) {
    const nextMemory = {
      ...memory,
      sourceState,
      updatedAt: toIsoNow()
    };

    await db.memories.update(memory.id, nextMemory);

    return nextMemory;
  }

  return memory;
};

export const refreshChatMemorySourceStates = async (chatId) => {
  const memories = await getChatMemory(chatId);

  return Promise.all(
    memories.map((memory) => refreshMemorySourceState(memory.memoryId))
  );
};

export const getChatMemoryCandidates = async (chatId) => {
  assertChatId(chatId);

  const candidates = await db.memoryCandidates
    .where('chatId')
    .equals(chatId)
    .toArray();

  return candidates.sort((a, b) => {
    const priorityDifference = Number(b.priority || 0)
      - Number(a.priority || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return new Date(b.updatedAt || b.createdAt || 0).getTime()
      - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
};

export const getMemoryJob = async (chatId) => {
  assertChatId(chatId);

  return db.memoryJobs
    .where('chatId')
    .equals(chatId)
    .first();
};

export const ensureMemoryJob = async (chatId) => {
  assertChatId(chatId);

  const existingJob = await getMemoryJob(chatId);

  if (existingJob) {
    return existingJob;
  }

  const now = toIsoNow();

  const job = {
    chatId,
    status: MEMORY_JOB_STATUSES.IDLE,
    lastProcessedMessageId: null,
    nextRunAt: null,
    lastError: '',
    retryCount: 0,
    createdAt: now,
    updatedAt: now
  };

  try {
    await db.memoryJobs.add(job);
    return job;
  } catch (error) {
    const concurrentJob = await getMemoryJob(chatId);

    if (concurrentJob) {
      return concurrentJob;
    }

    throw error;
  }
};

export const destroyChatWithMemories = async (chatId) => {
  assertChatId(chatId);

  await db.transaction(
    'rw',
    db.chats,
    db.messages,
    db.memories,
    db.memoryCandidates,
    db.memoryRevisions,
    db.memoryJobs,
    db.scheduledMessages,
    async () => {
      await db.messages
        .where('chatId')
        .equals(chatId)
        .delete();

      await deleteMemoryRevisionsForChatInTransaction(chatId);

      await db.memories
        .where('chatId')
        .equals(chatId)
        .delete();

      await db.memoryCandidates
        .where('chatId')
        .equals(chatId)
        .delete();

      await db.memoryJobs
        .where('chatId')
        .equals(chatId)
        .delete();

      await db.scheduledMessages
        .where('chatId')
        .equals(chatId)
        .delete();

      await db.chats.delete(chatId);
    }
  );
};

export const clearChatMemoryData = async (chatId) => {
  assertChatId(chatId);

  await db.transaction(
    'rw',
    db.memories,
    db.memoryCandidates,
    db.memoryRevisions,
    db.memoryJobs,
    async () => {
      await deleteMemoryRevisionsForChatInTransaction(chatId);

      await db.memories
        .where('chatId')
        .equals(chatId)
        .delete();

      await db.memoryCandidates
        .where('chatId')
        .equals(chatId)
        .delete();

      await db.memoryJobs
        .where('chatId')
        .equals(chatId)
        .delete();
    }
  );
};

export const createPendingMemoryCandidate = async ({
  chatId,
  title = '',
  content,
  type = 'fact',
  priority = 3,
  sourceMessageIds = [],
  sourceMessageTimestamps = [],
  sourceKind = MEMORY_SOURCE_KINDS.CONVERSATION,

  proposalType = MEMORY_CANDIDATE_PROPOSALS.CREATE,
  targetMemoryId = null,
  relatedMemoryIds = [],
  similarityScore = 0,
  conflictReason = ''
}) => {
  assertChatId(chatId);
  assertMemoryContent(content);

  const now = toIsoNow();

  const candidate = {
    candidateId: createStableId('memory_candidate'),
    chatId,
    title: normalizeText(title),
    content: normalizeText(content),
    type,
    priority: normalizeImportance(priority),
    status: MEMORY_CANDIDATE_STATUSES.PENDING,

    proposalType: Object.values(MEMORY_CANDIDATE_PROPOSALS).includes(
      proposalType
    )
      ? proposalType
      : MEMORY_CANDIDATE_PROPOSALS.CREATE,

    targetMemoryId: normalizeText(targetMemoryId) || null,

    relatedMemoryIds: Array.isArray(relatedMemoryIds)
      ? [...new Set(
          relatedMemoryIds
            .map((id) => normalizeText(id))
            .filter(Boolean)
        )]
      : [],

    similarityScore: Math.max(
      0,
      Math.min(1, Number(similarityScore) || 0)
    ),

    conflictReason: normalizeText(conflictReason),

    sourceMessageIds: normalizeSourceMessageIds(sourceMessageIds),
    sourceMessageTimestamps: Array.isArray(sourceMessageTimestamps)
      ? sourceMessageTimestamps.filter(Boolean)
      : [],
    sourceKind,
    createdAt: now,
    updatedAt: now
  };

  await db.memoryCandidates.add(candidate);

  return candidate;
};

export const acceptMemoryCandidate = async (
  candidateId,
  {
    title,
    content,
    type,
    importance,
    note = '由待确认记忆采纳。'
  } = {}
) => {
  if (!candidateId) {
    throw new Error('缺少待确认记忆标识。');
  }

  const candidate = await db.memoryCandidates
    .where('candidateId')
    .equals(candidateId)
    .first();

  if (!candidate) {
    throw new Error('未找到待确认记忆。');
  }

  if (candidate.status !== MEMORY_CANDIDATE_STATUSES.PENDING) {
    throw new Error('这条候选记忆已被处理。');
  }

  const now = toIsoNow();

  const nextTitle = normalizeText(
    title === undefined ? candidate.title : title
  );

  const nextContent = normalizeText(
    content === undefined ? candidate.content : content
  );

  assertMemoryContent(nextContent);

  const nextType = type || candidate.type || 'fact';

  const nextImportance = normalizeImportance(
    importance === undefined
      ? candidate.priority
      : importance
  );

  const proposalType = candidate.proposalType
    || MEMORY_CANDIDATE_PROPOSALS.CREATE;

  const targetMemory = candidate.targetMemoryId
    ? await getMemoryById(candidate.targetMemoryId)
    : null;

  const sourceMessageIds = normalizeSourceMessageIds(
    candidate.sourceMessageIds
  );

  const sourceKind = candidate.sourceKind
    || MEMORY_SOURCE_KINDS.CONVERSATION;

  const createAcceptedMemoryPayload = ({
    supersedesMemoryId = null
  } = {}) => ({
    memoryId: createStableId('memory'),
    chatId: candidate.chatId,
    title: nextTitle,
    content: nextContent,
    type: nextType,
    status: MEMORY_STATUSES.ACTIVE,
    importance: nextImportance,

    // 用户主动点击采纳，故不再只是 AI 推测。
    confidence: MEMORY_CONFIDENCES.CONFIRMED,

    sourceMessageIds,
    sourceMessageTimestamps: Array.isArray(
      candidate.sourceMessageTimestamps
    )
      ? candidate.sourceMessageTimestamps.filter(Boolean)
      : [],

    sourceState: getSourceStateFromData({
      sourceKind,
      sourceMessageIds
    }),

    sourceKind,
    normalizedContent: normalizeComparableText(nextContent),

    userEditedAt: null,
    userConfirmedAt: now,

    supersedesMemoryId,
    supersededByMemoryId: null,
    duplicateOfMemoryId: null,
    conflictWithMemoryIds: [],

    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    lastRetrievedAt: null,
    useCount: 0
  });

  let acceptedMemory = null;

  await db.transaction(
    'rw',
    db.memories,
    db.memoryCandidates,
    db.memoryRevisions,
    async () => {
      if (
        proposalType === MEMORY_CANDIDATE_PROPOSALS.DUPLICATE &&
        targetMemory
      ) {
        await db.memoryCandidates.update(candidate.id, {
          ...candidate,
          status: MEMORY_CANDIDATE_STATUSES.ACCEPTED,
          acceptedMemoryId: targetMemory.memoryId,
          acceptedAsDuplicate: true,
          updatedAt: now
        });

        acceptedMemory = targetMemory;
        return;
      }

      if (
        proposalType === MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING &&
        targetMemory
      ) {
        const nextTargetMemory = {
          ...targetMemory,
          title: nextTitle,
          content: nextContent,
          type: nextType,
          importance: nextImportance,
          confidence: MEMORY_CONFIDENCES.CONFIRMED,

          normalizedContent: normalizeComparableText(nextContent),

          // 由用户采纳候选，视为一次用户确认。
          userConfirmedAt: now,
          updatedAt: now
        };

        await db.memoryRevisions.add(createRevisionPayload({
          memoryId: targetMemory.memoryId,
          chatId: targetMemory.chatId,
          action: MEMORY_REVISION_ACTIONS.EDITED,
          snapshot: targetMemory,
          createdAt: now,
          note: `${note} 已更新原有记忆。`
        }));

        await db.memories.update(targetMemory.id, nextTargetMemory);

        await db.memoryCandidates.update(candidate.id, {
          ...candidate,
          status: MEMORY_CANDIDATE_STATUSES.ACCEPTED,
          acceptedMemoryId: targetMemory.memoryId,
          updatedAt: now
        });

        acceptedMemory = nextTargetMemory;
        return;
      }

      const shouldCorrectTarget = (
        proposalType === MEMORY_CANDIDATE_PROPOSALS.CORRECT_EXISTING &&
        targetMemory
      );

      const memory = createAcceptedMemoryPayload({
        supersedesMemoryId: shouldCorrectTarget
          ? targetMemory.memoryId
          : null
      });

      await db.memories.add(memory);

      await db.memoryRevisions.add(createRevisionPayload({
        memoryId: memory.memoryId,
        chatId: memory.chatId,
        action: MEMORY_REVISION_ACTIONS.CREATED,
        snapshot: memory,
        createdAt: now,
        note
      }));

      if (shouldCorrectTarget) {
        const correctedTarget = {
          ...targetMemory,
          status: MEMORY_STATUSES.CORRECTED,
          supersededByMemoryId: memory.memoryId,
          correctedAt: now,
          updatedAt: now
        };

        await db.memoryRevisions.add(createRevisionPayload({
          memoryId: targetMemory.memoryId,
          chatId: targetMemory.chatId,
          action: MEMORY_REVISION_ACTIONS.SUPERSEDED,
          snapshot: targetMemory,
          createdAt: now,
          note: `已由记忆「${memory.title || memory.content.slice(0, 24)}」更正。`
        }));

        await db.memories.update(
          targetMemory.id,
          correctedTarget
        );
      }

      await db.memoryCandidates.update(candidate.id, {
        ...candidate,
        status: MEMORY_CANDIDATE_STATUSES.ACCEPTED,
        acceptedMemoryId: memory.memoryId,
        updatedAt: now
      });

      acceptedMemory = memory;
    }
  );

  if (
    acceptedMemory &&
    sourceKind === MEMORY_SOURCE_KINDS.CONVERSATION &&
    !acceptedMemory.acceptedAsDuplicate
  ) {
    await refreshMemorySourceState(acceptedMemory.memoryId);
  }

  return acceptedMemory;
};

export const dismissMemoryCandidate = async (
  candidateId,
  { note = '' } = {}
) => {
  if (!candidateId) {
    throw new Error('缺少待确认记忆标识。');
  }

  const candidate = await db.memoryCandidates
    .where('candidateId')
    .equals(candidateId)
    .first();

  if (!candidate) {
    throw new Error('未找到待确认记忆。');
  }

  const now = toIsoNow();

  const nextCandidate = {
    ...candidate,
    status: MEMORY_CANDIDATE_STATUSES.DISMISSED,
    dismissedNote: normalizeText(note),
    updatedAt: now
  };

  await db.memoryCandidates.update(candidate.id, nextCandidate);

  return nextCandidate;
};

export const getPendingMemoryCandidates = async (chatId) => {
  assertChatId(chatId);

  const candidates = await db.memoryCandidates
    .where('chatId')
    .equals(chatId)
    .toArray();

  return candidates
    .filter((candidate) => (
      candidate.status === MEMORY_CANDIDATE_STATUSES.PENDING
    ))
    .sort((a, b) => {
      const priorityDifference = Number(b.priority || 0)
        - Number(a.priority || 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return new Date(b.updatedAt || b.createdAt || 0).getTime()
        - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
};


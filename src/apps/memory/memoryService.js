import db from '../../db';

import {
  MEMORY_CANDIDATE_STATUSES,
  MEMORY_CONFIDENCES,
  MEMORY_JOB_STATUSES,
  MEMORY_REVISION_ACTIONS,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STATUSES
} from './memoryConstants';



const createStableId = (prefix) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
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
  if (!Array.isArray(value)) return [];

  return value
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
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

const assertChatId = (chatId) => {
  if (chatId === null || chatId === undefined || chatId === '') {
    throw new Error('缺少消息框标识，无法处理记忆。');
  }
};

const assertMemoryContent = (content) => {
  if (!normalizeText(content)) {
    throw new Error('记忆内容不能为空。');
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
  if (!memoryId) return null;

  return db.memories.where('memoryId').equals(memoryId).first();
};

export const getMemoryRevisions = async (memoryId) => {
  if (!memoryId) return [];

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
  note = ''
}) => {
  assertChatId(chatId);
  assertMemoryContent(content);

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
    lastUsedAt: null,
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
    sourceMessageIds: updates.sourceMessageIds === undefined
      ? currentMemory.sourceMessageIds
      : normalizeSourceMessageIds(updates.sourceMessageIds),
    sourceMessageTimestamps: updates.sourceMessageTimestamps === undefined
      ? currentMemory.sourceMessageTimestamps
      : Array.isArray(updates.sourceMessageTimestamps)
        ? updates.sourceMessageTimestamps.filter(Boolean)
        : [],
    confidence: updates.confidence || MEMORY_CONFIDENCES.USER_WRITTEN,
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
  const currentMemory = await getMemoryById(memoryId);

  if (!currentMemory) {
    throw new Error('未找到需要更新的记忆。');
  }

  const actionByStatus = {
    [MEMORY_STATUSES.WITHDRAWN]: MEMORY_REVISION_ACTIONS.WITHDRAWN,
    [MEMORY_STATUSES.ARCHIVED]: MEMORY_REVISION_ACTIONS.ARCHIVED,
    [MEMORY_STATUSES.ACTIVE]: MEMORY_REVISION_ACTIONS.RESTORED
  };

  const now = toIsoNow();
  const nextMemory = {
    ...currentMemory,
    status,
    updatedAt: now,
    withdrawnAt: status === MEMORY_STATUSES.WITHDRAWN
      ? now
      : null
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
      await db.memoryRevisions.add(createRevisionPayload({
        memoryId: currentMemory.memoryId,
        chatId: currentMemory.chatId,
        action: MEMORY_REVISION_ACTIONS.DELETED,
        snapshot: currentMemory
      }));

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
  const existingCount = sourceMessages.filter(Boolean).length;

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
    const priorityDifference = Number(b.priority || 0) - Number(a.priority || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return new Date(b.updatedAt || b.createdAt || 0).getTime()
      - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
};

export const getMemoryJob = async (chatId) => {
  assertChatId(chatId);

  return db.memoryJobs.where('chatId').equals(chatId).first();
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

  await db.memoryJobs.add(job);

  return job;
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
    async () => {
      await db.messages.where('chatId').equals(chatId).delete();
      await db.memories.where('chatId').equals(chatId).delete();
      await db.memoryCandidates.where('chatId').equals(chatId).delete();
      await db.memoryRevisions.where('chatId').equals(chatId).delete();
      await db.memoryJobs.where('chatId').equals(chatId).delete();
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
      await db.memories.where('chatId').equals(chatId).delete();
      await db.memoryCandidates.where('chatId').equals(chatId).delete();
      await db.memoryRevisions.where('chatId').equals(chatId).delete();
      await db.memoryJobs.where('chatId').equals(chatId).delete();
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
  sourceKind = MEMORY_SOURCE_KINDS.CONVERSATION
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

  const memory = {
    memoryId: createStableId('memory'),
    chatId: candidate.chatId,
    title: normalizeText(title === undefined ? candidate.title : title),
    content: normalizeText(content === undefined ? candidate.content : content),
    type: type || candidate.type || 'fact',
    status: MEMORY_STATUSES.ACTIVE,
    importance: normalizeImportance(
      importance === undefined ? candidate.priority : importance
    ),
    confidence: MEMORY_CONFIDENCES.CONFIRMED,
    sourceMessageIds: normalizeSourceMessageIds(candidate.sourceMessageIds),
    sourceMessageTimestamps: Array.isArray(candidate.sourceMessageTimestamps)
      ? candidate.sourceMessageTimestamps.filter(Boolean)
      : [],
    sourceState: MEMORY_SOURCE_STATES.AVAILABLE,
    sourceKind: candidate.sourceKind || MEMORY_SOURCE_KINDS.CONVERSATION,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    useCount: 0
  };

  assertMemoryContent(memory.content);

  await db.transaction(
    'rw',
    db.memories,
    db.memoryCandidates,
    db.memoryRevisions,
    async () => {
      await db.memories.add(memory);

      await db.memoryRevisions.add(createRevisionPayload({
        memoryId: memory.memoryId,
        chatId: memory.chatId,
        action: MEMORY_REVISION_ACTIONS.CREATED,
        snapshot: memory,
        createdAt: now,
        note
      }));

      await db.memoryCandidates.update(candidate.id, {
        ...candidate,
        status: MEMORY_CANDIDATE_STATUSES.ACCEPTED,
        acceptedMemoryId: memory.memoryId,
        updatedAt: now
      });
    }
  );

  return memory;
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

  await db.memoryCandidates.update(candidate.id, {
    ...candidate,
    status: MEMORY_CANDIDATE_STATUSES.DISMISSED,
    dismissedNote: normalizeText(note),
    updatedAt: now
  });

  return {
    ...candidate,
    status: MEMORY_CANDIDATE_STATUSES.DISMISSED,
    dismissedNote: normalizeText(note),
    updatedAt: now
  };
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
      const priorityDifference = Number(b.priority || 0) - Number(a.priority || 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return new Date(b.updatedAt || b.createdAt || 0).getTime()
        - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
};

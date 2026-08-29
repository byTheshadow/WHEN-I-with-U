import db from '../../db';

import {
  MEMORY_EMOTION_SUBJECTS,
  MEMORY_RECALL_POLICIES,
  MEMORY_SCOPES,
  MEMORY_STABILITIES,
  MEMORY_SUBJECTS,
  MEMORY_TYPES
} from './memoryConstants';

const normalizeText = (value) => (
  String(value || '').trim()
);

const normalizeTopicKey = (value) => (
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .slice(0, 60)
);

const normalizeSubject = (memory) => {
  if (Object.values(MEMORY_SUBJECTS).includes(memory.subject)) {
    return memory.subject;
  }

  if (memory.type === MEMORY_TYPES.CHARACTER_THOUGHT) {
    return MEMORY_SUBJECTS.CHARACTER;
  }

  if (memory.type === MEMORY_TYPES.RELATIONSHIP) {
    return MEMORY_SUBJECTS.RELATIONSHIP;
  }

  if (memory.type === MEMORY_TYPES.EPISODE) {
    return MEMORY_SUBJECTS.SHARED;
  }

  return MEMORY_SUBJECTS.USER;
};

const normalizeEmotionSubject = (memory, subject) => {
  if (memory.type !== MEMORY_TYPES.EMOTION) {
    return null;
  }

  if (
    Object.values(MEMORY_EMOTION_SUBJECTS)
      .includes(memory.emotionSubject)
  ) {
    return memory.emotionSubject;
  }

  if (subject === MEMORY_SUBJECTS.CHARACTER) {
    return MEMORY_EMOTION_SUBJECTS.CHARACTER;
  }

  if (
    subject === MEMORY_SUBJECTS.RELATIONSHIP ||
    subject === MEMORY_SUBJECTS.SHARED
  ) {
    return MEMORY_EMOTION_SUBJECTS.SHARED;
  }

  return MEMORY_EMOTION_SUBJECTS.USER;
};

const buildFallbackTopicKey = (memory) => {
  const source = [
    memory.topicKey,
    memory.title,
    memory.content
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');

  const normalized = normalizeTopicKey(source);

  if (normalized) {
    return normalized.slice(0, 60);
  }

  return `memory_${memory.memoryId || memory.id || 'unknown'}`;
};

const normalizeStability = (memory) => {
  if (
    Object.values(MEMORY_STABILITIES)
      .includes(memory.stability)
  ) {
    return memory.stability;
  }

  if (
    [
      MEMORY_TYPES.PREFERENCE,
      MEMORY_TYPES.RELATIONSHIP,
      MEMORY_TYPES.EXPRESSION_RULE,
      MEMORY_TYPES.CHARACTER_THOUGHT
    ].includes(memory.type)
  ) {
    return MEMORY_STABILITIES.ONGOING;
  }

  if (
    [
      MEMORY_TYPES.EMOTION,
      MEMORY_TYPES.EPISODE
    ].includes(memory.type)
  ) {
    return MEMORY_STABILITIES.TEMPORARY;
  }

  return MEMORY_STABILITIES.ONGOING;
};

const normalizeScope = (memory, subject) => {
  if (
    Object.values(MEMORY_SCOPES)
      .includes(memory.memoryScope)
  ) {
    return memory.memoryScope;
  }

  if (subject === MEMORY_SUBJECTS.CHARACTER) {
    return MEMORY_SCOPES.CHARACTER_SETTING;
  }

  if (subject === MEMORY_SUBJECTS.RELATIONSHIP) {
    return MEMORY_SCOPES.RELATIONSHIP_SETTING;
  }

  return MEMORY_SCOPES.CONVERSATION;
};

const normalizeRecallPolicy = (memory, scope) => {
  if (
    Object.values(MEMORY_RECALL_POLICIES)
      .includes(memory.recallPolicy)
  ) {
    return memory.recallPolicy;
  }

  if (scope === MEMORY_SCOPES.CHARACTER_SETTING) {
    return MEMORY_RECALL_POLICIES.LOW_FREQUENCY;
  }

  if (
    memory.type === MEMORY_TYPES.EMOTION ||
    memory.type === MEMORY_TYPES.EXPRESSION_RULE
  ) {
    return MEMORY_RECALL_POLICIES.WHEN_RELEVANT;
  }

  return MEMORY_RECALL_POLICIES.NORMAL;
};

const normalizeRecallState = (memory) => {
  const state = (
    memory.recallState &&
    typeof memory.recallState === 'object'
  )
    ? memory.recallState
    : {};

  return {
    cooldownUntil: state.cooldownUntil || null,
    consecutiveRecallCount: Math.max(
      0,
      Number(state.consecutiveRecallCount || 0)
    ),
    lastRecallTurnId: normalizeText(
      state.lastRecallTurnId
    ) || null
  };
};

const normalizeTemporalStatus = (memory) => {
  const status = (
    memory.temporalStatus ||
    memory.temporal?.status ||
    ''
  );

  return normalizeText(status) || null;
};

const buildMissingFields = (memory) => {
  const subject = normalizeSubject(memory);
  const emotionSubject = normalizeEmotionSubject(
    memory,
    subject
  );
  const topicKey = (
    normalizeTopicKey(memory.topicKey) ||
    buildFallbackTopicKey(memory)
  );

  const existingTopicKeys = Array.isArray(memory.topicKeys)
    ? memory.topicKeys
    : [];

  const topicKeys = [
    topicKey,
    ...existingTopicKeys
      .map(normalizeTopicKey)
      .filter(Boolean)
  ];

  const scope = normalizeScope(memory, subject);

  const nextFields = {};

  if (!memory.subject) {
    nextFields.subject = subject;
  }

  if (
    memory.type === MEMORY_TYPES.EMOTION &&
    !memory.emotionSubject
  ) {
    nextFields.emotionSubject = emotionSubject;
  }

  if (!memory.topicKey) {
    nextFields.topicKey = topicKey;
  }

  if (
    !Array.isArray(memory.topicKeys) ||
    memory.topicKeys.length === 0
  ) {
    nextFields.topicKeys = [...new Set(topicKeys)].slice(0, 8);
  }

  if (!memory.stability) {
    nextFields.stability = normalizeStability(memory);
  }

  if (!memory.memoryScope) {
    nextFields.memoryScope = scope;
  }

  if (!memory.recallPolicy) {
    nextFields.recallPolicy = normalizeRecallPolicy(
      memory,
      scope
    );
  }

  if (!memory.recallState) {
    nextFields.recallState = normalizeRecallState(memory);
  }

  const temporalStatus = normalizeTemporalStatus(memory);

  if (
    temporalStatus &&
    memory.temporalStatus !== temporalStatus
  ) {
    nextFields.temporalStatus = temporalStatus;
  }

  return nextFields;
};

export const backfillChatMemories = async (chatId) => {
  if (
    chatId === null ||
    chatId === undefined ||
    chatId === ''
  ) {
    return 0;
  }

  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  let updatedCount = 0;

  await db.transaction(
    'rw',
    db.memories,
    async () => {
      for (const memory of memories) {
        const missingFields = buildMissingFields(memory);

        if (Object.keys(missingFields).length === 0) {
          continue;
        }

        await db.memories.update(
          memory.id,
          missingFields
        );

        updatedCount += 1;
      }
    }
  );

  return updatedCount;
};

export const backfillAllMemories = async () => {
  const memories = await db.memories.toArray();

  let updatedCount = 0;

  await db.transaction(
    'rw',
    db.memories,
    async () => {
      for (const memory of memories) {
        const missingFields = buildMissingFields(memory);

        if (Object.keys(missingFields).length === 0) {
          continue;
        }

        await db.memories.update(
          memory.id,
          missingFields
        );

        updatedCount += 1;
      }
    }
  );

  return updatedCount;
};

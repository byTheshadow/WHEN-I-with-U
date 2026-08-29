import {
  MEMORY_CONFIDENCES,
  MEMORY_STATUSES,
  MEMORY_TYPES
} from './memoryConstants';

export const normalizeComparableText = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？；：“”‘’、,.!?;:()[\]{}]/g, '')
);

export const tokenizeMemoryText = (value) => {
  const text = normalizeComparableText(value);

  if (!text) {
    return [];
  }

  const tokens = new Set();

  text
    .split(/[\s,，。！？；：、“”‘’（）()、/\\|.!?;:\-[\]{}]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .forEach((token) => tokens.add(token));

  const chineseChunks = text.match(/[\u4e00-\u9fff]{2,}/g) || [];

  chineseChunks.forEach((chunk) => {
    for (let index = 0; index < chunk.length - 1; index += 1) {
      tokens.add(chunk.slice(index, index + 2));
    }
  });

  return [...tokens];
};

export const getMemoryComparableText = (memory) => (
  [
    memory?.title,
    memory?.content,
    memory?.type,
    memory?.topicKey,
    ...(Array.isArray(memory?.topicKeys)
      ? memory.topicKeys
      : [])
  ]
    .filter(Boolean)
    .join(' ')
);

export const calculateMemorySimilarity = (left, right) => {
  const leftText = typeof left === 'string'
    ? left
    : getMemoryComparableText(left);

  const rightText = typeof right === 'string'
    ? right
    : getMemoryComparableText(right);

  const normalizedLeft = normalizeComparableText(leftText);
  const normalizedRight = normalizeComparableText(rightText);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const leftTokens = tokenizeMemoryText(leftText);
  const rightTokens = tokenizeMemoryText(rightText);

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const rightSet = new Set(rightTokens);

  const sharedCount = leftTokens.filter((token) => (
    rightSet.has(token)
  )).length;

  const tokenScore = sharedCount / Math.max(
    leftTokens.length,
    rightTokens.length
  );

  const containsScore = (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  )
    ? 0.82
    : 0;

  return Math.max(tokenScore, containsScore);
};

export const hasExplicitCorrectionSignal = (value) => (
  /(不是|并不是|不是这样|我之前说错了|我说错了|更正一下|纠正一下|改成|请以现在这句为准|以后请记住|不再是|已经不)/i
    .test(String(value || ''))
);

export const isManualAuthorityMemory = (memory) => Boolean(
  memory &&
  (
    memory.confidence === MEMORY_CONFIDENCES.USER_WRITTEN ||
    memory.userEditedAt ||
    memory.userConfirmedAt ||
    memory.sourceKind === 'user_created'
  )
);

export const isMemoryAvailableForComparison = (memory) => (
  memory &&
  ![
    MEMORY_STATUSES.WITHDRAWN,
    MEMORY_STATUSES.ARCHIVED,
    MEMORY_STATUSES.CORRECTED
  ].includes(memory.status)
);

const normalizeTopicKey = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
);

const getTopicKeys = (memory) => {
  const topicKey = normalizeTopicKey(memory?.topicKey);

  const topicKeys = Array.isArray(memory?.topicKeys)
    ? memory.topicKeys
      .map(normalizeTopicKey)
      .filter(Boolean)
    : [];

  return [...new Set(
    [topicKey, ...topicKeys].filter(Boolean)
  )];
};

const getTopicRelation = (left, right) => {
  const leftKeys = getTopicKeys(left);
  const rightKeys = getTopicKeys(right);

  if (!leftKeys.length || !rightKeys.length) {
    return {
      matched: false,
      exact: false,
      score: 0
    };
  }

  const rightSet = new Set(rightKeys);
  const sharedKeys = leftKeys.filter((key) => rightSet.has(key));

  if (sharedKeys.length === 0) {
    return {
      matched: false,
      exact: false,
      score: 0
    };
  }

  const exact = Boolean(
    normalizeTopicKey(left?.topicKey) &&
    normalizeTopicKey(left?.topicKey) ===
      normalizeTopicKey(right?.topicKey)
  );

  return {
    matched: true,
    exact,
    score: exact ? 1 : 0.76
  };
};

const getTemporalRange = (memory) => {
  const temporal = memory?.temporal;

  if (!temporal || typeof temporal !== 'object') {
    return null;
  }

  const start = new Date(temporal.startAt || 0).getTime();
  const end = new Date(temporal.endAt || temporal.startAt || 0).getTime();

  if (
    !Number.isFinite(start) ||
    start <= 0 ||
    !Number.isFinite(end) ||
    end <= 0
  ) {
    return null;
  }

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
    status: temporal.status || '',
    precision: temporal.precision || ''
  };
};

const getTemporalRelation = (left, right) => {
  const leftRange = getTemporalRange(left);
  const rightRange = getTemporalRange(right);

  if (!leftRange || !rightRange) {
    return {
      comparable: false,
      overlaps: false,
      sameDay: false,
      clearlyDifferent: false,
      score: 0
    };
  }

  const oneDay = 24 * 60 * 60 * 1000;

  const overlaps = (
    leftRange.start <= rightRange.end &&
    rightRange.start <= leftRange.end
  );

  const sameDay = Math.abs(leftRange.start - rightRange.start) < oneDay;

  return {
    comparable: true,
    overlaps,
    sameDay,
    clearlyDifferent: !overlaps && !sameDay,
    score: overlaps ? 1 : sameDay ? 0.85 : 0
  };
};

const getSemanticSimilarity = (incomingMemory, existingMemory) => {
  const textScore = calculateMemorySimilarity(
    incomingMemory,
    existingMemory
  );

  const sameType = (
    incomingMemory?.type &&
    incomingMemory.type === existingMemory?.type
  );

  const sameSubject = (
    incomingMemory?.subject &&
    existingMemory?.subject &&
    incomingMemory.subject === existingMemory.subject
  );

  const topic = getTopicRelation(
    incomingMemory,
    existingMemory
  );

  const temporal = getTemporalRelation(
    incomingMemory,
    existingMemory
  );

  let score = textScore;

  if (sameType) {
    score += 0.1;
  }

  if (sameSubject) {
    score += 0.14;
  }

  if (topic.matched) {
    score += topic.exact ? 0.42 : 0.28;
  }

  if (temporal.overlaps) {
    score += 0.2;
  }

  return {
    score: Math.min(1, score),
    textScore,
    sameType,
    sameSubject,
    topic,
    temporal
  };
};

const isSamePlannedEvent = (relation, incomingMemory, existingMemory) => (
  incomingMemory?.type === MEMORY_TYPES.EPISODE &&
  existingMemory?.type === MEMORY_TYPES.EPISODE &&
  relation.sameSubject &&
  relation.topic.matched &&
  (
    relation.temporal.overlaps ||
    relation.temporal.sameDay
  )
);

const isSeparateTimedEvent = (
  relation,
  incomingMemory,
  existingMemory
) => (
  incomingMemory?.type === MEMORY_TYPES.EPISODE &&
  existingMemory?.type === MEMORY_TYPES.EPISODE &&
  relation.sameSubject &&
  relation.topic.matched &&
  relation.temporal.comparable &&
  relation.temporal.clearlyDifferent
);

export const findClosestMemoryMatch = (
  incomingMemory,
  existingMemories = []
) => {
  const candidates = existingMemories
    .filter(isMemoryAvailableForComparison)
    .map((memory) => {
      const relation = getSemanticSimilarity(
        incomingMemory,
        memory
      );

      return {
        memory,
        similarityScore: relation.score,
        relation
      };
    })
    .sort((left, right) => (
      right.similarityScore - left.similarityScore
    ));

  return candidates[0] || null;
};

export const decideMemoryProposal = ({
  incomingMemory,
  existingMemories = [],
  sourceTexts = []
}) => {
  const closest = findClosestMemoryMatch(
    incomingMemory,
    existingMemories
  );

  if (!closest || closest.similarityScore < 0.48) {
    return {
      proposalType: 'create',
      targetMemoryId: null,
      relatedMemoryIds: [],
      similarityScore: 0,
      conflictReason: ''
    };
  }

  const target = closest.memory;
  const relation = closest.relation;
  const similarityScore = closest.similarityScore;

  /*
   * 同主题但具有明确不同日期的共同经历，通常是两次事件。
   * 例如：两次不同周五的约会，不能被误并为同一条。
   */
  if (isSeparateTimedEvent(relation, incomingMemory, target)) {
    return {
      proposalType: 'create',
      targetMemoryId: null,
      relatedMemoryIds: [target.memoryId],
      similarityScore,
      conflictReason: ''
    };
  }

  const correctionSignal = sourceTexts.some(
    hasExplicitCorrectionSignal
  );

  if (correctionSignal && relation.sameSubject) {
    return {
      proposalType: 'correct_existing',
      targetMemoryId: target.memoryId,
      relatedMemoryIds: [target.memoryId],
      similarityScore,
      conflictReason: isManualAuthorityMemory(target)
        ? '用户当前表达可能正在更正一条手动维护的记忆；建议由用户确认后再替代旧理解。'
        : '用户当前表达可能正在更正旧理解。'
    };
  }

  /*
   * 同一主题、主体、类型的稳定偏好与事实，允许更积极地判定为更新。
   * 例：
   * - 喜欢咖啡 → 更喜欢拿铁
   * - 常喝咖啡 → 最近开始戒咖啡
   */
  const shouldMergeStableMemory = (
    relation.sameType &&
    relation.sameSubject &&
    relation.topic.matched &&
    [
      MEMORY_TYPES.PREFERENCE,
      MEMORY_TYPES.FACT,
      MEMORY_TYPES.RELATIONSHIP,
      MEMORY_TYPES.EXPRESSION_RULE
    ].includes(incomingMemory?.type)
  );

  /*
   * 同一天、同主题的计划事件与后续结果，属于同一事件链。
   * 例：
   * - 本周五要去约会
   * - 约会很顺利
   */
  const shouldMergeEvent = isSamePlannedEvent(
    relation,
    incomingMemory,
    target
  );

  if (
    similarityScore >= 0.9 ||
    (
      relation.textScore >= 0.82 &&
      relation.sameType &&
      relation.sameSubject
    )
  ) {
    return {
      proposalType: 'duplicate',
      targetMemoryId: target.memoryId,
      relatedMemoryIds: [target.memoryId],
      similarityScore,
      conflictReason: '新片段与现有记忆描述的是相同理解。'
    };
  }

  if (
    shouldMergeStableMemory ||
    shouldMergeEvent ||
    similarityScore >= 0.62
  ) {
    return {
      proposalType: 'update_existing',
      targetMemoryId: target.memoryId,
      relatedMemoryIds: [target.memoryId],
      similarityScore,
      conflictReason: isManualAuthorityMemory(target)
        ? '新片段与用户手动维护的记忆属于同一主题，建议由用户确认后合并更新。'
        : shouldMergeEvent
          ? '新片段与已有记忆描述同一时间窗口内的事件，建议合并为一条连续记录。'
          : '新片段与已有记忆属于同一主体和主题，建议合并为更完整的记录。'
    };
  }

  return {
    proposalType: 'conflict',
    targetMemoryId: target.memoryId,
    relatedMemoryIds: [target.memoryId],
    similarityScore,
    conflictReason: '新片段与已有理解有关联，但暂时无法安全判断是否可以合并。'
  };
};

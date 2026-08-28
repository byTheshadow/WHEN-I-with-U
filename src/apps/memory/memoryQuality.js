import {
  MEMORY_CONFIDENCES,
  MEMORY_STATUSES
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
    memory?.type
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
    MEMORY_STATUSES.ARCHIVED
  ].includes(memory.status)
);

export const findClosestMemoryMatch = (
  incomingMemory,
  existingMemories = []
) => {
  const candidates = existingMemories
    .filter(isMemoryAvailableForComparison)
    .map((memory) => ({
      memory,
      similarityScore: calculateMemorySimilarity(
        incomingMemory,
        memory
      )
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore);

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

  if (!closest || closest.similarityScore < 0.45) {
    return {
      proposalType: 'create',
      targetMemoryId: null,
      relatedMemoryIds: [],
      similarityScore: 0,
      conflictReason: ''
    };
  }

  const correctionSignal = sourceTexts.some(
    hasExplicitCorrectionSignal
  );

  const target = closest.memory;
  const similarityScore = closest.similarityScore;

  if (similarityScore >= 0.86) {
    return {
      proposalType: 'duplicate',
      targetMemoryId: target.memoryId,
      relatedMemoryIds: [target.memoryId],
      similarityScore,
      conflictReason: '新片段与现有记忆高度相似。'
    };
  }

  if (correctionSignal) {
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

  if (similarityScore >= 0.6) {
    return {
      proposalType: 'update_existing',
      targetMemoryId: target.memoryId,
      relatedMemoryIds: [target.memoryId],
      similarityScore,
      conflictReason: isManualAuthorityMemory(target)
        ? '新片段接近一条用户手动维护的记忆，系统不会自动覆盖。'
        : '新片段与已有记忆属于相近主题，建议确认是否更新。'
    };
  }

  return {
    proposalType: 'conflict',
    targetMemoryId: target.memoryId,
    relatedMemoryIds: [target.memoryId],
    similarityScore,
    conflictReason: '新片段与已有记忆有关联，但暂时无法确认两者是否可以合并。'
  };
};

import db from '../../db';

import {
  MEMORY_CONFIDENCES,
  MEMORY_STATUSES,
  MEMORY_TYPES,
  RECALLABLE_MEMORY_STATUSES
} from './memoryConstants';

const MAX_MEMORY_ITEMS = 6;
const MAX_CONTEXT_CHARS = 2400;
const MAX_SINGLE_MEMORY_CHARS = 420;
const EMOTION_MIN_SCORE = 0.62;
const DEFAULT_MIN_SCORE = 0.12;

const normalizeText = (value) => String(value || '').trim();

const tokenize = (value) => {
  const text = normalizeText(value).toLowerCase();

  if (!text) return [];

  const tokens = new Set();

  text
    .split(/[\s,，。！？；：、“”‘’（）()、/\\|.!?;:\-[\]{}]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .forEach((item) => tokens.add(item));

  const chineseChunks = text.match(/[\u4e00-\u9fff]{2,}/g) || [];

  chineseChunks.forEach((chunk) => {
    for (let index = 0; index < chunk.length - 1; index += 1) {
      tokens.add(chunk.slice(index, index + 2));
    }
  });

  return [...tokens];
};

const getMemoryText = (memory) => (
  [memory.title, memory.content, memory.type]
    .filter(Boolean)
    .join(' ')
);

const getConfidenceScore = (confidence) => ({
  [MEMORY_CONFIDENCES.USER_WRITTEN]: 1,
  [MEMORY_CONFIDENCES.CONFIRMED]: 0.94,
  [MEMORY_CONFIDENCES.INFERRED]: 0.62,
  [MEMORY_CONFIDENCES.SUGGESTED]: 0.35
}[confidence] || 0.35);

const getTokenOverlap = (leftTokens, rightTokens) => {
  if (!leftTokens.length || !rightTokens.length) return 0;

  const matched = leftTokens.filter((token) => (
    rightTokens.some((other) => (
      token.includes(other) || other.includes(token)
    ))
  )).length;

  return matched / leftTokens.length;
};

const isCurrentCorrection = (userText) => (
  /(不是|并不是|不是这样|我之前说错了|更正一下|纠正一下|改成|请以现在这句为准|以后请记住)/i
    .test(normalizeText(userText))
);

const isRecallableMemory = (memory, chatId) => {
  if (!memory || memory.chatId !== chatId) return false;

  if (!RECALLABLE_MEMORY_STATUSES.includes(memory.status)) {
    return false;
  }

  if (memory.supersededByMemoryId) return false;
  if (memory.duplicateOfMemoryId) return false;

  return true;
};

const getDaysSince = (value) => {
  const time = new Date(value || 0).getTime();

  if (!Number.isFinite(time) || time <= 0) return 365;

  return Math.max(0, (Date.now() - time) / 86400000);
};

const getUserAuthorityBoost = (memory) => {
  let score = 0;

  if (memory.confidence === MEMORY_CONFIDENCES.USER_WRITTEN) {
    score += 0.2;
  }

  if (memory.userEditedAt) {
    score += 0.16;
  }

  if (memory.userConfirmedAt) {
    score += 0.12;
  }

  return score;
};

const getTypeBoost = (memory) => {
  if (memory.type === MEMORY_TYPES.EXPRESSION_RULE) return 0.15;
  if (memory.type === MEMORY_TYPES.PREFERENCE) return 0.06;

  return 0;
};

const getFatiguePenalty = (memory) => {
  const count = Number(memory.useCount || 0);
  const daysSinceUse = getDaysSince(memory.lastUsedAt);

  if (count <= 0) return 0;

  const countPenalty = Math.min(0.22, Math.log2(count + 1) * 0.045);
  const recovery = Math.min(0.1, daysSinceUse * 0.012);

  return Math.max(0, countPenalty - recovery);
};

const calculateScore = (memory, queryTokens) => {
  const memoryTokens = tokenize(getMemoryText(memory));
  const overlap = getTokenOverlap(queryTokens, memoryTokens);

  const importance = Number(memory.importance || 3) / 5;
  const confidence = getConfidenceScore(memory.confidence);
  const freshness = Math.max(0, 1 - getDaysSince(memory.updatedAt) / 365);
  const userAuthority = getUserAuthorityBoost(memory);
  const typeBoost = getTypeBoost(memory);
  const fatigue = getFatiguePenalty(memory);

  const inferredStalenessPenalty = (
    memory.confidence === MEMORY_CONFIDENCES.INFERRED &&
    getDaysSince(memory.updatedAt) > 120
  )
    ? 0.08
    : 0;

  return (
    overlap * 0.58 +
    importance * 0.1 +
    confidence * 0.1 +
    freshness * 0.05 +
    userAuthority +
    typeBoost -
    fatigue -
    inferredStalenessPenalty
  );
};

const getTypeLabel = (type) => ({
  fact: '事实与近况',
  preference: '偏好与习惯',
  episode: '共同经历',
  relationship: '关系理解',
  character_thought: '角色内部背景',
  emotion: '情绪线索',
  expression_rule: '表达方式与边界',
  reflection: '阶段性反思'
}[type] || '共同记忆');

const formatMemoryForPrompt = (memory) => {
  const rawContent = normalizeText(memory.content);
  const content = rawContent.length > MAX_SINGLE_MEMORY_CHARS
    ? `${rawContent.slice(0, MAX_SINGLE_MEMORY_CHARS)}…`
    : rawContent;

  const sourceNotice = memory.sourceState === 'available'
    ? ''
    : '；原始消息依据当前不可完整查看';

  const thoughtNotice = memory.type === MEMORY_TYPES.CHARACTER_THOUGHT
    ? '；这是角色自身的内部背景，不得表述为用户事实'
    : '';

  return `- [${getTypeLabel(memory.type)}] ${
    memory.title ? `${memory.title}：` : ''
  }${content}${sourceNotice}${thoughtNotice}`;
};

const getRecentMessageText = (recentMessages) => (
  (Array.isArray(recentMessages) ? recentMessages : [])
    .filter((message) => message && message.type !== 'error')
    .slice(-6)
    .map((message) => normalizeText(message.content))
    .filter(Boolean)
    .join(' ')
);

export const getRecallableChatMemories = async (chatId) => {
  if (chatId === undefined || chatId === null || chatId === '') {
    return [];
  }

  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  return memories.filter((memory) => isRecallableMemory(memory, chatId));
};

export const getChatMemoryContext = async ({
  chatId,
  userText = '',
  recentMessages = []
}) => {
  if (chatId === undefined || chatId === null || chatId === '') {
    return '';
  }

  const memories = await getRecallableChatMemories(chatId);

  if (!memories.length) return '';

  const currentText = normalizeText(userText);
  const queryTokens = tokenize(
    `${currentText} ${getRecentMessageText(recentMessages)}`
  );

  if (!queryTokens.length) return '';

  const correctionMode = isCurrentCorrection(currentText);

  const ranked = memories
    .map((memory) => ({
      memory,
      score: calculateScore(memory, queryTokens),
      overlap: getTokenOverlap(queryTokens, tokenize(getMemoryText(memory)))
    }))
    .filter(({ memory, score, overlap }) => {
      if (memory.type === MEMORY_TYPES.EMOTION) {
        return overlap >= 0.35 && score >= EMOTION_MIN_SCORE;
      }

      if (correctionMode && overlap >= 0.35) {
        return false;
      }

      return score >= DEFAULT_MIN_SCORE;
    })
    .sort((a, b) => b.score - a.score);

  const selected = [];
  let contextLength = 0;
  const selectedTypes = new Set();

  for (const item of ranked) {
    if (selected.length >= MAX_MEMORY_ITEMS) break;

    const line = formatMemoryForPrompt(item.memory);

    if (contextLength + line.length > MAX_CONTEXT_CHARS) {
      continue;
    }

    // 避免同一类型占满全部上下文；边界类除外。
    if (
      selectedTypes.has(item.memory.type) &&
      selected.filter((memory) => memory.type === item.memory.type).length >= 2 &&
      item.memory.type !== MEMORY_TYPES.EXPRESSION_RULE
    ) {
      continue;
    }

    selected.push(item.memory);
    selectedTypes.add(item.memory.type);
    contextLength += line.length;
  }

  if (!selected.length) return '';

  void markMemoriesUsed(selected).catch((error) => {
    console.warn('[Memory] Failed to mark recalled memories:', error);
  });

  return `
【仅供当前消息框回复参考的共同记忆】
以下内容仅属于当前消息框。用户当前明确表达的说法永远优先于旧记录。
只在与当前话题自然相关时参考，不要提及记忆系统、数据库、检索结果或内部字段。
不得使用已撤回、归档、失效、冲突、被更正或已被替代的记录。
情绪线索只在当前语境直接相关时谨慎参考，不得借此向用户施压、催促或制造愧疚。
角色内部背景不是用户事实，不得将其表述为“用户说过”。
不要逐条复述以下内容：

${selected.map(formatMemoryForPrompt).join('\n')}
`;
};

export const markMemoriesUsed = async (memories = []) => {
  const ids = [...new Set(
    memories
      .map((memory) => memory?.id)
      .filter((id) => id !== undefined && id !== null)
  )];

  if (!ids.length) return;

  const now = new Date().toISOString();

  await db.transaction('rw', db.memories, async () => {
    for (const id of ids) {
      const memory = await db.memories.get(id);

      if (!memory || !RECALLABLE_MEMORY_STATUSES.includes(memory.status)) {
        continue;
      }

      if (memory.supersededByMemoryId || memory.duplicateOfMemoryId) {
        continue;
      }

      await db.memories.update(id, {
        lastUsedAt: now,
        lastRetrievedAt: now,
        useCount: Number(memory.useCount || 0) + 1
      });
    }
  });
};

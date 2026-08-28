import db from '../../db';
import {
  MEMORY_STATUSES,
  RECALLABLE_MEMORY_STATUSES
} from './memoryConstants';

const MAX_MEMORIES = 18;
const MAX_CONTEXT_LENGTH = 12000;

const normalizeText = (value) => String(value || '').trim();

const tokenize = (value) => normalizeText(value)
  .toLowerCase()
  .split(/[\s,，。！？；：、“”‘’（）()、/\\|.!?;:]+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 2);

const getMemoryText = (memory) => [
  memory.title,
  memory.content,
  memory.type
].filter(Boolean).join(' ');

const calculateRelevance = (memory, queryTokens) => {
  const memoryTokens = tokenize(getMemoryText(memory));

  if (queryTokens.length === 0 || memoryTokens.length === 0) {
    return 0;
  }

  const matchedCount = queryTokens.filter((token) => (
    memoryTokens.some((memoryToken) => (
      memoryToken.includes(token) || token.includes(memoryToken)
    ))
  )).length;

  const keywordScore = matchedCount / queryTokens.length;
  const importanceScore = Number(memory.importance || 3) / 5;
  const confidenceScore = {
    user_written: 1,
    confirmed: 0.95,
    inferred: 0.7,
    suggested: 0.45
  }[memory.confidence] || 0.4;

  const updatedAt = new Date(memory.updatedAt || memory.createdAt || 0).getTime();
  const ageDays = Number.isFinite(updatedAt)
    ? Math.max(0, (Date.now() - updatedAt) / 86400000)
    : 365;

  const recencyScore = Math.max(0, 1 - ageDays / 365);

  return (
    keywordScore * 0.55 +
    importanceScore * 0.2 +
    confidenceScore * 0.2 +
    recencyScore * 0.05
  );
};

const getTypeLabel = (type) => ({
  fact: '事实与近况',
  preference: '偏好与习惯',
  episode: '共同经历',
  relationship: '关系理解',
  character_thought: '角色心事',
  emotion: '情绪痕迹',
  expression_rule: '表达方式与边界',
  reflection: '阶段性反思'
}[type] || '共同记忆');

const formatMemoryForPrompt = (memory) => {
  const sourceNotice = memory.sourceState === 'available'
    ? ''
    : '；原始消息依据当前不可完整查看';

  return `- [${getTypeLabel(memory.type)}] ${memory.title
    ? `${memory.title}：`
    : ''}${memory.content}${sourceNotice}`;
};

export const getRecallableChatMemories = async (chatId) => {
  if (chatId === undefined || chatId === null) {
    return [];
  }

  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  return memories.filter((memory) => (
    RECALLABLE_MEMORY_STATUSES.includes(memory.status) &&
    memory.status !== MEMORY_STATUSES.WITHDRAWN &&
    memory.status !== MEMORY_STATUSES.ARCHIVED
  ));
};

export const getChatMemoryContext = async ({
  chatId,
  userText = '',
  recentMessages = []
}) => {
  const memories = await getRecallableChatMemories(chatId);

  if (memories.length === 0) {
    return '';
  }

  const recentText = recentMessages
    .slice(-6)
    .map((message) => message.content || '')
    .join(' ');

  const queryTokens = tokenize(`${userText} ${recentText}`);

  const rankedMemories = memories
    .map((memory) => ({
      memory,
      score: calculateRelevance(memory, queryTokens)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      return new Date(b.memory.updatedAt || 0).getTime()
        - new Date(a.memory.updatedAt || 0).getTime();
    })
    .filter(({ score }) => score > 0.05)
    .slice(0, MAX_MEMORIES);

  if (rankedMemories.length === 0) {
    return '';
  }

  let context = `
【仅供当前消息框回复参考的共同记忆】
以下内容只属于当前消息框。当前对话中的用户说法优先于这些记录。
只在与当前话题自然相关时参考，不要提及记忆系统、数据库、检索结果或内部字段。
已撤回、已归档、已删除的内容不得使用；来源不完整时不要将其说成绝对确定的事实。
不要逐条复述这些记录，也不要利用它们向用户施压、催促或制造愧疚。
`;

  for (const { memory } of rankedMemories) {
    const line = formatMemoryForPrompt(memory);

    if (`${context}\n${line}`.length > MAX_CONTEXT_LENGTH) {
      break;
    }

    context += `\n${line}`;
  }

  return context;
};

export const markMemoriesUsed = async (memories = []) => {
  const ids = memories
    .map((memory) => memory.id)
    .filter((id) => id !== undefined && id !== null);

  if (ids.length === 0) return;

  const now = new Date().toISOString();

  await db.transaction('rw', db.memories, async () => {
    for (const id of ids) {
      const memory = await db.memories.get(id);

      if (!memory) continue;

      await db.memories.update(id, {
        lastUsedAt: now,
        useCount: Number(memory.useCount || 0) + 1
      });
    }
  });
};

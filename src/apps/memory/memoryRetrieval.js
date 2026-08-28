import db from '../../db';

import {
  RECALLABLE_MEMORY_STATUSES
} from './memoryConstants';

const MAX_MEMORIES = 18;
const MAX_CONTEXT_LENGTH = 12000;

const normalizeText = (value) => (
  String(value || '').trim()
);

/**
 * 为英文、数字和中文文本生成可用于匹配的词元。
 *
 * 中文通常没有空格分词，因此除了按标点切分外，
 * 还会为连续中文文本生成二元词组。
 */
const tokenize = (value) => {
  const text = normalizeText(value).toLowerCase();

  if (!text) {
    return [];
  }

  const terms = new Set();

  // 兼容英文、数字、带空格短语以及被标点分隔的文本。
  text
    .split(/[\s,，。！？；：、“”‘’（）()、/\\|.!?;:]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .forEach((token) => {
      terms.add(token);
    });

  // 对连续中文文本进行二元切分。
  // 例如“连续追问”会产生“连续”“续追”“追问”。
  const chineseChunks = text.match(/[\u4e00-\u9fff]{2,}/g) || [];

  chineseChunks.forEach((chunk) => {
    for (let index = 0; index < chunk.length - 1; index += 1) {
      terms.add(chunk.slice(index, index + 2));
    }
  });

  return [...terms];
};

const getMemoryText = (memory) => (
  [
    memory.title,
    memory.content,
    memory.type
  ]
    .filter(Boolean)
    .join(' ')
);

const getConfidenceScore = (confidence) => ({
  user_written: 1,
  confirmed: 0.95,
  inferred: 0.7,
  suggested: 0.45
}[confidence] || 0.4);

const calculateRelevance = (memory, queryTokens) => {
  const memoryTokens = tokenize(getMemoryText(memory));

  if (
    queryTokens.length === 0 ||
    memoryTokens.length === 0
  ) {
    return 0;
  }

  const matchedCount = queryTokens.filter((token) => (
    memoryTokens.some((memoryToken) => (
      memoryToken.includes(token) ||
      token.includes(memoryToken)
    ))
  )).length;

  const keywordScore = matchedCount / queryTokens.length;
  const importanceScore = Number(memory.importance || 3) / 5;
  const confidenceScore = getConfidenceScore(memory.confidence);

  const updatedAt = new Date(
    memory.updatedAt ||
    memory.createdAt ||
    0
  ).getTime();

  const ageDays = Number.isFinite(updatedAt)
    ? Math.max(
        0,
        (Date.now() - updatedAt) / 86400000
      )
    : 365;

  const recencyScore = Math.max(
    0,
    1 - ageDays / 365
  );

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

  return `- [${getTypeLabel(memory.type)}] ${
    memory.title
      ? `${memory.title}：`
      : ''
  }${memory.content}${sourceNotice}`;
};

const isRecallableMemory = (memory, chatId) => (
  memory &&
  memory.chatId === chatId &&
  RECALLABLE_MEMORY_STATUSES.includes(memory.status)
);

const getRecentMessageText = (recentMessages) => (
  (Array.isArray(recentMessages)
    ? recentMessages
    : []
  )
    .filter((message) => (
      message &&
      message.type !== 'error'
    ))
    .slice(-6)
    .map((message) => (
      message.content ||
      ''
    ))
    .join(' ')
);

export const getRecallableChatMemories = async (chatId) => {
  if (
    chatId === undefined ||
    chatId === null ||
    chatId === ''
  ) {
    return [];
  }

  const memories = await db.memories
    .where('chatId')
    .equals(chatId)
    .toArray();

  return memories.filter((memory) => (
    isRecallableMemory(memory, chatId)
  ));
};

export const getChatMemoryContext = async ({
  chatId,
  userText = '',
  recentMessages = []
}) => {
  if (
    chatId === undefined ||
    chatId === null ||
    chatId === ''
  ) {
    return '';
  }

  const memories = await getRecallableChatMemories(chatId);

  if (memories.length === 0) {
    return '';
  }

  const recentText = getRecentMessageText(recentMessages);

  const queryTokens = tokenize(
    `${userText} ${recentText}`
  );

  const rankedMemories = memories
    .map((memory) => ({
      memory,
      score: calculateRelevance(
        memory,
        queryTokens
      )
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return new Date(
        b.memory.updatedAt ||
        b.memory.createdAt ||
        0
      ).getTime() - new Date(
        a.memory.updatedAt ||
        a.memory.createdAt ||
        0
      ).getTime();
    })
    .filter(({ score }) => score > 0.05)
    .slice(0, MAX_MEMORIES);

  if (rankedMemories.length === 0) {
    return '';
  }

  const selectedMemories = rankedMemories.map(
    ({ memory }) => memory
  );

  // 使用统计是辅助信息，不能阻塞正常聊天。
  void markMemoriesUsed(selectedMemories).catch((error) => {
    console.warn(
      '[Memory] Failed to mark recalled memories as used:',
      error
    );
  });

  let context = `
【仅供当前消息框回复参考的共同记忆】
以下内容只属于当前消息框。当前对话中的用户说法优先于这些记录。
只在与当前话题自然相关时参考，不要提及记忆系统、数据库、检索结果或内部字段。
已撤回、已归档、已删除的内容不得使用；来源不完整时不要将其说成绝对确定的事实。
不要逐条复述这些记录，也不要利用它们向用户施压、催促或制造愧疚。
`;

  for (const memory of selectedMemories) {
    const line = formatMemoryForPrompt(memory);
    const nextContext = `${context}\n${line}`;

    if (nextContext.length > MAX_CONTEXT_LENGTH) {
      break;
    }

    context = nextContext;
  }

  return context;
};

export const markMemoriesUsed = async (memories = []) => {
  const ids = memories
    .map((memory) => memory?.id)
    .filter((id) => (
      id !== undefined &&
      id !== null
    ));

  if (ids.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
  const now = new Date().toISOString();

  await db.transaction(
    'rw',
    db.memories,
    async () => {
      for (const id of uniqueIds) {
        const memory = await db.memories.get(id);

        if (!memory) {
          continue;
        }

        // 记忆可能在检索完成后被撤回或归档。
        // 使用统计不应继续更新这类记忆。
        if (
          !RECALLABLE_MEMORY_STATUSES.includes(
            memory.status
          )
        ) {
          continue;
        }

        await db.memories.update(id, {
          lastUsedAt: now,
          useCount: Number(memory.useCount || 0) + 1
        });
      }
    }
  );
};


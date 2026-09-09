import db from '../../db';

const MESSAGE_EXCLUDED_TYPES = new Set([
  'error',
  'system',
  'typing'
]);

const isValidMessage = (message) => {
  if (!message || MESSAGE_EXCLUDED_TYPES.has(message.type)) {
    return false;
  }

  if (!message.timestamp) {
    return false;
  }

  return typeof message.content === 'string'
    ? message.content.trim().length > 0
    : Boolean(message.content);
};

const getTimestamp = (value) => {
  if (!value) return NaN;

  const timestamp = typeof value === 'number'
    ? value
    : new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : NaN;
};

const formatDuration = (milliseconds) => {
  const totalMinutes = Math.max(
    0,
    Math.floor(milliseconds / (60 * 1000))
  );

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}天`);
  }

  if (hours > 0) {
    parts.push(`${hours}小时`);
  }

  if (days === 0 && minutes > 0) {
    parts.push(`${minutes}分钟`);
  }

  return parts.length > 0 ? parts.join('') : '不到一分钟';
};

const getLongingLevel = (elapsedMs) => {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (elapsedMs < 6 * hour) {
    return 'none';
  }

  if (elapsedMs < 24 * hour) {
    return 'light';
  }

  if (elapsedMs < 3 * day) {
    return 'noticeable';
  }

  return 'strong';
};

const getLongingInstruction = (longingLevel, elapsedText) => {
  switch (longingLevel) {
    case 'none':
      return [
        `用户在${elapsedText}前刚刚出现过。`,
        '不要写成经历了长久等待，也不要刻意强调想念。'
      ].join('');

    case 'light':
      return [
        `用户已经${elapsedText}没有发来消息。`,
        '可以有轻微的想念或想起，但表达要自然克制。'
      ].join('');

    case 'noticeable':
      return [
        `用户已经${elapsedText}没有发来消息。`,
        '可以自然表现出明显的想念、等待或回想，但不要责备用户。'
      ].join('');

    case 'strong':
      return [
        `用户已经${elapsedText}没有发来消息。`,
        '角色可以自然流露出较深的想念、牵挂和等待感，',
        '但不能质问用户，也不能制造愧疚感。'
      ].join('');

    default:
      return '暂时没有足够的聊天记录判断用户的离开时长。';
  }
};

export const getDiaryTimeContext = async (
  chatId,
  now = Date.now()
) => {
  if (!chatId) {
    return {
      hasUserHistory: false,
      lastUserMessageAt: null,
      lastInteractionAt: null,
      elapsedMs: null,
      elapsedText: '尚未与用户建立聊天记录',
      longingLevel: 'unknown',
      instruction: '没有关联聊天记录，不要虚构用户曾经离开或等待的经历。'
    };
  }

  const messages = await db.messages
    .where('chatId')
    .equals(chatId)
    .sortBy('timestamp');

  const validMessages = messages
    .filter(isValidMessage)
    .map((message) => ({
      ...message,
      parsedTimestamp: getTimestamp(message.timestamp)
    }))
    .filter((message) => Number.isFinite(message.parsedTimestamp))
    .sort((a, b) => (
      a.parsedTimestamp - b.parsedTimestamp
    ));

  const userMessages = validMessages.filter(
    (message) => message.sender === 'user'
  );

  const latestUserMessage = userMessages[userMessages.length - 1];
  const latestInteraction = validMessages[validMessages.length - 1];

  if (!latestUserMessage) {
    return {
      hasUserHistory: false,
      lastUserMessageAt: null,
      lastInteractionAt: latestInteraction?.timestamp || null,
      elapsedMs: null,
      elapsedText: '尚未收到用户的聊天消息',
      longingLevel: 'unknown',
      instruction: [
        '目前没有足够的用户主动发言记录。',
        '不要虚构用户曾经离开了多久，也不要把未知写成确定的等待。'
      ].join('')
    };
  }

  const elapsedMs = Math.max(
    0,
    now - latestUserMessage.parsedTimestamp
  );

  const elapsedText = formatDuration(elapsedMs);
  const longingLevel = getLongingLevel(elapsedMs);

  const recentMessages = validMessages.slice(-10);

  return {
    hasUserHistory: true,
    lastUserMessageAt: latestUserMessage.timestamp,
    lastInteractionAt: latestInteraction?.timestamp || null,
    elapsedMs,
    elapsedText,
    longingLevel,
    instruction: getLongingInstruction(
      longingLevel,
      elapsedText
    ),
    recentMessages
  };
};

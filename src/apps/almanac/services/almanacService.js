import db from '../../../db';

export const ALMANAC_EVENT_TYPES = {
  CHAT_OPEN: 'chat_open',
  USER_MESSAGE: 'user_message',
  MORNING_GREETING: 'morning_greeting',
  NIGHT_GREETING: 'night_greeting',
  MILESTONE_REACHED: 'milestone_reached',
};

const safeDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const getSafeTimestamp = (value) => {
  const date = safeDate(value);
  return date ? date.getTime() : null;
};

export const getDateKey = (value = Date.now(), timeZone) => {
  const date = safeDate(value) || new Date();

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const result = {};

    parts.forEach((part) => {
      if (part.type !== 'literal') {
        result[part.type] = part.value;
      }
    });

    if (result.year && result.month && result.day) {
      return `${result.year}-${result.month}-${result.day}`;
    }
  } catch {
    // 使用本地时间降级
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getLocalHour = (value = Date.now(), timeZone) => {
  const date = safeDate(value) || new Date();

  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date).find((part) => part.type === 'hour')?.value;

    const parsedHour = Number.parseInt(hour, 10);

    if (Number.isInteger(parsedHour)) {
      return parsedHour === 24 ? 0 : parsedHour;
    }
  } catch {
    // 使用本地时间降级
  }

  return date.getHours();
};

export const getUserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const getDefaultAlmanacConfig = (chatId) => ({
  chatId,
  rhythmInferenceEnabled: false,

  morningGreetingEnabled: false,
  morningGreetingTime: '08:30',

  nightGreetingEnabled: false,
  nightGreetingTime: '23:30',

  allowMissedGreeting: false,
  skipIfUserChattedToday: true,

  updatedAt: new Date().toISOString(),
});

export const getAlmanacConfig = async (chatId) => {
  if (!chatId) return null;

  try {
    const saved = await db.almanacConfigs.get(chatId);

    return {
      ...getDefaultAlmanacConfig(chatId),
      ...(saved || {}),
    };
  } catch (error) {
    console.warn('[Almanac] 读取配置失败：', error);
    return getDefaultAlmanacConfig(chatId);
  }
};

export const saveAlmanacConfig = async (chatId, patch) => {
  if (!chatId) return null;

  const current = await getAlmanacConfig(chatId);

  const next = {
    ...current,
    ...patch,
    chatId,
    updatedAt: new Date().toISOString(),
  };

  await db.almanacConfigs.put(next);

  return next;
};

export const recordAlmanacEvent = async ({
  chatId,
  characterId,
  eventType,
  timestamp = Date.now(),
  metadata = {},
}) => {
  if (!chatId || !eventType) return null;

  const safeTimestamp = getSafeTimestamp(timestamp);

  if (!safeTimestamp) {
    return null;
  }

  const timeZone = getUserTimeZone();

  const record = {
    chatId,
    characterId: characterId || null,
    eventType,
    timestamp: new Date(safeTimestamp).toISOString(),
    dateKey: getDateKey(safeTimestamp, timeZone),
    localHour: getLocalHour(safeTimestamp, timeZone),
    timezone: timeZone,
    metadata: metadata || {},
  };

  try {
    return await db.almanacRecords.add(record);
  } catch (error) {
    console.warn('[Almanac] 记录事件失败：', error);
    return null;
  }
};

export const getAlmanacRecords = async (chatId) => {
  if (!chatId) return [];

  try {
    return await db.almanacRecords
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');
  } catch (error) {
    console.warn('[Almanac] 读取观察记录失败：', error);
    return [];
  }
};

export const getAlmanacStats = (records = []) => {
  const validRecords = records
    .map((record) => ({
      ...record,
      timestamp: getSafeTimestamp(record.timestamp),
    }))
    .filter((record) => record.timestamp);

  const activeDates = new Set(
    validRecords
      .map((record) => record.dateKey)
      .filter(Boolean)
  );

  const userMessages = validRecords.filter(
    (record) => record.eventType === ALMANAC_EVENT_TYPES.USER_MESSAGE
  );

  const chatOpens = validRecords.filter(
    (record) => record.eventType === ALMANAC_EVENT_TYPES.CHAT_OPEN
  );

  const firstTimestamp = validRecords.length
    ? Math.min(...validRecords.map((record) => record.timestamp))
    : null;

  return {
    totalRecords: validRecords.length,
    activeDays: activeDates.size,
    userMessageCount: userMessages.length,
    chatOpenCount: chatOpens.length,
    firstTimestamp,
    latestTimestamp: validRecords.length
      ? Math.max(...validRecords.map((record) => record.timestamp))
      : null,
  };
};

export const getHeatmapData = (records = []) => {
  const result = new Map();

  records.forEach((record) => {
    if (!record?.dateKey) return;

    const current = result.get(record.dateKey) || {
      dateKey: record.dateKey,
      count: 0,
      hours: new Set(),
      eventTypes: new Set(),
    };

    current.count += 1;

    if (Number.isInteger(record.localHour)) {
      current.hours.add(record.localHour);
    }

    if (record.eventType) {
      current.eventTypes.add(record.eventType);
    }

    result.set(record.dateKey, current);
  });

  return Array.from(result.values()).map((item) => ({
    dateKey: item.dateKey,
    count: item.count,
    hours: Array.from(item.hours).sort((a, b) => a - b),
    eventTypes: Array.from(item.eventTypes),
  }));
};

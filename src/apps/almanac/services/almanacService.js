import db from '../../../db';

const hasAlmanacStores = () => (
  Boolean(
    db.almanacConfigs &&
    db.almanacRecords
  )
);

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
    })
      .formatToParts(date)
      .find((part) => part.type === 'hour')?.value;

    const parsedHour = Number.parseInt(hour, 10);

    if (Number.isInteger(parsedHour)) {
      return parsedHour === 24 ? 0 : parsedHour;
    }
  } catch {
    // 使用本地时间降级
  }

  return date.getHours();
};

export const getDeviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const isValidTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone,
    }).format();

    return true;
  } catch {
    return false;
  }
};

export const getUserTimeZone = (config = null) => {
  const configuredTimeZone = config?.timezone;

  if (isValidTimeZone(configuredTimeZone)) {
    return configuredTimeZone;
  }

  return getDeviceTimeZone();
};

export const isUsingDeviceTimeZone = (config = null) => {
  return !isValidTimeZone(config?.timezone);
};

export const getDefaultAlmanacConfig = (chatId) => ({
  chatId,

  /*
   * 初始化是否已经完成。
   * false 表示第一次进入 Almanac 时需要显示初始化界面。
   */
  initializationCompleted: false,

  /*
   * milestones_only：
   *   从今天开始记录，但保留纪念日，不分析过去相处记录。
   *
   * fresh_start：
   *   从今天开始记录，不保留过去纪念日。
   *
   * all_history：
   *   使用现有全部记录进行分析。
   */
  dataMode: null,

  /*
   * 统计和观察的起点。
   * 只有 timestamp >= observationStartedAt 的记录会参与分析。
   */
  observationStartedAt: null,

  /*
   * 最近一次点击“从今天重新开始”的时间。
   */
  observationResetAt: null,

  timezone: null,
  timezoneSource: 'device',
  deviceTimeZone: null,
  timezoneNoticeDismissed: false,
  timezoneNoticeLastShownAt: null,

  rhythmInferenceEnabled: false,

  /*
   * 纪念日允许自然提醒时，最多提前多少天进入 AI 上下文。
   * 这不是主动消息调度时间。
   */
  milestoneReminderLeadDays: 7,

  morningGreetingEnabled: false,

  morningGreetingTime: '08:30',

  nightGreetingEnabled: false,
  nightGreetingTime: '23:30',

  allowMissedGreeting: false,
  skipIfUserChattedToday: true,

  updatedAt: new Date().toISOString(),
});



export const getAlmanacConfig = async (chatId) => {
  if (!chatId || !hasAlmanacStores()) {
    return getDefaultAlmanacConfig(chatId);
  }

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
  if (!chatId || !hasAlmanacStores()) {
    return {
      ...getDefaultAlmanacConfig(chatId),
      ...patch,
    };
  }

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
  timeZone = null,
  count = 1,
  firstTimestamp = null,
  lastTimestamp = null,
  localHourBuckets = null,
}) => {

  if (
    !chatId ||
    !eventType ||
    !hasAlmanacStores()
  ) {
    return null;
  }

  const safeTimestamp = getSafeTimestamp(timestamp);

  if (!safeTimestamp) {
    return null;
  }

  const resolvedTimeZone = isValidTimeZone(timeZone)
  ? timeZone
  : getDeviceTimeZone();


 const record = {
  chatId,
  characterId: characterId || null,
  eventType,

  // 只保存时间，不保存消息正文
  timestamp: new Date(safeTimestamp).toISOString(),

  dateKey: getDateKey(
    safeTimestamp,
    resolvedTimeZone,
  ),

  localHour: getLocalHour(
    safeTimestamp,
    resolvedTimeZone,
  ),

  timezone: resolvedTimeZone,
  count: Number.isFinite(count) && count > 0 ? count : 1,

  firstTimestamp: firstTimestamp
    ? new Date(firstTimestamp).toISOString()
    : new Date(safeTimestamp).toISOString(),

  lastTimestamp: lastTimestamp
    ? new Date(lastTimestamp).toISOString()
    : new Date(safeTimestamp).toISOString(),

  ...(localHourBuckets
    ? { localHourBuckets }
    : {}),

  metadata: metadata || {},
};


  try {
    return await db.almanacRecords.add(record);
  } catch (error) {
    console.warn('[Almanac] 记录事件失败：', error);

    return null;
  }
};

export const filterAlmanacRecordsByConfig = (
  records = [],
  config = null
) => {
  if (!Array.isArray(records)) {
    return [];
  }

  /*
   * 使用全部数据时，不进行起点过滤。
   */
  if (config?.dataMode === 'all_history') {
    return records;
  }

  const startedAt = getSafeTimestamp(
    config?.observationStartedAt
  );

  if (!startedAt) {
    return records;
  }

  return records.filter((record) => {
    const timestamp = getSafeTimestamp(record.timestamp);

    return timestamp && timestamp >= startedAt;
  });
};

export const getAlmanacRecords = async (chatId) => {
  if (!chatId || !hasAlmanacStores()) {
    return [];
  }

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

export const getFilteredAlmanacRecords = async (chatId) => {
  const [config, records] = await Promise.all([
    getAlmanacConfig(chatId),
    getAlmanacRecords(chatId),
  ]);

  return filterAlmanacRecordsByConfig(records, config);
};

export const restartAlmanacFromToday = async (chatId) => {
  if (!chatId) {
    return getDefaultAlmanacConfig(chatId);
  }

  const now = new Date().toISOString();

  return saveAlmanacConfig(chatId, {
    initializationCompleted: true,
    dataMode: 'fresh_start',
    observationStartedAt: now,
    observationResetAt: now,
  });
};

export const clearAlmanacRecords = async (chatId) => {
  if (!chatId || !hasAlmanacStores()) {
    return 0;
  }

  const records = await db.almanacRecords
    .where('chatId')
    .equals(chatId)
    .toArray();

  if (records.length === 0) {
    return 0;
  }

  await db.almanacRecords.bulkDelete(
    records
      .map((record) => record.id)
      .filter(Boolean)
  );

  return records.length;
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

  const userMessages = validRecords.filter((record) => (
    record.eventType === ALMANAC_EVENT_TYPES.USER_MESSAGE
    || record.eventType === 'user_message_daily'
  ));

  const chatOpens = validRecords.filter((record) => (
    record.eventType === ALMANAC_EVENT_TYPES.CHAT_OPEN
    || record.eventType === 'chat_open_daily'
  ));

  const userMessageCount = userMessages.reduce(
    (total, record) => (
      total + (
        Number.isFinite(Number(record.count))
          ? Number(record.count)
          : 1
      )
    ),
    0
  );

  const chatOpenCount = chatOpens.reduce(
    (total, record) => (
      total + (
        Number.isFinite(Number(record.count))
          ? Number(record.count)
          : 1
      )
    ),
    0
  );

  const firstTimestamp = validRecords.length
    ? Math.min(...validRecords.map((record) => record.timestamp))
    : null;

  return {
    totalRecords: validRecords.length,
    activeDays: activeDates.size,
    userMessageCount,
    chatOpenCount,
    firstTimestamp,
    latestTimestamp: validRecords.length
      ? Math.max(...validRecords.map((record) => record.timestamp))
      : null,
  };
};


export const getHeatmapData = (records = []) => {
  const result = new Map();

  records.forEach((record) => {
    if (!record?.dateKey) {
      return;
    }

    const current = result.get(record.dateKey) || {
      dateKey: record.dateKey,
      count: 0,
      hours: new Set(),
      eventTypes: new Set(),
    };

       current.count += (
      Number.isFinite(Number(record.count))
        ? Number(record.count)
        : 1
    );


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

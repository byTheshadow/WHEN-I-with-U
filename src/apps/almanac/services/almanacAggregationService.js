import db from '../../../db';
import {
  ALMANAC_EVENT_TYPES,
  getAlmanacConfig,
  getDateKey,
  getLocalHour,
  getUserTimeZone,
  isValidTimeZone,
} from './almanacService';

export const ALMANAC_DAILY_EVENT_TYPES = {
  USER_MESSAGE_DAILY: 'user_message_daily',
  CHAT_OPEN_DAILY: 'chat_open_daily',
};

const getDailyRecord = async ({
  chatId,
  eventType,
  dateKey,
}) => {
  const records = await db.almanacRecords
    .where('[chatId+eventType+dateKey]')
    .equals([chatId, eventType, dateKey])
    .toArray();

  return records[0] || null;
};

export const recordDailyAlmanacCount = async ({
  chatId,
  characterId = null,
  eventType,
  timestamp = Date.now(),
  count = 1,
}) => {
  if (!chatId || !eventType) {
    return null;
  }

  const config = await getAlmanacConfig(chatId);
  const timeZone = getUserTimeZone(config);

  const dateKey = getDateKey(timestamp, timeZone);
  const localHour = getLocalHour(timestamp, timeZone);
  const safeCount = Number.isFinite(count) && count > 0
    ? count
    : 1;

  const current = await getDailyRecord({
    chatId,
    eventType,
    dateKey,
  });

  const nowIso = new Date(timestamp).toISOString();

  const hourBuckets = {
    ...(current?.localHourBuckets || {}),
    [localHour]: (
      Number(current?.localHourBuckets?.[localHour] || 0)
      + safeCount
    ),
  };

  const nextRecord = {
    id: current?.id,
    chatId,
    characterId: characterId || current?.characterId || null,
    eventType,
    timestamp: nowIso,
    dateKey,
    timezone: isValidTimeZone(timeZone)
      ? timeZone
      : 'UTC',

    count: Number(current?.count || 0) + safeCount,

    firstTimestamp: current?.firstTimestamp
      || nowIso,

    lastTimestamp: nowIso,

    localHour,
    localHourBuckets: hourBuckets,

    metadata: {
      source: 'almanac',
      aggregated: true,
      contentStored: false,
    },
  };

  if (current?.id) {
    await db.almanacRecords.put(nextRecord);
    return current.id;
  }

  delete nextRecord.id;

  return db.almanacRecords.add(nextRecord);
};

export const recordUserMessageForAlmanac = async ({
  chatId,
  characterId,
  timestamp = Date.now(),
}) => {
  return recordDailyAlmanacCount({
    chatId,
    characterId,
    eventType: ALMANAC_DAILY_EVENT_TYPES.USER_MESSAGE_DAILY,
    timestamp,
  });
};

export const recordChatOpenForAlmanac = async ({
  chatId,
  characterId,
  timestamp = Date.now(),
}) => {
  return recordDailyAlmanacCount({
    chatId,
    characterId,
    eventType: ALMANAC_DAILY_EVENT_TYPES.CHAT_OPEN_DAILY,
    timestamp,
  });
};

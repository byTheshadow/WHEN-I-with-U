import {
  getAlmanacConfig,
  getAlmanacRecords,
  getDeviceTimeZone,
  getUserTimeZone,
  isUsingDeviceTimeZone,
} from './almanacService';

import { getRhythmObservation } from './almanacRhythmService';

const DAILY_USER_MESSAGE_EVENT = 'user_message_daily';
const LEGACY_USER_MESSAGE_EVENT = 'user_message';

const MAX_PROMPT_LENGTH = 2400;
const MINIMUM_OBSERVATION_DAYS = 3;

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const getUserMessageRecords = (records = []) => {
  return records
    .filter((record) => (
      record?.eventType === DAILY_USER_MESSAGE_EVENT
      || record?.eventType === LEGACY_USER_MESSAGE_EVENT
    ))
    .sort((a, b) => (
      new Date(a.timestamp || 0).getTime()
      - new Date(b.timestamp || 0).getTime()
    ));
};

const getRecordCount = (record) => {
  // 新的每日聚合记录使用 count。
  if (record?.eventType === DAILY_USER_MESSAGE_EVENT) {
    return Math.max(0, safeNumber(record.count, 0));
  }

  // 兼容旧版一条消息一条记录的数据。
  if (record?.eventType === LEGACY_USER_MESSAGE_EVENT) {
    return 1;
  }

  return 0;
};

const getHourBuckets = (records) => {
  const buckets = {};

  records.forEach((record) => {
    if (record?.localHourBuckets) {
      Object.entries(record.localHourBuckets).forEach(
        ([hour, count]) => {
          const normalizedHour = Number(hour);

          if (
            Number.isInteger(normalizedHour)
            && normalizedHour >= 0
            && normalizedHour <= 23
          ) {
            buckets[normalizedHour] = (
              safeNumber(buckets[normalizedHour], 0)
              + safeNumber(count, 0)
            );
          }
        },
      );

      return;
    }

    if (Number.isInteger(record?.localHour)) {
      buckets[record.localHour] = (
        safeNumber(buckets[record.localHour], 0)
        + getRecordCount(record)
      );
    }
  });

  return buckets;
};

const getTopHour = (hourBuckets) => {
  const entries = Object.entries(hourBuckets)
    .map(([hour, count]) => ({
      hour: Number(hour),
      count: safeNumber(count),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return entries[0] || null;
};

const isLateNightHour = (hour) => (
  hour >= 22 || hour <= 2
);

const formatHourRange = (hour) => {
  const start = `${String(hour).padStart(2, '0')}:00`;
  const end = `${String((hour + 1) % 24).padStart(2, '0')}:00`;

  return `${start}—${end}`;
};

const buildUnderstanding = (records) => {
  const userRecords = getUserMessageRecords(records);

  const activeDates = new Set(
    userRecords
      .map((record) => record.dateKey)
      .filter(Boolean),
  );

  const totalMessages = userRecords.reduce(
    (total, record) => total + getRecordCount(record),
    0,
  );

  if (
    activeDates.size < MINIMUM_OBSERVATION_DAYS
    || totalMessages <= 0
  ) {
    return null;
  }

  const hourBuckets = getHourBuckets(userRecords);
  const topHour = getTopHour(hourBuckets);

  if (!topHour) {
    return null;
  }

  const lateNight = isLateNightHour(topHour.hour);

  if (lateNight) {
    return {
      message:
        '最近 user 比较常在夜里回来。夜晚可能是 user 更愿意慢下来、按照自己的节奏相处的时间。',
      guidance:
        '可以陪 user 保持自然的夜间聊天节奏，让对话按照 user 当下的意愿展开。user 没有表达疲惫或困扰时，可以让陪伴自然继续；当 user 主动提到累了或想休息时，再温柔回应。',
      confidence: 0.68,
    };
  }

  return {
    message:
      `最近 user 比较常在${formatHourRange(topHour.hour)}之间出现。char 正在慢慢熟悉 user 的相处节奏。`,
    guidance:
      '可以顺着 user 当下的时间和交流状态回应，让陪伴自然、轻松，也给 user 足够的选择空间。',
    confidence: 0.62,
  };
};

const formatUserLocalDateTime = (date, timeZone) => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
};

const limitPromptLength = (text) => {
  if (text.length <= MAX_PROMPT_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_PROMPT_LENGTH)}\n`;
};

export const getAlmanacPromptContext = async (chatId) => {
  if (!chatId) {
    return '';
  }

  try {
    const config = await getAlmanacConfig(chatId);
    const records = await getAlmanacRecords(chatId);

    const timeZone = getUserTimeZone(config);
    const now = new Date();

    const lines = [
      '【Almanac：正在了解 user】',
      `user 所在地时间：${formatUserLocalDateTime(now, timeZone)}`,
    ];

    if (isUsingDeviceTimeZone(config)) {
      lines.push(
        `当前参考时区为设备时区：${getDeviceTimeZone()}`,
        '可以在 Almanac 设置中确认或选择 user 的所在地时间。',
      );
    }

    if (config?.rhythmInferenceEnabled) {
      const observation = await getRhythmObservation({
        chatId,
        records,
      });

      if (observation?.ready && observation.message) {
        lines.push(
          'user 允许观察这个聊天窗口的相处节律。',
          `近期相处观察：${observation.message}`,
          '可以把这份观察作为温和参考，帮助 char 更自然地理解和尊重 user。',
        );
      }
    }

    const understanding = buildUnderstanding(records);

    if (understanding) {
      lines.push(
        '【对 user 的新理解】',
        understanding.message,
        `【可以这样陪伴 user】${understanding.guidance}`,
        `这份理解的参考置信度约为 ${Math.round(
          understanding.confidence * 100,
        )}%，适合自然参考，也可以随着新的相处逐渐调整。`,
      );
    }

    lines.push(
      '可以根据这些相处观察调整语气、回应速度、陪伴节奏和话题展开方式。',
      '可以尊重 user 自己选择的生活节奏，让 user 按舒服的方式相处。',
      '可以在 user 主动表达需要时提供帮助，在 user 没有表达困扰时保留轻松和自由。',
      '可以把 Almanac 当作“如何更好地陪伴 user”的轻量参考。',
      '请自然地使用这些理解，不需要向 user 解释观察来源。',
      '请不要把相处节奏直接说成健康结论、睡眠结论或人格结论。',
    );

    return limitPromptLength(
      `\n\n${lines.join('\n')}\n`,
    );
  } catch (error) {
    console.warn(
      '[Almanac] Prompt context skipped safely:',
      error,
    );

    return '';
  }
};

export default getAlmanacPromptContext;

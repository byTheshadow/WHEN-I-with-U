import {
  ALMANAC_DAILY_EVENT_TYPES,
} from './almanacAggregationService';

const MINIMUM_SAMPLE_DAYS = 3;

const getUserMessageRecords = (records = []) => {
  return records
    .filter((record) => (
      record.eventType
      === ALMANAC_DAILY_EVENT_TYPES.USER_MESSAGE_DAILY
      && Number(record.count) > 0
    ))
    .sort((a, b) => (
      new Date(a.timestamp).getTime()
      - new Date(b.timestamp).getTime()
    ));
};

const getHourTotals = (records) => {
  const totals = {};

  records.forEach((record) => {
    Object.entries(record.localHourBuckets || {}).forEach(
      ([hour, count]) => {
        totals[hour] = (
          Number(totals[hour] || 0)
          + Number(count || 0)
        );
      },
    );
  });

  return totals;
};

const getTopHour = (hourTotals) => {
  const result = Object.entries(hourTotals)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  if (!result) {
    return null;
  }

  return {
    hour: Number(result[0]),
    count: Number(result[1]),
  };
};

export const getAlmanacUnderstanding = (records = []) => {
  const userRecords = getUserMessageRecords(records);

  if (userRecords.length < MINIMUM_SAMPLE_DAYS) {
    return {
      ready: false,
      message: '',
      guidance: '',
      confidence: 0,
    };
  }

  const hourTotals = getHourTotals(userRecords);
  const topHour = getTopHour(hourTotals);

  if (!topHour) {
    return {
      ready: false,
      message: '',
      guidance: '',
      confidence: 0,
    };
  }

  const isLateNight = topHour.hour >= 22 || topHour.hour <= 2;

  if (isLateNight) {
    return {
      ready: true,
      confidence: 0.68,

      message:
        '最近你比较常在夜里回来。夜晚可能是你更愿意慢下来、按照自己的节奏相处的时间。',

      guidance:
        '可以陪用户保持自然的夜间聊天节奏，给用户更多空间和陪伴感；当用户没有表达疲惫或困扰时，可以让对话自然继续。',
    };
  }

  return {
    ready: true,
    confidence: 0.62,

    message:
      `最近你比较常在${topHour.hour}点左右出现。char 正在慢慢熟悉你的相处节奏。`,

    guidance:
      '可以顺着用户较常出现的时间和交流节奏回应，让陪伴自然、轻松，并尊重用户当下的选择。',
  };
};

export const buildAlmanacUnderstandingPrompt = (records = []) => {
  const understanding = getAlmanacUnderstanding(records);

  if (!understanding.ready) {
    return '';
  }

  return [
    '【Almanac：正在了解 user】',
    understanding.message,
    `相处方式参考：${understanding.guidance}`,
    '这些内容是近期相处形成的温和观察，可以帮助 char 更好地理解和尊重 user。',
    '请将它自然地体现在语气、节奏和回应方式中。',
    '可以陪伴、理解和适度适应 user 的节奏。',
    '不要把观察说成确定事实，也不要主动解释统计来源。',
  ].join('\n');
};

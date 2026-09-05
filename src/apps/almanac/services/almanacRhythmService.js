import {
  getSafeTimestamp,
  getAlmanacConfig,
} from './almanacService';

const MINIMUM_DAYS = 7;

export const getRhythmObservation = async ({
  chatId,
  records = [],
}) => {
  const config = await getAlmanacConfig(chatId);

  if (!config?.rhythmInferenceEnabled) {
    return {
      enabled: false,
      ready: false,
      message: '作息观察尚未开启。',
    };
  }

  const userRecords = records.filter(
    (record) => record.eventType === 'user_message'
  );

  const days = new Set(
    userRecords
      .map((record) => record.dateKey)
      .filter(Boolean)
  );

  if (days.size < MINIMUM_DAYS) {
    return {
      enabled: true,
      ready: false,
      sampleDays: days.size,
      requiredDays: MINIMUM_DAYS,
      message: `再相处 ${MINIMUM_DAYS - days.size} 天，才会形成较初步的观察。`,
    };
  }

  const hourCounts = new Map();

  userRecords.forEach((record) => {
    if (!Number.isInteger(record.localHour)) return;

    hourCounts.set(
      record.localHour,
      (hourCounts.get(record.localHour) || 0) + 1
    );
  });

  const rankedHours = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  const dominantHour = rankedHours[0]?.[0];

  let period = '白天';

  if (dominantHour >= 5 && dominantHour < 11) {
    period = '早晨';
  } else if (dominantHour >= 11 && dominantHour < 18) {
    period = '下午';
  } else if (dominantHour >= 18 && dominantHour < 24) {
    period = '夜间';
  } else {
    period = '深夜';
  }

  const confidence = Math.min(
    0.95,
    0.35 + days.size / 30 + (rankedHours[0]?.[1] || 0) / 100
  );

  return {
    enabled: true,
    ready: true,
    sampleDays: days.size,
    dominantHour,
    period,
    confidence: Number(confidence.toFixed(2)),
    observationStart: userRecords
      .map((record) => getSafeTimestamp(record.timestamp))
      .filter(Boolean)
      .sort((a, b) => a - b)[0] || null,
    message: `最近的相遇记录里，你似乎更常在${period}来到这里。`,
  };
};

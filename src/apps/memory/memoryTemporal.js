import {
  MEMORY_TEMPORAL_PRECISIONS,
  MEMORY_TEMPORAL_STATUSES
} from './memoryConstants';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_MAP = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0
};

const normalizeText = (value) => String(value || '').trim();

const toValidDate = (value) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

const getLocalTimezone = () => {
  try {
    return Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const startOfLocalDay = (value) => {
  const date = toValidDate(value);

  if (!date) return null;

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  );
};

const endOfLocalDay = (value) => {
  const start = startOfLocalDay(value);

  if (!start) return null;

  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    23,
    59,
    59,
    999
  );
};

const addLocalDays = (value, days) => {
  const date = toValidDate(value);

  if (!date) return null;

  const next = new Date(date);

  next.setDate(next.getDate() + Number(days || 0));

  return next;
};

const getMondayBasedWeekday = (date) => {
  const day = date.getDay();

  return day === 0 ? 6 : day - 1;
};

const getStartOfWeek = (value) => {
  const dayStart = startOfLocalDay(value);

  if (!dayStart) return null;

  return addLocalDays(
    dayStart,
    -getMondayBasedWeekday(dayStart)
  );
};

const getDayRange = ({
  anchorDate,
  dayOffset = 0,
  hour = null,
  minute = 0,
  rangeEndHour = null
}) => {
  const targetDate = addLocalDays(anchorDate, dayOffset);

  if (!targetDate) return null;

  if (hour === null || hour === undefined) {
    const start = startOfLocalDay(targetDate);
    const end = endOfLocalDay(targetDate);

    return {
      startAt: start?.toISOString() || null,
      endAt: end?.toISOString() || null,
      precision: MEMORY_TEMPORAL_PRECISIONS.DAY
    };
  }

  const start = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    hour,
    minute,
    0,
    0
  );

  const end = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    rangeEndHour ?? hour,
    rangeEndHour === null ? minute : 59,
    rangeEndHour === null ? 0 : 59,
    rangeEndHour === null ? 0 : 999
  );

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    precision: rangeEndHour === null
      ? MEMORY_TEMPORAL_PRECISIONS.EXACT_DATETIME
      : MEMORY_TEMPORAL_PRECISIONS.DATETIME_RANGE
  };
};

const getPeriodRange = ({
  anchorDate,
  dayOffset = 0,
  period
}) => {
  const periodHours = {
    凌晨: [0, 5],
    早上: [6, 8],
    上午: [8, 11],
    中午: [11, 13],
    下午: [13, 17],
    傍晚: [17, 19],
    晚上: [19, 23],
    今晚: [19, 23]
  };

  const range = periodHours[period];

  if (!range) {
    return getDayRange({
      anchorDate,
      dayOffset
    });
  }

  return getDayRange({
    anchorDate,
    dayOffset,
    hour: range[0],
    rangeEndHour: range[1]
  });
};

const buildTemporalResult = ({
  originalExpression,
  anchorAt,
  startAt = null,
  endAt = null,
  precision = MEMORY_TEMPORAL_PRECISIONS.AMBIGUOUS,
  isRelativeExpression = false,
  isAmbiguous = false
}) => ({
  originalExpression: normalizeText(originalExpression),
  anchorAt: anchorAt || null,
  timezone: getLocalTimezone(),
  startAt,
  endAt,
  precision,
  status: MEMORY_TEMPORAL_STATUSES.PLANNED,
  isRelativeExpression,
  isAmbiguous
});

const buildAmbiguousTemporalResult = ({
  originalExpression,
  anchorAt
}) => buildTemporalResult({
  originalExpression,
  anchorAt,
  precision: MEMORY_TEMPORAL_PRECISIONS.AMBIGUOUS,
  isAmbiguous: true
});

const getExplicitDateRange = ({
  year,
  month,
  day,
  anchorDate
}) => {
  const targetYear = Number(year) || anchorDate.getFullYear();
  const targetMonth = Number(month) - 1;
  const targetDay = Number(day);

  if (
    !Number.isInteger(targetMonth) ||
    targetMonth < 0 ||
    targetMonth > 11 ||
    !Number.isInteger(targetDay) ||
    targetDay < 1 ||
    targetDay > 31
  ) {
    return null;
  }

  const target = new Date(
    targetYear,
    targetMonth,
    targetDay,
    0,
    0,
    0,
    0
  );

  if (
    target.getFullYear() !== targetYear ||
    target.getMonth() !== targetMonth ||
    target.getDate() !== targetDay
  ) {
    return null;
  }

  return getDayRange({
    anchorDate: target,
    dayOffset: 0
  });
};

const extractClockTime = (value) => {
  const text = normalizeText(value);

  const match = text.match(
    /(?:凌晨|早上|上午|中午|下午|傍晚|晚上|今晚)?\s*(\d{1,2})\s*(?:点|時)(?:(\d{1,2})\s*分?)?(半)?/
  );

  if (!match) return null;

  let hour = Number(match[1]);
  let minute = match[3] ? 30 : Number(match[2] || 0);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const period = (
    match[0].match(/凌晨|早上|上午|中午|下午|傍晚|晚上|今晚/)?.[0]
  );

  if (
    ['下午', '傍晚', '晚上', '今晚'].includes(period) &&
    hour >= 1 &&
    hour <= 11
  ) {
    hour += 12;
  }

  if (period === '中午' && hour >= 1 && hour <= 10) {
    hour += 12;
  }

  return {
    hour,
    minute
  };
};

const getTimePeriod = (value) => (
  normalizeText(value)
    .match(/凌晨|早上|上午|中午|下午|傍晚|今晚|晚上/)?.[0] || null
);

export const getTemporalAnchorFromMessages = (
  sourceMessageIds = [],
  sourceMessages = []
) => {
  const sourceIdSet = new Set(
    (Array.isArray(sourceMessageIds) ? sourceMessageIds : [])
      .map(Number)
      .filter(Number.isFinite)
  );

  const matched = (Array.isArray(sourceMessages)
    ? sourceMessages
    : [])
    .filter((message) => (
      sourceIdSet.has(Number(message?.id)) &&
      toValidDate(message?.timestamp)
    ))
    .sort((left, right) => (
      new Date(left.timestamp).getTime()
      - new Date(right.timestamp).getTime()
    ));

  return matched[0]?.timestamp || null;
};

export const extractTemporalExpression = (value) => {
  const text = normalizeText(value);

  if (!text) return '';

  const patterns = [
    /(?:本周|这周|本星期|这个星期|下周|下星期|下个星期)[一二三四五六日天]/,
    /(?:今天|明天|后天|大后天|昨天|前天)(?:凌晨|早上|上午|中午|下午|傍晚|今晚|晚上)?(?:\s*\d{1,2}\s*(?:点|時)(?:(?:\d{1,2}\s*分?)|半)?)?/,
    /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/,
    /\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/,
    /(?:再过|过)\s*\d+\s*天/,
    /(?:本周|这周|下周|下星期|下个星期)/,
    /(?:月底|月初|下个月|这个月)/,
    /(?:周|星期)[一二三四五六日天]/
  ];

  for (const pattern of patterns) {
    const matched = text.match(pattern);

    if (matched?.[0]) {
      return normalizeText(matched[0]);
    }
  }

  return '';
};

export const resolveTemporalExpression = ({
  expression,
  anchorAt
}) => {
  const originalExpression = normalizeText(expression);
  const anchorDate = toValidDate(anchorAt);

  if (!originalExpression || !anchorDate) {
    return null;
  }

  const time = extractClockTime(originalExpression);
  const period = getTimePeriod(originalExpression);

  const createResultFromRange = ({
    range,
    isRelativeExpression = false
  }) => {
    if (!range) {
      return buildAmbiguousTemporalResult({
        originalExpression,
        anchorAt
      });
    }

    return buildTemporalResult({
      originalExpression,
      anchorAt,
      startAt: range.startAt,
      endAt: range.endAt,
      precision: range.precision,
      isRelativeExpression
    });
  };

  const explicitFullDate = originalExpression.match(
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/
  );

  if (explicitFullDate) {
    const range = getExplicitDateRange({
      year: explicitFullDate[1],
      month: explicitFullDate[2],
      day: explicitFullDate[3],
      anchorDate
    });

    return createResultFromRange({ range });
  }

  const explicitMonthDay = originalExpression.match(
    /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/
  );

  if (explicitMonthDay) {
    const currentYear = anchorDate.getFullYear();

    let range = getExplicitDateRange({
      year: currentYear,
      month: explicitMonthDay[1],
      day: explicitMonthDay[2],
      anchorDate
    });

    if (
      range?.startAt &&
      new Date(range.startAt).getTime() <
        startOfLocalDay(anchorDate).getTime()
    ) {
      range = getExplicitDateRange({
        year: currentYear + 1,
        month: explicitMonthDay[1],
        day: explicitMonthDay[2],
        anchorDate
      });
    }

    return createResultFromRange({ range });
  }

  const dayOffsetMap = {
    今天: 0,
    明天: 1,
    后天: 2,
    大后天: 3,
    昨天: -1,
    前天: -2
  };

  const relativeDay = Object.keys(dayOffsetMap)
    .find((key) => originalExpression.includes(key));

  if (relativeDay) {
    const dayOffset = dayOffsetMap[relativeDay];

    const range = time
      ? getDayRange({
          anchorDate,
          dayOffset,
          hour: time.hour,
          minute: time.minute
        })
      : period
        ? getPeriodRange({
            anchorDate,
            dayOffset,
            period
          })
        : getDayRange({
            anchorDate,
            dayOffset
          });

    return createResultFromRange({
      range,
      isRelativeExpression: true
    });
  }

  const afterDaysMatch = originalExpression.match(
    /(?:再过|过)\s*(\d+)\s*天/
  );

  if (afterDaysMatch) {
    const range = getDayRange({
      anchorDate,
      dayOffset: Number(afterDaysMatch[1])
    });

    return createResultFromRange({
      range,
      isRelativeExpression: true
    });
  }

  const weekDayMatch = originalExpression.match(
    /(本周|这周|本星期|这个星期|下周|下星期|下个星期)([一二三四五六日天])/
  );

  if (weekDayMatch) {
    const weekPrefix = weekDayMatch[1];
    const weekday = WEEKDAY_MAP[weekDayMatch[2]];
    const weekStart = getStartOfWeek(anchorDate);

    const isNextWeek = [
      '下周',
      '下星期',
      '下个星期'
    ].includes(weekPrefix);

    const targetOffset = (
      (isNextWeek ? 7 : 0) +
      (weekday === 0 ? 6 : weekday - 1)
    );

    const targetDate = addLocalDays(
      weekStart,
      targetOffset
    );

    const range = time
      ? getDayRange({
          anchorDate: targetDate,
          hour: time.hour,
          minute: time.minute
        })
      : period
        ? getPeriodRange({
            anchorDate: targetDate,
            period
          })
        : getDayRange({
            anchorDate: targetDate
          });

    return createResultFromRange({
      range,
      isRelativeExpression: true
    });
  }

  if (/(?:周|星期)[一二三四五六日天]/.test(originalExpression)) {
    return buildTemporalResult({
      originalExpression,
      anchorAt,
      precision: MEMORY_TEMPORAL_PRECISIONS.WEEKDAY_ONLY,
      isAmbiguous: true
    });
  }

  if (/下个月/.test(originalExpression)) {
    const nextMonthStart = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth() + 1,
      1,
      0,
      0,
      0,
      0
    );

    const nextMonthEnd = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth() + 2,
      0,
      23,
      59,
      59,
      999
    );

    return buildTemporalResult({
      originalExpression,
      anchorAt,
      startAt: nextMonthStart.toISOString(),
      endAt: nextMonthEnd.toISOString(),
      precision: MEMORY_TEMPORAL_PRECISIONS.MONTH,
      isRelativeExpression: true
    });
  }

  if (/(?:本周|这周|本星期|这个星期)/.test(originalExpression)) {
    const weekStart = getStartOfWeek(anchorDate);
    const weekEnd = addLocalDays(weekStart, 6);

    return buildTemporalResult({
      originalExpression,
      anchorAt,
      startAt: startOfLocalDay(weekStart)?.toISOString() || null,
      endAt: endOfLocalDay(weekEnd)?.toISOString() || null,
      precision: MEMORY_TEMPORAL_PRECISIONS.WEEK,
      isRelativeExpression: true
    });
  }

  if (/月底|月初|这个月/.test(originalExpression)) {
    return buildTemporalResult({
      originalExpression,
      anchorAt,
      precision: MEMORY_TEMPORAL_PRECISIONS.AMBIGUOUS,
      isRelativeExpression: true,
      isAmbiguous: true
    });
  }

  return buildAmbiguousTemporalResult({
    originalExpression,
    anchorAt
  });
};

export const buildTemporalDataFromSource = ({
  temporalExpression,
  sourceMessageIds,
  sourceMessages
}) => {
  const expression = normalizeText(temporalExpression);

  if (!expression) {
    return null;
  }

  const anchorAt = getTemporalAnchorFromMessages(
    sourceMessageIds,
    sourceMessages
  );

  if (!anchorAt) {
    return buildAmbiguousTemporalResult({
      originalExpression: expression,
      anchorAt: null
    });
  }

  return resolveTemporalExpression({
    expression,
    anchorAt
  });
};

export const isTemporalMemoryExpired = (
  temporal,
  now = new Date()
) => {
  if (!temporal?.endAt) {
    return false;
  }

  if (
    temporal.status !== MEMORY_TEMPORAL_STATUSES.PLANNED &&
    temporal.status !== MEMORY_TEMPORAL_STATUSES.ONGOING
  ) {
    return false;
  }

  const endTime = new Date(temporal.endAt).getTime();

  if (!Number.isFinite(endTime)) {
    return false;
  }

  return endTime < now.getTime() - DAY_MS;
};

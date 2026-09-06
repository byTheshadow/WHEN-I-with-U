import db from '../../../db';

const hasMilestoneStore = () => (
  Boolean(db.almanacMilestones)
);

const sortByDate = (items = []) => (
  [...items].sort((a, b) => (
    String(a.date || '').localeCompare(
      String(b.date || '')
    )
  ))
);

export const getAlmanacMilestones = async (chatId) => {
  if (!chatId || !hasMilestoneStore()) {
    return [];
  }

  try {
    return sortByDate(
      await db.almanacMilestones
        .where('chatId')
        .equals(chatId)
        .toArray()
    );
  } catch (error) {
    console.warn('[Almanac] 读取纪念日失败：', error);
    return [];
  }
};

export const createAlmanacMilestone = async ({
  chatId,
  type = 'countdown',
  title,
  date,
  isRecurring = false,
  showCountdown = true,
  allowNaturalReminder = false,
}) => {
  if (
    !chatId
    || !hasMilestoneStore()
    || !title?.trim()
    || !date
  ) {
    return null;
  }

  const now = new Date().toISOString();

  const milestone = {
    chatId,
    type,
    title: title.trim(),
    date,
    isRecurring: Boolean(isRecurring),
    showCountdown: Boolean(showCountdown),
    allowNaturalReminder: Boolean(allowNaturalReminder),
    createdAt: now,
    updatedAt: now,
  };

  return db.almanacMilestones.add(milestone);
};

export const updateAlmanacMilestone = async (
  id,
  patch = {}
) => {
  if (!id || !hasMilestoneStore()) {
    return null;
  }

  const current = await db.almanacMilestones.get(id);

  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    title: String(patch.title ?? current.title).trim(),
    updatedAt: new Date().toISOString(),
  };

  await db.almanacMilestones.put(next);

  return next;
};

export const deleteAlmanacMilestone = async (id) => {
  if (!id || !hasMilestoneStore()) {
    return false;
  }

  await db.almanacMilestones.delete(id);

  return true;
};

const getDateOnly = (value) => {
  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getNextOccurrence = (milestone, now = new Date()) => {
  const originalDate = getDateOnly(milestone.date);

  if (!originalDate) {
    return null;
  }

  if (!milestone.isRecurring) {
    return originalDate;
  }

  const currentYear = now.getFullYear();

  const thisYear = new Date(
    currentYear,
    originalDate.getMonth(),
    originalDate.getDate()
  );

  if (thisYear >= now) {
    return thisYear;
  }

  return new Date(
    currentYear + 1,
    originalDate.getMonth(),
    originalDate.getDate()
  );
};

export const getMilestoneViewData = (
  milestones = [],
  now = new Date()
) => {
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return milestones.map((milestone) => {
    const target = getNextOccurrence(milestone, now);

    if (!target) {
      return {
        ...milestone,
        daysRemaining: null,
        isPast: false,
      };
    }

    const daysRemaining = Math.ceil(
      (target.getTime() - today.getTime()) /
        (24 * 60 * 60 * 1000)
    );

    return {
      ...milestone,
      targetDate: target.toISOString(),
      daysRemaining,
      isPast: daysRemaining < 0,
    };
  });
};

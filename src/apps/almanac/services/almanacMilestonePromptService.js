import {
  getAlmanacMilestones,
  getMilestoneViewData,
} from './almanacMilestoneService';

const DEFAULT_LEAD_DAYS = 7;
const MAX_REMINDER_ITEMS = 1;

const getSafeLeadDays = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_LEAD_DAYS;
  }

  return Math.min(Math.floor(parsed), 30);
};

const getReminderCandidates = (
  milestones = [],
  now = new Date(),
  leadDays = DEFAULT_LEAD_DAYS
) => {
  const viewData = getMilestoneViewData(
    milestones,
    now
  );

  return viewData
    .filter((milestone) => (
      milestone.allowNaturalReminder === true
      && Number.isInteger(milestone.daysRemaining)
      && milestone.daysRemaining >= 0
      && milestone.daysRemaining <= leadDays
    ))
    .sort((a, b) => (
      a.daysRemaining - b.daysRemaining
    ))
    .slice(0, MAX_REMINDER_ITEMS);
};

export const getAlmanacNaturalReminderData = async ({
  chatId,
  now = new Date(),
  leadDays = DEFAULT_LEAD_DAYS,
} = {}) => {
  if (!chatId) {
    return [];
  }

  const milestones = await getAlmanacMilestones(chatId);

  return getReminderCandidates(
    milestones,
    now,
    getSafeLeadDays(leadDays)
  );
};

export default getAlmanacNaturalReminderData;

import db from '../../../db';

const nowIso = () => new Date().toISOString();

export const createCompanionshipEvent = async ({
  sessionId,
  chatId,
  type,
  title = '',
  content = '',
  metadata = null,
}) => {
  if (!sessionId || !chatId || !type) {
    return null;
  }

  const timestamp = nowIso();

  const event = {
    sessionId,
    chatId,
    type,
    title: String(title || ''),
    content: String(content || ''),
    metadata,
    createdAt: timestamp,
    timestamp,
  };

  const id = await db.companionshipEvents.add(event);

  return {
    ...event,
    id,
  };
};

export const listCompanionshipEvents = async ({
  sessionId,
  limit = 100,
} = {}) => {
  if (!sessionId) return [];

  const events = await db.companionshipEvents
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  return events
    .sort(
      (a, b) => (
        new Date(a.createdAt).getTime()
        - new Date(b.createdAt).getTime()
      ),
    )
    .slice(-Math.max(1, limit));
};

export const deleteCompanionshipEvents = async (sessionId) => {
  if (!sessionId) return 0;

  const events = await db.companionshipEvents
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  if (events.length === 0) return 0;

  await db.companionshipEvents.bulkDelete(
    events.map((event) => event.id),
  );

  return events.length;
};

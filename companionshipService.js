import db from '../../../db';

const MAX_DURATION_MINUTES = 120;
const MIN_DURATION_MINUTES = 5;
const MIN_INTERVAL_MINUTES = 1;

const nowIso = () => new Date().toISOString();

const normalizeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
};

export const normalizeCompanionshipSettings = ({
  chatId,
  goal = '',
  durationMinutes = 30,
  intervalMinutes = 5,
  notificationEnabled = true,
}) => {
  const normalizedDuration = Math.min(
    MAX_DURATION_MINUTES,
    Math.max(
      MIN_DURATION_MINUTES,
      Number(durationMinutes) || 30,
    ),
  );

  const normalizedInterval = Math.min(
    normalizedDuration,
    Math.max(
      MIN_INTERVAL_MINUTES,
      Number(intervalMinutes) || 5,
    ),
  );

  return {
    chatId: normalizeId(chatId),
    goal: String(goal || '').trim().slice(0, 1200),
    durationMinutes: normalizedDuration,
    intervalMinutes: normalizedInterval,
    notificationEnabled: Boolean(notificationEnabled),
  };
};

export const getRunningCompanionship = async (chatId) => {
 const sessions = await db.companionshipSessions
  .toArray();

const running = sessions
  .filter((session) => (
    session.status === 'running'
    && String(session.chatId) === String(chatId)
  ))
  .sort(
    (a, b) =>
      new Date(b.createdAt).getTime()
      - new Date(a.createdAt).getTime(),
  )[0];


  const running = sessions
    .filter((session) => session.status === 'running')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime()
        - new Date(a.createdAt).getTime(),
    )[0];

  if (!running) return null;

  if (Date.now() >= new Date(running.endsAt).getTime()) {
    await stopCompanionship(running.id, 'completed');
    return null;
  }

  return running;
};

export const createCompanionshipSession = async ({
  chatId,
  characterId,
  goal,
  durationMinutes,
  intervalMinutes,
  notificationEnabled,
}) => {
  const settings = normalizeCompanionshipSettings({
    chatId,
    goal,
    durationMinutes,
    intervalMinutes,
    notificationEnabled,
  });

  if (!settings.chatId) {
    throw new Error('缺少需要绑定的聊天框。');
  }

  const existing = await getRunningCompanionship(settings.chatId);

  if (existing) {
    throw new Error('这个聊天框已经有一段正在进行的陪伴。');
  }

  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + settings.durationMinutes * 60 * 1000,
  );
  const nextTriggerAt = new Date(
    startedAt.getTime() + settings.intervalMinutes * 60 * 1000,
  );

  const createdAt = nowIso();

  const session = {
    chatId,
characterId,


    goal: settings.goal,
    durationMinutes: settings.durationMinutes,
    intervalMinutes: settings.intervalMinutes,
    notificationEnabled: settings.notificationEnabled,

    responseMode: 'mcp-and-voice',
    mcpAuthorizationGranted: true,
    mcpAuthorizationGrantedAt: createdAt,

    status: 'running',
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    nextTriggerAt: nextTriggerAt.toISOString(),
    lastTriggeredAt: null,
    lastDecision: null,
    lastError: null,

    createdAt,
    updatedAt: createdAt,
  };

  const id = await db.companionshipSessions.add(session);

  return {
    ...session,
    id,
  };
};

export const updateCompanionshipSession = async (id, changes = {}) => {
  if (!id) return null;

  await db.companionshipSessions.update(id, {
    ...changes,
    updatedAt: nowIso(),
  });

  return db.companionshipSessions.get(id);
};

export const stopCompanionship = async (
  id,
  status = 'stopped',
) => {
  if (!id) return false;

  await db.companionshipSessions.update(id, {
    status,
    mcpAuthorizationGranted: false,
    authorizationRevokedAt: nowIso(),
    updatedAt: nowIso(),
  });

  return true;
};

export const markCompanionshipTrigger = async ({
  sessionId,
  decision,
  nextTriggerAt,
  error = null,
}) => {
  if (!sessionId) return;

  await db.companionshipSessions.update(sessionId, {
    lastTriggeredAt: nowIso(),
    nextTriggerAt,
    lastDecision: decision,
    lastError: error,
    updatedAt: nowIso(),
  });
};

export const isCompanionshipAuthorizationValid = async ({
  sessionId,
  chatId,
  characterId,
}) => {
  const session = await db.companionshipSessions.get(sessionId);

  if (!session) return false;

  return (
    session.status === 'running'
    && session.mcpAuthorizationGranted === true
    && normalizeId(session.chatId) === normalizeId(chatId)
    && normalizeId(session.characterId) === normalizeId(characterId)
    && Date.now() < new Date(session.endsAt).getTime()
  );
};

export {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  MIN_INTERVAL_MINUTES,
};
export const getCompanionshipSession = async (sessionId) => {
  if (!sessionId) return null;

  return db.companionshipSessions.get(sessionId);
};

export const getRecoverableCompanionship = async () => {
  const sessions = await db.companionshipSessions
    .where('status')
    .equals('running')
    .toArray();

  const now = Date.now();

  return sessions.filter((session) => (
    session.endsAt
    && new Date(session.endsAt).getTime() > now
  ));
};

export const completeExpiredCompanionships = async () => {
  const runningSessions = await db.companionshipSessions
    .where('status')
    .equals('running')
    .toArray();

  const now = Date.now();
  const expired = runningSessions.filter((session) => (
    session.endsAt
    && new Date(session.endsAt).getTime() <= now
  ));

  await Promise.all(
    expired.map((session) => (
      stopCompanionship(session.id, 'completed')
    )),
  );

  return expired;
};

export const getMissedTriggerState = (session) => {
  if (!session?.nextTriggerAt) {
    return {
      missed: false,
      nextTriggerAt: null,
    };
  }

  const nextTime = new Date(session.nextTriggerAt).getTime();

  if (!Number.isFinite(nextTime) || Date.now() < nextTime) {
    return {
      missed: false,
      nextTriggerAt: session.nextTriggerAt,
    };
  }

  return {
    missed: true,
    nextTriggerAt: session.nextTriggerAt,
  };
};

export const calculateNextTriggerAt = ({
  session,
  from = Date.now(),
}) => {
  if (!session) return null;

  const intervalMs = Math.max(
    60 * 1000,
    Number(session.intervalMinutes || 5) * 60 * 1000,
  );

  const nextTime = from + intervalMs;
  const endsTime = new Date(session.endsAt).getTime();

  if (!Number.isFinite(endsTime) || nextTime >= endsTime) {
    return null;
  }

  return new Date(nextTime).toISOString();
};

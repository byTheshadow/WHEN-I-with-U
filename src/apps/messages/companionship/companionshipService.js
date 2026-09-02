import db from '../../../db';

import {
  COMPANIONSHIP_STATUS,
  COMPANIONSHIP_TURN_STATUS,
  COMPANIONSHIP_MAX_DURATION_MINUTES,
  COMPANIONSHIP_DEFAULT_DURATION_MINUTES,
  COMPANIONSHIP_DEFAULT_INTERVAL_MINUTES,
  normalizeCompanionshipDuration,
  normalizeCompanionshipInterval,
  normalizeCompanionshipText,
  createCompanionshipTimestamp,
} from './companionshipConstants';

const normalizeId = (value) => {
  if (
    value === undefined
    || value === null
    || value === ''
  ) {
    return null;
  }

  return String(value);
};

const getNow = () => Date.now();

export const getRunningCompanionshipSession = async ({
  chatId,
} = {}) => {
  const normalizedChatId = normalizeId(chatId);

  if (!normalizedChatId) {
    return null;
  }

  const sessions = await db.companionshipSessions
    .where('chatId')
    .equals(normalizedChatId)
    .toArray();

  const now = getNow();

  return sessions
    .filter((session) => (
      session.status === COMPANIONSHIP_STATUS.RUNNING
      && new Date(session.endsAt).getTime() > now
    ))
    .sort((a, b) => (
      new Date(b.startedAt).getTime()
      - new Date(a.startedAt).getTime()
    ))[0] || null;
};

export const getCompanionshipSession = async (sessionId) => {
  if (sessionId === undefined || sessionId === null) {
    return null;
  }

  return db.companionshipSessions.get(sessionId);
};

export const createCompanionshipSession = async ({
  chatId,
  characterId,
  goal,
  durationMinutes = COMPANIONSHIP_DEFAULT_DURATION_MINUTES,
  intervalMinutes = COMPANIONSHIP_DEFAULT_INTERVAL_MINUTES,
  notificationEnabled = true,
  responseMode = 'auto',
  previousKeepAlive = false,
}) => {
  const normalizedChatId = normalizeId(chatId);
  const normalizedCharacterId = normalizeId(characterId);

  if (!normalizedChatId || !normalizedCharacterId) {
    throw new Error('创建陪伴会话时缺少聊天或角色信息。');
  }

  const existing = await getRunningCompanionshipSession({
    chatId: normalizedChatId,
  });

  if (existing) {
    throw new Error('当前聊天已经有一段正在进行的陪伴。');
  }

  const safeDuration = Math.min(
    COMPANIONSHIP_MAX_DURATION_MINUTES,
    normalizeCompanionshipDuration(durationMinutes),
  );

  const safeInterval = normalizeCompanionshipInterval(
    intervalMinutes,
    safeDuration,
  );

  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + safeDuration * 60 * 1000,
  );
  const nextTriggerAt = new Date(
    startedAt.getTime() + safeInterval * 60 * 1000,
  );

  const timestamp = createCompanionshipTimestamp();

  const session = {
    chatId: normalizedChatId,
    characterId: normalizedCharacterId,

    goal: normalizeCompanionshipText(goal),
    durationMinutes: safeDuration,
    intervalMinutes: safeInterval,

    notificationEnabled: Boolean(notificationEnabled),
    responseMode,

    status: COMPANIONSHIP_STATUS.RUNNING,

    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    nextTriggerAt: nextTriggerAt.toISOString(),
    lastTriggeredAt: null,

    previousKeepAlive: Boolean(previousKeepAlive),
    keepAliveEnabledBySession: true,

    mcpAuthorizationGranted: true,
    mcpAuthorizationGrantedAt: timestamp,

    lastDecision: null,
    lastError: null,

    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const id = await db.companionshipSessions.add(session);

  return {
    ...session,
    id,
  };
};

export const updateCompanionshipSession = async (
  sessionId,
  changes,
) => {
  if (sessionId === undefined || sessionId === null) {
    throw new Error('更新陪伴会话时缺少会话标识。');
  }

  await db.companionshipSessions.update(sessionId, {
    ...changes,
    updatedAt: createCompanionshipTimestamp(),
  });

  return db.companionshipSessions.get(sessionId);
};

export const stopCompanionshipSession = async (
  sessionId,
  status = COMPANIONSHIP_STATUS.STOPPED,
) => {
  const session = await getCompanionshipSession(sessionId);

  if (!session) {
    return null;
  }

  const now = createCompanionshipTimestamp();

  return updateCompanionshipSession(sessionId, {
    status,
    mcpAuthorizationGranted: false,
    mcpAuthorizationRevokedAt: now,
    nextTriggerAt: null,
    updatedAt: now,
  });
};

export const expireCompanionshipSessionIfNeeded = async (
  session,
) => {
  if (!session) {
    return null;
  }

  if (
    session.status !== COMPANIONSHIP_STATUS.RUNNING
    || new Date(session.endsAt).getTime() > getNow()
  ) {
    return session;
  }

  return stopCompanionshipSession(
    session.id,
    COMPANIONSHIP_STATUS.EXPIRED,
  );
};

export const completeCompanionshipSession = async (sessionId) => (
  stopCompanionshipSession(
    sessionId,
    COMPANIONSHIP_STATUS.COMPLETED,
  )
);

export const createCompanionshipTurn = async ({
  sessionId,
  chatId,
  scheduledFor,
}) => {
  const normalizedSessionId = normalizeId(sessionId);
  const normalizedChatId = normalizeId(chatId);
  const normalizedScheduledFor = new Date(scheduledFor).toISOString();

  const existing = await db.companionshipTurns
    .where('[sessionId+scheduledFor]')
    .equals([
      normalizedSessionId,
      normalizedScheduledFor,
    ])
    .first();

  if (existing) {
    return existing;
  }

  const id = await db.companionshipTurns.add({
    sessionId: normalizedSessionId,
    chatId: normalizedChatId,
    scheduledFor: normalizedScheduledFor,
    status: COMPANIONSHIP_TURN_STATUS.PENDING,
    createdAt: createCompanionshipTimestamp(),
  });

  return db.companionshipTurns.get(id);
};

export const updateCompanionshipTurn = async (
  turnId,
  changes,
) => {
  await db.companionshipTurns.update(turnId, {
    ...changes,
    updatedAt: createCompanionshipTimestamp(),
  });

  return db.companionshipTurns.get(turnId);
};

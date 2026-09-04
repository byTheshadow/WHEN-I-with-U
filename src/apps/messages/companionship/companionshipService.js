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

const getChatById = async (chatId) => {
  if (
    chatId === undefined
    || chatId === null
    || chatId === ''
  ) {
    return null;
  }

  // 先按原始类型查询，兼容 Dexie 数字主键。
  const directChat = await db.chats.get(chatId);

  if (directChat) {
    return directChat;
  }

  // select、路由参数等场景通常会把 id 变成字符串。
  const chats = await db.chats.toArray();

  return chats.find(
    (chat) => String(chat.id) === String(chatId),
  ) || null;
};

const getSessionById = async (sessionId) => {
  const directSession = await db.companionshipSessions.get(sessionId);

  if (directSession) {
    return directSession;
  }

  const sessions = await db.companionshipSessions.toArray();

  return sessions.find(
    (session) => String(session.id) === String(sessionId),
  ) || null;
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
  if (
    chatId === undefined
    || chatId === null
    || chatId === ''
  ) {
    return null;
  }

  const sessions = await db.companionshipSessions.toArray();

  const running = sessions
    .filter((session) => (
      session.status === 'running'
      && String(session.chatId) === String(chatId)
    ))
    .sort(
      (a, b) => (
        new Date(b.createdAt).getTime()
        - new Date(a.createdAt).getTime()
      ),
    )[0];

  if (!running) {
    return null;
  }

  if (
    !running.endsAt
    || Date.now() >= new Date(running.endsAt).getTime()
  ) {
    await stopCompanionship(running.id, 'completed');
    return null;
  }

  return running;
};

export const getLatestCompanionship = async (chatId) => {
  if (
    chatId === undefined
    || chatId === null
    || chatId === ''
  ) {
    return null;
  }

  const sessions = await db.companionshipSessions.toArray();

  return sessions
    .filter((session) => (
      String(session.chatId) === String(chatId)
    ))
    .sort(
      (a, b) => (
        new Date(b.createdAt).getTime()
        - new Date(a.createdAt).getTime()
      ),
    )[0] || null;
};


export const createCompanionshipSession = async ({
  chatId,
  characterId,
  goal,
  durationMinutes,
  intervalMinutes,
  notificationEnabled,
}) => {
  const chat = await getChatById(chatId);

  if (!chat) {
    throw new Error('找不到需要绑定的聊天框。');
  }

  const actualChatId = chat.id;
  const actualCharacterId = chat.characterId;

  const settings = normalizeCompanionshipSettings({
    chatId: actualChatId,
    goal,
    durationMinutes,
    intervalMinutes,
    notificationEnabled,
  });

  /*
   * 先在事务外清理过期但仍然标记为 running 的旧会话。
   * 不能在下面的事务中调用 getRunningCompanionship，
   * 因为它发现过期会话后会调用 stopCompanionship，产生额外写操作。
   */
  await completeExpiredCompanionships();

  const startedAt = new Date();

  const endsAt = new Date(
    startedAt.getTime() + settings.durationMinutes * 60 * 1000,
  );

  const nextTriggerAt = new Date(
    startedAt.getTime() + settings.intervalMinutes * 60 * 1000,
  );

  const createdAt = nowIso();

  /*
   * 将“检查运行中的会话”和“创建新会话、更新聊天状态”
   * 放进同一个 Dexie 写事务，避免并发创建时同时通过检查。
   */
  const session = await db.transaction(
    'rw',
    db.companionshipSessions,
    db.chats,
    async () => {
      const sessionsForChat = await db.companionshipSessions
        .where('chatId')
        .equals(actualChatId)
        .toArray();

      const existing = sessionsForChat.find(
        (sessionItem) => sessionItem.status === 'running',
      );

      if (existing) {
        throw new Error('这个聊天框已经有一段正在进行的陪伴。');
      }

      const previousKeepAlive = chat.keepAlive === true;

      const newSession = {
        chatId: actualChatId,
        characterId: actualCharacterId,

        goal: settings.goal,
        durationMinutes: settings.durationMinutes,
        intervalMinutes: settings.intervalMinutes,
        notificationEnabled: settings.notificationEnabled,

        responseMode: 'auto',
        mcpAuthorizationGranted: true,
        mcpAuthorizationGrantedAt: createdAt,

        previousKeepAlive,
        keepAliveEnabledByCompanionship: true,

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

      const id = await db.companionshipSessions.add(newSession);

      await db.chats.update(actualChatId, {
        keepAlive: true,
        updatedAt: createdAt,
      });

      return {
        ...newSession,
        id,
      };
    },
  );

  return session;
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

  const session = await db.companionshipSessions.get(id);

  if (!session) return false;

  const stoppedAt = nowIso();

  await db.companionshipSessions.update(id, {
  status,
  endedAt: session.endedAt || stoppedAt,
  mcpAuthorizationGranted: false,
  authorizationRevokedAt: stoppedAt,
  updatedAt: stoppedAt,
});


  if (
    session.keepAliveEnabledByCompanionship === true
    && session.chatId !== undefined
    && session.chatId !== null
  ) {
    /*
     * 只有当前 keepAlive 仍然是陪伴开启时设置的 true，
     * 才说明用户在陪伴期间没有修改过该设置，此时才恢复原值。
     *
     * 如果用户已经手动关闭 keepAlive，当前值会是 false，
     * 此时跳过恢复，避免覆盖用户的手动操作。
     */
    const currentChat = await db.chats.get(session.chatId);

    const stillCompanionshipManaged = currentChat?.keepAlive === true;

    if (stillCompanionshipManaged) {
      await db.chats.update(session.chatId, {
        keepAlive: session.previousKeepAlive === true,
        updatedAt: nowIso(),
      });
    }
  }

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
  const session = await getSessionById(sessionId);

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

  return getSessionById(sessionId);
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

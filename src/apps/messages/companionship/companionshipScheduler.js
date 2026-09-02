import {
  getRunningCompanionshipSession,
  createCompanionshipTurn,
  updateCompanionshipSession,
  expireCompanionshipSessionIfNeeded,
} from './companionshipService';

import {
  COMPANIONSHIP_STATUS,
  COMPANIONSHIP_TURN_STATUS,
} from './companionshipConstants';

const CHECK_INTERVAL_MS = 15 * 1000;

let schedulerTimer = null;
let activeSchedulerSessionId = null;
let activeTurnHandler = null;
let isProcessingTurn = false;

const emitCompanionshipEvent = (detail) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('companionship-event', {
      detail,
    }),
  );
};

const getNow = () => Date.now();

const getTime = (value) => {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : null;
};

const stopTimer = () => {
  if (schedulerTimer) {
    window.clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
};

const finishExpiredSession = async (session) => {
  const expired = await expireCompanionshipSessionIfNeeded(session);

  if (
    expired
    && expired.status !== COMPANIONSHIP_STATUS.RUNNING
  ) {
    emitCompanionshipEvent({
      type: 'COMPANIONSHIP_COMPLETED',
      session: expired,
    });

    stopTimer();
    activeSchedulerSessionId = null;

    return true;
  }

  return false;
};

const processDueTurn = async (session) => {
  if (isProcessingTurn) return;

  const nextTriggerTime = getTime(session.nextTriggerAt);

  if (
    nextTriggerTime === null
    || nextTriggerTime > getNow()
  ) {
    return;
  }

  isProcessingTurn = true;

  try {
    const turn = await createCompanionshipTurn({
      sessionId: session.id,
      chatId: session.chatId,
      scheduledFor: session.nextTriggerAt,
    });

    if (turn.status !== COMPANIONSHIP_TURN_STATUS.PENDING) {
      return;
    }

    await updateCompanionshipSession(session.id, {
      lastTriggeredAt: session.nextTriggerAt,
      nextTriggerAt: new Date(
        getNow() + session.intervalMinutes * 60 * 1000,
      ).toISOString(),
    });

    await updateCompanionshipTurn(turn.id, {
      status: COMPANIONSHIP_TURN_STATUS.RUNNING,
      startedAt: new Date().toISOString(),
    });

    emitCompanionshipEvent({
      type: 'COMPANIONSHIP_TURN_DUE',
      session,
      turn,
    });

    if (typeof activeTurnHandler === 'function') {
      await activeTurnHandler({
        session,
        turn,
      });
    }
  } catch (error) {
    console.error(
      '[Companionship] 处理陪伴触发失败：',
      error,
    );

    emitCompanionshipEvent({
      type: 'COMPANIONSHIP_TURN_ERROR',
      session,
      error,
    });
  } finally {
    isProcessingTurn = false;
  }
};

const checkSession = async () => {
  if (!activeSchedulerSessionId) return;

  const session = await getRunningCompanionshipSession({
    chatId: activeSchedulerSessionId.chatId,
  });

  if (!session) {
    stopTimer();
    activeSchedulerSessionId = null;
    return;
  }

  if (await finishExpiredSession(session)) {
    return;
  }

  await processDueTurn(session);
};

export const startCompanionshipScheduler = ({
  chatId,
  onTurn,
} = {}) => {
  stopTimer();

  activeSchedulerSessionId = {
    chatId: String(chatId),
  };

  activeTurnHandler = onTurn;

  void checkSession();

  if (typeof window !== 'undefined') {
    schedulerTimer = window.setInterval(
      () => {
        void checkSession();
      },
      CHECK_INTERVAL_MS,
    );
  }

  return () => {
    stopCompanionshipScheduler();
  };
};

export const stopCompanionshipScheduler = () => {
  stopTimer();
  activeSchedulerSessionId = null;
  activeTurnHandler = null;
  isProcessingTurn = false;
};

export const restartCompanionshipSchedulerForChat = ({
  chatId,
  onTurn,
} = {}) => (
  startCompanionshipScheduler({
    chatId,
    onTurn,
  })
);

export const recoverCompanionshipScheduler = ({
  chatId,
  onTurn,
} = {}) => (
  startCompanionshipScheduler({
    chatId,
    onTurn,
  })
);

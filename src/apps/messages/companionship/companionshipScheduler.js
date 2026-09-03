import {
  calculateNextTriggerAt,
  completeExpiredCompanionships,
  getCompanionshipSession,
  getMissedTriggerState,
  markCompanionshipTrigger,
  stopCompanionship,
} from './companionshipService';

const MIN_DELAY_MS = 1000;
const RECOVERY_GRACE_MS = 60 * 1000;

const schedulerInstances = new Map();

const getNow = () => Date.now();

const getTimestamp = (value) => {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
};

const getDelayUntil = (timestamp) => {
  const targetTime = getTimestamp(timestamp);

  if (targetTime === null) {
    return MIN_DELAY_MS;
  }

  return Math.max(
    MIN_DELAY_MS,
    targetTime - getNow(),
  );
};

const isSessionExpired = (session) => {
  const endsAt = getTimestamp(session?.endsAt);

  return endsAt !== null && getNow() >= endsAt;
};

class CompanionshipScheduler {
  constructor({
    sessionId,
    onTrigger,
    onSessionChange,
    onError,
  }) {
    this.sessionId = sessionId;
    this.onTrigger = onTrigger;
    this.onSessionChange = onSessionChange;
    this.onError = onError;

    this.timerId = null;
    this.destroyed = false;
    this.isTriggering = false;
  }

  async start() {
    if (this.destroyed) return;

    try {
      await completeExpiredCompanionships();

      const session = await getCompanionshipSession(
        this.sessionId,
      );

      if (!session) {
        this.emitSessionChange(null);
        return;
      }

      if (session.status !== 'running') {
        this.emitSessionChange(session);
        return;
      }

      if (isSessionExpired(session)) {
        await this.finishSession(session);
        return;
      }

      this.emitSessionChange(session);

      const missedState = getMissedTriggerState(session);

      if (missedState.missed) {
        await this.trigger(session, {
          reason: 'recovered-missed-trigger',
        });

        return;
      }

      this.schedule(session);
    } catch (error) {
      this.handleError(error);
    }
  }

  schedule(session) {
    if (
      this.destroyed
      || !session
      || session.status !== 'running'
    ) {
      return;
    }

    this.clearTimer();

    if (!session.nextTriggerAt) {
      return;
    }

    this.timerId = setTimeout(() => {
      void this.handleScheduledTrigger();
    }, getDelayUntil(session.nextTriggerAt));
  }

  async handleScheduledTrigger() {
    if (
      this.destroyed
      || this.isTriggering
    ) {
      return;
    }

    try {
      const session = await getCompanionshipSession(
        this.sessionId,
      );

      if (!session) {
        this.emitSessionChange(null);
        return;
      }

      if (session.status !== 'running') {
        this.emitSessionChange(session);
        return;
      }

      if (isSessionExpired(session)) {
        await this.finishSession(session);
        return;
      }

      const nextTriggerTime = getTimestamp(
        session.nextTriggerAt,
      );

      /*
       * 定时器可能因为系统后台限速而提前或延迟执行。
       * 如果提前执行，不触发本次陪伴，而是重新安排。
       */
      if (
        nextTriggerTime !== null
        && getNow() + RECOVERY_GRACE_MS < nextTriggerTime
      ) {
        this.schedule(session);
        return;
      }

      await this.trigger(session, {
        reason: 'scheduled-trigger',
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  async trigger(session, context = {}) {
    if (
      this.destroyed
      || this.isTriggering
      || !session
      || session.status !== 'running'
    ) {
      return;
    }

    this.isTriggering = true;
    this.clearTimer();

    const triggerStartedAt = getNow();

    /*
     * 先计算下一次触发时间。
     *
     * 这样即使 AI 请求失败，本次会话也不会因为异常而停止，
     * 下一次触发仍然可以继续。
     */
    const nextTriggerAt = calculateNextTriggerAt({
      session,
      from: triggerStartedAt,
    });

    try {
      if (typeof this.onTrigger === 'function') {
        await this.onTrigger({
          session,
          ...context,
        });
      }

      if (nextTriggerAt) {
        await markCompanionshipTrigger({
          sessionId: session.id,
          decision: 'processed',
          nextTriggerAt,
          error: null,
        });
      } else {
        await stopCompanionship(
          session.id,
          'completed',
        );
      }

      const latest = await getCompanionshipSession(
        session.id,
      );

      this.emitSessionChange(latest);

      if (
        latest
        && latest.status === 'running'
        && !this.destroyed
      ) {
        this.schedule(latest);
      }
    } catch (error) {
      /*
       * 单次陪伴回合失败不应摧毁整个调度器。
       * 记录错误后，继续安排下一次触发。
       */
      try {
        await markCompanionshipTrigger({
          sessionId: session.id,
          decision: 'error',
          nextTriggerAt,
          error: error?.message || '陪伴回合执行失败。',
        });
      } catch (recordError) {
        console.warn(
          '[Companionship] 无法记录回合错误：',
          recordError,
        );
      }

      this.handleError(error);

      const latest = await getCompanionshipSession(
        session.id,
      );

      this.emitSessionChange(latest);

      if (
        latest
        && latest.status === 'running'
        && !this.destroyed
      ) {
        this.schedule(latest);
      }
    } finally {
      this.isTriggering = false;
    }
  }

  async refresh() {
    if (this.destroyed) return;

    this.clearTimer();
    await this.start();
  }

  async finishSession(session) {
    if (!session?.id) return;

    await stopCompanionship(
      session.id,
      'completed',
    );

    const completedSession = {
      ...session,
      status: 'completed',
      mcpAuthorizationGranted: false,
    };

    this.emitSessionChange(completedSession);
    this.clearTimer();
  }

  emitSessionChange(session) {
    if (typeof this.onSessionChange !== 'function') {
      return;
    }

    try {
      this.onSessionChange(session || null);
    } catch (error) {
      console.warn(
        '[Companionship] 会话状态回调失败：',
        error,
      );
    }
  }

  handleError(error) {
    console.error(
      '[Companionship] 调度器运行失败：',
      error,
    );

    if (typeof this.onError === 'function') {
      this.onError(error);
    }
  }

  clearTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.clearTimer();
  }
}

export const startCompanionshipScheduler = ({
  sessionId,
  onTrigger,
  onSessionChange,
  onError,
}) => {
  if (
    sessionId === undefined
    || sessionId === null
    || sessionId === ''
  ) {
    throw new Error(
      '启动陪伴调度器时缺少 sessionId。',
    );
  }

  const normalizedSessionId = String(sessionId);
  const previousScheduler = schedulerInstances.get(
    normalizedSessionId,
  );

  if (previousScheduler) {
    previousScheduler.destroy();
  }

  const scheduler = new CompanionshipScheduler({
    sessionId,
    onTrigger,
    onSessionChange,
    onError,
  });

  schedulerInstances.set(
    normalizedSessionId,
    scheduler,
  );

  void scheduler.start();

  return {
    refresh: () => scheduler.refresh(),

    destroy: () => {
      scheduler.destroy();

      if (
        schedulerInstances.get(normalizedSessionId)
        === scheduler
      ) {
        schedulerInstances.delete(normalizedSessionId);
      }
    },
  };
};

export const stopCompanionshipScheduler = (sessionId) => {
  if (
    sessionId === undefined
    || sessionId === null
    || sessionId === ''
  ) {
    return;
  }

  const normalizedSessionId = String(sessionId);
  const scheduler = schedulerInstances.get(
    normalizedSessionId,
  );

  if (!scheduler) return;

  scheduler.destroy();
  schedulerInstances.delete(normalizedSessionId);
};

export const refreshAllCompanionshipSchedulers = () => {
  for (const scheduler of schedulerInstances.values()) {
    void scheduler.refresh();
  }
};

import {
  calculateNextTriggerAt,
  completeExpiredCompanionships,
  getCompanionshipSession,
  getMissedTriggerState,
  markCompanionshipTrigger,
  stopCompanionship,
} from './companionshipService';

const schedulerInstances = new Map();

const now = () => Date.now();

const getDelay = (timestamp) => {
  const target = new Date(timestamp).getTime();

  if (!Number.isFinite(target)) {
    return 1000;
  }

  return Math.max(500, target - now());
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

    this.timeoutId = null;
    this.destroyed = false;
    this.isTriggering = false;
  }

  async start() {
    if (this.destroyed) return;

    await completeExpiredCompanionships();

    const session = await getCompanionshipSession(this.sessionId);

    if (!session || session.status !== 'running') {
      this.emitChange(session);
      return;
    }

    this.emitChange(session);

    const missed = getMissedTriggerState(session);

    if (missed.missed) {
      await this.trigger(session, {
        reason: 'recovered-missed-trigger',
      });

      return;
    }

    this.schedule(session);
  }

  schedule(session) {
    if (this.destroyed || session?.status !== 'running') {
      return;
    }

    this.clearTimeout();

    if (!session.nextTriggerAt) {
      return;
    }

    this.timeoutId = window.setTimeout(
      () => {
        void this.handleScheduledTrigger();
      },
      getDelay(session.nextTriggerAt),
    );
  }

  async handleScheduledTrigger() {
    if (this.destroyed || this.isTriggering) return;

    const session = await getCompanionshipSession(this.sessionId);

    if (!session || session.status !== 'running') {
      this.emitChange(session);
      return;
    }

    if (new Date(session.endsAt).getTime() <= now()) {
      await stopCompanionship(session.id, 'completed');
      this.emitChange({
        ...session,
        status: 'completed',
        mcpAuthorizationGranted: false,
      });
      return;
    }

    await this.trigger(session, {
      reason: 'scheduled-trigger',
    });
  }

  async trigger(session, context = {}) {
    if (this.destroyed || this.isTriggering) return;

    this.isTriggering = true;

    const triggerStartedAt = now();
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

      await markCompanionshipTrigger({
        sessionId: session.id,
        decision: 'processed',
        nextTriggerAt,
      });

      const latest = await getCompanionshipSession(session.id);
      this.emitChange(latest);

      if (latest?.status === 'running') {
        this.schedule(latest);
      }
    } catch (error) {
      console.error('[Companionship] trigger failed:', error);

      await markCompanionshipTrigger({
        sessionId: session.id,
        decision: 'error',
        nextTriggerAt,
        error: error?.message || '陪伴触发失败。',
      });

      this.onError?.(error);

      const latest = await getCompanionshipSession(session.id);
      this.emitChange(latest);

      if (latest?.status === 'running') {
        this.schedule(latest);
      }
    } finally {
      this.isTriggering = false;
    }
  }

  async handleVisibilityChange() {
    if (this.destroyed) return;

    await this.start();
  }

  emitChange(session) {
    this.onSessionChange?.(session || null);
  }

  clearTimeout() {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.clearTimeout();
  }
}

export const startCompanionshipScheduler = (options) => {
  const sessionId = options?.sessionId;

  if (!sessionId) {
    throw new Error('启动陪伴调度器时缺少 sessionId。');
  }

  const previous = schedulerInstances.get(String(sessionId));

  if (previous) {
    previous.destroy();
  }

  const scheduler = new CompanionshipScheduler({
    ...options,
    sessionId: String(sessionId),
  });

  schedulerInstances.set(String(sessionId), scheduler);
  void scheduler.start();

  return {
    destroy: () => {
      scheduler.destroy();

      if (schedulerInstances.get(String(sessionId)) === scheduler) {
        schedulerInstances.delete(String(sessionId));
      }
    },
    refresh: () => scheduler.handleVisibilityChange(),
  };
};

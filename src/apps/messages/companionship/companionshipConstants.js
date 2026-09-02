export const COMPANIONSHIP_STATUS = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  ERROR: 'error',
};

export const COMPANIONSHIP_TURN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  SILENT: 'silent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export const COMPANIONSHIP_DECISIONS = {
  MESSAGE: 'message',
  VOICE: 'voice',
  MCP: 'mcp',
  SILENT: 'silent',
  ERROR: 'error',
};

export const COMPANIONSHIP_MAX_DURATION_MINUTES = 120;

export const COMPANIONSHIP_DEFAULT_DURATION_MINUTES = 30;

export const COMPANIONSHIP_DEFAULT_INTERVAL_MINUTES = 5;

export const COMPANIONSHIP_MIN_INTERVAL_MINUTES = 1;

export const COMPANIONSHIP_MAX_INTERVAL_MINUTES = 60;

export const normalizeCompanionshipText = (
  value,
  maxLength = 1200,
) => (
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength)
);

export const normalizeCompanionshipDuration = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return COMPANIONSHIP_DEFAULT_DURATION_MINUTES;
  }

  return Math.min(
    COMPANIONSHIP_MAX_DURATION_MINUTES,
    Math.max(1, Math.round(number)),
  );
};

export const normalizeCompanionshipInterval = (
  value,
  durationMinutes,
) => {
  const duration = normalizeCompanionshipDuration(durationMinutes);
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return Math.min(
      COMPANIONSHIP_DEFAULT_INTERVAL_MINUTES,
      duration,
    );
  }

  return Math.min(
    Math.max(1, Math.round(number)),
    Math.min(
      COMPANIONSHIP_MAX_INTERVAL_MINUTES,
      duration,
    ),
  );
};

export const createCompanionshipId = () => {
  if (
    typeof crypto !== 'undefined'
    && typeof crypto.randomUUID === 'function'
  ) {
    return `companionship_${crypto.randomUUID()}`;
  }

  return `companionship_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
};

export const createCompanionshipTimestamp = () => (
  new Date().toISOString()
);

export const MEMORY_TYPES = {
  FACT: 'fact',
  PREFERENCE: 'preference',
  EPISODE: 'episode',
  RELATIONSHIP: 'relationship',
  CHARACTER_THOUGHT: 'character_thought',
  EMOTION: 'emotion',
  EXPRESSION_RULE: 'expression_rule',
  REFLECTION: 'reflection'
};

export const MEMORY_TYPE_OPTIONS = [
  { id: MEMORY_TYPES.FACT, label: '事实与近况' },
  { id: MEMORY_TYPES.PREFERENCE, label: '偏好与习惯' },
  { id: MEMORY_TYPES.EPISODE, label: '共同经历' },
  { id: MEMORY_TYPES.RELATIONSHIP, label: '关系理解' },
  { id: MEMORY_TYPES.CHARACTER_THOUGHT, label: '角色心事' },
  { id: MEMORY_TYPES.EMOTION, label: '情绪痕迹' },
  { id: MEMORY_TYPES.EXPRESSION_RULE, label: '表达方式与边界' },
  { id: MEMORY_TYPES.REFLECTION, label: '阶段性反思' }
];

export const MEMORY_SUBJECTS = {
  USER: 'user',
  CHARACTER: 'character',
  RELATIONSHIP: 'relationship',
  SHARED: 'shared'
};

export const MEMORY_SUBJECT_OPTIONS = [
  { id: MEMORY_SUBJECTS.USER, label: '用户' },
  { id: MEMORY_SUBJECTS.CHARACTER, label: '角色' },
  { id: MEMORY_SUBJECTS.RELATIONSHIP, label: '关系' },
  { id: MEMORY_SUBJECTS.SHARED, label: '共同经历' }
];

export const MEMORY_EMOTION_SUBJECTS = {
  USER: 'user',
  CHARACTER: 'character',
  SHARED: 'shared'
};

export const MEMORY_SCOPES = {
  CONVERSATION: 'conversation',
  CHARACTER_SETTING: 'character_setting',
  RELATIONSHIP_SETTING: 'relationship_setting'
};

export const MEMORY_RECALL_POLICIES = {
  NORMAL: 'normal',
  LOW_FREQUENCY: 'low_frequency',
  WHEN_RELEVANT: 'when_relevant'
};

export const MEMORY_STABILITIES = {
  MOMENTARY: 'momentary',
  TEMPORARY: 'temporary',
  ONGOING: 'ongoing',
  STABLE: 'stable'
};

export const MEMORY_TEMPORAL_PRECISIONS = {
  EXACT_DATETIME: 'exact_datetime',
  DATETIME_RANGE: 'datetime_range',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  WEEKDAY_ONLY: 'weekday_only',
  AMBIGUOUS: 'ambiguous'
};

export const MEMORY_TEMPORAL_STATUSES = {
  PLANNED: 'planned',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown'
};

export const MEMORY_STATUSES = {
  ACTIVE: 'active',
  TEMPORARY: 'temporary',
  DORMANT: 'dormant',
  ARCHIVED: 'archived',
  WITHDRAWN: 'withdrawn',
  CORRECTED: 'corrected'
};

export const MEMORY_STATUS_OPTIONS = [
  { id: MEMORY_STATUSES.ACTIVE, label: '生效中' },
  { id: MEMORY_STATUSES.TEMPORARY, label: '暂时记录' },
  { id: MEMORY_STATUSES.DORMANT, label: '已被更正或暂不调用' },
  { id: MEMORY_STATUSES.ARCHIVED, label: '已归档' },
  { id: MEMORY_STATUSES.WITHDRAWN, label: '已撤回' },
  { id: MEMORY_STATUSES.CORRECTED, label: '已被更正' }
];

export const MEMORY_CONFIDENCES = {
  INFERRED: 'inferred',
  SUGGESTED: 'suggested',
  CONFIRMED: 'confirmed',
  USER_WRITTEN: 'user_written'
};

export const MEMORY_CONFIDENCE_LABELS = {
  [MEMORY_CONFIDENCES.INFERRED]: '整理推测',
  [MEMORY_CONFIDENCES.SUGGESTED]: '待确认',
  [MEMORY_CONFIDENCES.CONFIRMED]: '已确认',
  [MEMORY_CONFIDENCES.USER_WRITTEN]: '用户写入'
};

export const MEMORY_SOURCE_STATES = {
  AVAILABLE: 'available',
  PARTIALLY_DELETED: 'partially_deleted',
  DELETED: 'deleted',
  IMPORTED_WITHOUT_SOURCE: 'imported_without_source',
  USER_CREATED: 'user_created'
};

export const MEMORY_SOURCE_KINDS = {
  CONVERSATION: 'conversation',
  SUMMARY_ASSISTED: 'summary_assisted',
  IMPORTED: 'imported',
  USER_CREATED: 'user_created'
};

export const MEMORY_CANDIDATE_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired'
};

export const MEMORY_CANDIDATE_PROPOSALS = {
  CREATE: 'create',
  DUPLICATE: 'duplicate',
  UPDATE_EXISTING: 'update_existing',
  CORRECT_EXISTING: 'correct_existing',
  CONFLICT: 'conflict'
};

export const MEMORY_CANDIDATE_PROPOSAL_LABELS = {
  [MEMORY_CANDIDATE_PROPOSALS.CREATE]: '待确认的新片段',
  [MEMORY_CANDIDATE_PROPOSALS.DUPLICATE]: '疑似重复记录',
  [MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING]: '建议更新已有记忆',
  [MEMORY_CANDIDATE_PROPOSALS.CORRECT_EXISTING]: '用户说法正在更正旧理解',
  [MEMORY_CANDIDATE_PROPOSALS.CONFLICT]: '与既有理解存在冲突'
};

export const MEMORY_JOB_STATUSES = {
  IDLE: 'idle',
  PENDING: 'pending',
  RUNNING: 'running',
  FAILED: 'failed'
};

export const MEMORY_REVISION_ACTIONS = {
  CREATED: 'created',
  EDITED: 'edited',
  WITHDRAWN: 'withdrawn',
  RESTORED: 'restored',
  ARCHIVED: 'archived',
  DORMANT: 'dormant',
  CORRECTED: 'corrected',
  SUPERSEDED: 'superseded',
  CANDIDATE_ACCEPTED: 'candidate_accepted',
  DELETED: 'deleted',
  IMPORTED: 'imported'
};

export const RECALLABLE_MEMORY_STATUSES = [
  MEMORY_STATUSES.ACTIVE,
  MEMORY_STATUSES.TEMPORARY
];

export const MEMORY_IMPORT_FORMAT = 'when-i-with-u-memory';
export const MEMORY_IMPORT_FORMAT_VERSION = 1;

export const MEMORY_IMPORT_MODES = {
  MERGE: 'merge',
  ONLY_NEW: 'only_new',
  REPLACE_CHAT: 'replace_chat'
};

export const MEMORY_IMPORT_MODE_OPTIONS = [
  {
    id: MEMORY_IMPORT_MODES.MERGE,
    label: '合并导入',
    description: '保留现有记忆，并根据记忆的最后更新时间合并重复项目。'
  },
  {
    id: MEMORY_IMPORT_MODES.ONLY_NEW,
    label: '仅导入新项',
    description: '本地已存在相同记忆时跳过，不覆盖现有内容。'
  },
  {
    id: MEMORY_IMPORT_MODES.REPLACE_CHAT,
    label: '替换当前消息框的记忆',
    description: '清除目标消息框的全部记忆、候选和修订，再写入导入内容。原始聊天消息与阶段性摘要不会被删除。'
  }
];

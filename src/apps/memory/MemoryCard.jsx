import React, { useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  RotateCcw,
  Trash2,
  Undo2
} from 'lucide-react';

import ConfirmModal from '../../components/ConfirmModal';
import MemoryImportModal from './MemoryImportModal';
import MemoryExportModal from './MemoryExportModal';
import MemoryRevisionModal from './MemoryRevisionModal';

import {
  MEMORY_CONFIDENCE_LABELS,
  MEMORY_STATUS_OPTIONS,
  MEMORY_STATUSES,
  MEMORY_TYPE_OPTIONS
} from './memoryConstants';

const getTypeLabel = (type) => (
  MEMORY_TYPE_OPTIONS.find((item) => item.id === type)?.label || '共同记忆'
);

const getStatusLabel = (status) => (
  MEMORY_STATUS_OPTIONS.find((item) => item.id === status)?.label || status
);

const formatDate = (value) => {
  if (!value) return '时间未记录';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '时间未记录';

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '.');
};

const formatDateTime = (value) => {
  if (!value) return '未记录';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '未记录';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const getSourceLabel = (memory) => {
  if (memory.sourceState === 'available') {
    const count = Array.isArray(memory.sourceMessageIds)
      ? memory.sourceMessageIds.length
      : 0;

    return count > 0 ? `${count} 条消息依据` : '有对话依据';
  }

  if (memory.sourceState === 'partially_deleted') {
    return '部分消息依据已删除';
  }

  if (memory.sourceState === 'deleted') {
    return '原始消息已删除';
  }

  if (memory.sourceState === 'imported_without_source') {
    return '导入记录，原始消息不在本地';
  }

  if (memory.sourceKind === 'user_created') {
    return '用户手动写入';
  }

  return '来源未完整记录';
};

const getAuthorityLabel = (memory) => {
  if (
    memory.confidence === 'user_written' ||
    memory.userEditedAt
  ) {
    return '用户手动维护';
  }

  if (memory.userConfirmedAt) {
    return '用户确认';
  }

  if (memory.confidence === 'confirmed') {
    return '已确认';
  }

  if (memory.confidence === 'inferred') {
    return 'AI 整理推断';
  }

  return '待确认理解';
};

const getSubjectLabel = (subject) => ({
  user: '用户',
  character: '角色',
  relationship: '关系',
  shared: '共同经历'
}[subject] || '未标注');

const getEmotionSubjectLabel = (subject) => ({
  user: '用户的情绪',
  character: '角色的情绪',
  shared: '共同情绪'
}[subject] || '未标注');

const getTemporalStatusLabel = (status) => ({
  planned: '计划中',
  ongoing: '正在发生',
  completed: '已完成',
  cancelled: '已取消',
  unknown: '结果未确认'
}[status] || '未标注');

const getTemporalPrecisionLabel = (precision) => ({
  exact_datetime: '精确到时间',
  datetime_range: '时间范围',
  day: '精确到日期',
  week: '一周范围',
  month: '月份范围',
  weekday_only: '仅星期信息',
  ambiguous: '时间尚不明确'
}[precision] || '未标注');

const getScopeLabel = (scope) => ({
  conversation: '当前对话',
  character_setting: '角色设定',
  relationship_setting: '关系设定'
}[scope] || '当前对话');

const getRecallPolicyLabel = (policy) => ({
  normal: '按相关性参考',
  low_frequency: '低频参考',
  when_relevant: '仅相关时参考'
}[policy] || '按相关性参考');

const isInactive = (status) => (
  [
    MEMORY_STATUSES.WITHDRAWN,
    MEMORY_STATUSES.ARCHIVED,
    MEMORY_STATUSES.DORMANT,
    MEMORY_STATUSES.CORRECTED
  ].includes(status)
);

const getTemporalDisplay = (temporal) => {
  if (!temporal || typeof temporal !== 'object') {
    return null;
  }

  const startAt = formatDateTime(temporal.startAt);
  const endAt = formatDateTime(temporal.endAt);

  if (!temporal.startAt) {
    return '尚未能安全换算为绝对时间';
  }

  if (
    !temporal.endAt ||
    temporal.startAt === temporal.endAt
  ) {
    return startAt;
  }

  return `${startAt} 至 ${endAt}`;
};

export const MemoryCard = ({
  memory,
  onEdit,
  onWithdraw,
  onRestore,
  onArchive,
  onDelete,
  onViewRevisions
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  if (!memory) return null;

  const confidenceLabel = (
    MEMORY_CONFIDENCE_LABELS[memory.confidence] || '未标注'
  );

  const temporal = (
    memory.temporal &&
    typeof memory.temporal === 'object'
  )
    ? memory.temporal
    : null;

  const temporalDisplay = getTemporalDisplay(temporal);

  const handleConfirm = async () => {
    const action = confirmAction?.type;

    setConfirmAction(null);

    if (action === 'withdraw') {
      await onWithdraw?.(memory);
    }

    if (action === 'restore') {
      await onRestore?.(memory);
    }

    if (action === 'archive') {
      await onArchive?.(memory);
    }

    if (action === 'delete') {
      await onDelete?.(memory);
    }
  };

  const getConfirmContent = () => {
    if (confirmAction?.type === 'withdraw') {
      return {
        title: '撤回这条记忆',
        message: '撤回后，这条记忆将不再参与聊天回复，但仍会保留在记忆档案中，之后可以恢复。',
        confirmText: '撤回记忆'
      };
    }

    if (confirmAction?.type === 'restore') {
      return {
        title: '恢复这条记忆',
        message: '恢复后，这条记忆可以重新作为当前消息框的聊天参考。',
        confirmText: '恢复记忆'
      };
    }

    if (confirmAction?.type === 'archive') {
      return {
        title: '归档这条记忆',
        message: '归档后，这条记忆将暂时退出聊天调用，但不会被永久删除。',
        confirmText: '归档'
      };
    }

    return {
      title: '永久删除这条记忆',
      message: '永久删除后，这条记忆及其修订记录都无法恢复。',
      confirmText: '永久删除'
    };
  };

  const confirmContent = getConfirmContent();

  return (
    <>
      <article
        className={[
          'memory-card',
          isInactive(memory.status) ? 'memory-card-inactive' : ''
        ].join(' ')}
      >
        <div className="memory-card-topline">
          <span className="memory-card-index">
            MEMORY / {String(memory.id || '').padStart(2, '0')}
          </span>

          <span className="memory-card-status">
            {getStatusLabel(memory.status)}
          </span>
        </div>

        <div className="memory-card-body">
          <div className="memory-card-type">
            {getTypeLabel(memory.type)}
          </div>

          <h3 className="memory-card-title">
            {memory.title || '未命名记忆'}
          </h3>

          <p className="memory-card-content">
            {memory.content}
          </p>

          {temporal?.originalExpression && (
            <p className="memory-card-relation">
              时间线索：{temporal.originalExpression}
              {temporal.isAmbiguous ? '（尚未确认具体时间）' : ''}
            </p>
          )}

          {memory.status === MEMORY_STATUSES.CORRECTED && (
            <p className="memory-card-relation memory-card-relation-corrected">
              这一页已被后来的理解更正，不再参与聊天参考。
            </p>
          )}

          {memory.status === MEMORY_STATUSES.DORMANT &&
            memory.supersededByMemoryId && (
              <p className="memory-card-relation">
                这一页已由后来的记忆替代。
              </p>
            )}

          <div className="memory-card-meta">
            <span>{getAuthorityLabel(memory)}</span>
            <span>{confidenceLabel}</span>
            <span>{formatDate(memory.updatedAt || memory.createdAt)}</span>
            <span>{getSourceLabel(memory)}</span>
          </div>
        </div>

        <div className="memory-card-actions">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="memory-action-button"
          >
            {showDetails ? (
              <ChevronUp className="memory-action-icon" />
            ) : (
              <ChevronDown className="memory-action-icon" />
            )}
            <span>{showDetails ? '收起' : '详情'}</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit?.(memory)}
            className="memory-action-button"
          >
            <Edit2 className="memory-action-icon" />
            <span>编辑</span>
          </button>

          {memory.status === MEMORY_STATUSES.WITHDRAWN ||
          memory.status === MEMORY_STATUSES.ARCHIVED ? (
            <button
              type="button"
              onClick={() => setConfirmAction({ type: 'restore' })}
              className="memory-action-button"
            >
              <RotateCcw className="memory-action-icon" />
              <span>恢复</span>
            </button>
          ) : memory.status === MEMORY_STATUSES.CORRECTED ? (
            <span className="memory-action-disabled">
              已被更正
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction({ type: 'withdraw' })}
              className="memory-action-button"
            >
              <Undo2 className="memory-action-icon" />
              <span>撤回</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmAction({ type: 'delete' })}
            className="memory-action-button memory-action-danger"
          >
            <Trash2 className="memory-action-icon" />
            <span>删除</span>
          </button>
        </div>

        {showDetails && (
          <div className="memory-card-details">
            <div>
              <span className="memory-detail-label">重要程度</span>
              <span className="memory-detail-value">
                {memory.importance || 3} / 5
              </span>
            </div>

            <div>
              <span className="memory-detail-label">归属</span>
              <span className="memory-detail-value">
                {getSubjectLabel(memory.subject)}
              </span>
            </div>

            {memory.type === 'emotion' && (
              <div>
                <span className="memory-detail-label">情绪归属</span>
                <span className="memory-detail-value">
                  {getEmotionSubjectLabel(memory.emotionSubject)}
                </span>
              </div>
            )}

            {memory.topicKey && (
              <div>
                <span className="memory-detail-label">主题</span>
                <span className="memory-detail-value">
                  {memory.topicKey}
                </span>
              </div>
            )}

            {temporal && (
              <>
                <div>
                  <span className="memory-detail-label">原始时间说法</span>
                  <span className="memory-detail-value">
                    {temporal.originalExpression || '未记录'}
                  </span>
                </div>

                <div>
                  <span className="memory-detail-label">解析后的时间</span>
                  <span className="memory-detail-value">
                    {temporalDisplay || '未记录'}
                  </span>
                </div>

                <div>
                  <span className="memory-detail-label">时间精度</span>
                  <span className="memory-detail-value">
                    {getTemporalPrecisionLabel(temporal.precision)}
                  </span>
                </div>

                <div>
                  <span className="memory-detail-label">事件状态</span>
                  <span className="memory-detail-value">
                    {getTemporalStatusLabel(
                      memory.temporalStatus || temporal.status
                    )}
                  </span>
                </div>
              </>
            )}

            <div>
              <span className="memory-detail-label">记录范围</span>
              <span className="memory-detail-value">
                {getScopeLabel(memory.memoryScope)}
              </span>
            </div>

            <div>
              <span className="memory-detail-label">参考方式</span>
              <span className="memory-detail-value">
                {getRecallPolicyLabel(memory.recallPolicy)}
              </span>
            </div>

            <div>
              <span className="memory-detail-label">形成时间</span>
              <span className="memory-detail-value">
                {formatDate(memory.createdAt)}
              </span>
            </div>

            <div>
              <span className="memory-detail-label">最后更新</span>
              <span className="memory-detail-value">
                {formatDate(memory.updatedAt)}
              </span>
            </div>

            <div>
              <span className="memory-detail-label">来源状态</span>
              <span className="memory-detail-value">
                {getSourceLabel(memory)}
              </span>
            </div>

            <div>
              <span className="memory-detail-label">被参考次数</span>
              <span className="memory-detail-value">
                {Number(memory.useCount || 0)} 次
              </span>
            </div>

            <div>
              <span className="memory-detail-label">维护权重</span>
              <span className="memory-detail-value">
                {getAuthorityLabel(memory)}
              </span>
            </div>

            <button
              type="button"
              className="memory-revision-link"
              onClick={() => onViewRevisions?.(memory)}
            >
              <Eye className="memory-action-icon" />
              查看修订记录
            </button>

            {memory.status !== MEMORY_STATUSES.ARCHIVED &&
              memory.status !== MEMORY_STATUSES.WITHDRAWN &&
              memory.status !== MEMORY_STATUSES.CORRECTED && (
                <button
                  type="button"
                  className="memory-revision-link"
                  onClick={() => setConfirmAction({ type: 'archive' })}
                >
                  <Archive className="memory-action-icon" />
                  归档但保留
                </button>
              )}
          </div>
        )}
      </article>

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmContent.title}
        message={confirmContent.message}
        confirmText={confirmContent.confirmText}
        cancelText="取消"
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default MemoryCard;

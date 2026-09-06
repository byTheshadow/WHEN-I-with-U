import React, {
  useEffect,
  useState,
} from 'react';

import AlmanacCountdownForm from './AlmanacCountdownForm';

const formatDaysRemaining = (daysRemaining) => {
  if (
    daysRemaining === null
    || daysRemaining === undefined
  ) {
    return '';
  }

  if (daysRemaining === 0) {
    return '就是今天';
  }

  if (daysRemaining < 0) {
    return `已过去 ${Math.abs(daysRemaining)} 天`;
  }

  return `还有 ${daysRemaining} 天`;
};

const formatMilestoneDate = (date) => {
  if (!date) {
    return '未设置日期';
  }

  return date;
};

export const AlmanacMilestoneManager = ({
  milestones = [],
  onCreate,
  onUpdate,
  onDelete,
  openCreateSignal = 0,
}) => {
  const [editingMilestone, setEditingMilestone] =
    useState(null);

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (openCreateSignal <= 0) {
      return;
    }

    setEditingMilestone(null);
    setShowForm(true);
  }, [openCreateSignal]);

  const handleSubmit = async (form) => {
    if (editingMilestone) {
      await onUpdate(
        editingMilestone.id,
        form,
      );

      setEditingMilestone(null);
      setShowForm(false);
      return;
    }

    await onCreate(form);
    setShowForm(false);
  };

  const beginCreate = () => {
    setEditingMilestone(null);
    setShowForm(true);
  };

  const beginEdit = (milestone) => {
    setEditingMilestone(milestone);
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditingMilestone(null);
    setShowForm(false);
  };

  const handleDelete = async (milestone) => {
    const confirmed = window.confirm(
      `确定删除“${milestone.title}”吗？`,
    );

    if (!confirmed) {
      return;
    }

    await onDelete(milestone.id);

    if (
      editingMilestone?.id === milestone.id
    ) {
      setEditingMilestone(null);
      setShowForm(false);
    }
  };

  return (
    <section
      className="almanac-panel almanac-milestone-manager"
      data-almanac-milestone-manager
    >
      <header className="almanac-manager-heading">
        <div className="almanac-manager-heading-copy">
          <p className="almanac-eyebrow">
            PERSONAL DATES
          </p>

          <h3 className="almanac-section-title">
            纪念日与倒数日
          </h3>

          <p className="almanac-manager-description">
            只有你主动留下的日期会出现在这里。
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="almanac-secondary-button almanac-add-date-button"
            onClick={beginCreate}
          >
            <span>添加日期</span>
            <span
              className="almanac-button-arrow"
              aria-hidden="true"
            >
              ↗
            </span>
          </button>
        )}
      </header>

      {showForm && (
        <div className="almanac-form-region">
          <AlmanacCountdownForm
            milestone={editingMilestone}
            onSubmit={handleSubmit}
            onCancel={cancelForm}
          />
        </div>
      )}

      {milestones.length === 0 && !showForm ? (
       <div
  className="almanac-empty almanac-milestone-empty"
  role="status"
>
  <span
    className="almanac-empty-mark"
    aria-hidden="true"
  >
    —
  </span>

  <div className="almanac-empty-copy">
    <strong className="almanac-empty-title">
      还没有留下日期
    </strong>

    <small className="almanac-empty-description">
      添加一个重要的日子，它会在这里安静地等待。
    </small>
  </div>
</div>

      ) : (
        <div className="almanac-managed-milestones">
          {milestones.map((milestone, index) => {
            const daysLabel = formatDaysRemaining(
              milestone.daysRemaining,
            );

            return (
              <article
                className="almanac-managed-milestone"
                key={milestone.id}
              >
                <span
                  className="almanac-managed-milestone-index"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="almanac-managed-milestone-content">
                  <div className="almanac-managed-milestone-main">
                    <strong className="almanac-managed-milestone-title">
                      {milestone.title}
                    </strong>

                    <p className="almanac-managed-milestone-date">
                      {formatMilestoneDate(milestone.date)}

                      {milestone.isRecurring && (
                        <span className="almanac-milestone-tag">
                          每年重复
                        </span>
                      )}
                    </p>
                  </div>

                  {milestone.showCountdown !== false
                    && daysLabel && (
                      <p
                        className={
                          milestone.daysRemaining === 0
                            ? 'almanac-countdown-label is-today'
                            : milestone.daysRemaining < 0
                              ? 'almanac-countdown-label is-past'
                              : 'almanac-countdown-label'
                        }
                      >
                        {daysLabel}
                      </p>
                    )}

                  {milestone.allowNaturalReminder && (
                    <small className="almanac-reminder-status">
                      已允许自然提醒
                    </small>
                  )}
                </div>

                <div className="almanac-managed-milestone-actions">
                  <button
                    type="button"
                    className="almanac-item-action-button"
                    onClick={() => beginEdit(milestone)}
                  >
                    编辑
                  </button>

                  <button
                    type="button"
                    className="almanac-item-action-button almanac-danger-text"
                    onClick={() => {
                      void handleDelete(milestone);
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AlmanacMilestoneManager;

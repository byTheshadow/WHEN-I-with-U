import React, { useState } from 'react';

import AlmanacCountdownForm from './AlmanacCountdownForm';

const formatDaysRemaining = (daysRemaining) => {
  if (daysRemaining === null || daysRemaining === undefined) {
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

export const AlmanacMilestoneManager = ({
  milestones = [],
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [editingMilestone, setEditingMilestone] =
    useState(null);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (form) => {
    if (editingMilestone) {
      await onUpdate(editingMilestone.id, form);
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

  const handleDelete = async (milestone) => {
    const confirmed = window.confirm(
      `确定删除“${milestone.title}”吗？`
    );

    if (!confirmed) {
      return;
    }

    await onDelete(milestone.id);

    if (editingMilestone?.id === milestone.id) {
      setEditingMilestone(null);
      setShowForm(false);
    }
  };

  return (
    <section className="almanac-panel almanac-milestone-manager">
      <div className="almanac-manager-heading">
        <div>
          <p className="almanac-eyebrow">
            Personal dates
          </p>

          <h3 className="almanac-section-title">
            纪念日与倒数日
          </h3>

          <p className="almanac-muted">
            只有你主动留下的日期会出现在这里。
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="almanac-secondary-button"
            onClick={beginCreate}
          >
            添加日期
          </button>
        )}
      </div>

      {showForm && (
        <AlmanacCountdownForm
          milestone={editingMilestone}
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditingMilestone(null);
            setShowForm(false);
          }}
        />
      )}

      {milestones.length === 0 && !showForm ? (
        <div className="almanac-empty">
          还没有留下纪念日或倒数日。
        </div>
      ) : (
        <div className="almanac-managed-milestones">
          {milestones.map((milestone) => (
            <article
              className="almanac-managed-milestone"
              key={milestone.id}
            >
              <div>
                <strong>{milestone.title}</strong>

                <small>
                  {milestone.date}
                  {milestone.isRecurring
                    ? ' · 每年重复'
                    : ''}
                </small>

                {milestone.showCountdown !== false && (
                  <small className="almanac-countdown-label">
                    {formatDaysRemaining(
                      milestone.daysRemaining
                    )}
                  </small>
                )}

                {milestone.allowNaturalReminder && (
                  <small>
                    已允许自然提醒
                  </small>
                )}
              </div>

              <div className="almanac-managed-milestone-actions">
                <button
                  type="button"
                  className="almanac-text-button"
                  onClick={() => beginEdit(milestone)}
                >
                  编辑
                </button>

                <button
                  type="button"
                  className="almanac-text-button almanac-danger-text"
                  onClick={() => {
                    void handleDelete(milestone);
                  }}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default AlmanacMilestoneManager;

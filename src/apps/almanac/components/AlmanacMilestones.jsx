import React, {
  useMemo,
  useState,
} from 'react';

import AlmanacMilestoneManager from './AlmanacMilestoneManager';

import {
  getMilestoneViewData,
} from '../services/almanacMilestoneService';

const DAY_MILESTONES = [1, 7, 30, 100];

const getSystemMilestones = (stats) => {
  if (
    !stats
    || !stats.firstTimestamp
  ) {
    return [];
  }

  const firstTimestamp = new Date(
    stats.firstTimestamp,
  ).getTime();

  if (!Number.isFinite(firstTimestamp)) {
    return [];
  }

  const elapsedDays = Math.max(
    1,
    Math.floor(
      (Date.now() - firstTimestamp)
      / (24 * 60 * 60 * 1000),
    ) + 1,
  );

  const result = DAY_MILESTONES
    .filter((day) => elapsedDays >= day)
    .map((day) => ({
      key: `days-${day}`,
      title: `相遇第 ${day} 天`,
      description:
        day === 1
          ? '这里第一次留下了你的来访。'
          : `这段相处已经经过了 ${day} 天。`,
    }));

  const userMessageCount = Number(
    stats.userMessageCount,
  );

  if (
    Number.isFinite(userMessageCount)
    && userMessageCount >= 100
  ) {
    result.push({
      key: 'user-messages-100',
      title: '第 100 条 user 消息',
      description:
        '你已经在这里留下了 100 条消息痕迹。',
    });
  }

  const firstDate = new Date(
    firstTimestamp,
  );

  if (
    firstDate.getFullYear()
    < new Date().getFullYear()
  ) {
    result.push({
      key: 'first-new-year',
      title: '第一次跨年',
      description:
        '这段相处曾经从一个年份走到了下一个年份。',
    });
  }

  return result;
};

export const AlmanacMilestones = ({
  stats,
  milestones = [],
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [openCreateSignal, setOpenCreateSignal] =
    useState(0);

  const systemMilestones = useMemo(
    () => getSystemMilestones(stats),
    [stats],
  );

  const personalMilestones = useMemo(
    () => getMilestoneViewData(milestones),
    [milestones],
  );

  const handleOpenCreate = () => {
    setOpenCreateSignal((value) => value + 1);

    if (
      typeof window === 'undefined'
      || typeof document === 'undefined'
    ) {
      return;
    }

    window.setTimeout(() => {
      document
        .querySelector(
          '[data-almanac-milestone-manager]',
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 30);
  };

  return (
    <>
      <section className="almanac-panel almanac-milestones-overview">
        <header className="almanac-milestone-heading">
          <div className="almanac-milestone-heading-copy">
            <p className="almanac-eyebrow">
              DEVELOPED MARKS
            </p>

            <h2 className="almanac-section-title">
              显影出来的时刻
            </h2>

            <p className="almanac-milestone-description">
              记录重要的日期，也可以留下一个正在靠近的日子。
            </p>
          </div>

          <button
            type="button"
            className="almanac-secondary-button almanac-add-date-button"
            onClick={handleOpenCreate}
          >
            <span>添加日期</span>

            <span
              className="almanac-button-arrow"
              aria-hidden="true"
            >
              ↗
            </span>
          </button>
        </header>

        <div className="almanac-system-milestones">
          <div className="almanac-subsection-heading">
            <p className="almanac-subsection-kicker">
              SYSTEM MARKS
            </p>

            <span className="almanac-subsection-rule" />
          </div>

          {systemMilestones.length === 0 ? (
           <div
  className="almanac-empty almanac-system-empty"
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
      还没有足够的相处记录
    </strong>

    <small className="almanac-empty-description">
      更多相遇发生之后，这里会慢慢显影出新的时刻。
    </small>
  </div>
</div>

          ) : (
            <div className="almanac-milestone-list">
              {systemMilestones.map((milestone, index) => (
                <article
                  className="almanac-system-milestone"
                  key={milestone.key}
                >
                  <span
                    className="almanac-milestone-line"
                    aria-hidden="true"
                  />

                  <span
                    className="almanac-system-milestone-index"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="almanac-system-milestone-content">
                    <strong>
                      {milestone.title}
                    </strong>

                    <p>
                      {milestone.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {personalMilestones.length > 0 && (
          <div className="almanac-personal-milestone-list">
            <div className="almanac-subsection-heading">
              <p className="almanac-subsection-kicker">
                YOUR DATES
              </p>

              <span className="almanac-subsection-rule" />
            </div>

            {personalMilestones.map((milestone) => (
              <article
                className="almanac-personal-milestone"
                key={milestone.id}
              >
                <span
                  className="almanac-personal-milestone-dot"
                  aria-hidden="true"
                />

                <div className="almanac-personal-milestone-content">
                  <strong>
                    {milestone.title}
                  </strong>

                  <p>
                    {milestone.date}

                    {milestone.isRecurring && (
                      <span className="almanac-milestone-tag">
                        每年重复
                      </span>
                    )}
                  </p>

                  {milestone.showCountdown !== false && (
                    <small
                      className={
                        milestone.daysRemaining === 0
                          ? 'almanac-personal-countdown is-today'
                          : milestone.daysRemaining < 0
                            ? 'almanac-personal-countdown is-past'
                            : 'almanac-personal-countdown'
                      }
                    >
                      {milestone.daysRemaining === 0
                        ? '就是今天'
                        : milestone.daysRemaining > 0
                          ? `还有 ${milestone.daysRemaining} 天`
                          : `已过去 ${
                              Math.abs(
                                milestone.daysRemaining,
                              )
                            } 天`}
                    </small>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <AlmanacMilestoneManager
        milestones={milestones}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        openCreateSignal={openCreateSignal}
      />
    </>
  );
};

export default AlmanacMilestones;


import React, { useMemo } from 'react';

import AlmanacMilestoneManager from './AlmanacMilestoneManager';
import {
  getMilestoneViewData,
} from '../services/almanacMilestoneService';

const DAY_MILESTONES = [1, 7, 30, 100];

const getSystemMilestones = (stats) => {
  if (!stats?.firstTimestamp) {
    return [];
  }

  const elapsedDays = Math.max(
    1,
    Math.floor(
      (Date.now() - stats.firstTimestamp) /
        (24 * 60 * 60 * 1000)
    ) + 1
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

  if (stats.userMessageCount >= 100) {
    result.push({
      key: 'user-messages-100',
      title: '第 100 条 user 消息',
      description:
        '你已经在这里留下了 100 条消息痕迹。',
    });
  }

  const firstDate = new Date(stats.firstTimestamp);

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
  const systemMilestones = useMemo(
    () => getSystemMilestones(stats),
    [stats]
  );

  const personalMilestones = useMemo(
    () => getMilestoneViewData(milestones),
    [milestones]
  );

  return (
    <>
      <section className="almanac-panel space-y-4">
        <div>
          <p className="almanac-eyebrow">
            Developed marks
          </p>

          <h2 className="almanac-section-title">
            显影出来的时刻
          </h2>
        </div>

        {systemMilestones.length === 0 ? (
          <div className="almanac-empty">
            还没有足够的相处记录形成系统时刻。
          </div>
        ) : (
          <div className="almanac-milestone-list">
            {systemMilestones.map((milestone) => (
              <article key={milestone.key}>
                <span className="almanac-milestone-line" />

                <div>
                  <strong>{milestone.title}</strong>
                  <p>{milestone.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {personalMilestones.length > 0 && (
          <div className="almanac-personal-milestone-list">
            {personalMilestones.map((milestone) => (
              <article
                className="almanac-personal-milestone"
                key={milestone.id}
              >
                <div>
                  <strong>{milestone.title}</strong>

                  <p>
                    {milestone.date}
                    {milestone.isRecurring
                      ? ' · 每年重复'
                      : ''}
                  </p>

                  {milestone.showCountdown !== false && (
                    <small>
                      {milestone.daysRemaining === 0
                        ? '就是今天'
                        : milestone.daysRemaining > 0
                          ? `还有 ${milestone.daysRemaining} 天`
                          : `已过去 ${
                              Math.abs(
                                milestone.daysRemaining
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
      />
    </>
  );
};

export default AlmanacMilestones;

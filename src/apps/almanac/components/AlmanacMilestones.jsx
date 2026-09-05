import React, { useMemo } from 'react';

const DAY_MILESTONES = [1, 7, 30, 100];

export const AlmanacMilestones = ({ stats }) => {
  const milestones = useMemo(() => {
    if (!stats?.firstTimestamp) return [];

    const elapsedDays = Math.max(
      1,
      Math.floor(
        (Date.now() - stats.firstTimestamp) /
          (24 * 60 * 60 * 1000)
      ) + 1
    );

    return DAY_MILESTONES.filter(
      (day) => elapsedDays >= day
    ).map((day) => ({
      key: `days-${day}`,
      title: `相遇第 ${day} 天`,
      description:
        day === 1
          ? '这里第一次留下了你的来访。'
          : `这段相处已经经过了 ${day} 天。`,
    }));
  }, [stats]);

  if (milestones.length === 0) return null;

  return (
    <section className="almanac-panel space-y-4">
      <div>
        <p className="almanac-eyebrow">Developed marks</p>
        <h2 className="almanac-section-title">显影出来的时刻</h2>
      </div>

      <div className="almanac-milestone-list">
        {milestones.map((milestone) => (
          <article key={milestone.key}>
            <span className="almanac-milestone-line" />
            <div>
              <strong>{milestone.title}</strong>
              <p>{milestone.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AlmanacMilestones;

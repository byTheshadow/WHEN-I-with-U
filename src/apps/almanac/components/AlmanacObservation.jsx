import React from 'react';

export const AlmanacObservation = ({
  stats,
  rhythmObservation,
}) => {
  return (
    <section className="almanac-panel space-y-4">
      <div>
        <p className="almanac-eyebrow">A quiet record</p>
        <h2 className="almanac-section-title">这里留下过</h2>
      </div>

      <div className="almanac-stat-grid">
        <div>
          <strong>{stats.activeDays}</strong>
          <span>个相遇日</span>
        </div>

        <div>
          <strong>{stats.userMessageCount}</strong>
          <span>条消息痕迹</span>
        </div>

        <div>
          <strong>{stats.chatOpenCount}</strong>
          <span>次回来</span>
        </div>
      </div>

      {rhythmObservation?.enabled && (
        <div className="almanac-observation-note">
          <p className="almanac-eyebrow">Rhythm observation</p>

          {rhythmObservation.ready ? (
            <>
              <p>{rhythmObservation.message}</p>
              <small>
                基于 {rhythmObservation.sampleDays} 天记录，
                置信度约为 {Math.round(
                  rhythmObservation.confidence * 100
                )}%。
              </small>
            </>
          ) : (
            <p>{rhythmObservation.message}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default AlmanacObservation;

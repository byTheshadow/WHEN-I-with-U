import React, { useMemo, useState } from 'react';

const getHeatLevel = (count, maxCount) => {
  if (!count || !maxCount) return 0;

  const ratio = count / maxCount;

  if (ratio >= 0.8) return 4;
  if (ratio >= 0.55) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
};

export const AlmanacHeatmap = ({ data = [] }) => {
  const [selectedDate, setSelectedDate] = useState(null);

  const maxCount = useMemo(
    () => Math.max(...data.map((item) => item.count), 0),
    [data]
  );

  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey)
      ),
    [data]
  );

  return (
    <section className="almanac-panel space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="almanac-eyebrow">Lightprint trace</p>
          <h2 className="almanac-section-title">相遇热力</h2>
        </div>

        <span className="almanac-muted">
          {data.length} 个有记录的日子
        </span>
      </div>

      {sortedData.length === 0 ? (
        <div className="almanac-empty">
          还没有足够的相遇痕迹。
        </div>
      ) : (
        <>
          <div className="almanac-heatmap" aria-label="相遇热力图">
            {sortedData.map((item) => (
              <button
                type="button"
                key={item.dateKey}
                className={`almanac-heat-cell level-${getHeatLevel(
                  item.count,
                  maxCount
                )}`}
                title={`${item.dateKey}，${item.count} 次记录`}
                aria-label={`${item.dateKey}，${item.count} 次记录`}
                onClick={() => setSelectedDate(item)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="almanac-muted">少</span>

            <div className="almanac-heat-legend">
              <span className="almanac-heat-cell level-0" />
              <span className="almanac-heat-cell level-1" />
              <span className="almanac-heat-cell level-2" />
              <span className="almanac-heat-cell level-3" />
              <span className="almanac-heat-cell level-4" />
            </div>

            <span className="almanac-muted">多</span>
          </div>

          {selectedDate && (
            <div className="almanac-note">
              <strong>{selectedDate.dateKey}</strong>
              <span>
                这一天留下了 {selectedDate.count} 次相遇记录。
              </span>
              {selectedDate.hours?.length > 0 && (
                <span>
                  出现过的时段：
                  {selectedDate.hours
                    .map((hour) => `${hour}:00`)
                    .join('、')}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AlmanacHeatmap;

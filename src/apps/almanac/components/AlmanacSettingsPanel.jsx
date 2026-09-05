import React, { useEffect, useMemo, useState } from 'react';

const getDeviceTimeZone = () => {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone
      || 'UTC'
    );
  } catch {
    return 'UTC';
  }
};

const isValidTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone,
    }).format();

    return true;
  } catch {
    return false;
  }
};

const getSupportedTimeZones = () => {
  const commonTimeZones = [
    'UTC',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Taipei',
    'Asia/Bangkok',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Toronto',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // 浏览器不支持 supportedValuesOf 时使用常用时区列表
  }

  return commonTimeZones;
};

const formatTimeZoneLabel = (timeZone) => {
  if (!timeZone) return '未设置';

  return timeZone.replaceAll('_', ' ');
};

const getInitialTimeZone = (config) => {
  if (
    config?.timezone
    && isValidTimeZone(config.timezone)
  ) {
    return config.timezone;
  }

  return getDeviceTimeZone();
};

export const AlmanacSettingsPanel = ({
  config,
  onSave,
}) => {
  const [draft, setDraft] = useState(config);
  const [showTimezoneNotice, setShowTimezoneNotice] = useState(false);
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);
  const [selectedTimeZone, setSelectedTimeZone] = useState('');
  const [timezoneSearch, setTimezoneSearch] = useState('');

  const deviceTimeZone = useMemo(
    () => getDeviceTimeZone(),
    [],
  );

  const supportedTimeZones = useMemo(
    () => getSupportedTimeZones(),
    [],
  );

  useEffect(() => {
    if (!config) return;

    setDraft(config);

    const hasUserSelectedTimeZone = (
      config.timezoneSource === 'user'
      && isValidTimeZone(config.timezone)
    );

    const hasDismissedNotice = Boolean(
      config.timezoneNoticeDismissed,
    );

    const currentDeviceTimeZone = getDeviceTimeZone();

    const deviceTimeZoneChanged = (
      config.timezoneSource !== 'user'
      && config.deviceTimeZone
      && config.deviceTimeZone !== currentDeviceTimeZone
    );

    const shouldShowInitialNotice = (
      !hasUserSelectedTimeZone
      && !hasDismissedNotice
    );

    if (
      shouldShowInitialNotice
      || deviceTimeZoneChanged
    ) {
      setSelectedTimeZone(
        isValidTimeZone(config.timezone)
          ? config.timezone
          : currentDeviceTimeZone,
      );

      setShowTimezoneNotice(true);
    }
  }, [config]);

  useEffect(() => {
    if (!draft) return;

    if (
      !draft.timezone
      || !isValidTimeZone(draft.timezone)
    ) {
      const currentDeviceTimeZone = getDeviceTimeZone();

      setDraft((current) => ({
        ...current,
        timezone: currentDeviceTimeZone,
        deviceTimeZone: currentDeviceTimeZone,
        timezoneSource: 'device',
      }));
    }
  }, [draft]);

  if (!draft) return null;

  const update = (patch) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const saveConfig = (patch = {}) => {
    const nextConfig = {
      ...draft,
      ...patch,
      deviceTimeZone: getDeviceTimeZone(),
      updatedAt: new Date().toISOString(),
    };

    setDraft(nextConfig);
    onSave(nextConfig);
  };

  const confirmDeviceTimeZone = () => {
    const currentDeviceTimeZone = getDeviceTimeZone();

    saveConfig({
      timezone: currentDeviceTimeZone,
      deviceTimeZone: currentDeviceTimeZone,
      timezoneSource: 'device-confirmed',
      timezoneNoticeDismissed: true,
      timezoneNoticeLastShownAt: new Date().toISOString(),
    });

    setShowTimezoneNotice(false);
  };

  const openTimezoneSelector = () => {
    setSelectedTimeZone(
      getInitialTimeZone(draft),
    );

    setShowTimezoneSelector(true);
  };

  const confirmSelectedTimeZone = () => {
    if (!isValidTimeZone(selectedTimeZone)) {
      return;
    }

    saveConfig({
      timezone: selectedTimeZone,
      deviceTimeZone: getDeviceTimeZone(),
      timezoneSource: 'user',
      timezoneNoticeDismissed: true,
      timezoneNoticeLastShownAt: new Date().toISOString(),
    });

    setShowTimezoneSelector(false);
    setShowTimezoneNotice(false);
  };

  const dismissTimezoneNotice = () => {
    saveConfig({
      timezone: getDeviceTimeZone(),
      deviceTimeZone: getDeviceTimeZone(),
      timezoneSource: 'device',
      timezoneNoticeDismissed: true,
      timezoneNoticeLastShownAt: new Date().toISOString(),
    });

    setShowTimezoneNotice(false);
  };

  const filteredTimeZones = supportedTimeZones.filter(
    (timeZone) => (
      timeZone
        .toLowerCase()
        .includes(timezoneSearch.trim().toLowerCase())
    ),
  );

  return (
    <>
      <section className="almanac-panel space-y-4">
        <div>
          <p className="almanac-eyebrow">Private settings</p>
          <h2 className="almanac-section-title">观察与问候</h2>
        </div>

        <div className="almanac-timezone-card">
          <div>
            <strong>相遇时间所在地</strong>

            <small>
              Almanac 会按照这个时区理解你们相遇的日期、早安和晚安时间。
            </small>
          </div>

          <div className="almanac-timezone-current">
            <span>
              {formatTimeZoneLabel(
                draft.timezone || deviceTimeZone,
              )}
            </span>

            <button
              type="button"
              className="almanac-secondary-button"
              onClick={openTimezoneSelector}
            >
              修改所在地
            </button>
          </div>

          {draft.timezoneSource !== 'user' && (
            <small className="almanac-timezone-hint">
              当前使用设备时区。如果你正在旅行，可以在这里确认或选择所在地。
            </small>
          )}

          {draft.timezoneSource === 'user' && (
            <small className="almanac-timezone-hint">
              当前使用你主动选择的所在地时间。
            </small>
          )}
        </div>

        <label className="almanac-toggle-row">
          <span>
            <strong>允许观察相遇节律</strong>
            <small>
              关闭后仍保留基础相遇记录，char 仍然可以逐渐熟悉你的相处节奏。
            </small>
          </span>

          <input
            type="checkbox"
            checked={Boolean(draft.rhythmInferenceEnabled)}
            onChange={(event) =>
              update({
                rhythmInferenceEnabled: event.target.checked,
              })
            }
          />
        </label>

        <div className="almanac-divider" />

        <label className="almanac-toggle-row">
          <span>
            <strong>早安问候</strong>
            <small>
              页面运行或恢复时，在你设定的时间之后尝试送来一声问候。
            </small>
          </span>

          <input
            type="checkbox"
            checked={Boolean(draft.morningGreetingEnabled)}
            onChange={(event) =>
              update({
                morningGreetingEnabled: event.target.checked,
              })
            }
          />
        </label>

        <input
          className="almanac-time-input"
          type="time"
          value={draft.morningGreetingTime || '08:30'}
          onChange={(event) =>
            update({
              morningGreetingTime: event.target.value,
            })
          }
          disabled={!draft.morningGreetingEnabled}
        />

        <label className="almanac-toggle-row">
          <span>
            <strong>晚安问候</strong>
            <small>
              页面运行或恢复时，在你设定的时间之后尝试送来一声晚安。
            </small>
          </span>

          <input
            type="checkbox"
            checked={Boolean(draft.nightGreetingEnabled)}
            onChange={(event) =>
              update({
                nightGreetingEnabled: event.target.checked,
              })
            }
          />
        </label>

        <input
          className="almanac-time-input"
          type="time"
          value={draft.nightGreetingTime || '23:30'}
          onChange={(event) =>
            update({
              nightGreetingTime: event.target.value,
            })
          }
          disabled={!draft.nightGreetingEnabled}
        />

        <label className="almanac-toggle-row">
          <span>
            <strong>今天已经相遇时，保留安静空间</strong>
            <small>
              如果你今天已经主动来聊天，char 会把这次相遇留给你，而不是再次打扰你。
            </small>
          </span>

          <input
            type="checkbox"
            checked={Boolean(draft.skipIfUserChattedToday)}
            onChange={(event) =>
              update({
                skipIfUserChattedToday: event.target.checked,
              })
            }
          />
        </label>

        <button
          type="button"
          className="almanac-primary-button"
          onClick={() => saveConfig()}
        >
          保存当前聊天设置
        </button>
      </section>

      {showTimezoneNotice && (
        <div
          className="almanac-modal-backdrop"
          role="presentation"
        >
          <div
            className="almanac-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="almanac-timezone-title"
          >
            <p className="almanac-eyebrow">Time zone</p>

            <h2
              id="almanac-timezone-title"
              className="almanac-section-title"
            >
              让相遇发生在你的时间里
            </h2>

            <p className="almanac-modal-description">
              Almanac 想按照你的所在地记录相遇时间。
              这样早安、晚安、热力图和纪念日会更贴近你的生活。
            </p>

            <div className="almanac-timezone-preview">
              <span>目前检测到的设备时区</span>
              <strong>{deviceTimeZone}</strong>
            </div>

            <p className="almanac-modal-description">
              如果你正在旅行，或者设备时区还没有跟随所在地变化，
              你可以在这里选择更适合你的时间。
            </p>

            <div className="almanac-modal-actions">
              <button
                type="button"
                className="almanac-primary-button"
                onClick={confirmDeviceTimeZone}
              >
                使用当前设备时区
              </button>

              <button
                type="button"
                className="almanac-secondary-button"
                onClick={openTimezoneSelector}
              >
                选择我的所在地
              </button>

              <button
                type="button"
                className="almanac-text-button"
                onClick={dismissTimezoneNotice}
              >
                稍后设置
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimezoneSelector && (
        <div
          className="almanac-modal-backdrop"
          role="presentation"
        >
          <div
            className="almanac-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="almanac-timezone-selector-title"
          >
            <p className="almanac-eyebrow">Your place</p>

            <h2
              id="almanac-timezone-selector-title"
              className="almanac-section-title"
            >
              选择你现在所在的时间
            </h2>

            <input
              type="search"
              className="almanac-timezone-search"
              placeholder="搜索城市或时区，例如 Shanghai"
              value={timezoneSearch}
              onChange={(event) =>
                setTimezoneSearch(event.target.value)
              }
            />

            <select
              className="almanac-timezone-select"
              value={selectedTimeZone}
              onChange={(event) =>
                setSelectedTimeZone(event.target.value)
              }
            >
              <option value="">
                请选择所在地时区
              </option>

              {filteredTimeZones.map((timeZone) => (
                <option
                  key={timeZone}
                  value={timeZone}
                >
                  {formatTimeZoneLabel(timeZone)}
                </option>
              ))}
            </select>

            <div className="almanac-modal-actions">
              <button
                type="button"
                className="almanac-primary-button"
                disabled={!isValidTimeZone(selectedTimeZone)}
                onClick={confirmSelectedTimeZone}
              >
                使用这个所在地
              </button>

              <button
                type="button"
                className="almanac-text-button"
                onClick={() => {
                  setShowTimezoneSelector(false);
                  setTimezoneSearch('');
                }}
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AlmanacSettingsPanel;

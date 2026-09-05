import React, { useEffect, useState } from 'react';

export const AlmanacSettingsPanel = ({
  config,
  onSave,
}) => {
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  if (!draft) return null;

  const update = (patch) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  return (
    <section className="almanac-panel space-y-4">
      <div>
        <p className="almanac-eyebrow">Private settings</p>
        <h2 className="almanac-section-title">观察与问候</h2>
      </div>

      <label className="almanac-toggle-row">
        <span>
          <strong>允许观察相遇节律</strong>
          <small>
            关闭后仍保留基础相遇记录，但不生成作息倾向。
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
          <small>页面运行或恢复时，在设定时间后尝试发送。</small>
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
          <small>不会承诺应用完全关闭时准点发送。</small>
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
          <strong>当天已经聊天时跳过问候</strong>
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
        onClick={() => onSave(draft)}
      >
        保存当前聊天设置
      </button>
    </section>
  );
};

export default AlmanacSettingsPanel;

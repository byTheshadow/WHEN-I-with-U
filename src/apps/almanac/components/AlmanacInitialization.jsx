import React, { useState } from 'react';

const INITIALIZATION_OPTIONS = [
  {
    value: 'milestones_only',
    title: '从今天重新开始，只保留纪念日',
    description:
      '过去不参与热力图、统计和作息观察，但可以留下第一次相遇日等重要日期。',
    needsDate: true,
  },
  {
    value: 'fresh_start',
    title: '从今天开始新的 Almanac',
    description:
      '不读取过去数据，也不保留过去纪念日。今天就是新的观察起点。',
    needsDate: false,
  },
  {
    value: 'all_history',
    title: '使用目前所有数据并开始分析',
    description:
      '保留现有相处记录，从已经发生的相处开始生成统计和观察。',
    needsDate: false,
  },
];

export const AlmanacInitialization = ({
  onComplete,
}) => {
  const [dataMode, setDataMode] = useState('');
  const [firstMeetingDate, setFirstMeetingDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedOption = INITIALIZATION_OPTIONS.find(
    (option) => option.value === dataMode
  );

  const submit = async () => {
    if (!dataMode || isSaving) {
      return;
    }

        if (!dataMode) {
      return;
    }

    setIsSaving(true);

    try {
      await onComplete({
        dataMode,
        firstMeetingDate:
          selectedOption?.needsDate
            ? firstMeetingDate
            : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="almanac-modal-backdrop"
      role="presentation"
    >
      <section
        className="almanac-modal almanac-initialization-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="almanac-initialization-title"
      >
        <p className="almanac-eyebrow">
          First entry
        </p>

        <h2
          id="almanac-initialization-title"
          className="almanac-section-title"
        >
          你想从哪里开始记录？
        </h2>

        <p className="almanac-modal-description">
          Almanac 不会修改聊天消息。这里选择的只是统计和观察的开始方式。
        </p>

        <div className="almanac-initialization-options">
          {INITIALIZATION_OPTIONS.map((option) => (
            <label
              className={
                `almanac-initialization-option ${
                  dataMode === option.value
                    ? 'selected'
                    : ''
                }`
              }
              key={option.value}
            >
              <input
                type="radio"
                name="almanac-data-mode"
                value={option.value}
                checked={dataMode === option.value}
                onChange={(event) => {
                  setDataMode(event.target.value);
                }}
              />

              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>

        {selectedOption?.needsDate && (
          <label className="almanac-initialization-date">
            <span>第一次相遇日</span>

            <input
              type="date"
              value={firstMeetingDate}
              onChange={(event) => {
                setFirstMeetingDate(event.target.value);
              }}
            />

            <small>
              如果暂时不想填写，也可以先返回，之后在设置中添加。
            </small>
          </label>
        )}

        <div className="almanac-modal-actions">
          <button
            type="button"
            className="almanac-primary-button"
                        disabled={!dataMode || isSaving}

            onClick={() => void submit()}
          >
            {isSaving ? '正在保存…' : '开始记录'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default AlmanacInitialization;

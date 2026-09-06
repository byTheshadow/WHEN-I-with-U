import React, {
  useEffect,
  useState,
} from 'react';

const EMPTY_FORM = {
  title: '',
  date: '',
  isRecurring: false,
  showCountdown: true,
  allowNaturalReminder: false,
};

export const AlmanacCountdownForm = ({
  milestone = null,
  onSubmit,
  onCancel,
}) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!milestone) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      title: milestone.title || '',
      date: milestone.date || '',
      isRecurring: Boolean(milestone.isRecurring),
      showCountdown: milestone.showCountdown !== false,
      allowNaturalReminder: Boolean(
        milestone.allowNaturalReminder,
      ),
    });
  }, [milestone]);

  const update = (patch) => {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      isSaving
      || !form.title.trim()
      || !form.date
    ) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        title: form.title.trim(),
        date: form.date,
        isRecurring: form.isRecurring,
        showCountdown: form.showCountdown,
        allowNaturalReminder: form.allowNaturalReminder,
      });

      if (!milestone) {
        setForm(EMPTY_FORM);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isSubmitDisabled = (
    isSaving
    || !form.title.trim()
    || !form.date
  );

  return (
    <form
      className="almanac-countdown-form"
      onSubmit={handleSubmit}
    >
      <div className="almanac-form-heading">
        <div>
          <p className="almanac-form-kicker">
            {milestone ? 'EDIT DATE' : 'NEW DATE'}
          </p>

          <h4 className="almanac-form-title">
            {milestone ? '编辑这个日期' : '留下一个日期'}
          </h4>
        </div>

        {milestone && (
          <span className="almanac-form-status">
            EDITING
          </span>
        )}
      </div>

      <div className="almanac-form-fields">
        <label className="almanac-form-field">
          <span className="almanac-form-label">
            标题
          </span>

          <input
            className="almanac-form-input"
            type="text"
            value={form.title}
            placeholder="例如：我的生日、旅行、见面"
            maxLength={80}
            onChange={(event) => {
              update({
                title: event.target.value,
              });
            }}
          />
        </label>

        <label className="almanac-form-field">
          <span className="almanac-form-label">
            日期
          </span>

          <input
            className="almanac-form-input almanac-date-input"
            type="date"
            value={form.date}
            onChange={(event) => {
              update({
                date: event.target.value,
              });
            }}
          />
        </label>
      </div>

      <div className="almanac-form-options">
        <label className="almanac-toggle-row almanac-form-toggle">
          <span>
            <strong>每年重复</strong>

            <small>
              适合生日、周年等每年都会到来的日期。
            </small>
          </span>

          <input
            type="checkbox"
            checked={form.isRecurring}
            onChange={(event) => {
              update({
                isRecurring: event.target.checked,
              });
            }}
          />
        </label>

        <label className="almanac-toggle-row almanac-form-toggle">
          <span>
            <strong>显示倒数</strong>

            <small>
              在纪念日区域显示距离下一次日期还有多少天。
            </small>
          </span>

          <input
            type="checkbox"
            checked={form.showCountdown}
            onChange={(event) => {
              update({
                showCountdown: event.target.checked,
              });
            }}
          />
        </label>

        <label className="almanac-toggle-row almanac-form-toggle">
          <span>
            <strong>允许自然提醒</strong>

            <small>
              允许 char 在接近日期时自然提及，不代表一定会主动打扰。
            </small>
          </span>

          <input
            type="checkbox"
            checked={form.allowNaturalReminder}
            onChange={(event) => {
              update({
                allowNaturalReminder: event.target.checked,
              });
            }}
          />
        </label>
      </div>

      <div className="almanac-form-actions">
        <button
          type="submit"
          className="almanac-primary-button almanac-form-submit"
          disabled={isSubmitDisabled}
        >
          {isSaving
            ? '正在保存…'
            : milestone
              ? '保存修改'
              : '添加日期'}
        </button>

        {milestone && (
          <button
            type="button"
            className="almanac-text-button almanac-form-cancel"
            onClick={onCancel}
          >
            取消编辑
          </button>
        )}
      </div>
    </form>
  );
};

export default AlmanacCountdownForm;

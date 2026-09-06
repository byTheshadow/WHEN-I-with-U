import React, { useEffect, useState } from 'react';

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
        milestone.allowNaturalReminder
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

  return (
    <form
      className="almanac-countdown-form"
      onSubmit={handleSubmit}
    >
      <label>
        <span>标题</span>

        <input
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

      <label>
        <span>日期</span>

        <input
          type="date"
          value={form.date}
          onChange={(event) => {
            update({
              date: event.target.value,
            });
          }}
        />
      </label>

      <label className="almanac-toggle-row">
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

      <label className="almanac-toggle-row">
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

      <label className="almanac-toggle-row">
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

      <div className="almanac-form-actions">
        <button
          type="submit"
          className="almanac-primary-button"
          disabled={
            isSaving
            || !form.title.trim()
            || !form.date
          }
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
            className="almanac-text-button"
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

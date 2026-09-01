// src/apps/margin-notes/MarginNotesSettingsModal.jsx

import React, { useState } from 'react';
import { Check, Globe, Sparkles, X } from 'lucide-react';

import db from '../../db';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', detail: '英语' },
  { code: 'ja', label: '日本語', detail: '日语' },
  { code: 'fr', label: 'Français', detail: '法语' },
  { code: 'de', label: 'Deutsch', detail: '德语' },
  { code: 'es', label: 'Español', detail: '西班牙语' },
  { code: 'it', label: 'Italiano', detail: '意大利语' },
  { code: 'ru', label: 'Русский', detail: '俄语' },
  { code: 'zh', label: '文言 / 古典中文', detail: '' }
];

export default function MarginNotesSettingsModal({
  currentSettings,
  onClose,
  onSave
}) {
  const [targetLang, setTargetLang] = useState(
    currentSettings?.targetLang || 'en'
  );

  const [auxLang, setAuxLang] = useState(
    currentSettings?.auxLang || '简体中文'
  );

  const [themePref, setThemePref] = useState(
    currentSettings?.themePref || '生活哲思与日常诗意'
  );

  const [customAuthorHint, setCustomAuthorHint] = useState(
    currentSettings?.customAuthorHint || ''
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);

    const newSettings = {
      targetLang,
      auxLang,
      themePref: themePref.trim(),
      customAuthorHint: customAuthorHint.trim()
    };

    try {
      await db.settings.put({
        key: 'margin_notes_settings',
        value: newSettings
      });

      onSave?.(newSettings);
      onClose?.();
    } catch (error) {
      console.error('保存页边注设置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="mn-settings-backdrop"
      onClick={onClose}
    >
      <section
        className="mn-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mn-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mn-settings__header">
          <div className="mn-settings__heading">
            <span className="mn-settings__icon">
              <Globe size={16} strokeWidth={1.5} />
            </span>

            <div>
              <span className="mn-settings__eyebrow">
                Reading preferences
              </span>

              <h2 id="mn-settings-title">
                共读设置
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="mn-settings__close"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X size={17} strokeWidth={1.5} />
          </button>
        </header>

        <div className="mn-settings__body">
          <fieldset className="mn-settings__field">
            <legend>目标共读语言</legend>

            <div className="mn-language-list">
              {LANGUAGE_OPTIONS.map((item) => {
                const isSelected = targetLang === item.code;

                return (
                  <button
                    key={item.code}
                    type="button"
                    className={`mn-language-option ${
                      isSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => setTargetLang(item.code)}
                    aria-pressed={isSelected}
                  >
                    <span>
                      <strong>{item.label}</strong>

                      {item.detail && (
                        <small>{item.detail}</small>
                      )}
                    </span>

                    {isSelected && (
                      <Check size={14} strokeWidth={1.8} />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mn-settings__field">
            <span>辅助说明语言</span>

            <input
              type="text"
              value={auxLang}
              onChange={(event) => setAuxLang(event.target.value)}
              placeholder="例如：简体中文"
            />
          </label>

          <label className="mn-settings__field">
            <span>选篇偏好方向</span>

            <input
              type="text"
              value={themePref}
              onChange={(event) => setThemePref(event.target.value)}
              placeholder="如：黄昏漫步、晨间静思、孤独与爱"
            />
          </label>

          <label className="mn-settings__field">
            <span>
              指定作者 / 名篇线索
              <em>选填</em>
            </span>

            <input
              type="text"
              value={customAuthorHint}
              onChange={(event) =>
                setCustomAuthorHint(event.target.value)
              }
              placeholder="如：Thoreau、Rilke、枕草子"
            />
          </label>
        </div>

        <footer className="mn-settings__footer">
          <button
            type="button"
            className="mn-settings__cancel"
            onClick={onClose}
          >
            取消
          </button>

          <button
            type="button"
            className="mn-settings__save"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Sparkles size={13} strokeWidth={1.5} />
            {isSaving ? '保存中…' : '应用设置'}
          </button>
        </footer>
      </section>
    </div>
  );
}

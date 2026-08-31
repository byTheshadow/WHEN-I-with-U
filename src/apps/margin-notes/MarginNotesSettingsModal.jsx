// src/apps/margin-notes/MarginNotesSettingsModal.jsx
import React, { useState } from 'react';
import { X, Check, Globe, Sparkles } from 'lucide-react';
import db from '../../db';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English (英语)' },
  { code: 'ja', label: '日本語 (日语)' },
  { code: 'fr', label: 'Français (法语)' },
  { code: 'de', label: 'Deutsch (德语)' },
  { code: 'es', label: 'Español (西班牙语)' },
  { code: 'it', label: 'Italiano (意大利语)' },
  { code: 'ru', label: 'Русский (俄语)' },
  { code: 'zh', label: '文言/古典中文' }
];

export default function MarginNotesSettingsModal({
  currentSettings,
  onClose,
  onSave
}) {
  const [targetLang, setTargetLang] = useState(currentSettings?.targetLang || 'en');
  const [auxLang, setAuxLang] = useState(currentSettings?.auxLang || '简体中文');
  const [themePref, setThemePref] = useState(currentSettings?.themePref || '生活哲思与日常诗意');
  const [customAuthorHint, setCustomAuthorHint] = useState(currentSettings?.customAuthorHint || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const newSettings = {
      targetLang,
      auxLang,
      themePref,
      customAuthorHint
    };

    try {
      await db.settings.put({
        key: 'margin_notes_settings',
        value: newSettings
      });
      onSave(newSettings);
      onClose();
    } catch (err) {
      console.error('保存页边注设置失败:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-2xl relative flex flex-col gap-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 opacity-70" />
            <h3 className="text-sm font-semibold tracking-wide">共读语种与偏好设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 目标语言 */}
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-medium text-[var(--text-muted)]">目标共读语言</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {LANGUAGE_OPTIONS.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setTargetLang(item.code)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  targetLang === item.code
                    ? 'font-bold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor:
                    targetLang === item.code ? 'var(--control-soft-bg)' : 'transparent',
                  border: '1px solid var(--card-border)'
                }}
              >
                <span>{item.label}</span>
                {targetLang === item.code && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>

        {/* 主题偏好 */}
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-medium text-[var(--text-muted)]">选篇偏好方向</label>
          <input
            type="text"
            value={themePref}
            onChange={(e) => setThemePref(e.target.value)}
            placeholder="如：黄昏漫步、晨间静思、孤独与爱..."
            className="w-full text-xs rounded-lg px-3 py-2 outline-none"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)'
            }}
          />
        </div>

        {/* 指定作者或作品线索 */}
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-medium text-[var(--text-muted)]">
            指定真实作者 / 名篇线索 (选填)
          </label>
          <input
            type="text"
            value={customAuthorHint}
            onChange={(e) => setCustomAuthorHint(e.target.value)}
            placeholder="如：Thoreau, Rilke, 枕草子..."
            className="w-full text-xs rounded-lg px-3 py-2 outline-none"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)'
            }}
          />
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: 'var(--text-main)',
              color: 'var(--bg-main)'
            }}
          >
            <Sparkles className="h-3 w-3" />
            {isSaving ? '保存中...' : '确认应用'}
          </button>
        </div>
      </div>
    </div>
  );
}

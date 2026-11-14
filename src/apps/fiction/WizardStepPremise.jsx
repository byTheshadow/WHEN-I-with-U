// src/apps/fiction/WizardStepPremise.jsx
//
// 向导第 1 步：故事基础。存档名、形式、背景、大纲、文风。
// 文风 = 预设（单选，可取消）+ 自己描述（可手写，也可从 .txt / .md 文件读入）。

import React, { useRef, useState } from 'react';
import { FileText } from 'lucide-react';

import { FICTION_MODES } from './fictionService';
import {
  FICTION_STYLE_PRESETS,
  STYLE_CUSTOM_MAX,
  TEXT_FIELD_MAX,
} from './fictionWizardService';

const MODE_OPTIONS = [
  { id: FICTION_MODES.CHOICE, no: 'i.', name: '选择式文游', desc: '每段给出选项，也能自己写' },
  { id: FICTION_MODES.NOVEL, no: 'ii.', name: '纯小说式', desc: '没有选项，像读书一样往下读' },
];

const MAX_IMPORT_BYTES = 200 * 1024;

const countChars = (text) => Array.from(String(text || '')).length;

const FieldLabel = ({ children, required = false }) => (
  <div className="fic-w-label-row">
    <span className="fic-w-label">{children}</span>
    <span className={`fic-w-tag ${required ? 'is-req' : ''}`}>{required ? '必填' : '可留空'}</span>
  </div>
);

const WizardStepPremise = ({ form, onChange, onToast, lockMode = false }) => {
  const [customOpen, setCustomOpen] = useState(Boolean(form.style?.custom));
  const fileInputRef = useRef(null);

  const style = form.style || { presetId: '', custom: '' };

  const patchStyle = (patch) => onChange({ style: { ...style, ...patch } });

  const handleFile = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      onToast?.('文件太大了，请控制在 200KB 以内');
      return;
    }

    try {
      const raw = (await file.text()).replace(/\r\n/g, '\n').trim();

      if (!raw) {
        onToast?.('文件里没有读到文字');
        return;
      }

      const current = String(style.custom || '').trim();
      const merged = current ? `${current}\n\n${raw}` : raw;
      const clipped = merged.slice(0, STYLE_CUSTOM_MAX);

      patchStyle({ custom: clipped });
      setCustomOpen(true);
      onToast?.(
        merged.length > STYLE_CUSTOM_MAX
          ? `内容较长，已截取前 ${STYLE_CUSTOM_MAX} 字`
          : '已追加到文风描述',
      );
    } catch (error) {
      console.warn('[Fiction] 读取文风文件失败：', error);
      onToast?.('读取文件失败，请换个文件试试');
    }
  };

  return (
    <div className="fic-w-body">
      <section className="fic-w-field">
        <FieldLabel required>存档名</FieldLabel>
        <input
          type="text"
          className="fic-w-input"
          value={form.title}
          maxLength={30}
          placeholder="给这个故事起个名字"
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </section>

      <section className="fic-w-field">
        <FieldLabel required>形式</FieldLabel>
        {lockMode && (
          <p className="fic-w-mode-lock">已经开始的存档不能改形式，其他设定都可以改。</p>
        )}
        <div className="fic-w-modes" role="radiogroup" aria-label="故事形式">
          {MODE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={form.mode === item.id}
              aria-disabled={lockMode || undefined}
              disabled={lockMode}
              className={`fic-btn-reset fic-w-mode ${form.mode === item.id ? 'is-on' : ''} ${lockMode ? 'is-locked' : ''}`}
              onClick={() => { if (!lockMode) onChange({ mode: item.id }); }}
            >
              <span className="fic-w-mode-no">{item.no}</span>
              <span className="fic-w-mode-text">
                <span className="fic-w-mode-name">{item.name}</span>
                <span className="fic-w-mode-desc">{item.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="fic-w-field">
        <FieldLabel required>背景</FieldLabel>
        <textarea
          className="fic-w-textarea"
          rows={6}
          value={form.background}
          maxLength={TEXT_FIELD_MAX}
          placeholder="故事发生在哪里、什么时候、开场是什么样子。写几句就行。"
          onChange={(event) => onChange({ background: event.target.value })}
        />
        <div className="fic-w-meta">
          <span />
          <span>{countChars(form.background)} 字</span>
        </div>
      </section>

      <section className="fic-w-field">
        <FieldLabel>大纲</FieldLabel>
        <textarea
          className="fic-w-textarea"
          rows={4}
          value={form.outline}
          maxLength={TEXT_FIELD_MAX}
          placeholder="想让故事往哪里走，可以写在这里。"
          onChange={(event) => onChange({ outline: event.target.value })}
        />
        <div className="fic-w-meta">
          <span>留空的话，AI 会完全自由地发展。</span>
          <span>{countChars(form.outline)} 字</span>
        </div>
      </section>

      <section className="fic-w-field">
        <FieldLabel>文风</FieldLabel>
        <div className="fic-w-chips">
          {FICTION_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={style.presetId === preset.id}
              className={`fic-btn-reset fic-w-chip ${style.presetId === preset.id ? 'is-on' : ''}`}
              onClick={() => patchStyle({ presetId: style.presetId === preset.id ? '' : preset.id })}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={customOpen}
            className={`fic-btn-reset fic-w-chip is-dashed ${customOpen ? 'is-on' : ''}`}
            onClick={() => setCustomOpen((open) => !open)}
          >
            + 自己描述
          </button>
        </div>

        {customOpen && (
          <div className="fic-w-custom">
            <textarea
              className="fic-w-textarea"
              rows={5}
              value={style.custom}
              maxLength={STYLE_CUSTOM_MAX}
              placeholder="用你自己的话描述想要的文风，比如语气、节奏、常用的修辞，也可以贴一段范文。"
              onChange={(event) => patchStyle({ custom: event.target.value })}
            />
            <div className="fic-w-meta">
              <span>和上面的预设可以同时用。</span>
              <span>{countChars(style.custom)} / {STYLE_CUSTOM_MAX}</span>
            </div>
            <button
              type="button"
              className="fic-btn-reset fic-w-file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={16} strokeWidth={1.6} aria-hidden="true" />
              从文件导入（.txt / .md）
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              hidden
              onChange={handleFile}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default WizardStepPremise;
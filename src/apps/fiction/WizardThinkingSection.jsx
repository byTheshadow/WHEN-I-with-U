// src/apps/fiction/WizardThinkingSection.jsx
//
// 向导「规则与数值」步骤里的「思维链」区块（放在「文生图」上面）。
//   - 开关：这份存档每次生成前，是否让模型先按思考预设想一遍再写正文
//   - 打开后出现：正在用的思考预设（点开可以换预设、新建、编辑）、
//     输出上限（max tokens，用户自己定）
// 写回表单的字段：thinkingChain / thinkingPresetId / thinkingMaxTokens。

import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import ThinkingPresetSheet from './ThinkingPresetSheet';
import { EMPTY_THINKING_LIBRARY, loadThinkingLibrary } from './fictionThinkingLibrary';
import {
  THINKING_MAX_TOKENS,
  THINKING_MAX_TOKENS_CHOICES,
  clampThinkingMaxTokens,
  pickThinkingEntries,
  resolveThinkingPreset,
} from './fictionThinkingPresets';
import './fictionThinking.css';
import './fictionThinkingEditor.css';

const WizardThinkingSection = ({ form, onChange }) => {
  const enabled = Boolean(form.thinkingChain);
  const maxTokens = clampThinkingMaxTokens(form.thinkingMaxTokens);
  const [draft, setDraft] = useState(String(maxTokens));
  const [library, setLibrary] = useState(EMPTY_THINKING_LIBRARY);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 读取用户自己的预设库（读不到就当没有，只用内置默认预设）。
  useEffect(() => {
    let alive = true;

    loadThinkingLibrary().then((next) => {
      if (alive) setLibrary(next);
    });

    return () => {
      alive = false;
    };
  }, []);

  // 点了下面的快捷数字、或者载入了别的存档时，输入框跟着变。
  useEffect(() => {
    setDraft(String(maxTokens));
  }, [maxTokens]);

  // 存档选的预设被删了（或还没选过）时，会解析到内置默认预设。
  const preset = resolveThinkingPreset(library, form.thinkingPresetId);
  const entries = pickThinkingEntries(preset, form.mode);

  const commitDraft = () => {
    const next = clampThinkingMaxTokens(draft);

    setDraft(String(next));
    if (next !== form.thinkingMaxTokens) onChange({ thinkingMaxTokens: next });
  };

  return (
    <section className="fic-w-field">
      <div className="fic-w-label-row">
        <span className="fic-w-label">思维链</span>
        <span className="fic-w-tag">先想后写</span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className="fic-btn-reset fic-w-switch-row"
        onClick={() => onChange({ thinkingChain: !enabled })}
      >
        <span className="fic-w-switch-text">
          <span className="fic-w-switch-label">写正文前先思考</span>
          <span className="fic-w-switch-hint">按思考预设逐条想完再动笔，思考过程折叠在每段正文上方</span>
        </span>
        <span className={`fic-w-switch ${enabled ? 'is-on' : ''}`} aria-hidden="true" />
      </button>

      {enabled && (
        <div className="fic-w-think-more">
          <button type="button" className="fic-btn-reset fic-th-entry" onClick={() => setSheetOpen(true)}>
            <span className="fic-w-pick-text">
              <span className="fic-w-pick-name">{preset.name}</span>
              <span className="fic-w-pick-sub">
                {entries.length} 个条目 · {entries.map((entry) => entry.title).join(' · ')}
              </span>
            </span>
            <ChevronRight size={18} className="fic-th-chev" aria-hidden="true" />
          </button>

          <div className="fic-w-think-sub">输出上限（max tokens）</div>
          <input
            type="number"
            inputMode="numeric"
            className="fic-w-input fic-w-think-number"
            aria-label="输出上限"
            min={THINKING_MAX_TOKENS.min}
            max={THINKING_MAX_TOKENS.max}
            step={1000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
          />
          <div className="fic-w-chips">
            {THINKING_MAX_TOKENS_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={maxTokens === value}
                className={`fic-btn-reset fic-w-chip ${maxTokens === value ? 'is-on' : ''}`}
                onClick={() => onChange({ thinkingMaxTokens: value })}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="fic-w-hint">
            思考和正文共用这个额度，思考不限篇幅，所以要给得宽一些。生成时如果报错说超出模型上限，把它调小；如果正文被截断，把它调大。
          </div>
        </div>
      )}

      <div className="fic-w-hint">
        思考内容只存下来给你看，不会带进下一次的上下文。每次生成会更慢，也更费额度。
      </div>

      {sheetOpen && (
        <ThinkingPresetSheet
          library={library}
          selectedId={form.thinkingPresetId}
          onSelect={(id) => onChange({ thinkingPresetId: id })}
          onLibraryChange={setLibrary}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </section>
  );
};

export default WizardThinkingSection;
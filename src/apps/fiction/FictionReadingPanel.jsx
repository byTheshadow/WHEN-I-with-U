// src/apps/fiction/FictionReadingPanel.jsx
//
// 阅读设置抽屉：字号、行距、阅读主题、引号高亮。
// 改动马上生效（正文就在抽屉上面，能直接看到），所以遮罩是透明的，
// 点抽屉外面或「完成」都是关闭。设置全局一份，保存在 useFictionReadingPrefs 里。

import React from 'react';

import {
  FONT_SIZE_RANGE,
  LINE_HEIGHT_OPTIONS,
  READING_THEMES,
} from './fictionReadingThemes';
import FictionBackgroundSection from './FictionBackgroundSection';

const swatchBackground = (theme) => (
  `radial-gradient(60% 60% at 18% 22%, ${theme.blobs[0]} 0%, transparent 72%), `
  + `radial-gradient(58% 58% at 86% 40%, ${theme.blobs[1]} 0%, transparent 72%), `
  + `radial-gradient(60% 60% at 34% 100%, ${theme.blobs[2]} 0%, transparent 72%), `
  + `${theme.paper}`
);

const nearestLineHeight = (value) => (
  LINE_HEIGHT_OPTIONS.reduce((best, option) => (
    Math.abs(option.value - value) < Math.abs(best.value - value) ? option : best
  ), LINE_HEIGHT_OPTIONS[0])
);

const FictionReadingPanel = ({ prefs, onChange, onClose, bgControls }) => {
  const activeLineHeight = nearestLineHeight(prefs.lineHeight).id;

  const stepSize = (direction) => {
    onChange({ fontSize: prefs.fontSize + direction * FONT_SIZE_RANGE.step });
  };

  return (
    <>
      <button
        type="button"
        className="fic-btn-reset fic-mask is-clear"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="fic-sheet fic-read-panel" role="dialog" aria-label="阅读设置">
        <div className="fic-sheet-grab" />
        <div className="fic-sheet-name">阅读设置</div>
        <div className="fic-sheet-meta">改动马上生效，所有存档通用</div>

        <div className="fic-read-row">
          <div className="fic-read-label">
            <span>字号</span>
            <span className="fic-read-value">{prefs.fontSize}</span>
          </div>
          <div className="fic-read-size">
            <button
              type="button"
              className="fic-btn-reset fic-read-step"
              aria-label="字号减小"
              disabled={prefs.fontSize <= FONT_SIZE_RANGE.min}
              onClick={() => stepSize(-1)}
            >
              A
            </button>
            <input
              type="range"
              className="fic-read-range"
              aria-label="字号"
              min={FONT_SIZE_RANGE.min}
              max={FONT_SIZE_RANGE.max}
              step={FONT_SIZE_RANGE.step}
              value={prefs.fontSize}
              onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
            />
            <button
              type="button"
              className="fic-btn-reset fic-read-step is-large"
              aria-label="字号增大"
              disabled={prefs.fontSize >= FONT_SIZE_RANGE.max}
              onClick={() => stepSize(1)}
            >
              A
            </button>
          </div>
        </div>

        <div className="fic-read-row">
          <div className="fic-read-label"><span>行距</span></div>
          <div className="fic-read-seg-group" role="group" aria-label="行距">
            {LINE_HEIGHT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`fic-btn-reset fic-read-seg ${activeLineHeight === option.id ? 'is-on' : ''}`}
                aria-pressed={activeLineHeight === option.id}
                onClick={() => onChange({ lineHeight: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fic-read-row">
          <div className="fic-read-label"><span>阅读主题</span></div>
          <div className="fic-read-swatches is-scroll" role="group" aria-label="阅读主题">
            {READING_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`fic-btn-reset fic-read-swatch ${prefs.themeId === theme.id ? 'is-on' : ''}`}
                aria-pressed={prefs.themeId === theme.id}
                onClick={() => onChange({ themeId: theme.id })}
              >
                <span className="fic-read-swatch-chip" style={{ background: swatchBackground(theme) }} />
                <span className="fic-read-swatch-name">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="fic-read-row is-inline">
          <div className="fic-read-label"><span>动态效果（雨夜、星空）</span></div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.motion}
            aria-label="动态效果"
            className={`fic-btn-reset fic-read-switch ${prefs.motion ? 'is-on' : ''}`}
            onClick={() => onChange({ motion: !prefs.motion })}
          />
        </div>

        <div className="fic-read-row is-inline">
          <div className="fic-read-label"><span>高亮引号里的话</span></div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.highlightQuotes}
            aria-label="高亮引号里的话"
            className={`fic-btn-reset fic-read-switch ${prefs.highlightQuotes ? 'is-on' : ''}`}
            onClick={() => onChange({ highlightQuotes: !prefs.highlightQuotes })}
          />
        </div>

        <FictionBackgroundSection controls={bgControls} />

        <div className="fic-sheet-actions">
          <button type="button" className="fic-btn-reset fic-sheet-btn fic-read-done" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </>
  );
};

export default FictionReadingPanel;
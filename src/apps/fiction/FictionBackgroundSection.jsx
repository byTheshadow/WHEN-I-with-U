// src/apps/fiction/FictionBackgroundSection.jsx
//
// 阅读设置抽屉里的「本存档背景图」一块：选图 / 更换 / 移除，以及压暗和模糊两个滑块。
// 背景图只属于当前存档，和抽屉里其他全局的阅读设置不同。数据都来自 useFictionBackground。

import React from 'react';

import { BG_BLUR_RANGE, BG_DIM_RANGE } from './fictionBackground';

const FictionBackgroundSection = ({ controls }) => {
  if (!controls) return null;

  const { background, busy, error, pickImage, update, remove } = controls;

  const handleFile = (event) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (file) void pickImage(file);
  };

  const pickLabel = busy ? '处理中' : (background ? '更换图片' : '选择图片');

  return (
    <>
      <div className="fic-read-row">
        <div className="fic-read-label">
          <span>背景图</span>
          <span className="fic-read-value">仅这个存档</span>
        </div>

        <div className="fic-read-btn-row">
          <label className={`fic-read-seg fic-bg-pick ${busy ? 'is-busy' : ''}`}>
            {pickLabel}
            <input type="file" accept="image/*" disabled={busy} onChange={handleFile} />
          </label>

          {background && (
            <button
              type="button"
              className="fic-btn-reset fic-read-seg"
              disabled={busy}
              onClick={() => { void remove(); }}
            >
              移除
            </button>
          )}
        </div>

        {error && <div className="fic-bg-error" role="alert">{error}</div>}
      </div>

      {background && (
        <>
          <div className="fic-read-row">
            <div className="fic-read-label">
              <span>压暗</span>
              <span className="fic-read-value">{background.dim}%</span>
            </div>
            <div className="fic-read-size">
              <input
                type="range"
                className="fic-read-range"
                aria-label="背景图压暗"
                min={BG_DIM_RANGE.min}
                max={BG_DIM_RANGE.max}
                step={BG_DIM_RANGE.step}
                value={background.dim}
                onChange={(event) => update({ dim: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="fic-read-row">
            <div className="fic-read-label">
              <span>模糊</span>
              <span className="fic-read-value">{background.blur}px</span>
            </div>
            <div className="fic-read-size">
              <input
                type="range"
                className="fic-read-range"
                aria-label="背景图模糊"
                min={BG_BLUR_RANGE.min}
                max={BG_BLUR_RANGE.max}
                step={BG_BLUR_RANGE.step}
                value={background.blur}
                onChange={(event) => update({ blur: Number(event.target.value) })}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default FictionBackgroundSection;
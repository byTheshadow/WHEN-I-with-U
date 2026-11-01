// src/apps/layoutstudio/LayoutTemplateSheet.jsx
//
// "我自己选"：从底部升起的模板选择面板。每个模板一行：真实渲染的小预览 +
// 一句话介绍 + 适合什么图。点一行就用这个模板出图。

import React, { useMemo } from 'react';

import LayoutMiniPreview from './LayoutMiniPreview';
import { createDefaultSpec } from './layoutSpec';
import { TEMPLATES } from './templates';

const LayoutTemplateSheet = ({ open, photos, onClose, onPick }) => {
  const previews = useMemo(
    () =>
      TEMPLATES.map((tpl) => ({
        tpl,
        spec: createDefaultSpec(tpl.id, { photoCount: photos.length, seed: 7 }),
      })),
    [photos]
  );

  return (
    <>
      <div
        className={`ls-sbg${open ? ' ls-on' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`ls-sheet${open ? ' ls-on' : ''}`} role="dialog" aria-label="挑一个模板">
        <div className="ls-grab" />
        <h3>挑一个模板</h3>
        <p className="ls-s">出图后，文字和位置都还能再改。</p>
        {previews.map(({ tpl, spec }) => (
          <button
            key={tpl.id}
            type="button"
            className="ls-opt"
            onClick={() => onPick(tpl.id)}
          >
            <LayoutMiniPreview photos={photos} spec={spec} active={open} />
            <span className="ls-opt-text">
              <b>{tpl.label}</b>
              <small>{tpl.desc}</small>
              <em>{tpl.fits}</em>
            </span>
          </button>
        ))}
      </div>
    </>
  );
};

export default LayoutTemplateSheet;
// src/apps/layoutstudio/LayoutSheet.jsx
//
// 通用的底部升起面板（带遮罩）。样式沿用 LayoutTemplateSheet 的 ls-sbg / ls-sheet。
// 相机版里用来放"视觉模型说明"和"改字和排布"。

import React from 'react';

const LayoutSheet = ({ open, title, sub, onClose, children }) => (
  <>
    <div className={`ls-sbg${open ? ' ls-on' : ''}`} onClick={onClose} aria-hidden="true" />
    <div className={`ls-sheet${open ? ' ls-on' : ''}`} role="dialog" aria-label={title}>
      <div className="ls-grab" />
      <h3>{title}</h3>
      {sub ? <p className="ls-s">{sub}</p> : null}
      {children}
    </div>
  </>
);

export default LayoutSheet;

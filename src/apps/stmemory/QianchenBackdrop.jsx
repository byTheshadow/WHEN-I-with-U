// src/apps/stmemory/QianchenBackdrop.jsx
//
// 前尘页面的外壳：渐变底色、四团缓慢漂移的光、斜光束、裂纹与细雪、四周压暗。
// 内容放进 children，会在固定的背景之上滚动。
//
// 只有 transform 漂移是持续动画；没有 canvas / WebGL / rAF / backdrop-filter。
import React from 'react';

import './qianchen.css';
import { SnowflakeDefs } from './Snowflake';
import { useQianchenTheme } from './qianchenTheme';

const QianchenBackdrop = ({ children, label }) => {
  const themeClass = useQianchenTheme();

  return (
    <div className={`qc ${themeClass}`} role="region" aria-label={label}>
      <div className="qc-bg" aria-hidden="true">
        <div className="haze"><i className="h1" /><i className="h2" /><i className="h3" /><i className="h4" /></div>
        <div className="shaft" /><div className="shaft b" />

        <svg
          className="layer"
          viewBox="0 0 390 844"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: 'var(--crack)' }}
        >
          <path d="M-6 330 L52 346 L96 338 L150 364 L168 398" strokeOpacity=".36" strokeWidth=".9" />
          <path d="M396 210 L338 240 L312 286 L264 304 L240 352" strokeOpacity=".34" strokeWidth=".9" />
          <path d="M312 286 L346 328 L330 372" strokeOpacity=".2" strokeWidth=".7" />
          <path d="M-6 640 L40 618 L84 632 L132 606" strokeOpacity=".26" strokeWidth=".8" />
          <path d="M396 640 L350 662 L318 640 L276 666" strokeOpacity=".24" strokeWidth=".8" />
        </svg>
        <svg
          className="layer"
          viewBox="0 0 390 844"
          preserveAspectRatio="xMidYMid slice"
          style={{ fill: 'var(--crack)' }}
        >
          <circle cx="60" cy="300" r="1.8" fillOpacity=".8" />
          <circle cx="330" cy="420" r="1.4" fillOpacity=".7" />
          <circle cx="40" cy="480" r="1.4" fillOpacity=".7" />
          <circle cx="352" cy="520" r="2.2" fillOpacity=".5" />
          <circle cx="260" cy="210" r="1.5" fillOpacity=".7" />
          <circle cx="120" cy="190" r="1.2" fillOpacity=".6" />
          <circle cx="300" cy="640" r="1.6" fillOpacity=".5" />
          <circle cx="90" cy="690" r="1.3" fillOpacity=".5" />
        </svg>
        <div className="edge" />
      </div>

      <SnowflakeDefs />
      {children}
    </div>
  );
};

export default QianchenBackdrop;

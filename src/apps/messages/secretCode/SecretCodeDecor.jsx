// src/apps/messages/secretCode/SecretCodeDecor.jsx
//
// 悄悄话词典里用到的几个手账小零件（长尾夹、回形针、NEW 星标）和两个
// 共用的小函数。只有展示，没有状态，样式在 secretCode.css 里。
import React from 'react';

export const padTwo = (n) => (n < 10 ? `0${n}` : String(n));

// 文件夹和小签各自轻微歪斜，按序号循环取
export const FOLDER_TILTS = [-1.6, 1.2, -0.9, 1.5, -1.1, 0.8];
export const SLIP_TILTS = [-1.2, 0.9, -0.6, 1.1, -0.4, 0.7];

// 黑色大长尾夹
export const BigClip = () => (
  <svg className="sc-clip" viewBox="0 0 40 56" aria-hidden="true">
    <path d="M8 24h24l-3 22a6 6 0 0 1-6 5h-6a6 6 0 0 1-6-5z" fill="var(--ink-b)" />
    <path
      d="M12 24V12a8 8 0 0 1 16 0v12"
      fill="none"
      stroke="var(--sc-sub)"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

// 夹在写字小签上的回形针
export const PaperClip = () => (
  <svg
    className="sc-pclip"
    style={{ top: -12, left: 16 }}
    viewBox="0 0 24 56"
    fill="none"
    stroke="var(--sc-sub)"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 50V12a6 6 0 0 1 12 0v30a3.5 3.5 0 0 1-7 0V16" />
  </svg>
);

const burstPath = (points) => {
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 ? 38 : 50;
    const angle = (Math.PI * i) / points;
    pts.push(
      `${(50 + radius * Math.sin(angle)).toFixed(1)}% ${(50 - radius * Math.cos(angle)).toFixed(1)}%`
    );
  }
  return `polygon(${pts.join(',')})`;
};

const BURST_CLIP = burstPath(10);

// 新写的小签角上的 NEW 星标，自己淡出（动画在 css 里）
export const NewBurst = () => (
  <span
    className="sc-burst"
    style={{ top: -12, right: -8, clipPath: BURST_CLIP }}
    aria-hidden="true"
  >
    NEW
  </span>
);

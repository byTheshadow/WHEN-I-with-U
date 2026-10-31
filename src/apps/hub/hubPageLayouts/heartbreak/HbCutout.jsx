// src/apps/hub/hubPageLayouts/heartbreak/HbCutout.jsx
//
// 人物抠图占位：白色描边的剪影加斜线填充，和预览里一致。后续片里
// 会换成角色头像加贴纸描边。三种剪影用 variant 0/1/2 选。

import React, { useId } from 'react';

const SHAPES = [
  <>
    <circle cx="50" cy="30" r="17" />
    <path d="M20 130 C 14 98, 24 62, 50 55 C 76 62, 88 98, 82 130 Z" />
    <path d="M28 76 C 10 88, 12 112, 30 114 L 38 96 Z" />
  </>,
  <>
    <circle cx="46" cy="33" r="18" />
    <path d="M12 130 C 16 100, 22 66, 46 58 C 72 62, 92 90, 88 130 Z" />
    <path d="M68 66 C 92 62, 98 40, 82 30 L 72 50 Z" />
  </>,
  <>
    <circle cx="54" cy="28" r="16" />
    <path d="M24 130 C 26 104, 30 64, 54 52 C 78 62, 80 100, 78 130 Z" />
    <path d="M74 70 C 90 80, 92 100, 80 106 L 72 90 Z" />
  </>,
];

export const HbCutout = ({ label = '人物抠图占位', variant = 0 }) => {
  const rawId = useId();
  const patternId = `hb-hatch-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const shape = SHAPES[variant % SHAPES.length];

  return (
    <div className="hb-cutwrap">
      <svg className="hb-cut" viewBox="-8 -8 116 146" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="hb-cut-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="hb-cut-hatch" />
          </pattern>
        </defs>
        <g className="hb-cut-edge">{shape}</g>
        <g fill={`url(#${patternId})`}>{shape}</g>
      </svg>
      <span className="hb-ph-tag">{label}</span>
    </div>
  );
};

export default HbCutout;
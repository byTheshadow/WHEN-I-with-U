// src/apps/focus/GrowthIcon.jsx
//
// 成长图标。SVG 字符串全部来自 focusGrowthIcons.js，不含用户输入，可以安全地直接放进去。
// 同样的参数只生成一次，避免每秒重绘时重复创建渐变。

import React, { useMemo } from 'react';
import { renderGrowthSvg } from './focusGrowthIcons';

const GrowthIcon = ({ style, stage, withered = false, className = '' }) => {
  const html = useMemo(() => renderGrowthSvg(style, stage, withered), [style, stage, withered]);

  return (
    <span
      className={`focus-gicon ${className}`.trim()}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default GrowthIcon;

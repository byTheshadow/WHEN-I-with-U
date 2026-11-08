// src/apps/stmemory/qianchenTheme.js
//
// 前尘页面的配色。跟随 app 的全局主题（<html data-theme>）：
//   mono-mist     -> mono（白黑）
//   cream-latte   -> cream
//   obsidian-dark -> dark
//   cyber-velvet  -> velvet
//   其他（含 rose-quartz） -> ice（前尘默认）
import { useEffect, useState } from 'react';

const THEME_MAP = {
  'mono-mist': 'mono',
  'cream-latte': 'cream',
  'obsidian-dark': 'dark',
  'cyber-velvet': 'velvet',
};

const readTheme = () => {
  if (typeof document === 'undefined') return 'ice';
  return THEME_MAP[document.documentElement.getAttribute('data-theme')] || 'ice';
};

export const useQianchenTheme = () => {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    setTheme(readTheme());
    return () => observer.disconnect();
  }, []);

  return `t-${theme}`;
};

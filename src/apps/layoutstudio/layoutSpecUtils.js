// src/apps/layoutstudio/layoutSpecUtils.js
//
// 版面清单（spec）里各字段的清洗小工具。纯函数，不依赖模板注册表，
// 所以模板文件和 layoutSpec.js 都可以安全 import，不会产生循环依赖。

import { MAX_TEXT_LENGTH } from './layoutConstants';
import { clamp } from './layoutDraw';

export const toNumber = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
};

export const toInt = (value, fallback, min, max) =>
  Math.round(toNumber(value, fallback, min, max));

export const toColor = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : fallback;
};

export const toChoice = (value, options, fallback) =>
  options.includes(value) ? value : fallback;

// 文字：去掉不可见控制字符（保留换行），截断长度。
export const toText = (value, fallback = '') => {
  const raw = value === undefined || value === null ? fallback : String(value);
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    const isControl = code < 32 && code !== 10;
    if (!isControl) out += ch;
    if ([...out].length >= MAX_TEXT_LENGTH) break;
  }
  return out;
};

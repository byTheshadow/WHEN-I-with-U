// src/services/accessibilityService.js
//
// 无障碍（低视力）设置：文字大小、更明显的焦点框。
//
// 存储：db.settings 里一条普通键值记录（key = 'accessibilitySettings'），
// 不需要新表、不需要升级数据库版本。
//
// 生效方式：只在 <html> 上挂 / 摘属性和一个 CSS 变量，真正的样式全部在
// src/styles/accessibility.css 里（按属性选择器生效）。默认设置下不会挂
// 任何属性，所以没开启时整个应用的外观与改动前完全一致。
//
// 本文件在被导入时就会自行初始化（和 cloudPushService.js 同样的做法），
// 由 main.jsx 导入一次即可，不需要在 App.jsx 里调用。为了避免页面先按
// 默认字号画一帧再跳大，会先同步读 localStorage 里的一份缓存立刻应用，
// 再异步读 db.settings 校正；以 db.settings 为准。

import db from '../db';

export const ACCESSIBILITY_SETTINGS_KEY = 'accessibilitySettings';

const CACHE_KEY = 'a11y_settings_cache';

export const FONT_SCALE_OPTIONS = [
  { id: 'standard', scale: 1, label: '标准', hint: '100%' },
  { id: 'large', scale: 1.25, label: '大', hint: '125%' },
  { id: 'xlarge', scale: 1.5, label: '特大', hint: '150%' },
  { id: 'xxlarge', scale: 2, label: '超大', hint: '200%' },
];

export const DEFAULT_ACCESSIBILITY_SETTINGS = {
  fontScale: 1,
  focusRing: false,
};

const ALLOWED_SCALES = FONT_SCALE_OPTIONS.map((option) => option.scale);

export const normalizeAccessibilitySettings = (raw) => {
  const fontScale = Number(raw?.fontScale);

  return {
    fontScale: ALLOWED_SCALES.includes(fontScale)
      ? fontScale
      : DEFAULT_ACCESSIBILITY_SETTINGS.fontScale,
    focusRing: raw?.focusRing === true,
  };
};

export const applyAccessibilitySettings = (settings) => {
  if (typeof document === 'undefined') return;

  const next = normalizeAccessibilitySettings(settings);
  const root = document.documentElement;

  if (next.fontScale > 1) {
    root.setAttribute('data-a11y-font-scale', String(next.fontScale));
    root.style.setProperty('--a11y-fs', String(next.fontScale));
  } else {
    root.removeAttribute('data-a11y-font-scale');
    root.style.removeProperty('--a11y-fs');
  }

  if (next.focusRing) {
    root.setAttribute('data-a11y-focus-ring', 'on');
  } else {
    root.removeAttribute('data-a11y-focus-ring');
  }
};

const readCache = () => {
  try {
    const text = window.localStorage.getItem(CACHE_KEY);
    return text
      ? normalizeAccessibilitySettings(JSON.parse(text))
      : DEFAULT_ACCESSIBILITY_SETTINGS;
  } catch {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }
};

const writeCache = (settings) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // 缓存只是为了少闪一下，写不进去不影响功能。
  }
};

export const loadAccessibilitySettings = async () => {
  const row = await db.settings.get(ACCESSIBILITY_SETTINGS_KEY);
  return normalizeAccessibilitySettings(row?.value);
};

// 保存并立刻应用。设置面板里点一下就生效，不依赖设置页底部的保存按钮。
export const saveAccessibilitySettings = async (settings) => {
  const next = normalizeAccessibilitySettings(settings);

  await db.settings.put({
    key: ACCESSIBILITY_SETTINGS_KEY,
    value: next,
  });

  writeCache(next);
  applyAccessibilitySettings(next);

  return next;
};

const bootstrapAccessibilitySettings = () => {
  applyAccessibilitySettings(readCache());

  loadAccessibilitySettings()
    .then((settings) => {
      writeCache(settings);
      applyAccessibilitySettings(settings);
    })
    .catch((error) => {
      // 读库失败就保留缓存里已经应用的那一份，不打断启动。
      console.warn('[accessibility] 读取无障碍设置失败:', error);
    });
};

if (typeof window !== 'undefined') {
  bootstrapAccessibilitySettings();
}
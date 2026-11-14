// src/apps/characterArea/characterAreaTheme.js
//
// 角色专属区域——外观主题（切片 F1）。纯函数，不碰数据库、不碰网络。
//
// 角色在"设计外观"那次AI调用里给出配色（5个色值）、字体风格、圆角风格、
// 边框风格。本文件负责：
//   - 把AI给的东西整理成一份干净的 theme 对象（缺的用推算补上）
//   - 自动修正对比度：正文色和背景/卡片的对比度不够时，往黑或白的方向
//     一点点推，保证看得清。角色选色是自由的，但不能选出看不见的字
//   - 生成区域页根节点要覆盖的 CSS 变量，以及一小段作用域样式
//
// 页面根节点覆盖的是项目里已有的全局变量（--bg-main、--card-bg、--text-main
// 等），所以目录列表、整理栏这些现成组件不用改，自己就会跟着换色。
// 另外多给封面用 5 个 --area-* 变量，封面里的 HTML 可以直接引用。
//
// theme 为空（老区域、还没设计过）时，buildAreaThemeStyle 返回 active:false，
// 页面保持原来的样子。

export const THEME_FONT_STACKS = {
  sans: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  serif: "'Songti SC', 'Noto Serif SC', 'SimSun', Georgia, serif",
  kai: "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif SC', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace",
  round: "'Yuanti SC', 'Hiragino Maru Gothic ProN', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  hand: "'Xingkai SC', 'STXingkai', 'Bradley Hand', 'Segoe Script', cursive",
};

export const THEME_FONT_KEYS = Object.keys(THEME_FONT_STACKS);

export const THEME_RADIUS_VALUES = { sharp: '4px', soft: '16px', round: '28px' };
export const THEME_RADIUS_KEYS = Object.keys(THEME_RADIUS_VALUES);

export const THEME_BORDER_KEYS = ['solid', 'dashed', 'dotted'];

// 封面里允许引用的动画名，对应下面 buildAreaThemeStyle 里定义的 keyframes。
export const COVER_ANIMATION_NAMES = [
  'area-float',
  'area-pulse',
  'area-fade',
  'area-twinkle',
  'area-sway',
];

export const DEFAULT_THEME_FONT = 'sans';
export const DEFAULT_THEME_RADIUS = 'soft';
export const DEFAULT_THEME_BORDER = 'solid';

const MIN_TEXT_CONTRAST = 4.5;
const MIN_SUB_CONTRAST = 3.8;
const MIN_MUTED_CONTRAST = 3;
const MIN_ACCENT_CONTRAST = 2.5;

// ---------------- 颜色小工具 ----------------

// 从一段文字里取出第一个 #RGB / #RRGGBB，统一成小写的 #rrggbb；取不到返回 ''。
export const normalizeHex = (value) => {
  const match = String(value || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/);
  if (!match) return '';

  const digits = match[1].toLowerCase();
  const full = digits.length === 3 ? digits.split('').map((ch) => ch + ch).join('') : digits;
  return `#${full}`;
};

const hexToRgb = (hex) => {
  const number = parseInt(hex.slice(1), 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

const rgbToHex = (rgb) =>
  `#${rgb
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0'))
    .join('')}`;

// 从 a 往 b 混合，t 是 0 到 1，t 越大越接近 b。
export const mixHex = (a, b, t) => {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex(from.map((value, index) => value + (to[index] - value) * t));
};

const toLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

export const contrastRatio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const high = Math.max(la, lb);
  const low = Math.min(la, lb);
  return (high + 0.05) / (low + 0.05);
};

// 让前景色 fg 在所有背景色上的对比度都不低于 min。
// 不够就往黑/白方向一点点推（背景偏亮往黑推，偏暗往白推），推到头还不够就直接黑/白。
export const ensureContrast = (fg, backgrounds, min) => {
  const worst = (color) => Math.min(...backgrounds.map((bg) => contrastRatio(color, bg)));

  if (worst(fg) >= min) return fg;

  const averageLuminance =
    backgrounds.reduce((sum, bg) => sum + luminance(bg), 0) / backgrounds.length;
  // 0.179 是黑和白与这个亮度的对比度正好相等的分界点。
  const target = averageLuminance > 0.179 ? '#000000' : '#ffffff';

  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHex(fg, target, step * 0.05);
    if (worst(candidate) >= min) return candidate;
  }

  return target;
};

// ---------------- 主题整理 ----------------

const pickKey = (value, keys, fallback) => {
  const lowered = String(value || '').trim().toLowerCase();
  return keys.includes(lowered) ? lowered : fallback;
};

// 把 { bg, card, text, textSub, accent, font, radius, border } 整理成干净的 theme。
// bg 和 text 是必须的，没有就返回 null（当作没有主题）；其余缺了就用推算补。
export const normalizeTheme = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const bg = normalizeHex(raw.bg);
  const text = normalizeHex(raw.text);
  if (!bg || !text) return null;

  const card = normalizeHex(raw.card) || mixHex(bg, text, 0.04);
  const surfaces = [bg, card];

  const fixedText = ensureContrast(text, surfaces, MIN_TEXT_CONTRAST);
  const textSub = ensureContrast(
    normalizeHex(raw.textSub) || mixHex(fixedText, bg, 0.3),
    surfaces,
    MIN_SUB_CONTRAST
  );
  const accent = ensureContrast(normalizeHex(raw.accent) || fixedText, surfaces, MIN_ACCENT_CONTRAST);

  return {
    bg,
    card,
    text: fixedText,
    textSub,
    accent,
    font: pickKey(raw.font, THEME_FONT_KEYS, DEFAULT_THEME_FONT),
    radius: pickKey(raw.radius, THEME_RADIUS_KEYS, DEFAULT_THEME_RADIUS),
    border: pickKey(raw.border, THEME_BORDER_KEYS, DEFAULT_THEME_BORDER),
  };
};

// 一句话描述当前主题，给"重新设计"的提示词用，让角色知道现在长什么样。
export const describeTheme = (theme) => {
  const normalized = normalizeTheme(theme);
  if (!normalized) return '';

  return `背景 ${normalized.bg}，卡片 ${normalized.card}，正文 ${normalized.text}，强调色 ${normalized.accent}，字体 ${normalized.font}，圆角 ${normalized.radius}，边框 ${normalized.border}`;
};

// ---------------- 页面样式 ----------------

const KEYFRAMES_CSS = `
@keyframes area-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes area-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .7; transform: scale(1.04); } }
@keyframes area-fade { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes area-twinkle { 0%,100% { opacity: .25; } 40% { opacity: 1; } 70% { opacity: .5; } }
@keyframes area-sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@media (prefers-reduced-motion: reduce) { .char-area-root * { animation: none !important; } }`;

// 返回：
//   { active: false, rootStyle: {}, cssText: '' }          没有主题，页面保持原样
//   { active: true, rootStyle: {...}, cssText: '...' }     rootStyle 直接放进根节点的 style
export const buildAreaThemeStyle = (rawTheme) => {
  const theme = normalizeTheme(rawTheme);

  if (!theme) return { active: false, rootStyle: {}, cssText: '' };

  const surfaces = [theme.bg, theme.card];
  const surface = mixHex(theme.card, theme.text, 0.06);
  const muted = ensureContrast(mixHex(theme.textSub, theme.card, 0.35), surfaces, MIN_MUTED_CONTRAST);
  const radius = THEME_RADIUS_VALUES[theme.radius];

  const rootStyle = {
    '--bg-main': theme.bg,
    '--bg-surface': surface,
    '--card-bg': theme.card,
    '--text-main': theme.text,
    '--text-sub': theme.textSub,
    '--text-muted': muted,
    '--area-bg': theme.bg,
    '--area-card': theme.card,
    '--area-text': theme.text,
    '--area-sub': theme.textSub,
    '--area-accent': theme.accent,
    '--area-radius': radius,
    fontFamily: THEME_FONT_STACKS[theme.font],
  };

  // 现有组件用的是 Tailwind 的 rounded-3xl / rounded-2xl 和 border，这里在根节点
  // 作用域内覆盖，免得去改每一个组件。只改大卡片（section）的边框样式，按钮不动。
  const cssText = `
.char-area-root .rounded-3xl { border-radius: var(--area-radius); }
.char-area-root .rounded-2xl { border-radius: calc(var(--area-radius) * 0.7); }
.char-area-root section.border { border-style: ${theme.border}; }${KEYFRAMES_CSS}`;

  return { active: true, rootStyle, cssText };
};
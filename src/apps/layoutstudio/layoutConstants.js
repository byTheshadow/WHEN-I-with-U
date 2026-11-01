// src/apps/layoutstudio/layoutConstants.js
//
// 修图室（Layout Studio）的公共常量。
// 画布固定 1080x1350（4:5），所有版面坐标都用 0~1 的归一化数值表示，
// 这样"版面清单"（spec）不依赖具体像素，角色（AI）只需要给出相对位置。

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

export const MAX_PHOTOS = 9;
export const MAX_ITEMS = 24;
export const MAX_TEXT_LENGTH = 60;

// 字体全部用系统字体栈，不依赖网络，PWA 离线时画布也不会掉字体。
export const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif";
export const FONT_SERIF = "Georgia, 'Noto Serif SC', 'Songti SC', serif";

export const TEXT_FONTS = ['sans', 'serif', 'serifItalic'];
export const TEXT_ALIGNS = ['left', 'center', 'right'];

// 形状（散点拼贴用）
export const SHAPE_KINDS = ['circle', 'square', 'star', 'petal'];
export const SHAPE_LABELS = {
  circle: '圆',
  square: '方',
  star: '星',
  petal: '花瓣',
};

// 贴纸种类。glyph 表示"直接画一段字形（比如 emoji）"，字形由版面清单里的
// glyph 字段提供。
export const STICKER_KINDS = [
  'shell',
  'spiral',
  'cone',
  'bubbles',
  'sparkle',
  'flower',
  'heart',
  'cloud',
  'glyph',
];

// 默认贴纸字形：用码点拼出来，源码里不出现字面 emoji。
export const DEFAULT_GLYPHS = [
  String.fromCodePoint(0x2728),
  String.fromCodePoint(0x1f41f),
  String.fromCodePoint(0x1fae7),
];

// src/components/planetCodeCommon.js
//
// "行星代码"系列加载页（planet-awaken / planet-warp）共用的小工具：
// 数学函数、可复现随机数、以及"代码字符图集"。
//
// 字符图集：把所有代码字符按「色带 x 亮度档位」预先渲染成带辉光的精灵放进一张
// 离屏 canvas，运行时每个字符只做一次 drawImage，不再每帧 fillText，
// 手机上也能同时画上千个字符。

export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const GLYPHS = [
  '0', '1', '2', '3', '5', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F',
  '<', '>', '/', '{', '}', '[', ']', '=', '+', '*', '#', '%', '&', '$', '@', ';', '|',
  'Λ', 'Σ', 'Ω', 'Δ', 'Ξ', 'Ψ', '∴', '≈', '∞',
  'ｱ', 'ｳ', 'ｶ', 'ｷ', 'ｸ', 'ｺ', 'ｻ', 'ｽ', 'ﾀ', 'ﾁ', 'ﾅ', 'ﾆ'
];
export const G = GLYPHS.length;

// 0 / 1 出现得更多一点，其余字符均匀分布。
export const pickGlyph = (rnd) => {
  const v = rnd();
  if (v < 0.36) return v < 0.18 ? 0 : 1;
  return 2 + Math.floor(rnd() * (G - 2));
};

// 色带：深蓝 / 青 / 紫 / 玫瑰 / 蜜桃 / 金，每条 4 档亮度。
const BANDS = [[218, 92], [188, 96], [262, 88], [318, 88], [16, 96], [42, 100]];
const TIER_L = [32, 50, 67, 88];

// 图集的行号：0-23 是 6 条色带 x 4 档亮度，之后三行是特殊样式。
export const ROW_DORM_F = 24; // 沉睡（近侧）
export const ROW_DORM_B = 25; // 沉睡（远侧）
export const ROW_WHITE = 26; // 刚被唤醒的白光
export const ROWS = 27;

// 不依赖网络字体：用系统等宽字体，字符图集只在挂载时生成一次。
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';

function rowStyle(row, dormantLightness) {
  if (row === ROW_DORM_F) {
    return { fill: 'hsl(226,34%,' + dormantLightness[0] + '%)', glow: null, blur: 0 };
  }
  if (row === ROW_DORM_B) {
    return { fill: 'hsl(230,36%,' + dormantLightness[1] + '%)', glow: null, blur: 0 };
  }
  if (row === ROW_WHITE) {
    return { fill: 'hsl(190,100%,97%)', glow: 'hsl(190,100%,70%)', blur: 1 };
  }
  const band = Math.floor(row / 4);
  const tier = row % 4;
  const h = BANDS[band][0];
  const s = BANDS[band][1];
  const l = TIER_L[tier];
  return {
    fill: 'hsl(' + h + ',' + (tier === 3 ? s * 0.4 : s) + '%,' + l + '%)',
    glow: 'hsl(' + h + ',' + s + '%,' + Math.min(l + 12, 78) + '%)',
    blur: tier >= 2 ? 1 : tier === 1 ? 0.5 : 0
  };
}

// 生成字符图集。
//   baseFont  一个字符在屏幕上的基础字号（CSS 像素）
//   dpr       设备像素比
//   pxScale   图集字号相对 baseFont*dpr 的放大倍数（跃迁款字符会被拉近放大，需要更高清）
//   minPx     图集字号下限
//   dormantLightness  [近侧, 远侧] 沉睡字符的明度，跃迁款比扫描款略亮一点
// 返回 { atlas, cell, unit }：unit 把「图集像素」换算回「屏幕 CSS 像素」。
export function createGlyphAtlas({
  baseFont,
  dpr,
  pxScale = 1,
  minPx = 10,
  dormantLightness = [38, 28]
}) {
  const aDpr = Math.min(dpr, 2);
  const px = clamp(Math.round(baseFont * aDpr * pxScale), minPx, 30);
  const cell = Math.ceil(px * 1.8);
  const unit = baseFont / px;

  const atlas = document.createElement('canvas');
  atlas.width = cell * G;
  atlas.height = cell * ROWS;
  const c = atlas.getContext('2d');
  c.font = '400 ' + px + 'px ' + MONO;
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  for (let r = 0; r < ROWS; r += 1) {
    const st = rowStyle(r, dormantLightness);
    for (let g = 0; g < G; g += 1) {
      const x = g * cell + cell / 2;
      const y = r * cell + cell / 2;
      c.fillStyle = st.fill;
      if (st.blur > 0) {
        c.shadowColor = st.glow;
        c.shadowBlur = px * 0.32 * st.blur;
        c.fillText(GLYPHS[g], x, y);
        c.shadowBlur = px * 0.12 * st.blur;
        c.fillText(GLYPHS[g], x, y);
        c.shadowBlur = 0;
      }
      c.fillText(GLYPHS[g], x, y);
    }
  }

  return { atlas, cell, unit };
}

// 背景星云：只生成一次的低分辨率离屏图，运行时按透明度 drawImage，
// 比每帧画三四个全屏渐变省很多。
export function createNebulaImage(width, height) {
  const w = Math.max(2, Math.round(width / 2));
  const h = Math.max(2, Math.round(height / 2));
  const nebula = document.createElement('canvas');
  nebula.width = w;
  nebula.height = h;
  const c = nebula.getContext('2d');
  const blobs = [
    [0.22, 0.28, 0.4, '92,66,210', 0.26],
    [0.8, 0.22, 0.34, '30,150,210', 0.18],
    [0.64, 0.72, 0.46, '200,70,170', 0.14],
    [0.5, 1.04, 0.5, '20,70,140', 0.34]
  ];
  const span = Math.max(w, h);
  blobs.forEach(([bx, by, br, rgb, alpha]) => {
    const g = c.createRadialGradient(w * bx, h * by, 0, w * bx, h * by, span * br);
    g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  return nebula;
}
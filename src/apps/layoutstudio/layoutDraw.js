// src/apps/layoutstudio/layoutDraw.js
//
// 修图室的底层绘制工具：全是纯函数（只操作传进来的 canvas context），
// 不碰 DOM、不碰数据库，方便以后单独测试或复用。

import {
  CANVAS_W as W,
  FONT_SANS,
  FONT_SERIF,
} from './layoutConstants';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 带种子的伪随机，保证同一个 seed 永远画出同一张图（"重新排布"就是换个 seed）。
export const createRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// 第 i 个元素（共 n 个）在整体进度 t（0~1）下的单独进度：依次弹出。
export const revealProgress = (i, n, t) =>
  clamp((t - (i / (n + 1)) * 0.65) / 0.35, 0, 1);

// 弹出效果：在 (cx, cy) 为中心缩放 + 淡入后再执行绘制。
export const popIn = (ctx, progress, cx, cy, drawFn) => {
  if (progress <= 0) return;
  const eased = easeOutBack(progress);
  const scale = 0.6 + 0.4 * eased;
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 1.6);
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  drawFn();
  ctx.restore();
};

// 把照片 cover 到矩形里（等比放大裁切）。photo 形如 { el, width, height }。
export const drawCover = (ctx, photo, x, y, w, h) => {
  if (!photo || !photo.el) return;
  const scale = Math.max(w / photo.width, h / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(photo.el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
};

// 灰度版本（缓存在 photo 对象上，同尺寸只算一次）。
export const getGrayCanvas = (photo, w, h) => {
  if (photo._gray && photo._gray.w === w && photo._gray.h === h) {
    return photo._gray.canvas;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, photo, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    data[i] = data[i + 1] = data[i + 2] = Math.min(255, gray * 1.04);
  }
  ctx.putImageData(imageData, 0, 0);
  photo._gray = { w, h, canvas };
  return canvas;
};

export const roundRectPath = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const starPoints = (cx, cy, spikes, outer, inner, rot = -Math.PI / 2) => {
  const points = [];
  for (let k = 0; k < spikes * 2; k += 1) {
    const angle = rot + (k * Math.PI) / spikes;
    const radius = k % 2 ? inner : outer;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return points;
};

// 散点拼贴用的形状路径（只建路径，不填充）。
export const shapePath = (ctx, shape, x, y, r, rot) => {
  ctx.beginPath();
  if (shape === 'square') {
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
      .map(([a, b]) => {
        const px = a * r * 0.9;
        const py = b * r * 0.9;
        return [
          x + px * Math.cos(rot) - py * Math.sin(rot),
          y + px * Math.sin(rot) + py * Math.cos(rot),
        ];
      })
      .forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  } else if (shape === 'star') {
    starPoints(x, y, 8, r * 1.2, r * 0.55, rot).forEach((p, i) =>
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])
    );
    ctx.closePath();
  } else if (shape === 'petal') {
    const rx = r * 1.15;
    const ry = r * 0.62;
    ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    const rot2 = rot + Math.PI / 2;
    ctx.moveTo(x + Math.cos(rot2) * rx, y + Math.sin(rot2) * rx);
    ctx.ellipse(x, y, rx, ry, rot2, 0, Math.PI * 2);
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
};

// 字体 CSS 串。font: sans | serif | serifItalic
export const fontCss = (font, weight, sizePx) => {
  if (font === 'serif') return `${weight >= 600 ? 700 : 400} ${sizePx}px ${FONT_SERIF}`;
  if (font === 'serifItalic') {
    return `italic ${weight >= 600 ? 700 : 400} ${sizePx}px ${FONT_SERIF}`;
  }
  return `${weight} ${sizePx}px ${FONT_SANS}`;
};

// 文字太宽就逐步缩小字号，直到放得下或到下限。返回最终字号。
export const fitFontSize = (ctx, text, maxWidth, startSize, makeFont, minSize = 20) => {
  let size = startSize;
  ctx.font = makeFont(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = makeFont(size);
  }
  return size;
};

/* ---------------- 贴纸 ---------------- */

const buildStickerPath = (ctx, kind, s) => {
  ctx.beginPath();
  if (kind === 'shell') {
    ctx.moveTo(-s * 0.28, s * 0.75);
    for (let a = Math.PI; a <= Math.PI * 2 + 0.001; a += Math.PI / 60) {
      const r = s * (0.95 + 0.07 * Math.cos((a - Math.PI) * 9));
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + s * 0.3);
    }
    ctx.lineTo(s * 0.28, s * 0.75);
    ctx.closePath();
  } else if (kind === 'spiral') {
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
  } else if (kind === 'cone') {
    ctx.moveTo(-s * 0.14, -s);
    ctx.lineTo(s * 0.14, -s);
    ctx.lineTo(s * 0.6, s * 0.55);
    ctx.quadraticCurveTo(0, s * 0.95, -s * 0.6, s * 0.55);
    ctx.closePath();
  } else if (kind === 'sparkle') {
    starPoints(0, 0, 4, s * 1.05, s * 0.3).forEach((p, i) =>
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])
    );
    ctx.closePath();
  } else if (kind === 'flower') {
    for (let k = 0; k < 5; k += 1) {
      const a = (k * Math.PI * 2) / 5 - Math.PI / 2;
      const x = Math.cos(a) * s * 0.52;
      const y = Math.sin(a) * s * 0.52;
      ctx.moveTo(x + s * 0.38, y);
      ctx.arc(x, y, s * 0.38, 0, Math.PI * 2);
    }
  } else if (kind === 'heart') {
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.3, s * 0.1, -s * 0.8, -s * 0.9, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.8, -s * 0.9, s * 1.3, s * 0.1, 0, s * 0.9);
    ctx.closePath();
  } else if (kind === 'cloud') {
    [
      [-0.45, 0.12, 0.38],
      [0, -0.14, 0.5],
      [0.5, 0.14, 0.36],
    ].forEach(([x, y, r]) => {
      ctx.moveTo(x * s + r * s, y * s);
      ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
    });
    ctx.rect(-0.45 * s, 0.05 * s, 0.95 * s, 0.45 * s);
  } else {
    ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
  }
};

const drawStickerDetails = (ctx, kind, s) => {
  if (kind === 'shell') {
    ctx.beginPath();
    for (let k = 0; k < 7; k += 1) {
      const a = Math.PI * (1.12 + k * 0.126);
      ctx.moveTo(0, s * 0.7);
      ctx.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9 + s * 0.3);
    }
    ctx.stroke();
  } else if (kind === 'spiral') {
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 5; t += 0.1) {
      const r = (t / (Math.PI * 5)) * s * 0.7;
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r;
      if (t) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  } else if (kind === 'cone') {
    ctx.beginPath();
    for (let k = 1; k <= 5; k += 1) {
      const f = k / 6;
      const y = -s + f * s * 1.55;
      const w = s * (0.14 + f * 0.46);
      ctx.moveTo(-w, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  } else if (kind === 'flower') {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6d6';
    ctx.fill();
  } else if (kind === 'heart') {
    ctx.beginPath();
    ctx.arc(-s * 0.38, -s * 0.12, s * 0.22, Math.PI * 1.1, Math.PI * 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 7;
    ctx.stroke();
  }
};

/**
 * 画一个贴纸，以 (0,0) 为中心（调用方负责 translate / rotate）。
 * mode:
 *   'line'   只描边（半透明填充），用于灰度底图上的"线稿"
 *   'fill'   实心填充，用于纯色底上的"剪影"
 *   'cutout' 带白边的实心贴纸（像剪下来的贴纸）
 * opts: { color, detail, glyph }
 */
export const drawSticker = (ctx, kind, s, mode, opts = {}) => {
  const { color = '#ffffff', detail = 'rgba(0,0,0,.35)', glyph = '*' } = opts;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (kind === 'glyph') {
    ctx.font = `${s * 1.6}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'cutout') {
      ctx.lineWidth = Math.max(14, s * 0.3);
      ctx.strokeStyle = '#fff';
      ctx.strokeText(glyph, 0, 0);
    }
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
    return;
  }

  const paint = () => {
    if (mode === 'line') {
      ctx.save();
      ctx.globalAlpha *= 0.22;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 5;
      ctx.strokeStyle = color;
      ctx.stroke();
    } else if (mode === 'fill') {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(14, s * 0.3);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  if (kind === 'bubbles') {
    [
      [0, 0, 0.62],
      [0.5, -0.55, 0.32],
    ].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      paint();
      ctx.beginPath();
      ctx.arc(x * s - r * s * 0.3, y * s - r * s * 0.3, r * s * 0.28, Math.PI, Math.PI * 1.6);
      ctx.strokeStyle = mode === 'line' ? color : 'rgba(255,255,255,.9)';
      ctx.lineWidth = mode === 'line' ? 4 : 6;
      ctx.stroke();
    });
    ctx.restore();
    return;
  }

  buildStickerPath(ctx, kind, s);
  paint();
  ctx.strokeStyle = mode === 'line' ? color : detail;
  ctx.lineWidth = mode === 'line' ? 4 : 3.5;
  drawStickerDetails(ctx, kind, s);
  ctx.restore();
};

// 供文字绘制使用：把版面里的"字号比例"换成像素。
export const sizeToPx = (size) => size * W;

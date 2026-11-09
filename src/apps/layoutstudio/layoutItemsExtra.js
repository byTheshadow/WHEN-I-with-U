// src/apps/layoutstudio/layoutItemsExtra.js
//
// 三种较新元素的绘制：player（音乐播放器）/ pill（图标胶囊）/ spread（两端对齐文字块）。
// 字段含义见 layoutSpecExtra.js。和 layoutItems.js 里原有的四种元素分开放，
// layoutItems.js 的 drawItem 遇到这三种 kind 时转到 drawExtraItem。

import { CANVAS_W as W, CANVAS_H as H, FONT_SANS } from './layoutConstants';
import { fontCss, roundRectPath } from './layoutDraw';
import { pillGlyphs } from './layoutSpecExtra';

const FONT_EMOJI = `'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', ${FONT_SANS}`;
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

/* ---------- player ---------- */

// 圆角进度条：底下一条半透明的轨道，上面按 ratio 填一段实心。
const drawBar = (ctx, x, y, w, h, ratio, color) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.32;
  roundRectPath(ctx, x, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = color;
  roundRectPath(ctx, x, y - h / 2, Math.max(h, w * ratio), h, h / 2);
  ctx.fill();
};

// 圆角三角形。dir 为 1 朝右，-1 朝左。
const drawTriangle = (ctx, cx, cy, size, dir) => {
  const half = size * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx + dir * size * 0.5, cy);
  ctx.lineTo(cx - dir * size * 0.5, cy - half);
  ctx.lineTo(cx - dir * size * 0.5, cy + half);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

// 小喇叭：一个喇叭口加两道声波。(cx, cy) 是喇叭口右边缘的中心。
const drawSpeaker = (ctx, cx, cy, s) => {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.18);
  ctx.lineTo(cx - s * 0.28, cy - s * 0.18);
  ctx.lineTo(cx, cy - s * 0.45);
  ctx.lineTo(cx, cy + s * 0.45);
  ctx.lineTo(cx - s * 0.28, cy + s * 0.18);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = s * 0.12;
  [0.3, 0.52].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, s * r, -0.9, 0.9);
    ctx.stroke();
  });
};

const drawPlayerItem = (ctx, item) => {
  const wp = item.size * W;
  const half = wp / 2;
  const color = item.color;
  const barH = Math.max(8, wp * 0.026);

  ctx.save();
  ctx.translate(item.x * W, item.y * H);
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = wp * 0.025;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 进度条 + 当前时间
  const progressY = -wp * 0.2;
  drawBar(ctx, -half, progressY, wp, barH, item.progress, color);
  if (item.time) {
    ctx.font = fontCss('sans', 400, wp * 0.052);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.time, -half, progressY + wp * 0.085);
  }

  // 上一首 / 暂停（或播放）/ 下一首
  const rowY = wp * 0.1;
  const u = wp * 0.085;
  const reach = wp * 0.26;
  ctx.lineWidth = u * 0.14;
  drawTriangle(ctx, -reach - u * 0.45, rowY, u, -1);
  drawTriangle(ctx, -reach + u * 0.45, rowY, u, -1);
  drawTriangle(ctx, reach - u * 0.45, rowY, u, 1);
  drawTriangle(ctx, reach + u * 0.45, rowY, u, 1);

  if (item.playing) {
    const barW = wp * 0.034;
    const barTall = wp * 0.115;
    const gap = wp * 0.026;
    [-1, 1].forEach((side) => {
      roundRectPath(
        ctx,
        side * (gap / 2 + barW / 2) - barW / 2,
        rowY - barTall / 2,
        barW,
        barTall,
        barW * 0.3
      );
      ctx.fill();
    });
  } else {
    drawTriangle(ctx, wp * 0.01, rowY, wp * 0.1, 1);
  }

  // 音量条 + 小喇叭
  const volumeY = wp * 0.3;
  const speaker = wp * 0.075;
  drawBar(ctx, -half, volumeY, wp - speaker * 1.7, barH, item.volume, color);
  ctx.lineWidth = speaker * 0.12;
  drawSpeaker(ctx, half - speaker * 0.62, volumeY, speaker);

  ctx.restore();
};

/* ---------- pill ---------- */

const drawPillItem = (ctx, item) => {
  const glyphs = pillGlyphs(item.text);
  if (glyphs.length === 0) return;

  // g 是单个图标的字号；整条胶囊太宽时整体缩小。
  const SLOT = 1.45;
  const PAD = 0.55;
  let g = item.size * W;
  const rawW = g * (glyphs.length * SLOT + PAD * 2);
  if (rawW > W * 0.94) g *= (W * 0.94) / rawW;

  const w = g * (glyphs.length * SLOT + PAD * 2);
  const h = g * 1.75;
  const cx = item.x * W;
  const cy = item.y * H;
  const left = cx - w / 2;
  const top = cy - h / 2;

  // 想法气泡的两个小圆点，挂在胶囊左下角。
  const bigR = h * 0.12;
  const smallR = h * 0.065;
  const dots = [
    [left + h * 0.52, top + h + bigR * 0.15, bigR],
    [left + h * 0.4, top + h + bigR * 2.1 + smallR * 0.2, smallR],
  ];

  const pillPath = () => roundRectPath(ctx, left, top, w, h, h / 2);
  const dotPath = ([dx, dy, dr]) => {
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
  };

  // 磨砂玻璃：半透明填充 + 柔和阴影，再描一圈淡淡的亮边。
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.22)';
  ctx.shadowBlur = g * 0.6;
  ctx.shadowOffsetY = g * 0.15;
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = item.color;
  pillPath();
  ctx.fill();
  dots.forEach((dot) => {
    dotPath(dot);
    ctx.fill();
  });
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = Math.max(2, g * 0.03);
  pillPath();
  ctx.stroke();
  dots.forEach((dot) => {
    dotPath(dot);
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.font = `${g}px ${FONT_EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  glyphs.forEach((glyph, i) => {
    ctx.fillText(glyph, left + g * PAD + g * SLOT * (i + 0.5), cy + g * 0.04);
  });
  ctx.restore();
};

/* ---------- spread ---------- */

// 把文字按盒子宽度换行。有空格就按词排；整段没有空格的中日韩文字按字排。
// 每个词的宽度要在调用前把 ctx.font 设好。
const wrapSpread = (ctx, text, boxW, px) => {
  const lines = [];
  String(text || '')
    .split('\n')
    .forEach((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return;

      let tokens = trimmed.split(/\s+/).filter(Boolean);
      let charMode = false;
      if (tokens.length === 1 && CJK.test(trimmed)) {
        tokens = [...trimmed].filter((ch) => ch.trim());
        charMode = true;
      }
      const minGap = charMode ? px * 0.1 : px * 0.38;

      let current = [];
      let currentW = 0;
      tokens.forEach((tok) => {
        const tw = ctx.measureText(tok).width;
        const needed = current.length ? currentW + minGap + tw : tw;
        if (current.length && needed > boxW) {
          lines.push({ words: current, minGap });
          current = [{ tok, tw }];
          currentW = tw;
        } else {
          current.push({ tok, tw });
          currentW = needed;
        }
      });
      if (current.length) lines.push({ words: current, minGap });
    });
  return lines;
};

const drawSpreadItem = (ctx, item) => {
  const px = Math.max(16, item.size * W);
  const boxW = item.w * W;

  ctx.save();
  ctx.font = fontCss('sans', item.weight, px);
  const lines = wrapSpread(ctx, item.text, boxW, px);
  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  const lineH = px * 1.22;
  const left = item.x * W - boxW / 2;
  const top = item.y * H - (lines.length * lineH) / 2;

  ctx.fillStyle = item.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (item.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = px * 0.4;
  }

  lines.forEach((line, i) => {
    const cy = top + lineH * (i + 0.5);
    const count = line.words.length;
    if (count === 1) {
      ctx.fillText(line.words[0].tok, left, cy);
      return;
    }
    // 两端对齐：把剩余宽度平均分给词与词之间的空隙；空隙太大就封顶，
    // 免得只有两三个词的短行被拉得七零八落。
    const sumW = line.words.reduce((total, word) => total + word.tw, 0);
    const gap = Math.max(line.minGap, Math.min((boxW - sumW) / (count - 1), px * 4.5));
    let x = left;
    line.words.forEach((word) => {
      ctx.fillText(word.tok, x, cy);
      x += word.tw + gap;
    });
  });
  ctx.restore();
};

export const drawExtraItem = (ctx, item) => {
  if (item.kind === 'player') drawPlayerItem(ctx, item);
  else if (item.kind === 'pill') drawPillItem(ctx, item);
  else if (item.kind === 'spread') drawSpreadItem(ctx, item);
};
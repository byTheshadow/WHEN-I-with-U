// src/apps/layoutstudio/layoutItems.js
//
// 版面清单里每一种元素（text / row / shape / sticker）怎么画。
// 元素的位置、大小、颜色、文字全部来自 item 自己的字段（0~1 归一化），
// 模板只负责底图，不决定元素放哪——这样角色（AI）才能自由安排文字和贴纸。

import { CANVAS_W as W, CANVAS_H as H } from './layoutConstants';
import {
  drawCover,
  drawSticker,
  fitFontSize,
  fontCss,
  shapePath,
} from './layoutDraw';

const pickPhoto = (photos, index) =>
  photos[((index % photos.length) + photos.length) % photos.length];

const toRad = (deg) => (deg * Math.PI) / 180;

const drawTextItem = (ctx, item) => {
  const lines = String(item.text || '').split('\n');
  const longest = lines.reduce((a, b) => (a.length >= b.length ? a : b), '');
  const make = (size) => fontCss(item.font, item.weight, size);
  const size = fitFontSize(ctx, longest, W * 0.94, item.size * W, make, 18);

  ctx.save();
  ctx.translate(item.x * W, item.y * H);
  ctx.rotate(toRad(item.rot));
  ctx.font = make(size);
  ctx.textAlign = item.align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = item.color;
  if (item.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,.32)';
    ctx.shadowBlur = size * 0.3;
  }
  const lineHeight = size * 1.12;
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));
  ctx.restore();
};

// 括号清单的一行：(缩略图) + 文字。item.x/y 是整行的中心。
const drawRowItem = (ctx, item, env) => {
  const size = item.size * W;
  const thumbH = size * 2.3;
  const thumbW = thumbH * 2.4;
  const parenW = thumbH * 0.28;
  const pad = parenW * 0.5;
  const gap = size * 0.9;

  const make = (s) => fontCss('sans', 700, s);
  const textSize = fitFontSize(ctx, item.text, W * 0.42, size, make, 22);
  ctx.font = make(textSize);
  const textW = ctx.measureText(item.text).width;

  const groupW = parenW + pad + thumbW + pad + parenW;
  const total = groupW + gap + textW;
  const cy = item.y * H;
  const startX = item.x * W - total / 2;
  const groupX = item.side === 'left' ? startX : startX + textW + gap;
  const textX = item.side === 'left' ? startX + groupW + gap : startX;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = textSize * 0.25;

  drawCover(
    ctx,
    pickPhoto(env.photos, item.photo),
    groupX + parenW + pad,
    cy - thumbH / 2,
    thumbW,
    thumbH
  );

  ctx.shadowBlur = 0;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = Math.max(4, size * 0.12);
  ctx.lineCap = 'round';
  const parenH = thumbH * 1.25;
  ctx.beginPath();
  ctx.moveTo(groupX + parenW, cy - parenH / 2);
  ctx.quadraticCurveTo(groupX - parenW * 0.3, cy, groupX + parenW, cy + parenH / 2);
  ctx.stroke();
  const rightX = groupX + groupW - parenW;
  ctx.beginPath();
  ctx.moveTo(rightX, cy - parenH / 2);
  ctx.quadraticCurveTo(rightX + parenW * 1.3, cy, rightX, cy + parenH / 2);
  ctx.stroke();

  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = textSize * 0.25;
  ctx.fillStyle = item.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.text, textX, cy + 2);
  ctx.restore();
};

const drawShapeItem = (ctx, item, env) => {
  const x = item.x * W;
  const y = item.y * H;
  const r = item.size * W;
  const shape = item.shape || env.params.shape || 'circle';

  ctx.save();
  shapePath(ctx, shape, x, y, r, toRad(item.rot));
  if (item.fill === 'photo') {
    ctx.clip();
    drawCover(ctx, pickPhoto(env.photos, item.photo), x - r * 3, y - r * 3, r * 6, r * 6);
    if (env.params.tint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = env.params.tint;
      ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    }
  } else if (item.fill === 'white') {
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.fill();
  } else {
    ctx.fillStyle = item.color;
    ctx.fill();
  }
  ctx.restore();

  if (item.text) {
    ctx.save();
    const make = (s) => fontCss('sans', 700, s);
    fitFontSize(ctx, item.text, r * 1.5, Math.min(44, r * 0.6), make, 18);
    ctx.fillStyle = item.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.text, x, y + 2);
    ctx.restore();
  }
};

const drawStickerItem = (ctx, item, env) => {
  const s = item.size * W;
  const x = item.x * W;
  const y = item.y * H;
  const rot = toRad(item.rot);

  const place = (px, py, mode, color, detail) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    drawSticker(ctx, item.sticker, s, mode, { color, detail, glyph: item.glyph });
    ctx.restore();
  };

  if (item.mode === 'duo' && env.splitY > 0 && y < env.splitY) {
    // 灰度照片上画线稿，纯色底上在对应位置画同款实心剪影。
    place(x, y, 'line', item.color, item.color);
    const mirrorY = env.splitY + (y / env.splitY) * (H - env.splitY);
    place(x, mirrorY, 'fill', item.color2, env.params.bottomColor || '#ffffff');
  } else {
    place(x, y, 'cutout', item.color, item.color2);
  }
};

export const drawItem = (ctx, item, env) => {
  if (item.kind === 'text') drawTextItem(ctx, item);
  else if (item.kind === 'row') drawRowItem(ctx, item, env);
  else if (item.kind === 'shape') drawShapeItem(ctx, item, env);
  else if (item.kind === 'sticker') drawStickerItem(ctx, item, env);
};

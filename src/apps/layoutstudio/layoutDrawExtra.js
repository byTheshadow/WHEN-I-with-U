// src/apps/layoutstudio/layoutDrawExtra.js
//
// 新模板用到的两个底层绘制工具。和 layoutDraw.js 一样全是纯函数，
// 只操作传进来的 canvas / context；单独放一个文件，避免 layoutDraw.js 继续变长。
//   - drawCoverFocus：带缩放和焦点的 cover，同一张照片可以裁出不同的几块；
//   - getBlurCanvas ：不依赖 ctx.filter 的模糊（Safari 上 ctx.filter 长期不可用），
//                     用"逐级缩小再逐级放大"的方式做出柔和的虚化，结果缓存在照片对象上。

import { drawCover } from './layoutDraw';

const makeCanvas = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

/**
 * 把照片 cover 到矩形里，并额外放大 zoom 倍（>=1），让焦点 (fx, fy)
 * （0~1，相对照片）尽量落在矩形中心，同时保证不露出照片边缘。
 */
export const drawCoverFocus = (ctx, photo, x, y, w, h, zoom = 1, fx = 0.5, fy = 0.5) => {
  if (!photo || !photo.el) return;
  const scale = Math.max(w / photo.width, h / photo.height) * Math.max(1, zoom);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  const offX = Math.min(x, Math.max(x + w - dw, x + w / 2 - fx * dw));
  const offY = Math.min(y, Math.max(y + h - dh, y + h / 2 - fy * dh));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(photo.el, offX, offY, dw, dh);
  ctx.restore();
};

/**
 * 返回一张 w x h 的、已经虚化好的照片画布（cover 铺满）。
 * level 是缩小的级数：每多一级，尺寸再减半，虚化更重。同尺寸同级数只算一次。
 */
export const getBlurCanvas = (photo, w, h, level) => {
  const key = `${w}x${h}@${level}`;
  if (photo._blur && photo._blur.key === key) return photo._blur.canvas;

  const base = makeCanvas(w, h);
  drawCover(base.getContext('2d'), photo, 0, 0, w, h);

  const chain = [base];
  for (let i = 0; i < level; i += 1) {
    const prev = chain[chain.length - 1];
    const next = makeCanvas(
      Math.max(8, Math.round(prev.width / 2)),
      Math.max(8, Math.round(prev.height / 2))
    );
    const nctx = next.getContext('2d');
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(prev, 0, 0, next.width, next.height);
    chain.push(next);
  }

  let current = chain[chain.length - 1];
  for (let i = chain.length - 2; i >= 0; i -= 1) {
    const up = makeCanvas(chain[i].width, chain[i].height);
    const uctx = up.getContext('2d');
    uctx.imageSmoothingEnabled = true;
    uctx.imageSmoothingQuality = 'high';
    uctx.drawImage(current, 0, 0, up.width, up.height);
    current = up;
  }

  photo._blur = { key, canvas: current };
  return current;
};
// src/apps/layoutstudio/layoutRenderer.js
//
// 把 (照片, spec) 画到一个 2D context 上。
// 调用方负责 context 的变换（比如缩略图要先 scale），这里只管画 1080x1350 的内容。
// t 是整体进度 0~1：1 表示全部画完；小于 1 时元素依次弹出（出图动画用）。

import { CANVAS_W as W, CANVAS_H as H } from './layoutConstants';
import { popIn, revealProgress } from './layoutDraw';
import { drawItem } from './layoutItems';
import { getTemplate } from './templates';

export const renderLayout = (ctx, photos, spec, t = 1) => {
  const tpl = spec ? getTemplate(spec.templateId) : null;
  if (!tpl || !photos || photos.length === 0) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  tpl.drawBackground(ctx, photos, spec.params);

  const env = {
    photos,
    params: spec.params,
    splitY: tpl.splitY(spec.params),
  };
  const count = spec.items.length;

  spec.items.forEach((item, index) => {
    popIn(ctx, revealProgress(index, count, t), item.x * W, item.y * H, () => {
      drawItem(ctx, item, env);
    });
  });
};

export default renderLayout;

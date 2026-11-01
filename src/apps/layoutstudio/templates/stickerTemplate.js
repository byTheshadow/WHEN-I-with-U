// src/apps/layoutstudio/templates/stickerTemplate.js
//
// 模板：贴纸双色。
// 上半是灰度照片，下半是一整块纯色底；贴纸在上半画成线稿，在下半的对应
// 位置画成同款实心剪影（mode: 'duo'）。贴纸种类、位置、大小、颜色、
// emoji 字形，以及一条小字签名，全部来自元素。

import { CANVAS_W as W, CANVAS_H as H, DEFAULT_GLYPHS } from '../layoutConstants';
import { drawCover, getGrayCanvas } from '../layoutDraw';

const KINDS = ['shell', 'spiral', 'cone', 'shell', 'glyph', 'spiral', 'cone', 'bubbles', 'glyph'];

const stickerTemplate = {
  id: 'sticker',
  label: '贴纸双色',
  desc: '上半灰度照片，下半纯色底，贴纸上下呼应',
  fits: '适合人像、物件，想要可爱一点',
  kinds: ['sticker', 'text'],
  paramSpec: {
    split: { type: 'number', min: 0.3, max: 0.7, default: 0.52 },
    bottomColor: { type: 'color', default: '#b9ccee' },
    gray: { type: 'bool', default: true },
  },
  paramOptions: [],
  splitY: (params) => params.split * H,

  drawBackground(ctx, photos, params) {
    const splitY = Math.round(params.split * H);
    ctx.fillStyle = params.bottomColor;
    ctx.fillRect(0, splitY, W, H - splitY);
    if (params.gray) {
      ctx.drawImage(getGrayCanvas(photos[0], W, splitY), 0, 0);
      ctx.fillStyle = 'rgba(30,40,62,.3)';
      ctx.fillRect(0, 0, W, splitY);
    } else {
      drawCover(ctx, photos[0], 0, 0, W, splitY);
    }
  },

  buildItems({ rand, params }) {
    const split = params.split;
    const items = KINDS.map((sticker, i) => ({
      kind: 'sticker',
      id: `s${i}`,
      sticker,
      glyph: DEFAULT_GLYPHS[i % DEFAULT_GLYPHS.length],
      x: 0.1 + rand() * 0.8,
      y: 0.07 + rand() * (split - 0.16),
      size: 0.045 + rand() * 0.035,
      rot: (rand() - 0.5) * 60,
      color: '#e4eeff',
      color2: '#4a4a50',
      mode: 'duo',
    }));
    items.push({
      kind: 'text',
      id: 'tag',
      text: '收进口袋的一天',
      x: 0.07,
      y: 0.93,
      size: 0.042,
      color: '#1d2a44',
      font: 'serifItalic',
      weight: 400,
      align: 'left',
      rot: 0,
      shadow: false,
    });
    return items;
  },
};

export default stickerTemplate;

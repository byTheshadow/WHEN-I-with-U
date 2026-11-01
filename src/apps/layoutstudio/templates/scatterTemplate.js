// src/apps/layoutstudio/templates/scatterTemplate.js
//
// 模板：散点拼贴。
// 上半是浅色底，散落着带照片质感的形状和几个短词；下半是照片本体，
// 散落着白色的形状和短词。形状种类（圆/方/星/花瓣）是模板参数；
// 每个形状放在哪、多大、填照片还是填白色、里面写不写字，由 shape 元素决定。

import { CANVAS_W as W, CANVAS_H as H, SHAPE_KINDS, SHAPE_LABELS } from '../layoutConstants';
import { drawCover } from '../layoutDraw';

const WORDS_TOP = [
  { text: 'soft', x: 0.2, y: 0.28 },
  { text: 'daily', x: 0.1, y: 0.62 },
  { text: ':)', x: 0.64, y: 0.78 },
];
const WORDS_BOTTOM = [
  { text: 'good day', x: 0.08, y: 0.1 },
  { text: 'light', x: 0.72, y: 0.62 },
];

const scatterTemplate = {
  id: 'scatter',
  label: '散点拼贴',
  desc: '上半浅色底，下半照片，撒满形状和短词',
  fits: '适合风景、天空、背景干净的图',
  kinds: ['shape', 'text'],
  paramSpec: {
    shape: { type: 'choice', options: SHAPE_KINDS, default: 'circle' },
    split: { type: 'number', min: 0.3, max: 0.7, default: 0.44 },
    panelColor: { type: 'color', default: '#f1f4f5' },
    tint: { type: 'color', default: '#96645ab3' },
  },
  paramOptions: [
    {
      key: 'shape',
      label: '形状',
      options: SHAPE_KINDS.map((id) => [id, SHAPE_LABELS[id]]),
    },
  ],
  splitY: (params) => params.split * H,

  drawBackground(ctx, photos, params) {
    const splitY = params.split * H;
    ctx.fillStyle = params.panelColor;
    ctx.fillRect(0, 0, W, splitY);
    drawCover(ctx, photos[0], 0, splitY, W, H - splitY);
  },

  buildItems({ rand, photoCount, params }) {
    const split = params.split;
    const items = [];
    const n = Math.max(1, photoCount);

    for (let i = 0; i < 12; i += 1) {
      items.push({
        kind: 'shape',
        id: `t${i}`,
        x: 0.08 + rand() * 0.84,
        y: 0.07 + rand() * (split - 0.14),
        size: 0.022 + rand() * 0.03,
        rot: rand() * 180,
        shape: params.shape,
        fill: 'photo',
        color: '#ffffff',
        photo: i % n,
        text: '',
        textColor: '#ffffff',
      });
    }
    for (let i = 0; i < 10; i += 1) {
      items.push({
        kind: 'shape',
        id: `b${i}`,
        x: 0.08 + rand() * 0.84,
        y: split + 0.07 + rand() * (1 - split - 0.14),
        size: 0.017 + rand() * 0.025,
        rot: rand() * 180,
        shape: params.shape,
        fill: 'white',
        color: '#ffffff',
        photo: 0,
        text: '',
        textColor: '#ffffff',
      });
    }
    const word = (w, i, onPhoto) => ({
      kind: 'text',
      id: `${onPhoto ? 'wb' : 'wt'}${i}`,
      text: w.text,
      x: w.x,
      y: onPhoto ? split + w.y * (1 - split) : w.y * split,
      size: 0.03,
      color: onPhoto ? '#ffffff' : '#1b1b1f',
      font: 'sans',
      weight: 500,
      align: 'left',
      rot: 0,
      shadow: onPhoto,
    });
    WORDS_TOP.forEach((w, i) => items.push(word(w, i, false)));
    WORDS_BOTTOM.forEach((w, i) => items.push(word(w, i, true)));
    return items;
  },
};

export default scatterTemplate;

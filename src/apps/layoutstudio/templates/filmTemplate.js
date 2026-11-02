// src/apps/layoutstudio/templates/filmTemplate.js
//
// 模板：胶片底片。
// 一整条竖向的胶片，两侧是一排排齿孔；只用 1 张主图，装在正中的那一格里，
// 上下两格露出相邻的格子（同一张照片压暗，像还没看的下一张）。
// 底片边缘的编号、感光度小字和下方的一句话，都是 text 元素，可以改、可以删。
// 模板参数：底片底色、齿孔颜色、彩色/黑白、暖色调浓度。

import { CANVAS_W as W, CANVAS_H as H } from '../layoutConstants';
import { drawCover, getGrayCanvas, roundRectPath } from '../layoutDraw';

// 几何（像素，画布 1080x1350）。主格居中偏上，相邻格按 PITCH 上下排开。
const FRAME_X = 128;
const FRAME_W = 824;
const FRAME_H = 900;
const FRAME_Y = 190;
const PITCH = FRAME_H + 40;
const NEIGHBOR_DIM = 0.62;

// 齿孔
const HOLE_W = 36;
const HOLE_H = 52;
const HOLE_R = 9;
const HOLE_PITCH = 88;
const HOLE_START_Y = 20;
const HOLE_CENTERS = [64, W - 64];

// 底片边缘印字的颜色（琥珀色，贴近真实底片的边码）。
const EDGE_COLOR = '#e0a23c';

const drawSprockets = (ctx, color) => {
  ctx.fillStyle = color;
  HOLE_CENTERS.forEach((cx) => {
    for (let y = HOLE_START_Y; y < H; y += HOLE_PITCH) {
      roundRectPath(ctx, cx - HOLE_W / 2, y, HOLE_W, HOLE_H, HOLE_R);
      ctx.fill();
    }
  });
};

const edgeText = (id, text, x, y, align) => ({
  kind: 'text',
  id,
  text,
  x,
  y,
  size: 0.022,
  color: EDGE_COLOR,
  font: 'sans',
  weight: 600,
  align,
  rot: 0,
  shadow: false,
});

const filmTemplate = {
  id: 'film',
  label: '胶片底片',
  desc: '照片装进带齿孔的底片格，上下露出相邻的格子',
  fits: '适合单张人像、街拍，想要复古底片感',
  kinds: ['text'],
  paramSpec: {
    base: { type: 'color', default: '#16120f' },
    hole: { type: 'color', default: '#ece6da' },
    tone: { type: 'choice', options: ['color', 'mono'], default: 'color' },
    warm: { type: 'number', min: 0, max: 0.35, default: 0.1 },
  },
  paramOptions: [
    {
      key: 'tone',
      label: '色调',
      options: [
        ['color', '彩色'],
        ['mono', '黑白'],
      ],
    },
  ],
  splitY: () => 0,

  drawBackground(ctx, photos, params) {
    const photo = photos[0];
    const mono = params.tone === 'mono';

    ctx.fillStyle = params.base;
    ctx.fillRect(0, 0, W, H);

    // 画一格：y 是这一格的顶边（可以在画布外，画布会自动裁掉）。
    const paintFrame = (y, dim) => {
      if (mono) ctx.drawImage(getGrayCanvas(photo, FRAME_W, FRAME_H), FRAME_X, y);
      else drawCover(ctx, photo, FRAME_X, y, FRAME_W, FRAME_H);
      if (params.warm > 0) {
        ctx.fillStyle = `rgba(255,150,60,${params.warm})`;
        ctx.fillRect(FRAME_X, y, FRAME_W, FRAME_H);
      }
      if (dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${dim})`;
        ctx.fillRect(FRAME_X, y, FRAME_W, FRAME_H);
      }
    };

    paintFrame(FRAME_Y - PITCH, NEIGHBOR_DIM);
    paintFrame(FRAME_Y + PITCH, NEIGHBOR_DIM);
    paintFrame(FRAME_Y, 0);

    // 主格一圈极淡的边，让它从底片底色里浮出来一点。
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);

    drawSprockets(ctx, params.hole);
  },

  buildItems() {
    const left = FRAME_X / W;
    const right = (FRAME_X + FRAME_W) / W;
    const topGapY = (FRAME_Y - 20) / H;
    const bottomGapY = (FRAME_Y + FRAME_H + 20) / H;

    return [
      edgeText('ed1', '> 11', left, topGapY, 'left'),
      edgeText('ed2', 'FILM 400', 0.5, topGapY, 'center'),
      edgeText('ed3', '11A', right, topGapY, 'right'),
      edgeText('fn', '12', left, bottomGapY, 'left'),
      edgeText('fn2', '12A', right, bottomGapY, 'right'),
      {
        kind: 'text',
        id: 'cap',
        text: '被好好收下的一天',
        x: 0.5,
        y: 0.925,
        size: 0.05,
        color: '#f4efe6',
        font: 'serifItalic',
        weight: 400,
        align: 'center',
        rot: 0,
        shadow: true,
      },
    ];
  },
};

export default filmTemplate;
// src/apps/layoutstudio/templates/bigTypeTemplate.js
//
// 模板：整图大字。
// 照片铺满并压暗，文字是主角：一个词一行，叠成大标题；另外可以有一两条
// 小字说明。文字内容、字号、颜色、位置、衬线/无衬线，全部来自 text 元素。

import { CANVAS_W as W, CANVAS_H as H } from '../layoutConstants';
import { drawCover } from '../layoutDraw';

const DEFAULT_WORDS = ['今天', '适合', '慢慢走'];
const WORD_COLORS = ['#ffffff', '#c5d9ee', '#ffffff'];

const bigTypeTemplate = {
  id: 'bigtype',
  label: '整图大字',
  desc: '一句话拆成大字，叠在照片正中',
  fits: '适合单张、画面有留白的照片',
  kinds: ['text'],
  paramSpec: {
    dim: { type: 'number', min: 0, max: 0.7, default: 0.24 },
  },
  paramOptions: [],
  splitY: () => 0,

  drawBackground(ctx, photos, params) {
    drawCover(ctx, photos[0], 0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${params.dim})`;
    ctx.fillRect(0, 0, W, H);
  },

  buildItems() {
    const size = 0.15;
    const step = (size * W * 1.1) / H;
    const startY = 0.5 - ((DEFAULT_WORDS.length - 1) / 2) * step;
    const words = DEFAULT_WORDS.map((text, i) => ({
      kind: 'text',
      id: `w${i}`,
      text,
      x: 0.5,
      y: startY + i * step,
      size,
      color: WORD_COLORS[i % WORD_COLORS.length],
      font: 'sans',
      weight: 800,
      align: 'center',
      rot: 0,
      shadow: true,
    }));
    words.push({
      kind: 'text',
      id: 'cap',
      text: '随手记下的一天',
      x: 0.5,
      y: 0.88,
      size: 0.038,
      color: '#fff3a8',
      font: 'sans',
      weight: 700,
      align: 'center',
      rot: 0,
      shadow: true,
    });
    return words;
  },
};

export default bigTypeTemplate;

// src/apps/layoutstudio/templates/bracketTemplate.js
//
// 模板：括号清单。
// 整张照片铺满，上面按"( 缩略图 ) 文字"一行一行排开的清单。
// 底图只有一张全幅照片 + 一层轻微压暗；每一行放在哪、写什么、用哪张
// 缩略图，全部由版面清单里的 row 元素决定。

import { CANVAS_W as W, CANVAS_H as H } from '../layoutConstants';
import { drawCover } from '../layoutDraw';

const DEFAULT_LINES = ['今天的天空', '喝点什么', '带上小熊', '看看风景', '冰淇淋'];

const bracketTemplate = {
  id: 'bracket',
  label: '括号清单',
  desc: '照片上排一份清单，每一行配一张小图',
  fits: '适合多张照片、日常记录',
  kinds: ['row', 'text'],
  paramSpec: {
    dim: { type: 'number', min: 0, max: 0.6, default: 0.14 },
  },
  paramOptions: [],
  splitY: () => 0,

  drawBackground(ctx, photos, params) {
    drawCover(ctx, photos[0], 0, 0, W, H);
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(255,255,255,.08)');
    gradient.addColorStop(1, `rgba(0,0,0,${params.dim + 0.06})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  },

  buildItems({ rand, photoCount }) {
    return DEFAULT_LINES.map((text, i) => ({
      kind: 'row',
      id: `r${i}`,
      text,
      x: 0.5 + (rand() - 0.5) * 0.08,
      y: 0.2 + i * 0.15,
      size: 0.052,
      side: i % 2 === 0 ? 'left' : 'right',
      photo: (i + 1) % Math.max(1, photoCount),
      color: '#ffffff',
    }));
  },
};

export default bracketTemplate;

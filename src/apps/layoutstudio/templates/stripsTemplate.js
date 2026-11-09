// src/apps/layoutstudio/templates/stripsTemplate.js
//
// 模板：竖条拼页。
// 画布从上到下切成几条横带，每条一张照片，每条上面压一小块两端对齐的白色小字
// （spread 元素）。条数跟着照片数走：2 张就是 2 条，3 张是 3 条，4 张及以上是 4 条；
// 只有 1 张时，把同一张照片按不同的缩放和位置裁成 3 条。
// 模板参数：条与条之间的缝（无缝 / 细缝）、压暗程度。

import { CANVAS_W as W, CANVAS_H as H } from '../layoutConstants';
import { drawCoverFocus } from '../layoutDrawExtra';

const MAX_STRIPS = 4;
const THIN_GAP = 8;

// 只有一张照片时，三条分别用的缩放和焦点（焦点是相对照片的 0~1 位置）。
const SINGLE_CROPS = [
  { zoom: 1.1, fx: 0.5, fy: 0.2 },
  { zoom: 1.6, fx: 0.4, fy: 0.5 },
  { zoom: 1.35, fx: 0.6, fy: 0.85 },
];

const DEFAULT_TEXTS = [
  '今天又是 认真 生活 的 一天',
  '喝一口 热的 慢慢 把日子 过成 喜欢的 样子',
  '被好好 收下 的 小事',
  '慢一点 也 没关系',
];

const stripCount = (photoCount) => (photoCount <= 1 ? 3 : Math.min(photoCount, MAX_STRIPS));

const stripsTemplate = {
  id: 'strips',
  label: '竖条拼页',
  desc: '画布切成几条横带，每条一张照片，每条上压一小块两端对齐的小字（spread 元素，词和词之间用空格隔开）',
  fits: '适合多张照片拼页，想要杂志感、碎碎念的文字',
  kinds: ['spread', 'text'],
  paramSpec: {
    gap: { type: 'choice', options: ['none', 'thin'], default: 'none' },
    dim: { type: 'number', min: 0, max: 0.5, default: 0.1 },
  },
  paramOptions: [
    {
      key: 'gap',
      label: '缝隙',
      options: [
        ['none', '无缝'],
        ['thin', '细缝'],
      ],
    },
  ],
  splitY: () => 0,

  drawBackground(ctx, photos, params) {
    const count = stripCount(photos.length);
    const gap = params.gap === 'thin' ? THIN_GAP : 0;
    const single = photos.length === 1;

    for (let i = 0; i < count; i += 1) {
      const top = Math.round((i * H) / count) + (i > 0 ? gap / 2 : 0);
      const bottom = Math.round(((i + 1) * H) / count) - (i < count - 1 ? gap / 2 : 0);
      const crop = single ? SINGLE_CROPS[i % SINGLE_CROPS.length] : { zoom: 1, fx: 0.5, fy: 0.5 };
      const photo = photos[i % photos.length];

      drawCoverFocus(ctx, photo, 0, top, W, bottom - top, crop.zoom, crop.fx, crop.fy);
      if (params.dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${params.dim})`;
        ctx.fillRect(0, top, W, bottom - top);
      }
    }
  },

  buildItems({ rand, photoCount }) {
    const count = stripCount(photoCount);

    return Array.from({ length: count }, (_, i) => {
      const onRight = i % 2 === 0;
      return {
        kind: 'spread',
        id: `s${i}`,
        text: DEFAULT_TEXTS[i % DEFAULT_TEXTS.length],
        x: (onRight ? 0.72 : 0.27) + (rand() - 0.5) * 0.04,
        y: i / count + (1 / count) * (onRight ? 0.3 : 0.7),
        w: 0.36,
        size: 0.026,
        color: '#ffffff',
        weight: 400,
        shadow: true,
      };
    });
  },
};

export default stripsTemplate;
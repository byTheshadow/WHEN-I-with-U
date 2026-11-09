// src/apps/layoutstudio/templates/capsuleTemplate.js
//
// 模板：心情胶囊。
// 整张照片虚化并压暗当氛围背景，正中间一颗磨砂玻璃胶囊（pill 元素），里面排一行
// emoji，左下角挂着想法气泡的两个小圆点；胶囊下面是一行小字（普通 text 元素）。
// 模板参数：虚化程度（轻 / 中 / 重）、压暗程度。

import { CANVAS_W as W, CANVAS_H as H } from '../layoutConstants';
import { getBlurCanvas } from '../layoutDrawExtra';
import { DEFAULT_PILL_TEXT } from '../layoutSpecExtra';

// 虚化程度对应"缩小几级"：级数越多越糊。
const BLUR_LEVELS = { light: 2, medium: 3, heavy: 4 };

const capsuleTemplate = {
  id: 'capsule',
  label: '心情胶囊',
  desc: '照片虚化压暗当背景，中间一颗磨砂胶囊（pill 元素，text 里写一排 emoji，最多 6 个），下面配一行小字',
  fits: '适合桌面、静物、随手拍，想要"今天的心情"这种氛围短句',
  kinds: ['pill', 'text'],
  paramSpec: {
    blur: { type: 'choice', options: ['light', 'medium', 'heavy'], default: 'medium' },
    dim: { type: 'number', min: 0, max: 0.7, default: 0.3 },
  },
  paramOptions: [
    {
      key: 'blur',
      label: '虚化',
      options: [
        ['light', '轻'],
        ['medium', '中'],
        ['heavy', '重'],
      ],
    },
  ],
  splitY: () => 0,

  drawBackground(ctx, photos, params) {
    const level = BLUR_LEVELS[params.blur] || BLUR_LEVELS.medium;
    ctx.drawImage(getBlurCanvas(photos[0], W, H, level), 0, 0, W, H);

    ctx.fillStyle = `rgba(0,0,0,${params.dim})`;
    ctx.fillRect(0, 0, W, H);
  },

  buildItems() {
    return [
      {
        kind: 'pill',
        id: 'pl',
        text: DEFAULT_PILL_TEXT,
        x: 0.5,
        y: 0.45,
        size: 0.075,
        color: '#ffffff',
      },
      {
        kind: 'text',
        id: 'cap',
        text: '今天的心情',
        x: 0.5,
        y: 0.547,
        size: 0.04,
        color: '#ffffff',
        font: 'sans',
        weight: 300,
        align: 'center',
        rot: 0,
        shadow: false,
      },
    ];
  },
};

export default capsuleTemplate;
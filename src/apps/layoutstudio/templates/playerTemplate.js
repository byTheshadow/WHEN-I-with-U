// src/apps/layoutstudio/templates/playerTemplate.js
//
// 模板：音乐播放器。
// 整张照片铺满，轻轻压暗（越往下越暗），下半部叠一个播放器：
// 歌名和歌手是两个普通 text 元素（可以改、可以删），播放器本体是一个 player 元素
// （进度条、时间、上一首/暂停/下一首、音量条）。

import { CANVAS_W as W, CANVAS_H as H } from '../layoutConstants';
import { drawCover } from '../layoutDraw';

const formatTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

const playerTemplate = {
  id: 'player',
  label: '音乐播放器',
  desc: '照片压暗后，下半部叠一个音乐播放器；歌名和歌手用 text 元素写在播放器上方，左对齐',
  fits: '适合氛围感的桌面、咖啡、街景，想要"正在听歌"的感觉',
  kinds: ['player', 'text'],
  paramSpec: {
    dim: { type: 'number', min: 0, max: 0.7, default: 0.34 },
  },
  paramOptions: [],
  splitY: () => 0,

  drawBackground(ctx, photos, params) {
    drawCover(ctx, photos[0], 0, 0, W, H);

    ctx.fillStyle = `rgba(0,0,0,${params.dim * 0.5})`;
    ctx.fillRect(0, 0, W, H);

    const gradient = ctx.createLinearGradient(0, H * 0.3, 0, H);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${params.dim})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, H * 0.3, W, H * 0.7);
  },

  buildItems({ rand }) {
    const progress = Math.round((0.16 + rand() * 0.5) * 100) / 100;

    return [
      {
        kind: 'text',
        id: 'ti',
        text: '今天也想你',
        x: 0.12,
        y: 0.53,
        size: 0.052,
        color: '#ffffff',
        font: 'sans',
        weight: 500,
        align: 'left',
        rot: 0,
        shadow: true,
      },
      {
        kind: 'text',
        id: 'ar',
        text: '某个很安静的夜晚',
        x: 0.12,
        y: 0.585,
        size: 0.04,
        color: '#ffffffd9',
        font: 'sans',
        weight: 300,
        align: 'left',
        rot: 0,
        shadow: true,
      },
      {
        kind: 'player',
        id: 'pl',
        x: 0.5,
        y: 0.76,
        size: 0.76,
        progress,
        volume: 0.62,
        time: formatTime(Math.round(progress * 200)),
        playing: true,
        color: '#ffffff',
      },
    ];
  },
};

export default playerTemplate;
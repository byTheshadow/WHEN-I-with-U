// src/apps/hub/hubPageLayouts/drift/driftData.js
//
// 「漂流星群」整页版式的数据层：把 appRegistry.js 的分组变成 6 个「星群」，每个
// 星群里的应用漂成一圈气泡。应用的名称、图标、分组、副标题都来自 appRegistry.js
// （改注册表，这里自动同步）；这个文件只补版式自己的东西：星群的短名和英文名、
// 每个应用一句话的说明（点中气泡后在下方卡片里显示）、气泡的摆放坐标。
//
// 气泡坐标基于 390 宽的参考画布（x、y、s 都是像素，d 是视差深度）。按星群里的应用
// 数量选一套摆法；数量不在预设里时，用前 7 个基础位置，多出来的在下面补一排。

import { getGroupedHubApps } from '../../appRegistry';

// 每个分组（appRegistry 里的 HUB_APP_GROUPS）对应的星群信息。tint 是 drift.css 里
// 定义的色调变量名。分组 id 以 appRegistry.js 为准；缺了也不会崩，会回退成分组自己的名字。
export const DRIFT_REALM_COPY = {
  talk: { short: '对话', en: 'Voices', tint: '--dr-b1' },
  memory: { short: '记忆', en: 'Keepsakes', tint: '--dr-d1' },
  story: { short: '故事', en: 'Tales', tint: '--dr-b3' },
  daily: { short: '日常', en: 'Days', tint: '--dr-d2' },
  play: { short: '小物', en: 'Trinkets', tint: '--dr-d1' },
  tools: { short: '工具', en: 'Tools', tint: '--dr-b3' },
};

// 每个应用一句话说明。缺的应用回退到注册表里的副标题，不会显示空白。
export const DRIFT_APP_NOTES = {
  ensemble: '多角色群聊',
  bubble: '泡泡群聊，还在装修中',
  rp: '长篇沉浸式角色扮演',
  callHistory: '语音通话的记录',
  askbox: '匿名提问，有没回答的问题时会亮一个小点',
  diaries: '同步下来的日记',
  memory: '私人记忆档案',
  archive: '旧消息归档',
  ephemera: '一张张时光票根',
  snapshots: '拍立得动态流',
  almanac: '随季节写下的笔记',
  'margin-notes': '一起读书、在页边写批注',
  imaginarium: '自由形式的协作小说室',
  fiction: '互动文游书架',
  'shared-world': '共享世界的小册子',
  imagestudio: '生图工作室',
  layoutstudio: '修图与版面调整',
  greeting: '写给对方的贺卡',
  planner: '共享日程',
  rhythm: '学习节律',
  newspaper: '每天早上的晨报',
  travel: '旅行日志',
  tripHome: '旅行小屋寄来的明信片',
  footprintMap: '去过的地方',
  flightchess: '掷骰子的飞行棋',
  textgames: '文字游戏大厅',
  pebbling: '互相传递小石头',
  habitat: '生态瓶，有栖息地时会亮一个小点',
  shell: '被冲上岸的碎片',
  emotionkit: '抽一张情绪急救便签',
  badges: '每月限定图标兑换',
  workflows: '定时工作流，有启用中的时会亮一个小点',
  hourglass: '接口调用记录',
};

export const DRIFT_TINT_CYCLE = ['--dr-b1', '--dr-d2', '--dr-d1', '--dr-b3', '--dr-d2', '--dr-b1', '--dr-d1'];

export const DRIFT_STARS = [
  [6, 40],
  [88, 22],
  [34, 86],
];

// 点中 Messages 月亮后，下方药丸里轮换的话。
export const DRIFT_WHISPERS = [
  '轻触月亮，听听今天的第一句',
  '上次的话题，还在原地等你',
  '轻一点说，也会被听见',
  '今天想先聊点什么？',
];

const BASE_POSITIONS = [
  { x: 28, y: 18, s: 104, d: 1.4 },
  { x: 200, y: 6, s: 84, d: 0.8 },
  { x: 268, y: 128, s: 96, d: 1.2 },
  { x: 150, y: 140, s: 78, d: 0.6 },
  { x: 20, y: 180, s: 86, d: 1 },
  { x: 176, y: 262, s: 72, d: 0.7 },
  { x: 292, y: 262, s: 70, d: 1.1 },
];

const PRESET_LAYOUTS = {
  2: {
    height: 250,
    positions: [
      { x: 56, y: 40, s: 120, d: 1.3 },
      { x: 222, y: 116, s: 100, d: 0.8 },
    ],
  },
  5: { height: 310, positions: BASE_POSITIONS.slice(0, 5) },
  6: { height: 372, positions: BASE_POSITIONS.slice(0, 6) },
  7: { height: 372, positions: BASE_POSITIONS.slice(0, 7) },
};

export const getDriftLayout = (count) => {
  if (PRESET_LAYOUTS[count]) return PRESET_LAYOUTS[count];

  const positions = BASE_POSITIONS.slice(0, Math.min(count, BASE_POSITIONS.length));
  for (let index = BASE_POSITIONS.length; index < count; index += 1) {
    const offset = index - BASE_POSITIONS.length;
    positions.push({
      x: 28 + (offset % 3) * 120,
      y: 350 + Math.floor(offset / 3) * 110,
      s: 72,
      d: 0.8,
    });
  }

  let height = 372;
  if (count <= 2) height = 250;
  else if (count <= 5) height = 310;
  else if (count > BASE_POSITIONS.length) {
    height = 372 + Math.ceil((count - BASE_POSITIONS.length) / 3) * 110;
  }

  return { height, positions };
};

export const getDriftAppNote = (app) =>
  DRIFT_APP_NOTES[app.id] || app.sub || '';

export const buildDriftRealms = () =>
  getGroupedHubApps().map((group) => {
    const copy = DRIFT_REALM_COPY[group.id] || {};
    return {
      id: group.id,
      short: copy.short || group.label.slice(0, 2),
      en: copy.en || group.en,
      zh: group.label,
      tint: copy.tint || '--dr-b1',
      apps: group.apps.filter((app) => !app.pinned),
    };
  });

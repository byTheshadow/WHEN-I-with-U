// src/apps/badges/DecemberScene.jsx
//
// 十二月限定赛季——"圣诞雪境"场景（纯渲染，不碰数据库）。
// 由 BadgeDancingLineBoard.jsx 在赛季的 sceneKind === 'december' 时使用，
// 样式在同目录的 decemberScene.css（所有类名、自定义属性、关键帧都带 dc- 前缀）。
//
// 浮空雪地上有 6 个展台，对应 6 枚图标主题，但解锁规则仍然是"三个条件全部达成，整套一起解锁"：
//   展台 0 初雪      冰晶   = 节点 0（第一个条件）
//   展台 1 袜中礼物  礼盒   = 节点 1（第二个条件）
//   展台 2 铃声响起  花环   = 节点 2（第三个条件）
//   展台 3 点亮圣诞树 木花箱 ┐
//   展台 4 北极星    星夜水晶 ├ 三个条件全部点亮才一起解冻 = 节点 3（终点）
//   展台 5 零点钟声  雪夜钟楼 ┘
// 展台上的徽章是主题小图标（场景装饰），真正的图标图片在页面下方的"本月图标"网格里。
//
// 场景里的树、雪人、路灯、拐杖糖等是"面向观察者的 2D 叠加层"，靠 3D 锚点定位。
// 为了省电，叠加层只在需要的时候（视差在动、悬停 / 选中 / 点亮的过渡中、窗口缩放）重算位置，
// 不是每一帧都算。所有写死的 HTML 字符串都是静态内容，不含任何用户输入。
//
// Props（跟万圣节 / 十一月场景保持同一套接口，多一个可选的 labels）：
//   lit          [boolean, boolean, boolean, boolean]  三个条件 + 终点是否点亮
//   selectedIdx  number  当前选中的节点（0-3）
//   fxEnabled    boolean 是否启用动效（视差、飘雪、灯火、极光）
//   onNodeClick  (i: number) => void
//   labels       string[] 6 个展台的名字（缺省用写死的名字，通常传 seasonDef.badges 的 title）

import React, { useEffect, useMemo, useRef, useState } from 'react';

import './decemberScene.css';

export const DECEMBER_SCENE_HEIGHT = 440;

/** 前三个条件节点对应的小图标类型（第四个终点是 'clock'）。 */
export const DECEMBER_NODE_TYPES = ['flake', 'gift', 'bell'];

/* ─────────────────────────────────────────────
   图标
───────────────────────────────────────────── */
const ICONS = {
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2M4 10.5l3.5-.5L6 7M20 13.5l-3.5.5L18 17M4 13.5l3.5.5L6 17M20 10.5l-3.5-.5L18 7"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 9h20M12 9v12"/><path d="M12 9c-2-4-6-5-6-2s4 2 6 2zm0 0c2-4 6-5 6-2s-4 2-6 2z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="M12 3v2"/></svg>',
  tree: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M12 2l4 6h-2l4 6h-3l4 5H5l4-5H6l4-6H8z"/><path d="M12 19v3"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M5 4L2 7M19 4l3 3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="#dff3f8" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};
const FLAKE = ICONS.snow.replace('stroke-width="2"', 'stroke-width="2.6"');

const MINITREE = (lights) => `<svg viewBox="0 0 30 46"><path d="M15 0L26 18H20L29 34H1L10 18H4z" fill="#2f9a74"/><path d="M15 0L4 18H10L1 34H15z" fill="#1f6b52"/><path d="M5 16h20M3 32h24" stroke="#f2fafc" stroke-width="3" stroke-linecap="round"/><rect x="13" y="34" width="4" height="10" fill="#6b4426"/>${lights ? '<circle class="dc-tl" cx="11" cy="24" r="1.8" fill="#f3c56c"/><circle class="dc-tl" style="--dc-td:-.7s" cx="19" cy="27" r="1.8" fill="#e5485c"/><circle class="dc-tl" cx="16" cy="12" r="1.6" fill="#8fd3e6"/>' : ''}</svg>`;

/* 每个展台周围的小物件（叠在徽章周围） */
const PROPS = {
  snow: `<div class="dc-prop dc-drift"></div>
    <div class="dc-prop dc-orb" style="--dc-od:0s">${FLAKE}</div>
    <div class="dc-prop dc-orb" style="--dc-od:-1.7s">${FLAKE}</div>
    <div class="dc-prop dc-orb" style="--dc-od:-3.4s">${FLAKE}</div>`,
  gift: `<i class="dc-prop dc-spark" style="left:-10px;top:10px;--dc-sd:0s"></i>
    <i class="dc-prop dc-spark" style="right:-12px;top:-4px;--dc-sd:-.8s"></i>
    <i class="dc-prop dc-spark" style="right:-6px;top:56px;--dc-sd:-1.5s;width:9px;height:9px"></i>
    <i class="dc-prop dc-spark" style="left:2px;top:-14px;--dc-sd:-1.1s;width:8px;height:8px"></i>`,
  bell: `<svg class="dc-prop dc-holly" viewBox="0 0 44 36"><path d="M22 18C14 6 4 8 2 4c2 8-2 10 4 14 4 2 10 2 16 0z" fill="#2f9a74"/><path d="M22 18c8-12 18-10 20-14-2 8 2 10-4 14-4 2-10 2-16 0z" fill="#1f6b52"/><circle cx="19" cy="20" r="4" fill="#e5485c"/><circle cx="26" cy="21" r="4" fill="#c8323c"/><circle cx="22.5" cy="26" r="4" fill="#e5485c"/><circle cx="18" cy="18.5" r="1.2" fill="#fff" opacity=".7"/></svg>
    <svg class="dc-prop dc-bells" viewBox="0 0 26 50"><path d="M13 0v14" stroke="#e5485c" stroke-width="2"/><path d="M5 30a8 8 0 0 1 16 0v6l3 3H2l3-3z" fill="#f3c56c"/><path d="M7 30a6 6 0 0 1 6-6" stroke="#fff6d6" stroke-width="2" fill="none"/><circle cx="13" cy="42" r="3" fill="#a7772f"/><circle cx="13" cy="15" r="3" fill="#e5485c"/></svg>`,
  tree: `<div class="dc-prop dc-minitree dc-l">${MINITREE(true)}</div><div class="dc-prop dc-minitree dc-r">${MINITREE(false)}</div>`,
  star: `<div class="dc-prop dc-halo-star"></div>
    <div class="dc-prop dc-orb" style="--dc-od:0s"><i class="dc-st"></i></div>
    <div class="dc-prop dc-orb" style="--dc-od:-2.6s"><i class="dc-st"></i></div>`,
  clock: `<svg class="dc-prop dc-spire" viewBox="0 0 80 40" preserveAspectRatio="none"><path d="M6 40L40 4 74 40z" fill="#2c3655"/><path d="M40 4L74 40H40z" fill="#3e4c7a"/><path d="M40 4L30 14 34 16 40 10 46 16 50 14z" fill="#f2fafc"/></svg>
    <i class="dc-prop dc-chime"></i><i class="dc-prop dc-chime" style="--dc-cd:-1.2s"></i>`,
};

/* 展台在 760×560 平台上的位置和高度。node：点击后选中哪个节点（后三个都是终点节点 3）。 */
const STANDS = [
  { theme: 'snow', c: '#7cc8e2', x: 250, y: 180, h: 60, node: 0, name: '初雪' },
  { theme: 'gift', c: '#e5485c', x: 410, y: 150, h: 44, node: 1, name: '袜中礼物' },
  { theme: 'bell', c: '#e8b24f', x: 300, y: 360, h: 52, node: 2, name: '铃声响起' },
  { theme: 'tree', c: '#2f9a74', x: 470, y: 330, h: 36, node: 3, name: '点亮圣诞树' },
  { theme: 'star', c: '#a98cf5', x: 640, y: 310, h: 70, node: 3, name: '北极星' },
  { theme: 'clock', c: '#6f8cff', x: 600, y: 100, h: 118, node: 3, name: '零点钟声' },
];

/* ─────────────────────────────────────────────
   静态场景（拼 HTML 字符串，只在模块加载时拼一次）
───────────────────────────────────────────── */
const box = (w, d, h, cls = '', inner = '', fxInner = '', fyInner = '') =>
  `<div class="dc-box ${cls}" style="--dc-bw:${w}px;--dc-bd:${d}px;--dc-bh:${h}px"><i class="dc-top"></i><i class="dc-fx">${fxInner}</i><i class="dc-fy">${fyInner}</i>${inner}</div>`;

const at = (x, y, html, extra = '') =>
  `<div class="dc-at" style="--dc-x:${x}px;--dc-y:${y}px;${extra}">${html}</div>`;

const CANE = '<svg class="dc-cane" viewBox="0 0 20 56"><path d="M6 56V14a6 6 0 0 1 12 0v4" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M6 56V14a6 6 0 0 1 12 0v4" fill="none" stroke="#e5485c" stroke-width="6" stroke-dasharray="4 5" stroke-linecap="round"/></svg>';
const SNOWMAN = '<div class="dc-snowman"><i class="dc-arm dc-l"></i><i class="dc-arm dc-r"></i><i class="dc-b dc-b1"></i><i class="dc-b dc-b2"></i><i class="dc-b dc-b3"></i><i class="dc-btn1"></i><i class="dc-btn2"></i><i class="dc-eye" style="left:19px"></i><i class="dc-eye" style="left:28px"></i><i class="dc-nose"></i><i class="dc-scarf"></i><i class="dc-tail"></i><i class="dc-brim"></i><i class="dc-hat"></i></div>';
const LAMP = '<div class="dc-lamp"><i class="dc-pole"></i><i class="dc-base"></i><i class="dc-head"></i><i class="dc-cap"></i><i class="dc-bow"></i></div>';

const tree = (w, star, orns) => {
  const o = orns
    ? '<i class="dc-orn" style="top:40%;left:38%;--dc-oc:#e5485c"></i><i class="dc-orn" style="top:58%;left:60%;--dc-oc:#f3c56c;--dc-od:-1s"></i><i class="dc-orn" style="top:74%;left:30%;--dc-oc:#8fd3e6;--dc-od:-.5s"></i>'
    : '';
  return {
    sh: w,
    html: `<div class="dc-tree" style="--dc-w:${w}px"><i class="dc-t1"></i><i class="dc-t2"></i><i class="dc-t3"></i><i class="dc-trunk"></i>${star ? '<i class="dc-star"></i>' : ''}${o}</div>`,
  };
};

const SLEIGH_SVG = '<svg viewBox="0 0 200 60" fill="#0a1626" stroke="#0a1626" stroke-linecap="round"><path d="M118 38h46c8 0 12-6 14-14l3-8h-6l-3 8c-1 5-4 7-9 7h-40z" stroke="none"/><path d="M112 46h66c8 0 11-4 12-9" fill="none" stroke-width="2.5"/><path d="M124 38v8M160 38v8" stroke-width="2"/><circle cx="146" cy="20" r="6" stroke="none"/><path d="M140 30h14l-2-8h-10z" stroke="none"/><path d="M128 24c4-4 8-4 12 0l-2 6h-8z" stroke="none"/><path d="M96 26C108 28 116 30 124 30" fill="none" stroke-width="1.2"/><g stroke="none"><ellipse cx="78" cy="28" rx="12" ry="5"/><circle cx="92" cy="21" r="3.5"/><path d="M86 26l5-5 2 2-5 5z"/></g><path d="M70 31l-5 9M74 32l-2 9M84 31l4 8M87 30l7 6M92 18l-2-6M92 18l3-6M90 14l-3-1M95 13l3-1" fill="none" stroke-width="1.6"/><g stroke="none"><ellipse cx="44" cy="26" rx="12" ry="5"/><circle cx="58" cy="19" r="3.5"/><path d="M52 24l5-5 2 2-5 5z"/></g><path d="M36 29l-5 9M40 30l-2 9M50 29l4 8M53 28l7 6M58 16l-2-6M58 16l3-6M56 12l-3-1M61 11l3-1" fill="none" stroke-width="1.6"/><path d="M60 22C72 24 82 24 90 23" fill="none" stroke-width="1"/></svg>';

/** 拼出整个静态场景：地面上的 3D 部分（sceneHtml）+ 面向观察者的 2D 叠加层（overlaysHtml）。 */
const buildStatic = () => {
  const overlays = [];
  let h = '';

  const deco = (x, y, item, shadow) => {
    const id = `a${overlays.length}`;
    overlays.push(`<div class="dc-att" data-a="${id}">${item.html || item}</div>`);
    const sw = shadow || item.sh || 30;
    return at(
      x,
      y,
      `<i class="dc-fshadow" style="left:${-sw * 0.6}px;top:${-sw * 0.3}px;width:${sw * 1.2}px;height:${sw * 0.6}px;transform:translate(${sw * 0.15}px,${sw * 0.15}px) translateZ(1px)"></i><i class="dc-anc" data-anchor="${id}"></i>`,
    );
  };

  // 栅栏
  h += '<div class="dc-fence-y"></div><div class="dc-fence-x"></div>';

  // 小屋（门窗直接放进左右两面墙里）
  const houseFy = '<i class="dc-win" style="left:14px;top:26px"></i><i class="dc-win" style="left:90px;top:26px"></i><i class="dc-wreath-door"></i>';
  const houseFx = '<i class="dc-win" style="left:30px;top:36px;width:22px;height:24px"></i>';
  const chimney = box(
    18,
    18,
    62,
    'dc-chim',
    '<i class="dc-anchor" data-anchor="smoke" style="position:absolute;left:9px;top:9px;width:1px;height:1px;transform:translateZ(62px)"></i>',
  );
  const roof = `<div class="dc-roof" style="--dc-bh:72px"><i class="dc-front"></i><i class="dc-back"></i><i class="dc-gable"></i><div class="dc-at" style="--dc-x:88px;--dc-y:12px">${chimney}</div></div>`;
  h += at(
    36,
    36,
    `<i class="dc-fshadow" style="left:-10px;top:-10px;width:170px;height:130px;transform:translate(14px,14px) translateZ(1px)"></i>${box(130, 96, 72, 'dc-house', roof, houseFx, houseFy)}`,
  );

  // 冰湖（带两道滑痕）
  h += '<i class="dc-pond" style="left:46px;top:380px;width:190px;height:120px"><i class="dc-skate" style="left:30px;top:30px;width:90px;height:50px"></i><i class="dc-skate" style="left:60px;top:46px;width:100px;height:56px;transform:rotate(160deg)"></i></i>';

  // 路灯光池
  [[70, 200], [600, 470], [730, 230]].forEach(([x, y]) => {
    h += `<i class="dc-pool" style="left:${x - 80}px;top:${y - 80}px;width:160px;height:160px"></i>`;
  });

  // 石板小路（从小屋门口蜿蜒到展台之间）；旋转角度用固定公式，保证每次渲染一样
  const path = [[100, 150], [125, 215], [180, 280], [260, 300], [360, 310], [440, 296], [560, 282], [640, 250], [720, 232]];
  let stoneIdx = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 30));
    for (let k = 0; k < n; k += 1) {
      const t = k / n;
      const rot = ((stoneIdx * 37) % 40) - 20;
      h += `<i class="dc-stone" style="left:${x1 + (x2 - x1) * t - 10}px;top:${y1 + (y2 - y1) * t - 10}px;--dc-r:${rot}deg"></i>`;
      stoneIdx += 1;
    }
  }

  // 礼物堆
  h += at(150, 140, box(26, 26, 22, 'dc-gift'), '--dc-gc:#e5485c');
  h += at(182, 128, box(18, 18, 16, 'dc-gift'), '--dc-gc:#3f74e0');
  h += at(560, 470, box(32, 32, 28, 'dc-gift'), '--dc-gc:#2f9a74');
  h += at(600, 500, box(22, 22, 18, 'dc-gift'), '--dc-gc:#a98cf5');
  h += at(530, 505, box(18, 18, 30, 'dc-gift'), '--dc-gc:#e8b24f');

  // 树林
  h += deco(704, 50, tree(78, true, true));
  h += deco(650, 30, tree(46));
  h += deco(742, 118, tree(40));
  h += deco(262, 30, tree(44));
  h += deco(330, 40, tree(30));
  h += deco(40, 300, tree(52, false, true));
  h += deco(30, 350, tree(34));
  h += deco(470, 520, tree(50));
  h += deco(730, 520, tree(42));
  h += deco(180, 545, tree(36));

  // 雪人、路灯、拐杖糖
  h += deco(290, 525, SNOWMAN, 56);
  h += deco(70, 200, LAMP, 20);
  h += deco(600, 470, LAMP, 20);
  h += deco(730, 230, LAMP, 20);
  h += deco(400, 500, CANE, 14);
  h += deco(110, 260, CANE, 14);
  h += deco(740, 400, CANE, 14);

  // 平台外漂浮的冰块
  [[-120, 120, -40, 46, 0], [860, 160, -70, 38, -2], [340, 660, -110, 52, -4], [-90, 470, -140, 34, -1], [600, -110, -60, 40, -3], [880, 470, -120, 28, -5]].forEach(
    ([x, y, z, s, d]) => {
      h += `<div class="dc-at dc-chunk" style="--dc-x:${x}px;--dc-y:${y}px;--dc-z0:${z}px;--dc-dl:${d}s">${box(s, s, s * 0.7)}</div>`;
    },
  );

  // 烟囱炊烟（叠加层，z 在其它叠加层下面）
  overlays.push(
    `<div class="dc-att dc-smoke" data-a="smoke" data-z="-1">${[0, -1.4, -2.8].map((d) => `<i style="--dc-pd:${d}s"></i>`).join('')}</div>`,
  );

  return { sceneHtml: h, overlaysHtml: overlays.join('') };
};

const { sceneHtml: SCENE_HTML, overlaysHtml: OVERLAYS_HTML } = buildStatic();

/* 展台顶上的小摆件（目前只有礼盒展台有两个小礼物） */
const ONTOP = {
  gift: at(4, 70, box(20, 20, 18, 'dc-gift'), '--dc-gc:#3f74e0') + at(72, 6, box(16, 16, 14, 'dc-gift'), '--dc-gc:#2f9a74'),
};

const CLOCKFACE = '<i class="dc-clockface"><i class="dc-hh"></i><i class="dc-mh"></i><i class="dc-cd"></i></i>';

/* 随机的星星、地面闪光、彩灯：只在组件第一次渲染时生成一次 */
const BULB_COLORS = ['#e5485c', '#f3c56c', '#7ee0b8', '#8fd3e6', '#c9a7ff'];
const makeDecor = () => ({
  stars: Array.from({ length: 90 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 65}%`,
    '--dc-d': `${2 + Math.random() * 4}s`,
    '--dc-delay': `${-Math.random() * 5}s`,
  })),
  glints: Array.from({ length: 30 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${-Math.random() * 4}s`,
    animationDuration: `${3 + Math.random() * 3}s`,
  })),
  bulbsX: Array.from({ length: 14 }, (_, i) => ({ '--dc-b': BULB_COLORS[i % 5], '--dc-bd': `${i % 2 ? -0.8 : 0}s` })),
  bulbsY: Array.from({ length: 19 }, (_, i) => ({ '--dc-b': BULB_COLORS[i % 5], '--dc-bd': `${i % 2 ? -0.8 : 0}s` })),
});

/* ─────────────────────────────────────────────
   组件
───────────────────────────────────────────── */
export function DecemberScene({ lit = [], selectedIdx = 0, fxEnabled = true, onNodeClick, labels }) {
  const rootRef = useRef(null);
  const pinsRef = useRef(null);
  const canvasRef = useRef(null);
  const kickRef = useRef(() => {});
  const [hotIdx, setHotIdx] = useState(-1);
  const [unlocking, setUnlocking] = useState(false);
  const decor = useMemo(makeDecor, []);

  const allLit = Boolean(lit[3]);
  const prevAllLit = useRef(allLit);

  // 终点刚点亮的那一刻：后三个展台放一次光柱 + 翻转动画
  useEffect(() => {
    let timer;
    if (!prevAllLit.current && allLit) {
      setUnlocking(true);
      timer = setTimeout(() => setUnlocking(false), 1600);
    }
    prevAllLit.current = allLit;
    return () => clearTimeout(timer);
  }, [allLit]);

  // 状态变化（悬停 / 选中 / 点亮）会让展台升降，叠加层要跟着重新定位一小段时间
  useEffect(() => {
    kickRef.current(1800);
  }, [hotIdx, selectedIdx, allLit, lit[0], lit[1], lit[2], unlocking]);

  // 叠加层定位 + 视差 + 缩放：一个循环，只在"脏"的时候才重算位置
  useEffect(() => {
    const root = rootRef.current;
    const pins = pinsRef.current;
    if (!root || !pins) return undefined;

    const atts = [];
    root.querySelectorAll('[data-anchor]').forEach((anchor) => {
      const el = pins.querySelector(`[data-a="${anchor.getAttribute('data-anchor')}"]`);
      if (el) atts.push({ anchor, el, z: Number(el.getAttribute('data-z') || 0) });
    });
    root.querySelectorAll('[data-slot-anchor]').forEach((anchor) => {
      const el = pins.querySelector(`[data-pin="${anchor.getAttribute('data-slot-anchor')}"]`);
      if (el) atts.push({ anchor, el, z: 0 });
    });

    const place = () => {
      const pr = pins.getBoundingClientRect();
      for (const a of atts) {
        const r = a.anchor.getBoundingClientRect();
        const y = r.top + r.height / 2 - pr.top;
        a.el.style.left = `${r.left + r.width / 2 - pr.left}px`;
        a.el.style.top = `${y}px`;
        a.el.style.zIndex = a.z < 0 ? 1 : Math.round(y) + 10;
      }
    };

    let dirtyUntil = performance.now() + 2500; // 入场动画期间也要跟着
    const kick = (ms = 900) => {
      dirtyUntil = Math.max(dirtyUntil, performance.now() + ms);
    };
    kickRef.current = kick;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let lastRz = null;
    let lastRx = null;

    const onMove = (e) => {
      if (!fxEnabled) return;
      const r = root.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      kick(400);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick(900);
    };

    const fit = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (!w || !h) return;
      root.style.setProperty('--dc-scale', Math.min(1.1, w / 980, h / 560).toFixed(3));
      root.style.setProperty('--dc-w', `${w}px`);
      kick(300);
    };

    let raf = 0;
    const tick = (now) => {
      if (fxEnabled) {
        cx += (tx - cx) * 0.06;
        cy += (ty - cy) * 0.06;
        const rz = (45 + cx * 10).toFixed(2);
        const rx = (58 - cy * 6).toFixed(2);
        if (rz !== lastRz || rx !== lastRx) {
          root.style.setProperty('--dc-rz', `${rz}deg`);
          root.style.setProperty('--dc-rx', `${rx}deg`);
          lastRz = rz;
          lastRx = rx;
          kick(120);
        }
      } else if (lastRz !== null) {
        root.style.removeProperty('--dc-rz');
        root.style.removeProperty('--dc-rx');
        lastRz = null;
        lastRx = null;
        kick(200);
      }
      if (now < dirtyUntil) place();
      raf = requestAnimationFrame(tick);
    };

    fit();
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(fit);
      observer.observe(root);
    } else {
      window.addEventListener('resize', fit);
    }
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', fit);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [fxEnabled]);

  // 飘雪（画布）：光效关闭时不画
  useEffect(() => {
    const cv = canvasRef.current;
    const root = rootRef.current;
    if (!cv || !root) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;

    if (!fxEnabled) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      return undefined;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    let flakes = [];
    let raf = 0;

    const size = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (!w || !h) return;
      W = cv.width = Math.round(w * dpr);
      H = cv.height = Math.round(h * dpr);
      flakes = Array.from({ length: Math.min(110, Math.floor(w / 6)) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (Math.random() * 2.2 + 0.6) * dpr,
        s: Math.random() * 0.6 + 0.3,
        o: Math.random() * 6.28,
      }));
    };
    size();

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(size);
      observer.observe(root);
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.y += f.s * dpr * 1.1;
        f.o += 0.01;
        f.x += Math.sin(f.o) * 0.4 * dpr;
        if (f.y > H) {
          f.y = -5;
          f.x = Math.random() * W;
        }
        if (f.x > W) f.x = 0;
        if (f.x < 0) f.x = W;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, 6.283);
        ctx.fillStyle = `rgba(235,247,252,${0.35 + f.r / (6 * dpr)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
    };
  }, [fxEnabled]);

  return (
    <div
      ref={rootRef}
      className={`dc-scene${fxEnabled ? '' : ' dc-scene--still'}`}
      role="group"
      aria-label="十二月成就场景"
    >
      <div className="dc-sky" aria-hidden="true">
        <div className="dc-aurora" />
        <div className="dc-stars">
          {decor.stars.map((style, i) => (
            <i key={i} style={style} />
          ))}
        </div>
        <div className="dc-moon" />
        <div className="dc-sleigh" dangerouslySetInnerHTML={{ __html: SLEIGH_SVG }} />
      </div>

      <canvas ref={canvasRef} className="dc-snow" aria-hidden="true" />

      <div className="dc-stage">
        <div className="dc-scaler">
          <div className="dc-world">
            <div className="dc-platform">
              <div className="dc-halo" />
              <div className="dc-floor">
                {decor.glints.map((style, i) => (
                  <i key={i} className="dc-glint" style={style} />
                ))}
              </div>
              <div className="dc-side-x">
                <div className="dc-bulbs">
                  {decor.bulbsX.map((style, i) => (
                    <i key={i} style={style} />
                  ))}
                </div>
              </div>
              <div className="dc-side-y">
                <div className="dc-bulbs">
                  {decor.bulbsY.map((style, i) => (
                    <i key={i} style={style} />
                  ))}
                </div>
              </div>
            </div>

            <div className="dc-layer" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SCENE_HTML }} />

            <div className="dc-layer">
              {STANDS.map((s, i) => {
                const isLit = Boolean(lit[s.node]);
                const isSelected = selectedIdx === s.node;
                const label = labels?.[i] || s.name;
                const className = [
                  'dc-slot',
                  `dc-t-${s.theme}`,
                  isLit ? '' : 'dc-locked',
                  isSelected ? 'dc-selected' : '',
                  hotIdx === i ? 'dc-hot' : '',
                  unlocking && s.node === 3 ? 'dc-unlocking' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={s.theme}
                    className={className}
                    style={{ '--dc-x': `${s.x}px`, '--dc-y': `${s.y}px`, '--dc-base-h': `${s.h}px`, '--dc-i': i, '--dc-c': s.c }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${label}，${isLit ? '已点亮' : '未点亮'}，查看详情`}
                    aria-pressed={isSelected}
                    onClick={() => onNodeClick?.(s.node)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNodeClick?.(s.node);
                      }
                    }}
                    onPointerEnter={() => setHotIdx(i)}
                    onPointerLeave={() => setHotIdx(-1)}
                    onFocus={() => setHotIdx(i)}
                    onBlur={() => setHotIdx(-1)}
                  >
                    <i className="dc-f dc-base-glow" />
                    <i className="dc-f dc-shadow" />
                    <i className="dc-f dc-fx" />
                    <i className="dc-f dc-fy" dangerouslySetInnerHTML={s.theme === 'clock' ? { __html: CLOCKFACE } : undefined} />
                    <i className="dc-f dc-top">
                      <i className="dc-anchor" data-slot-anchor={i} />
                    </i>
                    <i className="dc-f dc-ring" />
                    <div className="dc-ontop" dangerouslySetInnerHTML={{ __html: ONTOP[s.theme] || '' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="dc-pins" ref={pinsRef}>
          <div className="dc-overlays" aria-hidden="true" dangerouslySetInnerHTML={{ __html: OVERLAYS_HTML }} />
          {STANDS.map((s, i) => {
            const isLit = Boolean(lit[s.node]);
            const label = labels?.[i] || s.name;
            const className = [
              'dc-pin',
              isLit ? '' : 'dc-locked',
              selectedIdx === s.node ? 'dc-selected' : '',
              hotIdx === i ? 'dc-hot' : '',
              unlocking && s.node === 3 ? 'dc-unlocking' : '',
            ].filter(Boolean).join(' ');
            return (
              <div
                key={s.theme}
                className={className}
                style={{ '--dc-i': i, '--dc-c': s.c }}
                data-pin={i}
                onClick={() => onNodeClick?.(s.node)}
                onPointerEnter={() => setHotIdx(i)}
                onPointerLeave={() => setHotIdx(-1)}
              >
                <span className="dc-props" dangerouslySetInnerHTML={{ __html: PROPS[s.theme] }} />
                <div className="dc-beam" />
                <div className="dc-float">
                  <div className="dc-medal" dangerouslySetInnerHTML={{ __html: ICONS[s.theme] }} />
                  <div className="dc-frost" />
                  <div className="dc-lock" dangerouslySetInnerHTML={{ __html: ICONS.lock }} />
                </div>
                <div className="dc-tag">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   小图标 SVG（用于节点快捷条 / 详情卡，跟万圣节的 NodeIcon 同一个接口）
   type: 'flake' | 'gift' | 'bell' | 'clock'
───────────────────────────────────────────── */
export function DecemberNodeIcon({ type, on, size = 22 }) {
  const c = on
    ? { ice: '#7cc8e2', box: '#e5485c', ribbon: '#f3c56c', bell: '#e8b24f', clapper: '#a7772f', tower: '#6f8cff', face: '#fff7df', hand: '#1e2640' }
    : { ice: '#a79cab', box: '#8b7f8e', ribbon: '#c9bfcb', bell: '#a79cab', clapper: '#7b6f80', tower: '#8b7f8e', face: '#d8d0da', hand: '#645a68' };

  const bodies = {
    flake: (
      <>
        <path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" stroke={c.ice} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M12.5 5.5L16 8l3.5-2.5M12.5 26.5L16 24l3.5 2.5" stroke={c.ice} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    gift: (
      <>
        <rect x="5" y="13" width="22" height="14" rx="1.8" fill={c.box} />
        <rect x="3.5" y="9.5" width="25" height="5" rx="1.5" fill={c.box} stroke={c.ribbon} strokeWidth="1" />
        <path d="M16 9.5V27" stroke={c.ribbon} strokeWidth="2.6" />
        <path d="M16 9.5c-2-4-7-5-7-2s4 2 7 2zm0 0c2-4 7-5 7-2s-4 2-7 2z" fill="none" stroke={c.ribbon} strokeWidth="1.8" strokeLinejoin="round" />
      </>
    ),
    bell: (
      <>
        <path d="M7 22V15a9 9 0 0 1 18 0v7l3 3H4z" fill={c.bell} />
        <path d="M16 3.5V6" stroke={c.bell} strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="27.5" r="2.6" fill={c.clapper} />
      </>
    ),
    clock: (
      <>
        <path d="M7 29V13l9-9 9 9v16z" fill={c.tower} />
        <circle cx="16" cy="17" r="6" fill={c.face} />
        <path d="M16 13.5V17l2.6 1.6" stroke={c.hand} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {bodies[type] || bodies.flake}
    </svg>
  );
}

export default DecemberScene;
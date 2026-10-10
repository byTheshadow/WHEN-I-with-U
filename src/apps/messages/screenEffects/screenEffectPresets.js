// src/apps/messages/screenEffects/screenEffectPresets.js
//
// 全屏特效的静态数据：氛围预设名单、专注文字排版、雪花 SVG 路径。
// 角色提示词（screenEffectDirective.js）、渲染层（FullscreenEffectLayer.jsx）
// 和设置页（ScreenEffectSettings.jsx）都读这一份，名字不会对不上。

// 窗口事件名：directive 派发，FullscreenEffectLayer 监听。
export const SCREEN_EFFECT_EVENT = 'screen-effect-play';

// 氛围特效约持续多久后开始淡出（毫秒）。
export const AMBIENT_DURATION_MS = 7000;
// 专注文字停留更久一点，让人读完。
export const FOCUS_DURATION_MS = 9000;
// 淡出动画时长（毫秒），要和 css 里 sfx-overlay-out 保持一致。
export const FADE_OUT_MS = 900;

export const FOCUS_PRESET_ID = 'focus';

// 六瓣雪花：6 根主枝，每根两层小分叉，中心一个小圆环。
// viewBox 0 0 48 48，在模块加载时算一次路径字符串。
const buildFlakePath = () => {
  const c = 24;
  const parts = [];
  const fmt = (n) => n.toFixed(2);

  for (let k = 0; k < 6; k += 1) {
    const angle = ((k * 60) - 90) * (Math.PI / 180);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const at = (r) => [c + dx * r, c + dy * r];

    const [tipX, tipY] = at(20);
    parts.push(`M${c} ${c}L${fmt(tipX)} ${fmt(tipY)}`);

    // 枝尖的小 V 形收口
    [[-1, 1], [1, 1]].forEach(([side]) => {
      const b = angle + side * 40 * (Math.PI / 180);
      parts.push(
        `M${fmt(tipX)} ${fmt(tipY)}L${fmt(tipX - Math.cos(b) * 3.2)} ${fmt(tipY - Math.sin(b) * 3.2)}`,
      );
    });

    // 两层侧枝：越靠外越短
    [[14, 6.5], [8.5, 4.2]].forEach(([r, len]) => {
      const [bx, by] = at(r);
      [-1, 1].forEach((side) => {
        const b = angle + side * 55 * (Math.PI / 180);
        parts.push(
          `M${fmt(bx)} ${fmt(by)}L${fmt(bx + Math.cos(b) * len)} ${fmt(by + Math.sin(b) * len)}`,
        );
      });
    });
  }

  // 中心小圆环
  parts.push(`M${c + 2.2} ${c}A2.2 2.2 0 1 0 ${c - 2.2} ${c}A2.2 2.2 0 1 0 ${c + 2.2} ${c}`);
  return parts.join('');
};

export const FLAKE_PATH = buildFlakePath();

// 氛围预设。id 用于代码和设置存储，name 是给角色看/照抄的名字。
// background 是"底色"：用户可在设置里逐个关闭，关闭后只留动画元素。
export const AMBIENT_PRESETS = [
  {
    id: 'snow',
    name: '初雪',
    desc: '大片的六瓣雪花缓缓飘落，画面泛起清冷的蓝白光晕。',
    background: 'radial-gradient(circle at 50% 20%, #eef6fc 0%, #cfe3f5 45%, #9fb9d6 100%)',
    swatch: ['#cfe3f5', '#eef5fb'],
    defaultCaption: '',
    captionColor: '#2c4a68',
    captionShadow: '0 2px 18px rgba(255,255,255,0.7)',
    captionBottom: '14%',
  },
  {
    id: 'meteor',
    name: '流星雨',
    desc: '几道流光划过深蓝紫色的夜幕，转瞬即逝。',
    background: 'radial-gradient(circle at 30% 10%, #262c57 0%, #181a35 60%, #0d0e1f 100%)',
    swatch: ['#1b1f3b', '#3a3f74'],
    defaultCaption: '',
    captionColor: '#e8ecff',
    captionShadow: '0 0 22px rgba(160,180,255,0.5)',
    captionBottom: '14%',
  },
  {
    id: 'aurora',
    name: '极光',
    desc: '大片柔和的光带缓慢流动，色彩在绿蓝紫之间过渡。',
    background: 'linear-gradient(180deg, #0c1b22 0%, #0a1420 100%)',
    swatch: ['#113b36', '#3f6b8f'],
    defaultCaption: '',
    captionColor: '#e4fff4',
    captionShadow: '0 0 22px rgba(90,220,170,0.45)',
    captionBottom: '14%',
  },
  {
    id: 'sakura',
    name: '落樱',
    desc: '粉色花瓣打着旋儿飘落，背景透出暖粉色光晕，配一行小字。',
    background: 'radial-gradient(circle at 50% 15%, #fbe4ec 0%, #f3c9d6 45%, #c98a9e 100%)',
    swatch: ['#f6c9d9', '#c98a9e'],
    defaultCaption: '花落的时候，风也很温柔。',
    captionColor: '#5c2238',
    captionShadow: '0 2px 18px rgba(255,255,255,0.55)',
    captionBottom: '14%',
  },
  {
    id: 'firefly',
    name: '萤火',
    desc: '深色夜色中，细小的光点忽明忽暗地漂浮，配一行小字。',
    background: 'linear-gradient(180deg, #0c1f1d 0%, #163a33 100%)',
    swatch: ['#0c1f1d', '#163a33'],
    defaultCaption: '慢慢来，夜还很长。',
    captionColor: '#eafbe0',
    captionShadow: '0 0 20px rgba(215,255,176,0.45)',
    captionBottom: '16%',
  },
  {
    id: 'fireplace',
    name: '暖炉微光',
    desc: '中央暖橙色的光晕缓慢呼吸，边缘浮起细小的光屑，配一行小字。',
    background: 'radial-gradient(circle at 50% 60%, #ff8a3d 0%, #7a1f0c 45%, #220b05 100%)',
    swatch: ['#7a1f0c', '#ff8a3d'],
    defaultCaption: '靠近一点，我在呢。',
    captionColor: '#fff1df',
    captionShadow: '0 0 22px rgba(255,138,61,0.5)',
    captionBottom: '20%',
  },
];

// 专注文字（没有暗号要求，角色随时可以发）。
export const FOCUS_PRESET = {
  id: FOCUS_PRESET_ID,
  name: '专注文字',
  desc: '画面骤暗，几行文字像歌词一样错落浮现，大小、位置、进场方式各不相同。',
  background: 'radial-gradient(circle at 50% 50%, #12131c 0%, #05060a 70%)',
  swatch: ['#05060a', '#1b1f2e'],
};

// 设置页用：全部七种卡片（六种氛围 + 专注文字）。
export const ALL_EFFECT_CARDS = [...AMBIENT_PRESETS, FOCUS_PRESET];

export const getPresetById = (id) => (
  ALL_EFFECT_CARDS.find((preset) => preset.id === id) || null
);

export const getAmbientPresetByName = (rawName) => {
  const name = String(rawName || '').trim();
  if (!name) return null;

  return (
    AMBIENT_PRESETS.find((preset) => preset.name === name)
    || AMBIENT_PRESETS.find((preset) => (
      name.includes(preset.name) || preset.name.includes(name)
    ))
    || null
  );
};

// ---------------------------------------------------------------------
// 专注文字排版
// ---------------------------------------------------------------------

export const MAX_FOCUS_LINES = 8;
export const MAX_FOCUS_LINE_CHARS = 16;

const ALIGN_CYCLE = ['start', 'center', 'end'];
const SMALL_SIZE_CYCLE = [20, 30, 24, 28];
const EMPHASIS_ENTER_CYCLE = ['sfx-line-blur-in', 'sfx-line-fade-scale'];

const emphasisSize = (length) => {
  if (length <= 4) return 56;
  if (length <= 7) return 46;
  if (length <= 11) return 36;
  return 30;
};

/*
 * 把 [{ text, emphasis }] 排成带位置/字号/进场动画的行。
 * 强调行：大号加粗、居中、带光晕、模糊/缩放进场。
 * 普通行：字号在几档之间轮换，位置按 左/中/右 轮换，进场方向跟着位置走
 * （靠左的从左滑入，靠右的从右滑入，居中的从下浮起）。
 */
export const buildFocusLayout = (lines) => {
  let normalIndex = 0;
  let emphasisIndex = 0;

  return lines.map((line, index) => {
    const delay = Number((index * 0.32).toFixed(2));

    if (line.emphasis) {
      const enter = EMPHASIS_ENTER_CYCLE[emphasisIndex % EMPHASIS_ENTER_CYCLE.length];
      emphasisIndex += 1;
      return {
        text: line.text,
        size: emphasisSize(line.text.length),
        weight: 700,
        align: 'center',
        color: '#f4f1ea',
        glow: true,
        enter,
        delay,
      };
    }

    const align = ALIGN_CYCLE[normalIndex % ALIGN_CYCLE.length];
    const size = SMALL_SIZE_CYCLE[normalIndex % SMALL_SIZE_CYCLE.length];
    normalIndex += 1;

    const enter = align === 'start'
      ? 'sfx-line-slide-left'
      : align === 'end'
        ? 'sfx-line-slide-right'
        : 'sfx-line-fade-up';

    return {
      text: line.text,
      size,
      weight: 500,
      align,
      color: size >= 28 ? 'rgba(244,241,234,0.78)' : 'rgba(244,241,234,0.55)',
      glow: false,
      enter,
      delay,
    };
  });
};
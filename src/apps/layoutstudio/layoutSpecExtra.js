// src/apps/layoutstudio/layoutSpecExtra.js
//
// 三种较新的元素（player 播放器 / pill 图标胶囊 / spread 对齐文字块）的清洗逻辑。
// 和 layoutSpec.js 里原有的四种元素分开放；cleanItem 遇到不认识的 kind 时转到这里。
//
//   player  { x, y, size, progress, volume, time, playing, color }
//           只画播放器本体（进度条、时间、上一首/暂停/下一首、音量条）；
//           歌名和歌手用普通 text 元素写。
//   pill    { x, y, size, text, color }
//           磨砂玻璃胶囊，text 里是一排 emoji（最多 6 个）。
//   spread  { x, y, w, size, text, color, weight, shadow }
//           一块"两端对齐"的小字，w 是整块的宽度（占画布宽度的比例），
//           词和词之间用空格隔开，会自动换行并把每一行撑满。

import { toColor, toInt, toNumber, toText } from './layoutSpecUtils';

export const PILL_MAX_GLYPHS = 6;

// 默认图标：用码点拼出来，源码里不出现字面 emoji。
export const DEFAULT_PILL_TEXT = String.fromCodePoint(
  0x1f3a7,
  0x2615,
  0xfe0f,
  0x1f90e,
  0x1f4dc,
  0x1f58b,
  0xfe0f
);

// 按"用户看到的一个字符"切分（带肤色、变体符号的 emoji 不会被拆开）。
const splitGraphemes = (text) => {
  const raw = String(text || '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(raw)].map(
      (part) => part.segment
    );
  }
  return [...raw];
};

// 胶囊里实际要画的图标：去掉空白，最多 PILL_MAX_GLYPHS 个。
export const pillGlyphs = (text) =>
  splitGraphemes(text)
    .filter((ch) => ch.trim())
    .slice(0, PILL_MAX_GLYPHS);

export const cleanExtraItem = (raw, base) => {
  const { id, x, y } = base;

  if (raw.kind === 'player') {
    return {
      kind: 'player',
      id,
      x,
      y,
      size: toNumber(raw.size, 0.76, 0.4, 0.95),
      progress: toNumber(raw.progress, 0.26, 0, 1),
      volume: toNumber(raw.volume, 0.6, 0, 1),
      time: toText(raw.time, '0:36').slice(0, 8),
      playing: typeof raw.playing === 'boolean' ? raw.playing : true,
      color: toColor(raw.color, '#ffffff'),
    };
  }

  if (raw.kind === 'pill') {
    return {
      kind: 'pill',
      id,
      x,
      y,
      size: toNumber(raw.size, 0.075, 0.04, 0.12),
      text: pillGlyphs(toText(raw.text, DEFAULT_PILL_TEXT)).join('') || DEFAULT_PILL_TEXT,
      color: toColor(raw.color, '#ffffff'),
    };
  }

  if (raw.kind === 'spread') {
    return {
      kind: 'spread',
      id,
      x,
      y,
      w: toNumber(raw.w, 0.36, 0.15, 0.9),
      size: toNumber(raw.size, 0.026, 0.015, 0.06),
      text: toText(raw.text),
      color: toColor(raw.color, '#ffffff'),
      weight: toInt(raw.weight, 400, 300, 700),
      shadow: raw.shadow === undefined ? true : Boolean(raw.shadow),
    };
  }

  return null;
};
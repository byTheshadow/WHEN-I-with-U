import { describeMelody } from './harpDescribe';
import {
  MAX_SCORE_NOTES,
  MIN_PHRASE_NOTES,
  clampScoreGap,
} from './harpNotes';
import { normalizeTimbreId } from './harpTimbres';

// ============================================================
// 星光小竖琴 —— 角色主动弹给用户听的标签解析（纯函数）。
//
// 标签格式（跟 aiService.js 里其它括号标签同一个约定）：
//   [HARP: 旋律名 | 谱 | 速度(可选) | 音色(可选)]
//
//   谱：用空格隔开的音，音名 1 2 3 4 5 6 7，高八度前面加 ^。
//     5:2      后面停两拍再进下一个音（不写就是一拍，可以写 0.5、1.5 这类小数）
//     0        休止一拍，0:2 是休止两拍
//     1+3+5    用 + 连起来的音同时响（和弦），后面也可以跟 :拍数
//     例：3 5 5:2 0 ^1+^3 ^1 6:2
//     注意不能用方括号，标签本身是以 ] 结尾的，会被截断。
//   速度：轻快 / 适中 / 舒缓，或者数字（每分钟多少拍，40-180，例如 90）。
//     不写就是适中。
//   音色：竖琴 / 八音盒 / 拨弦（见 harpTimbres.js），不写就是经典竖琴。
//   速度和音色是两个可选段，顺序不严格：认出是速度词/数字就当速度，认出是
//   音色名就当音色，两个都认不出的忽略。
//
// 一段最多 MAX_SCORE_NOTES 个音（和弦里每个音都算），超出的直接截掉。
// 解析失败（不到 3 个有效音）返回 null，调用方直接不产出卡片。
//
// 存下来的还是 notes + delays：delays[k] 是第 k 个音距离上一个音的毫秒数，
// 和弦里除第一个音以外的音 delays 是 0。
// ============================================================

// 简谱数字 -> 音符编号。1 2 3 5 6 是竖琴的十根弦（低八度 0-4，高八度 5-9），
// 4 和 7 没有对应的弦，编号接在后面（见 harpNotes.js 的 ALL_PITCHES）。
const JIANPU_LOW = { 1: 0, 2: 1, 3: 2, 5: 3, 6: 4, 4: 10, 7: 11 };
const JIANPU_HIGH = { 1: 5, 2: 6, 3: 7, 5: 8, 6: 9, 4: 12, 7: 13 };

// 速度词对应的"一拍多少毫秒"，数字是每分钟多少拍。
const TEMPO_BEAT_MS = { 轻快: 280, 适中: 520, 舒缓: 900 };
const DEFAULT_BEAT_MS = TEMPO_BEAT_MS.适中;
const BPM_MIN = 40;
const BPM_MAX = 180;

const BEATS_MIN = 0.25;
const BEATS_MAX = 8;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseTempoWord = (word) => {
  if (TEMPO_BEAT_MS[word]) return TEMPO_BEAT_MS[word];
  const match = word.match(/^(\d{2,3})\s*(?:bpm|BPM|拍)?$/);
  if (!match) return null;
  return Math.round(60000 / clamp(Number(match[1]), BPM_MIN, BPM_MAX));
};

// 一个音写法 "^3" 或 "3"，认不出返回 null
const parsePitch = (raw) => {
  const match = String(raw || '').match(/^(\^?)([1-7])$/);
  if (!match) return null;
  const table = match[1] ? JIANPU_HIGH : JIANPU_LOW;
  const index = table[Number(match[2])];
  return index === undefined ? null : index;
};

// 谱面文字 -> 事件列表。事件要么是 { pitches: number[], beats }（一个音或一个和弦），
// 要么是 { rest: true, beats }。
const parseScoreEvents = (scoreText) => {
  const tokens = String(scoreText || '')
    .replace(/：/g, ':')
    .replace(/＋/g, '+')
    .replace(/↑/g, '^')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\^\s+/g, '^')
    .split(/[\s,，、-]+/)
    .filter(Boolean);

  const events = [];
  tokens.forEach((token) => {
    const match = token.match(/^([^:]+?)(?::(\d+(?:\.\d+)?))?$/);
    if (!match) return;

    const beats = match[2] === undefined
      ? 1
      : clamp(Number(match[2]) || 1, BEATS_MIN, BEATS_MAX);

    if (match[1] === '0') {
      events.push({ rest: true, beats });
      return;
    }

    const pitches = match[1]
      .split('+')
      .map(parsePitch)
      .filter((index) => index !== null);
    if (pitches.length) events.push({ pitches, beats });
  });

  return events;
};

export const parseHarpTagPayload = (rawPayload) => {
  const parts = String(rawPayload || '').split('|');
  const name = (parts[0] || '').trim().slice(0, 14) || '无名旋律';
  const scoreText = (parts[1] || '').trim();

  let beatMs = DEFAULT_BEAT_MS;
  let timbre = null;
  parts.slice(2).forEach((rawPart) => {
    const word = String(rawPart || '').trim();
    if (!word) return;
    const tempo = parseTempoWord(word);
    if (tempo) beatMs = tempo;
    else if (!timbre) timbre = normalizeTimbreId(word);
  });

  const notes = [];
  const delays = [];
  // 上一个音（或和弦）占的拍数，加上它和这个音之间的休止拍数，就是这个音前面的间隔
  let prevBeats = 0;
  let restBeats = 0;
  let eventCount = 0;

  parseScoreEvents(scoreText).forEach((event) => {
    if (event.rest) {
      // 谱子开头的休止没有意义（前面没有音），直接忽略
      if (eventCount > 0) restBeats += event.beats;
      return;
    }

    event.pitches.forEach((index, k) => {
      if (notes.length >= MAX_SCORE_NOTES) return;
      notes.push(index);
      if (k > 0 || eventCount === 0) {
        delays.push(0);
        return;
      }
      const gap = clampScoreGap((prevBeats + restBeats) * beatMs);
      // 稍微错开一点点，别太机械；只对够长的间隔做，免得把短音弄乱
      const jitter = gap >= 300 ? ((eventCount * 37) % 41) - 20 : 0;
      delays.push(gap + jitter);
    });

    prevBeats = event.beats;
    restBeats = 0;
    eventCount += 1;
  });

  if (notes.length < MIN_PHRASE_NOTES) return null;

  return {
    name,
    notes,
    delays,
    // 认不出音色（或没写）就是 null，调用方不写这个字段，重听时就是经典竖琴
    timbre,
    content: `弹了一段旋律「${name}」：${describeMelody({ notes, delays, timbre })}`,
  };
};
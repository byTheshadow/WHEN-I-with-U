// ============================================================
// 星光小竖琴 —— 音符与"一段旋律"的纯数据/纯函数（不碰数据库、不碰DOM）。
//
// 十根弦，C 大调五声音阶（1 2 3 5 6），上下两个八度：怎么划都不容易
// 弹出难听的音。index 0 是最长的低音弦（画面最左），index 9 是最短的
// 高音弦（画面最右）。弹奏记录、收藏、以后写回聊天的文字，都只存音符
// 编号和相邻音符的间隔，不存任何音频。
//
// 角色作曲时可以多用 4 和 7 两个音（各有高低两个八度）。它们在竖琴上
// 没有对应的弦，所以编号接在十根弦后面（10-13），只负责发声；画面上
// 重放时点亮最近的一根弦（见 ALL_PITCHES 里的 light 字段）。用户自己
// 弹的旋律永远只会用 0-9。
//
// 间隔为 0 表示"和上一个音同时响"，也就是和弦，不需要单独的存储结构。
// ============================================================

export const HARP_NOTES = [
  { index: 0, freq: 523.25, label: '1', high: false },
  { index: 1, freq: 587.33, label: '2', high: false },
  { index: 2, freq: 659.25, label: '3', high: false },
  { index: 3, freq: 783.99, label: '5', high: false },
  { index: 4, freq: 880.0, label: '6', high: false },
  { index: 5, freq: 1046.5, label: '1', high: true },
  { index: 6, freq: 1174.66, label: '2', high: true },
  { index: 7, freq: 1318.51, label: '3', high: true },
  { index: 8, freq: 1567.98, label: '5', high: true },
  { index: 9, freq: 1760.0, label: '6', high: true },
];

export const HARP_STRING_COUNT = HARP_NOTES.length;

// 全部可发声的音：十根弦 + 4、7 两个音的高低八度。
// light：重放时画面上点亮哪一根弦（十根弦自己就是自己）。
export const ALL_PITCHES = [
  ...HARP_NOTES.map((note) => ({ ...note, light: note.index })),
  { index: 10, freq: 698.46, label: '4', high: false, light: 2 },
  { index: 11, freq: 987.77, label: '7', high: false, light: 5 },
  { index: 12, freq: 1396.91, label: '4', high: true, light: 7 },
  { index: 13, freq: 1975.53, label: '7', high: true, light: 9 },
];

export const PITCH_COUNT = ALL_PITCHES.length;

export const getPitch = (index) => ALL_PITCHES[index] || null;

// 一段旋律最多记多少个音（防止有人一直划，存下来的数组无限长）。
export const MAX_MELODY_NOTES = 64;

// 角色作曲时一段旋律最多多少个音（和弦里的每个音都算一个）。
export const MAX_SCORE_NOTES = 40;

// 停手多久算"一段弹完了"。
export const PHRASE_CLOSE_MS = 2600;

// 至少几个音才算一段（才能收藏）。
export const MIN_PHRASE_NOTES = 3;

// 相邻两个音之间的间隔，存库和重放时都限制在这个范围里，
// 太短听起来糊成一团，太长重放要等太久。
export const MIN_NOTE_GAP_MS = 160;
export const MAX_NOTE_GAP_MS = 1500;

export const clampNoteGap = (ms) =>
  Math.max(MIN_NOTE_GAP_MS, Math.min(MAX_NOTE_GAP_MS, Math.round(Number(ms) || 0)));

// 角色写的曲谱允许更长的停顿（休止符、长音），也允许 0（和弦）。
export const MIN_SCORE_GAP_MS = 120;
export const MAX_SCORE_GAP_MS = 3200;

export const clampScoreGap = (ms) => {
  const value = Math.round(Number(ms));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(MIN_SCORE_GAP_MS, Math.min(MAX_SCORE_GAP_MS, value));
};

export const isValidNoteIndex = (value) =>
  Number.isInteger(value) && value >= 0 && value < PITCH_COUNT;

// 单个音的简谱写法，高八度前面加 "↑"，例如 "↑1"。
export const getNoteLabel = (index) => {
  const pitch = getPitch(index);
  if (!pitch) return '';
  return `${pitch.high ? '↑' : ''}${pitch.label}`;
};

// 把一段旋律按"同时响"分组：间隔为 0 的音和前一个音归为一组（和弦）。
// 返回每组里音符在原数组中的位置，例如 [[0], [1, 2, 3], [4]]。
export const groupMelody = (notes, delays) => {
  const list = Array.isArray(notes) ? notes : [];
  const gaps = Array.isArray(delays) ? delays : [];
  const groups = [];

  list.forEach((note, k) => {
    if (!isValidNoteIndex(note)) return;
    if (k > 0 && gaps[k] === 0 && groups.length) {
      groups[groups.length - 1].push(k);
    } else {
      groups.push([k]);
    }
  });

  return groups;
};

// 简谱文字，高八度的音前面加 "↑"，例如 "3 5 5 6 ↑1 6 5"。
// 传了 delays 时，同时响的音用 "+" 连起来，例如 "3 5+↑1+↑3 6"。
export const formatMelodyText = (notes, delays) => {
  const list = Array.isArray(notes) ? notes : [];
  return groupMelody(list, delays)
    .map((group) => group.map((k) => getNoteLabel(list[k])).join('+'))
    .join(' ');
};

// 把弹奏时记下的 [{ i, t }]（t 是毫秒时间戳）整理成存库用的
// { notes, delays }：delays[k] 是第 k 个音距离上一个音的间隔，第一个是 0。
export const buildMelodyFromPhrase = (phrase) => {
  const events = (Array.isArray(phrase) ? phrase : [])
    .filter((event) => event && isValidNoteIndex(event.i))
    .slice(0, MAX_MELODY_NOTES);

  return {
    notes: events.map((event) => event.i),
    delays: events.map((event, k) =>
      k === 0 ? 0 : clampNoteGap(event.t - events[k - 1].t)
    ),
  };
};
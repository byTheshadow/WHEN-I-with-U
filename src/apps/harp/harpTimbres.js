// ============================================================
// 星光小竖琴 —— 音色注册表（纯数据/纯函数，不碰音频、不碰数据库）。
//
// 这里只放"有哪些音色、叫什么、怎么认"，真正的发声参数在 harpAudio.js。
// 单独成文件，是为了标签解析（harpTagParser.js）、提示词（harpPromptBlock.js）、
// 文字描述（harpDescribe.js）和选择器界面都能引用它，而不用把音频代码拖进来。
//
// 加新音色：
//   1) 在下面的 HARP_TIMBRES 里加一条（id 一旦存进数据库就不要改）；
//   2) 在 harpAudio.js 的 TIMBRE_VOICES 里加同一个 id 的发声参数。
// 其余文件都不用动。
//
// 存储约定：旋律消息的 metadata.timbre、收藏记录的 timbre、聊天的 harpTimbre
// 存的都是这里的 id。字段缺失一律当 DEFAULT_TIMBRE（经典竖琴）处理，
// 所以旧数据不需要任何迁移。
// ============================================================

export const DEFAULT_TIMBRE = 'harp';

// aliases：角色在 [HARP: ...] 标签里可能写出的叫法（不分大小写）。
export const HARP_TIMBRES = [
  {
    id: 'harp',
    label: '竖琴',
    aliases: ['竖琴', '经典', '经典竖琴', 'harp'],
    hint: '原来的星光竖琴',
  },
  {
    id: 'musicbox',
    label: '八音盒',
    aliases: ['八音盒', '音乐盒', 'music box', 'musicbox'],
    hint: '清脆短促，带一点金属叮声',
  },
  {
    id: 'pluck',
    label: '拨弦',
    aliases: ['拨弦', '吉他', '弹拨', 'pluck', 'guitar'],
    hint: '干净的拨弦，余音比竖琴短',
  },
];

// 把任何写法（id、中文名、别名）认成 id；认不出来返回 null。
export const normalizeTimbreId = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;

  const hit = HARP_TIMBRES.find(
    (timbre) =>
      timbre.id === key ||
      timbre.label.toLowerCase() === key ||
      timbre.aliases.some((alias) => alias.toLowerCase() === key)
  );
  return hit ? hit.id : null;
};

export const getTimbreLabel = (id) => {
  const hit = HARP_TIMBRES.find((timbre) => timbre.id === normalizeTimbreId(id));
  return hit ? hit.label : HARP_TIMBRES[0].label;
};


// ============================================================
// 音色微调（tune）：在预设音色之上，角色可以再调三项，每项三档（0 / 1 / 2，1 是不调）。
//   bright  亮度：0 柔，1 中，2 亮
//   sustain 余音：0 短，1 中，2 长
//   echo    回声：0 少，1 中，2 多
// 存储约定：旋律消息的 metadata.tune、收藏记录的 tune 存的是 { bright, sustain, echo }；
// 三项都是 1（没调）时不写这个字段，所以旧数据不需要任何迁移。
// 发声参数在 harpAudio.js，这里只放"怎么认、怎么描述"。
// ============================================================

const TUNE_KEYS = ['bright', 'sustain', 'echo'];

const TUNE_LEVEL_WORDS = {
  bright: ['柔和', '适中', '明亮'],
  sustain: ['短', '适中', '长'],
  echo: ['少', '适中', '多'],
};

const clampLevel = (value) => {
  const level = Math.round(Number(value));
  return Number.isFinite(level) ? Math.max(0, Math.min(2, level)) : 1;
};

// 把任何形状的值整理成 { bright, sustain, echo }；三项都是 1（没调）或不是对象返回 null
export const normalizeTune = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const tune = {
    bright: clampLevel(raw.bright ?? 1),
    sustain: clampLevel(raw.sustain ?? 1),
    echo: clampLevel(raw.echo ?? 1),
  };
  return TUNE_KEYS.every((key) => tune[key] === 1) ? null : tune;
};

// 从角色写的中文词里认出微调，例如 "明亮,长余音,多回声"。认不出的词忽略；
// 一个词都没认出来返回 null。
export const parseTuneWords = (text) => {
  const raw = {};
  String(text || '')
    .split(/[\s,，、/;；]+/)
    .filter(Boolean)
    .forEach((word) => {
      if (word.includes('亮')) raw.bright = 2;
      else if (word.includes('柔') || word.includes('暗')) raw.bright = 0;
      else if (word.includes('长')) raw.sustain = 2;
      else if (word.includes('短')) raw.sustain = 0;
      else if (word.includes('多')) raw.echo = 2;
      else if (word.includes('少') || word.includes('干')) raw.echo = 0;
    });
  return normalizeTune(raw);
};

// 描述成一句话，例如 "偏明亮、余音长、回声多"；没调返回空字符串
export const describeTune = (tune) => {
  const normalized = normalizeTune(tune);
  if (!normalized) return '';
  const pieces = [];
  if (normalized.bright !== 1) pieces.push(normalized.bright === 2 ? '偏明亮' : '偏柔和');
  if (normalized.sustain !== 1) pieces.push(`余音${TUNE_LEVEL_WORDS.sustain[normalized.sustain]}`);
  if (normalized.echo !== 1) pieces.push(`回声${TUNE_LEVEL_WORDS.echo[normalized.echo]}`);
  return pieces.join('、');
};
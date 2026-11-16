// src/apps/fiction/fictionThinkingPresets.js
//
// 思维链的「思考预设」：纯数据和纯函数，不碰数据库、不发请求。
//
// 一份预设 = 名称 + 多个条目；每个条目有标题、内容、开关，按顺序排列。
// 开了思维链的存档，每次生成前会把开着的条目交给模型，要求它先在
// [THINK]…[/THINK] 里逐条想完，再写正文。
//
// 预设库存在 db.settings 里，key 是 THINKING_PRESETS_SETTING_KEY，
// value 形如 { presets: [ { id, name, entries: [...] } ] }。
// 读库由调用方做（fictionAiService.js），这里只负责规整和挑选。
// 内置的默认预设写在本文件里，不进数据库，所以不会被删掉或改坏。

export const THINKING_PRESETS_SETTING_KEY = 'fictionThinkingPresets';

export const BUILTIN_THINKING_PRESET_ID = 'builtin-default';

// 开了思维链之后，每次请求的输出上限（max tokens）由用户自己定。
// 思考不限篇幅，所以这个数要给得宽；服务商不接受时会直接报错，调小即可。
export const THINKING_MAX_TOKENS = {
  min: 4000,
  max: 200000,
  default: 32000,
};

export const THINKING_MAX_TOKENS_CHOICES = [8000, 16000, 32000, 64000];

export const BUILTIN_THINKING_PRESET = {
  id: BUILTIN_THINKING_PRESET_ID,
  name: '默认 · 先想后写',
  builtin: true,
  entries: [
    {
      id: 'recap',
      title: '回顾前文',
      content: '用几句话梳理到目前为止发生了什么：上一段停在哪里，玩家刚刚做了什么，有哪些还没收的伏笔、承诺或悬念。',
      enabled: true,
    },
    {
      id: 'canon',
      title: '核对设定',
      content: '对照故事背景、角色设定、世界书和当前数值，确认这一段不会出现冲突。列出此刻在场的人物，以及每个人现在的情绪、动机和对玩家的态度；数值的高低应该怎样体现在他们的言行上。',
      enabled: true,
    },
    {
      id: 'beat',
      title: '这一段要推进什么',
      content: '决定这一段的核心事件和情绪走向：开头接在哪里，中间发生什么变化，最后停在哪里。对照大纲看现在处在哪个阶段，不要原地打转，也不要提前收束。',
      enabled: true,
    },
    {
      id: 'consequence',
      title: '玩家行动的后果',
      content: '玩家这次的选择或行动会带来什么合理的结果，包括代价和意外。不要无条件让它成功，也不要替玩家做决定、说话或行动。',
      enabled: true,
    },
    {
      id: 'style',
      title: '对照文风',
      content: '重读文风要求，说明这一段打算怎么落实：叙述的节奏、用词、对白和描写的比例、需要避免的写法。检查有没有和前几段重复的句式或桥段。',
      enabled: true,
    },
    {
      id: 'options',
      title: '设计选项',
      content: '构思这一段结尾的选项：每个选项通向哪个不同的方向，各自的风险和数值影响是什么。确认没有哪个选项明显最优，也没有两个选项实质上是同一件事。',
      enabled: true,
      choiceOnly: true, // 纯小说式没有选项，这一条自动跳过
    },
  ],
};

const str = (value) => String(value ?? '').trim();

const normalizeEntry = (entry, index) => ({
  id: str(entry?.id) || `entry-${index + 1}`,
  title: str(entry?.title),
  content: str(entry?.content),
  enabled: entry?.enabled !== false,
  choiceOnly: Boolean(entry?.choiceOnly),
});

// 把一份预设规整成固定形状；不是对象或者没有 id 的返回 null。
export const normalizeThinkingPreset = (preset) => {
  if (!preset || typeof preset !== 'object' || !str(preset.id)) return null;

  return {
    id: str(preset.id),
    name: str(preset.name) || '未命名预设',
    builtin: Boolean(preset.builtin),
    entries: (Array.isArray(preset.entries) ? preset.entries : []).map(normalizeEntry),
  };
};

// library 是 db.settings 里读出来的 value（可能是 null、数组或 { presets }）。
// 返回「内置默认预设 + 用户自己的预设」，内置的永远排第一。
export const listThinkingPresets = (library) => {
  const raw = Array.isArray(library) ? library : library?.presets;
  const custom = (Array.isArray(raw) ? raw : [])
    .map(normalizeThinkingPreset)
    .filter((preset) => preset && preset.id !== BUILTIN_THINKING_PRESET_ID)
    .map((preset) => ({ ...preset, builtin: false }));

  return [normalizeThinkingPreset(BUILTIN_THINKING_PRESET), ...custom];
};

// 按 id 找预设；找不到（没选过、或者那份预设已经被删了）就用内置默认预设。
export const resolveThinkingPreset = (library, presetId) => {
  const presets = listThinkingPresets(library);

  return presets.find((preset) => preset.id === str(presetId)) || presets[0];
};

// 这一次生成要交给模型的条目：开着的、有内容的；纯小说式跳过只对选择式有意义的条目。
export const pickThinkingEntries = (preset, mode) => (
  (Array.isArray(preset?.entries) ? preset.entries : [])
    .filter((entry) => entry && entry.enabled !== false && str(entry.content))
    .filter((entry) => !(mode === 'novel' && entry.choiceOnly))
    .map((entry) => ({ title: str(entry.title), content: str(entry.content) }))
);

export const clampThinkingMaxTokens = (value) => {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number) || number <= 0) return THINKING_MAX_TOKENS.default;

  return Math.min(THINKING_MAX_TOKENS.max, Math.max(THINKING_MAX_TOKENS.min, number));
};

export default {
  THINKING_PRESETS_SETTING_KEY,
  BUILTIN_THINKING_PRESET_ID,
  BUILTIN_THINKING_PRESET,
  THINKING_MAX_TOKENS,
  THINKING_MAX_TOKENS_CHOICES,
  normalizeThinkingPreset,
  listThinkingPresets,
  resolveThinkingPreset,
  pickThinkingEntries,
  clampThinkingMaxTokens,
};
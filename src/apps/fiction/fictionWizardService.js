// src/apps/fiction/fictionWizardService.js
//
// 新建向导的数据层：默认表单、文风预设、校验、角色副本、草稿的读写。
// 草稿就是 fictionSaves 里一条 isDraft: true 的记录，草稿和正式存档用同一张表，
// 向导里填的字段名和存档字段名一一对应，保存时不用转换。
//
// 主角色的存法（第 3 轮组装提示词时按这个解析）：
//   { source: 'imported', importedId }  指向 importedCharacters 里某个副本的 localId
//   { source: 'custom', name, bio, extraNotes }  存档里新建的角色
// 这样导入的角色在「当主角」和「当 NPC」之间切换时，人设只有一份，不会各改各的。

import db from '../../db';
import {
  FICTION_IMAGE_MODES,
  FICTION_MODES,
  createSave,
  getSave,
  updateSave,
} from './fictionService';

export const WIZARD_STEP_COUNT = 3;
export const DRAFT_FALLBACK_TITLE = '未命名草稿';
export const STYLE_CUSTOM_MAX = 4000;
export const TEXT_FIELD_MAX = 4000;

export const MAX_IMPORTED = 3;
export const MAX_NPCS = 10;
export const MAX_STATS = 8;
export const MAX_LOCAL_ENTRIES = 30;

export const WORD_MIN_RANGE = { min: 500, max: 4000, step: 100 };
export const OPTION_MIN_RANGE = { min: 3, max: 6 };

// 数值名称会出现在 AI 的输出里（「好感度:+2,金钱:-10」），
// 这些符号和空白会破坏解析，所以不允许。
export const STAT_NAME_FORBIDDEN = /[:：,，、|[\]\s]/;

export const WIZARD_STEPS = [
  { id: 'premise', kicker: 'New Story', en: 'Premise', zh: '故事基础' },
  { id: 'cast', kicker: 'Dramatis Personae', en: 'Cast', zh: '角色编排' },
  { id: 'rules', kicker: 'House Rules', en: 'Rules', zh: '规则与数值' },
];

// prompt 是写给 AI 的文风描述，第 3 轮组装提示词时直接用。
export const FICTION_STYLE_PRESETS = [
  {
    id: 'light-novel',
    label: '轻小说',
    prompt: '轻小说风格：节奏明快，对白较多，穿插吐槽和内心独白，句子偏短、画面感强，情绪表达直接。',
  },
  {
    id: 'ancient',
    label: '古风',
    prompt: '古风白话：用词典雅，意境为先，多用白描和简练的短句，避免现代口语和网络用语。',
  },
  {
    id: 'suspense',
    label: '悬疑冷峻',
    prompt: '悬疑冷峻：叙述克制冷静，以细节取胜，多写环境和线索，不直接点破真相，情绪压在文字之下。',
  },
  {
    id: 'healing',
    label: '日常治愈',
    prompt: '日常治愈：温和细腻，聚焦生活小事和人物之间的细微情感，节奏舒缓，结尾留有暖意。',
  },
];

export const getStylePreset = (presetId) => (
  FICTION_STYLE_PRESETS.find((preset) => preset.id === presetId) || null
);

const str = (value) => String(value ?? '').trim();

const asArray = (value) => (Array.isArray(value) ? value : []);

const clampInt = (value, min, max, fallback) => {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) return fallback;

  return Math.min(max, Math.max(min, number));
};

export const makeId = (prefix) => (
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
);

// 世界书条目的关键词：用逗号、顿号、分号或换行分隔（不按空格拆，英文词组里有空格）。
export const parseKeywords = (text) => (
  String(text || '')
    .split(/[,，、;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
);

export const formatKeywords = (keywords) => asArray(keywords).join('、');

// ---------- 头像：从相册选图，居中裁成正方形，压到 256px 以内 ----------

export const fileToAvatarDataUrl = (file, size = 256) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    try {
      const side = Math.min(image.width, image.height);
      const out = Math.max(1, Math.min(size, side));
      const canvas = document.createElement('canvas');

      canvas.width = out;
      canvas.height = out;

      const context = canvas.getContext('2d');

      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        out,
        out,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    } catch (error) {
      reject(error);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('图片读取失败'));
  };

  image.src = url;
});

// ---------- 导入角色：复制成存档里的副本 ----------

// 聊天专用的字段不带进文游：头像先不复制、「用户对这个角色的设定」文游里有自己的「我的设定」、
// 自动消息和总结频率只对聊天有意义。
const CHAT_ONLY_KEYS = new Set([
  'id',
  'handle',
  'avatar',
  'userPersona',
  'userAvatar',
  'summaryFrequency',
  'isAutoMessageActive',
]);

const EDITABLE_KEYS = ['name', 'bio', 'extraNotes'];

const isHeavyValue = (value) => (
  typeof value === 'function'
  || (typeof Blob !== 'undefined' && value instanceof Blob)
  || value instanceof ArrayBuffer
  || ArrayBuffer.isView(value)
  || (typeof value === 'string' && value.startsWith('data:'))
);

export const importCharacterCopy = (character) => {
  const copy = {};

  Object.keys(character || {}).forEach((key) => {
    if (CHAT_ONLY_KEYS.has(key)) return;

    const value = character[key];

    if (isHeavyValue(value)) return;

    copy[key] = typeof value === 'object' && value !== null
      ? JSON.parse(JSON.stringify(value))
      : value;
  });

  const name = String(character?.name ?? '');
  const bio = String(character?.bio ?? '');
  const extraNotes = String(character?.extraNotes ?? '');

  return {
    ...copy,
    localId: makeId('ic'),
    sourceCharacterId: character?.id ?? null,
    sourceName: name,
    name,
    bio,
    extraNotes,
    // 原始人设：用来数「已微调几处」，也用来「恢复原人设」
    original: { name, bio, extraNotes },
  };
};

export const countImportedEdits = (copy) => {
  const original = copy?.original || {};

  return EDITABLE_KEYS.filter((key) => str(copy?.[key]) !== str(original[key])).length;
};

export const resetImportedCopy = (copy) => {
  const original = copy?.original || {};

  return {
    ...copy,
    name: original.name ?? '',
    bio: original.bio ?? '',
    extraNotes: original.extraNotes ?? '',
  };
};

// 选择器用：只取列表要显示的几项。
export const listImportableCharacters = async () => {
  const rows = await db.characters.toArray();

  return rows.map((row) => ({
    id: row.id,
    name: str(row.name) || '未命名角色',
    bio: str(row.bio),
  }));
};

export const importCharactersByIds = async (ids) => {
  const rows = await db.characters.bulkGet(asArray(ids).map(Number));

  return rows.filter(Boolean).map(importCharacterCopy);
};

// ---------- 表单 ----------

export const buildDefaultWizardForm = () => ({
  title: '',
  mode: FICTION_MODES.CHOICE,
  background: '',
  outline: '',
  style: { presetId: '', custom: '' },
  persona: { name: '', avatar: '', identity: '', extra: '' },
  mainCharacter: null,
  importedCharacters: [],
  npcs: [],
  worldBookIds: [],
  localEntries: [],
  wordMin: 2000,
  optionMin: 3,
  allowFreeInput: true,
  showDeltas: false,
  stats: [],
  imageMode: FICTION_IMAGE_MODES.OFF,
});

const normalizeImported = (list) => (
  asArray(list).filter((item) => item && item.localId).slice(0, MAX_IMPORTED)
);

const normalizeNpcs = (list) => (
  asArray(list)
    .filter((item) => item && str(item.name))
    .slice(0, MAX_NPCS)
    .map((item) => ({
      id: item.id || makeId('npc'),
      name: str(item.name),
      desc: str(item.desc),
    }))
);

const normalizeStats = (list) => {
  const seen = new Set();
  const result = [];

  asArray(list).forEach((item) => {
    if (!item || result.length >= MAX_STATS) return;

    const name = str(item.name);
    const min = Math.round(Number(item.min));
    const max = Math.round(Number(item.max));
    const initial = Math.round(Number(item.initial));

    if (!name || STAT_NAME_FORBIDDEN.test(name) || seen.has(name.toLowerCase())) return;
    if (![min, max, initial].every(Number.isFinite) || min >= max) return;

    seen.add(name.toLowerCase());
    result.push({
      id: item.id || makeId('st'),
      name,
      initial: Math.min(max, Math.max(min, initial)),
      min,
      max,
      desc: str(item.desc),
    });
  });

  return result;
};

const normalizeEntries = (list) => (
  asArray(list)
    .filter((item) => item && str(item.content))
    .slice(0, MAX_LOCAL_ENTRIES)
    .map((item) => ({
      id: item.id || makeId('le'),
      keywords: asArray(item.keywords).map(str).filter(Boolean),
      content: str(item.content),
      enabled: item.enabled !== false,
    }))
);

const normalizeMain = (main, imported) => {
  if (!main) return null;

  if (main.source === 'imported') {
    return imported.some((item) => item.localId === main.importedId)
      ? { source: 'imported', importedId: main.importedId }
      : null;
  }

  if (main.source === 'custom') {
    const name = str(main.name);

    if (!name) return null;

    return {
      source: 'custom',
      name,
      bio: str(main.bio),
      extraNotes: str(main.extraNotes),
    };
  }

  return null;
};

// 把向导表单整理成可以写进 fictionSaves 的字段，所有字段都在这里兜底。
const pickFormFields = (form, finish) => {
  const persona = form.persona || {};
  const personaClean = {
    name: str(persona.name),
    avatar: typeof persona.avatar === 'string' ? persona.avatar : '',
    identity: str(persona.identity),
    extra: str(persona.extra),
  };
  const personaEmpty = !personaClean.name
    && !personaClean.avatar
    && !personaClean.identity
    && !personaClean.extra;

  const style = form.style || {};
  const presetId = getStylePreset(style.presetId) ? style.presetId : '';
  const mode = form.mode === FICTION_MODES.NOVEL ? FICTION_MODES.NOVEL : FICTION_MODES.CHOICE;
  const imported = normalizeImported(form.importedCharacters);

  return {
    title: str(form.title),
    mode,
    background: str(form.background),
    outline: str(form.outline),
    style: { presetId, custom: str(style.custom) },
    persona: personaEmpty ? null : personaClean,
    mainCharacter: normalizeMain(form.mainCharacter, imported),
    importedCharacters: imported,
    npcs: normalizeNpcs(form.npcs),
    worldBookIds: asArray(form.worldBookIds),
    localEntries: normalizeEntries(form.localEntries),
    wordMin: clampInt(form.wordMin, WORD_MIN_RANGE.min, WORD_MIN_RANGE.max, 2000),
    optionMin: clampInt(form.optionMin, OPTION_MIN_RANGE.min, OPTION_MIN_RANGE.max, 3),
    allowFreeInput: form.allowFreeInput !== false,
    showDeltas: Boolean(form.showDeltas),
    // 纯小说式没有选项，数值系统用不上。草稿里保留，正式创建时清掉，
    // 这样书架上不会给小说式存档标「有数值」。
    stats: finish && mode === FICTION_MODES.NOVEL ? [] : normalizeStats(form.stats),
    imageMode: Object.values(FICTION_IMAGE_MODES).includes(form.imageMode)
      ? form.imageMode
      : FICTION_IMAGE_MODES.OFF,
  };
};

// 返回错误提示文字；空字符串表示通过。
export const validateWizardStep = (stepIndex, form) => {
  if (stepIndex === 0) {
    if (!str(form.title)) return '先给存档起个名字';
    if (!str(form.background)) return '背景是必填的，写几句就行';
  }

  if (stepIndex === 1) {
    const main = normalizeMain(form.mainCharacter, normalizeImported(form.importedCharacters));

    if (!main) return '主角色是必填的：导入一个已有角色，或新建一个';
  }

  return '';
};

// 打开草稿：把存档记录还原成向导表单。
export const loadWizardForm = async (saveId) => {
  const save = await getSave(saveId);

  if (!save) return null;

  const base = buildDefaultWizardForm();
  const form = { ...base };

  Object.keys(base).forEach((key) => {
    if (save[key] !== undefined && save[key] !== null) form[key] = save[key];
  });

  form.style = { ...base.style, ...(save.style || {}) };
  form.persona = { ...base.persona, ...(save.persona || {}) };
  form.importedCharacters = asArray(form.importedCharacters);
  form.npcs = asArray(form.npcs);
  form.stats = asArray(form.stats);
  form.localEntries = asArray(form.localEntries);
  form.worldBookIds = asArray(form.worldBookIds);

  if (form.title === DRAFT_FALLBACK_TITLE) form.title = '';

  return {
    form,
    step: Number(save.draftStep) || 0,
    isDraft: Boolean(save.isDraft),
  };
};

// 保存草稿（finish = false）或正式创建（finish = true），返回存档 id。
// 正式创建时会把三步的校验全跑一遍，失败时抛出带 step 字段的错误，
// 让向导跳回出问题的那一步。
export const saveWizardForm = async ({
  saveId = null,
  form,
  step = 0,
  finish = false,
}) => {
  if (finish) {
    for (let index = 0; index < WIZARD_STEP_COUNT; index += 1) {
      const message = validateWizardStep(index, form);

      if (message) {
        const error = new Error(message);

        error.step = index;
        throw error;
      }
    }
  }

  const fields = pickFormFields(form, finish);
  const patch = {
    ...fields,
    title: fields.title || DRAFT_FALLBACK_TITLE,
    isDraft: !finish,
    draftStep: finish ? 0 : step,
  };

  if (saveId) {
    await updateSave(saveId, patch);
    return saveId;
  }

  return createSave(patch);
};

// 编辑已经创建好的存档的设定（和「新建」共用同一套表单，但写回方式不同）。
// 和 saveWizardForm({ finish: true }) 的区别：
//   - 不碰 isDraft / draftStep / currentNodeId / segmentCount / branchCount /
//     coverImageId，已经玩过的剧情、分支、存档点、总结都原样保留；
//   - 玩法形式（mode）锁定，永远沿用存档自己的，表单里传什么都不会改它
//     （选择式 ↔ 小说式会让已有的选项和数值整个对不上）；
//   - 草稿不能走这里，草稿继续用 saveWizardForm。
// 数值（stats）可以改：旧节点的数值快照里缺的数值，下一段生成时会用初始值补上，
// 删掉的数值在旧快照里残留也无妨（见 fictionParser.applyDeltas）。
// 校验失败时抛出带 step 字段的错误，和 saveWizardForm 一样，向导会跳回出问题的那一步。
export const saveWizardEdits = async ({ saveId, form }) => {
  const save = await getSave(saveId);

  if (!save) throw new Error('这份存档找不到了');
  if (save.isDraft) throw new Error('草稿请在新建流程里保存');

  for (let index = 0; index < WIZARD_STEP_COUNT; index += 1) {
    const message = validateWizardStep(index, { ...form, mode: save.mode });

    if (message) {
      const error = new Error(message);

      error.step = index;
      throw error;
    }
  }

  const fields = pickFormFields({ ...form, mode: save.mode }, true);

  delete fields.mode;

  await updateSave(saveId, {
    ...fields,
    title: fields.title || save.title,
  });

  return saveId;
};

export default {
  WIZARD_STEPS,
  WIZARD_STEP_COUNT,
  FICTION_STYLE_PRESETS,
  getStylePreset,
  buildDefaultWizardForm,
  validateWizardStep,
  loadWizardForm,
  saveWizardForm,
  saveWizardEdits,
  importCharacterCopy,
  importCharactersByIds,
  listImportableCharacters,
  countImportedEdits,
  resetImportedCopy,
  fileToAvatarDataUrl,
  parseKeywords,
  formatKeywords,
  makeId,
};
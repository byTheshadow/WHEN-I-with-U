// src/apps/fiction/fictionThinkingLibrary.js
//
// 思考预设库的读写：存在 db.settings 的 fictionThinkingPresets 里，
// value 形如 { presets: [...] }，只存用户自己的预设（内置默认预设写在代码里，不进库）。
//
// 本文件的 loadThinkingLibrary / saveThinkingLibrary / countSavesUsingPreset 会碰数据库，
// 其余函数都是纯函数：拿旧的 library 返回新的 library，不改原对象。

import db from '../../db';
import {
  BUILTIN_THINKING_PRESET,
  THINKING_PRESETS_SETTING_KEY,
  listThinkingPresets,
  normalizeThinkingPreset,
} from './fictionThinkingPresets';

export const THINKING_LIMITS = {
  presets: 20,
  entries: 30,
  name: 20,
  title: 20,
  content: 2000,
};

const str = (value) => String(value ?? '').trim();

const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const EMPTY_THINKING_LIBRARY = { presets: [] };

// 库里只留用户自己的预设（listThinkingPresets 第一项是内置的，去掉）。
const toLibrary = (value) => ({ presets: listThinkingPresets(value).slice(1) });

export const loadThinkingLibrary = async () => {
  try {
    const row = await db.settings.get(THINKING_PRESETS_SETTING_KEY);

    return toLibrary(row?.value);
  } catch (error) {
    console.warn('[Fiction] 读取思考预设库失败：', error);

    return EMPTY_THINKING_LIBRARY;
  }
};

// 写库失败时会抛错，由调用方提示用户。
export const saveThinkingLibrary = async (library) => {
  await db.settings.put({
    key: THINKING_PRESETS_SETTING_KEY,
    value: { presets: toLibrary(library).presets },
  });
};

// 统计各份预设被多少个「开了思维链」的存档用着：{ [presetId]: 数量 }。
export const countSavesUsingPresets = async () => {
  const counts = {};

  try {
    const saves = await db.fictionSaves.toArray();

    saves.forEach((save) => {
      const id = str(save?.thinkingPresetId);

      if (save?.thinkingChain && id) counts[id] = (counts[id] || 0) + 1;
    });
  } catch (error) {
    console.warn('[Fiction] 统计预设使用情况失败：', error);
  }

  return counts;
};

// ---------- 纯函数：改库 ----------

const cloneEntries = (entries) => (entries || []).map((entry) => ({ ...entry }));

const clip = (text, max) => str(text).slice(0, max);

// 从一份预设（内置或自己的）复制出新预设。超出数量上限返回 null。
export const duplicatePreset = (library, source, name) => {
  if (toLibrary(library).presets.length >= THINKING_LIMITS.presets) return null;

  const preset = {
    id: makeId('preset'),
    name: clip(name || `${source?.name || '预设'} 副本`, THINKING_LIMITS.name) || '未命名预设',
    entries: cloneEntries(source?.entries),
  };

  return {
    library: { presets: [...toLibrary(library).presets, normalizeThinkingPreset(preset)] },
    preset,
  };
};

// 新建预设：从内置默认预设复制。
export const createPresetFromBuiltin = (library) => (
  duplicatePreset(library, BUILTIN_THINKING_PRESET, '新预设')
);

export const updatePreset = (library, presetId, patch) => ({
  presets: toLibrary(library).presets.map((preset) => (
    preset.id === presetId ? normalizeThinkingPreset({ ...preset, ...patch, id: preset.id }) : preset
  )),
});

export const renamePreset = (library, presetId, name) => (
  updatePreset(library, presetId, { name: clip(name, THINKING_LIMITS.name) })
);

export const deletePreset = (library, presetId) => ({
  presets: toLibrary(library).presets.filter((preset) => preset.id !== presetId),
});

export const setEntryEnabled = (library, presetId, entryId, enabled) => {
  const preset = toLibrary(library).presets.find((item) => item.id === presetId);

  if (!preset) return library;

  return updatePreset(library, presetId, {
    entries: preset.entries.map((entry) => (entry.id === entryId ? { ...entry, enabled: Boolean(enabled) } : entry)),
  });
};

// 把第 from 条挪到第 to 条的位置（上移 / 下移就是 to = from ∓ 1）。
export const moveEntry = (library, presetId, from, to) => {
  const preset = toLibrary(library).presets.find((item) => item.id === presetId);

  if (!preset || from === to || from < 0 || to < 0 || from >= preset.entries.length || to >= preset.entries.length) {
    return library;
  }

  const entries = [...preset.entries];
  const [moved] = entries.splice(from, 1);

  entries.splice(to, 0, moved);

  return updatePreset(library, presetId, { entries });
};

// 新增或修改一个条目：entry.id 为空 = 新增（追加到末尾，超出条目数上限返回 null）。
export const upsertEntry = (library, presetId, entry) => {
  const preset = toLibrary(library).presets.find((item) => item.id === presetId);

  if (!preset) return library;

  const next = {
    id: str(entry?.id),
    title: clip(entry?.title, THINKING_LIMITS.title),
    content: str(entry?.content).slice(0, THINKING_LIMITS.content),
    enabled: entry?.enabled !== false,
    choiceOnly: Boolean(entry?.choiceOnly),
  };

  const exists = next.id && preset.entries.some((item) => item.id === next.id);

  if (!exists) {
    if (preset.entries.length >= THINKING_LIMITS.entries) return null;

    return updatePreset(library, presetId, {
      entries: [...preset.entries, { ...next, id: next.id || makeId('entry') }],
    });
  }

  return updatePreset(library, presetId, {
    entries: preset.entries.map((item) => (item.id === next.id ? next : item)),
  });
};

export const deleteEntry = (library, presetId, entryId) => {
  const preset = toLibrary(library).presets.find((item) => item.id === presetId);

  if (!preset) return library;

  return updatePreset(library, presetId, {
    entries: preset.entries.filter((item) => item.id !== entryId),
  });
};

export default {
  THINKING_LIMITS,
  EMPTY_THINKING_LIBRARY,
  loadThinkingLibrary,
  saveThinkingLibrary,
  countSavesUsingPresets,
  duplicatePreset,
  createPresetFromBuiltin,
  updatePreset,
  renamePreset,
  deletePreset,
  setEntryEnabled,
  moveEntry,
  upsertEntry,
  deleteEntry,
};
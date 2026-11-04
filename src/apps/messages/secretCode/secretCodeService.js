// src/apps/messages/secretCode/secretCodeService.js
//
// 悄悄话词典（专属暗号）的数据层。词典存在角色记录上的两个无索引字段：
//   character.secretCodes        暗号数组
//   character.secretCodeFolders  文件夹数组
// 同一个角色的所有聊天窗共用同一本；不需要升级 db.version。
//
// 单条暗号：
//   { id, code, meaning, source, folderId, useCount, lastUsedAt, createdAt, updatedAt }
//   - source   'manual'（用户手动添加）| 'ai'（角色提议、用户确认）
//   - folderId 所在文件夹；没有或指向已不存在的文件夹时，读取时自动归到"未分类"
//   - useCount / lastUsedAt  使用统计，切片C/D才会真正更新
//
// 单个文件夹：
//   { id, name, desc, colorIndex, uncat }
//   - colorIndex 只存序号（0-3），渲染时再映射到主题变量，换主题不用迁移
//   - uncat      "未分类"文件夹，固定 id，永远存在，不能删除、不能改名
//
// 所有读写都先从 db 里重新读一次角色记录，再整体写回，避免界面上的旧状态
// 把别处的改动覆盖掉。写入暗号或文件夹时两个字段一起写。
import db from '../../../db';

export const SECRET_CODE_LIMITS = {
  MAX_ENTRIES: 50,
  MAX_CODE_LENGTH: 4,
  MAX_MEANING_LENGTH: 60,
  // 文件夹总数上限，"未分类"也算在内（所以自己能建 7 个）
  MAX_FOLDERS: 8,
  MAX_FOLDER_NAME_LENGTH: 8,
  MAX_FOLDER_DESC_LENGTH: 30,
};

export const UNCATEGORIZED_FOLDER_ID = 'sc_folder_uncat';
export const UNCATEGORIZED_FOLDER_NAME = '未分类';
// 文件夹颜色的序号范围，对应主题里的 --bg-blob-1/2/3 和 --accent-color
export const FOLDER_COLOR_COUNT = 4;

// 暗号里不能出现的东西：
// - 方括号和竖线：跟 [TAG: ...] 卡片语法、"|||" 气泡分隔符冲突
// - 空白：暗号要能被当成一个整体识别
// - emoji：站点全局不使用 emoji，而且 emoji 常被拆成多个 token，反而更贵
const FORBIDDEN_CHARS = /[\[\]|\s]/;
const EMOJI_LIKE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/u;

const toCodePointLength = (text) => Array.from(String(text || '')).length;

const makeEntryId = () =>
  `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const makeFolderId = () =>
  `scf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const sameFolderName = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// 规范化（纯函数）
// ---------------------------------------------------------------------------

export const normalizeSecretCodes = (raw) => {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item) => item && typeof item.code === 'string' && item.code)
    .map((item) => ({
      id: item.id || makeEntryId(),
      code: item.code,
      meaning: String(item.meaning || ''),
      source: item.source === 'ai' ? 'ai' : 'manual',
      folderId: typeof item.folderId === 'string' && item.folderId ? item.folderId : null,
      useCount: Number(item.useCount) || 0,
      lastUsedAt: item.lastUsedAt || null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    }));
};

const makeUncategorizedFolder = () => ({
  id: UNCATEGORIZED_FOLDER_ID,
  name: UNCATEGORIZED_FOLDER_NAME,
  desc: '',
  colorIndex: 1,
  uncat: true,
});

/**
 * 文件夹数组规范化：丢掉坏数据，保证"未分类"存在且只有一个、排在最前，
 * 超出上限的普通文件夹丢弃（正常使用走不到，只防脏数据）。
 */
export const normalizeSecretCodeFolders = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  const seenIds = new Set([UNCATEGORIZED_FOLDER_ID]);
  const normal = [];

  list.forEach((item) => {
    if (!item || typeof item.id !== 'string' || !item.id) return;
    if (item.uncat || item.id === UNCATEGORIZED_FOLDER_ID) return;
    if (seenIds.has(item.id)) return;

    const name = String(item.name || '').trim();
    if (!name) return;

    seenIds.add(item.id);
    normal.push({
      id: item.id,
      name,
      desc: String(item.desc || ''),
      colorIndex: Number.isInteger(item.colorIndex)
        ? ((item.colorIndex % FOLDER_COLOR_COUNT) + FOLDER_COLOR_COUNT) % FOLDER_COLOR_COUNT
        : 0,
      uncat: false,
    });
  });

  return [makeUncategorizedFolder(), ...normal.slice(0, SECRET_CODE_LIMITS.MAX_FOLDERS - 1)];
};

/**
 * 把一个角色记录整理成 { entries, folders }：
 * 没有 folderId 或指向不存在文件夹的暗号，统一归到"未分类"。
 * 旧数据（切片A写入的、没有 folderId 的暗号）靠这一步自动迁移，不需要脚本。
 */
export const normalizeSecretCodeBook = (character) => {
  const folders = normalizeSecretCodeFolders(character?.secretCodeFolders);
  const folderIds = new Set(folders.map((folder) => folder.id));

  const entries = normalizeSecretCodes(character?.secretCodes).map((entry) =>
    entry.folderId && folderIds.has(entry.folderId)
      ? entry
      : { ...entry, folderId: UNCATEGORIZED_FOLDER_ID }
  );

  return { entries, folders };
};

// ---------------------------------------------------------------------------
// 校验（纯函数）
// ---------------------------------------------------------------------------

/**
 * 校验一条暗号能不能写入。返回 { ok: true } 或 { ok: false, reason }。
 * existing 是当前词典；editingId 是正在编辑的那一条的 id（编辑时跳过
 * 跟自己的重复检查）。
 */
export const validateSecretCode = ({ code, meaning }, existing = [], editingId = null) => {
  const cleanCode = String(code || '').trim();
  const cleanMeaning = String(meaning || '').trim();

  if (!cleanCode) return { ok: false, reason: '暗号不能为空。' };
  if (!cleanMeaning) return { ok: false, reason: '含义不能为空。' };

  if (toCodePointLength(cleanCode) > SECRET_CODE_LIMITS.MAX_CODE_LENGTH) {
    return {
      ok: false,
      reason: `暗号最多 ${SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符，越短越省。`,
    };
  }

  if (FORBIDDEN_CHARS.test(cleanCode)) {
    return { ok: false, reason: '暗号里不能有空格、方括号或竖线。' };
  }

  if (EMOJI_LIKE.test(cleanCode)) {
    return { ok: false, reason: '暗号不能使用 emoji，请换成普通符号或文字。' };
  }

  if (toCodePointLength(cleanMeaning) > SECRET_CODE_LIMITS.MAX_MEANING_LENGTH) {
    return {
      ok: false,
      reason: `含义最多 ${SECRET_CODE_LIMITS.MAX_MEANING_LENGTH} 个字，写短一点。`,
    };
  }

  const duplicated = existing.some(
    (item) => item.id !== editingId && item.code === cleanCode
  );
  if (duplicated) return { ok: false, reason: '词典里已经有这个暗号了。' };

  return { ok: true };
};

/** 校验文件夹名字和说明。返回 { ok: true } 或 { ok: false, reason }。 */
export const validateSecretCodeFolder = ({ name, desc = '' }) => {
  const cleanName = String(name || '').trim();
  const cleanDesc = String(desc || '').trim();

  if (!cleanName) return { ok: false, reason: '文件夹名字不能为空。' };

  if (toCodePointLength(cleanName) > SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH) {
    return {
      ok: false,
      reason: `文件夹名字最多 ${SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH} 个字。`,
    };
  }

  if (EMOJI_LIKE.test(cleanName) || EMOJI_LIKE.test(cleanDesc)) {
    return { ok: false, reason: '文件夹名字和说明里不能使用 emoji。' };
  }

  if (toCodePointLength(cleanDesc) > SECRET_CODE_LIMITS.MAX_FOLDER_DESC_LENGTH) {
    return {
      ok: false,
      reason: `文件夹说明最多 ${SECRET_CODE_LIMITS.MAX_FOLDER_DESC_LENGTH} 个字。`,
    };
  }

  return { ok: true };
};

// 新文件夹的颜色：优先用还没被占用的序号，四种都用过了就按数量轮换
const pickNextColorIndex = (folders) => {
  const used = new Set(
    folders.filter((folder) => !folder.uncat).map((folder) => folder.colorIndex)
  );
  for (let i = 0; i < FOLDER_COLOR_COUNT; i += 1) {
    if (!used.has(i)) return i;
  }
  return folders.length % FOLDER_COLOR_COUNT;
};

// ---------------------------------------------------------------------------
// 读写
// ---------------------------------------------------------------------------

const readBook = async (characterId) => {
  const character = await db.characters.get(characterId);
  if (!character) return null;
  return normalizeSecretCodeBook(character);
};

// 词典变化时发一个全局事件，聊天气泡那边的词典缓存（secretCodeDictionaryStore）
// 收到后重新读库，这样气泡不用每条消息都读一次 db，词典页改了东西又能立刻生效。
export const SECRET_CODE_DICTIONARY_EVENT = 'secret-code-dictionary-changed';

const notifyDictionaryChanged = (characterId) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(SECRET_CODE_DICTIONARY_EVENT, { detail: { characterId } })
    );
  } catch (error) {
    console.warn('[secretCodeService] 通知词典变化失败：', error);
  }
};

const writeBook = async (characterId, { entries, folders }) => {
  await db.characters.update(characterId, {
    secretCodes: entries,
    secretCodeFolders: folders,
  });
  notifyDictionaryChanged(characterId);
  return { entries, folders };
};

const NOT_FOUND = { ok: false, entries: [], folders: [], reason: '找不到这个角色。' };

/** 读整本词典：{ entries, folders }。角色不存在时返回空本子。 */
export const getSecretCodeBook = async (characterId) => {
  if (!characterId) return { entries: [], folders: [makeUncategorizedFolder()] };
  const book = await readBook(characterId);
  return book || { entries: [], folders: [makeUncategorizedFolder()] };
};

/** 只读暗号数组（切片A的老接口，保持不变）。 */
export const getSecretCodes = async (characterId) => {
  const book = await getSecretCodeBook(characterId);
  return book.entries;
};

/** 只读文件夹数组。 */
export const getSecretCodeFolders = async (characterId) => {
  const book = await getSecretCodeBook(characterId);
  return book.folders;
};

/**
 * 在一份内存里的文件夹列表中找到或新建一个文件夹（纯函数，不写库）。
 * 同名（忽略大小写和首尾空格）直接用已有的，名字叫"未分类"也走已有的。
 * 返回 { folders, folder, created }；名字不合法或文件夹满了时 folder 为 null，
 * 由调用方决定是报错还是退回"未分类"。
 */
const resolveFolderByName = (folders, name, desc = '') => {
  const cleanName = String(name || '').trim();

  const existing = folders.find((folder) => sameFolderName(folder.name, cleanName));
  if (existing) return { folders, folder: existing, created: false, reason: '' };

  const check = validateSecretCodeFolder({ name: cleanName, desc });
  if (!check.ok) return { folders, folder: null, created: false, reason: check.reason };

  if (folders.length >= SECRET_CODE_LIMITS.MAX_FOLDERS) {
    return {
      folders,
      folder: null,
      created: false,
      reason: `文件夹最多 ${SECRET_CODE_LIMITS.MAX_FOLDERS} 个，先删掉不用的。`,
    };
  }

  const folder = {
    id: makeFolderId(),
    name: cleanName,
    desc: String(desc || '').trim(),
    colorIndex: pickNextColorIndex(folders),
    uncat: false,
  };

  return { folders: [...folders, folder], folder, created: true, reason: '' };
};

/**
 * 添加一条暗号。返回 { ok, entries, folders, entry, folderCreated, folderFallback, reason }。
 *
 * 放进哪个文件夹：
 *   - 传了 folderId 且存在 → 用它
 *   - 传了 folderName（角色提议时顺便起的名字）→ 同名用已有的，没有就新建；
 *     名字不合法或文件夹已满时退回"未分类"，并且 folderFallback 为 true，
 *     不让整条暗号因为文件夹问题被拒绝
 *   - 都没传 → "未分类"
 */
export const addSecretCode = async (
  characterId,
  { code, meaning, source = 'manual', folderId = null, folderName = '' }
) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const { entries } = book;
  let { folders } = book;

  if (entries.length >= SECRET_CODE_LIMITS.MAX_ENTRIES) {
    return {
      ok: false,
      entries,
      folders,
      reason: `词典最多 ${SECRET_CODE_LIMITS.MAX_ENTRIES} 条，先删掉一些不常用的。`,
    };
  }

  const check = validateSecretCode({ code, meaning }, entries);
  if (!check.ok) return { ok: false, entries, folders, reason: check.reason };

  let targetFolderId = UNCATEGORIZED_FOLDER_ID;
  let folderCreated = false;
  let folderFallback = false;

  if (folderId && folders.some((folder) => folder.id === folderId)) {
    targetFolderId = folderId;
  } else if (String(folderName || '').trim()) {
    const resolved = resolveFolderByName(folders, folderName);
    if (resolved.folder) {
      folders = resolved.folders;
      targetFolderId = resolved.folder.id;
      folderCreated = resolved.created;
    } else {
      folderFallback = true;
    }
  }

  const now = new Date().toISOString();
  const entry = {
    id: makeEntryId(),
    code: String(code).trim(),
    meaning: String(meaning).trim(),
    source: source === 'ai' ? 'ai' : 'manual',
    folderId: targetFolderId,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const nextEntries = [...entries, entry];
  await writeBook(characterId, { entries: nextEntries, folders });

  return {
    ok: true,
    entries: nextEntries,
    folders,
    entry,
    folderCreated,
    folderFallback,
    reason: '',
  };
};

/** 修改一条暗号的文字或含义（不动所在文件夹）。返回 { ok, entries, folders, reason }。 */
export const updateSecretCode = async (characterId, entryId, { code, meaning }) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const { entries, folders } = book;

  const target = entries.find((item) => item.id === entryId);
  if (!target) return { ok: false, entries, folders, reason: '这条暗号已经不存在了。' };

  const check = validateSecretCode({ code, meaning }, entries, entryId);
  if (!check.ok) return { ok: false, entries, folders, reason: check.reason };

  const next = entries.map((item) =>
    item.id === entryId
      ? {
          ...item,
          code: String(code).trim(),
          meaning: String(meaning).trim(),
          updatedAt: new Date().toISOString(),
        }
      : item
  );

  await writeBook(characterId, { entries: next, folders });
  return { ok: true, entries: next, folders, reason: '' };
};

/** 把一条暗号移到另一个文件夹。返回 { ok, entries, folders, reason }。 */
export const moveSecretCode = async (characterId, entryId, targetFolderId) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const { entries, folders } = book;

  if (!entries.some((item) => item.id === entryId)) {
    return { ok: false, entries, folders, reason: '这条暗号已经不存在了。' };
  }
  if (!folders.some((folder) => folder.id === targetFolderId)) {
    return { ok: false, entries, folders, reason: '目标文件夹已经不存在了。' };
  }

  const next = entries.map((item) =>
    item.id === entryId ? { ...item, folderId: targetFolderId } : item
  );

  await writeBook(characterId, { entries: next, folders });
  return { ok: true, entries: next, folders, reason: '' };
};

/** 删除一条暗号（不可恢复）。返回 { ok, entries, folders }。 */
export const deleteSecretCode = async (characterId, entryId) => {
  const book = await readBook(characterId);
  if (!book) return { ok: false, entries: [], folders: [] };

  const next = book.entries.filter((item) => item.id !== entryId);
  await writeBook(characterId, { entries: next, folders: book.folders });
  return { ok: true, entries: next, folders: book.folders };
};

// ---------------------------------------------------------------------------
// 文件夹的增删改
// ---------------------------------------------------------------------------

/**
 * 新建文件夹。同名（忽略大小写）不会重复建，直接返回已有的那个并标
 * merged: true。返回 { ok, entries, folders, folder, merged, reason }。
 */
export const addSecretCodeFolder = async (characterId, { name, desc = '' }) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const { entries, folders } = book;
  const resolved = resolveFolderByName(folders, name, desc);

  if (!resolved.folder) {
    return { ok: false, entries, folders, reason: resolved.reason };
  }

  if (resolved.created) {
    await writeBook(characterId, { entries, folders: resolved.folders });
  }

  return {
    ok: true,
    entries,
    folders: resolved.folders,
    folder: resolved.folder,
    merged: !resolved.created,
    reason: '',
  };
};

/**
 * 改文件夹的名字或说明。"未分类"不能改。改成和别的文件夹同名会被拒绝
 * （手动改名时静默合并会让暗号莫名其妙换地方，所以这里提示换个名字）。
 */
export const updateSecretCodeFolder = async (characterId, folderId, { name, desc = '' }) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const { entries, folders } = book;

  const target = folders.find((folder) => folder.id === folderId);
  if (!target) return { ok: false, entries, folders, reason: '这个文件夹已经不存在了。' };
  if (target.uncat) return { ok: false, entries, folders, reason: '"未分类"不能修改。' };

  const check = validateSecretCodeFolder({ name, desc });
  if (!check.ok) return { ok: false, entries, folders, reason: check.reason };

  const cleanName = String(name).trim();
  const clash = folders.some(
    (folder) => folder.id !== folderId && sameFolderName(folder.name, cleanName)
  );
  if (clash) return { ok: false, entries, folders, reason: '已经有同名的文件夹了，换个名字吧。' };

  const nextFolders = folders.map((folder) =>
    folder.id === folderId ? { ...folder, name: cleanName, desc: String(desc).trim() } : folder
  );

  await writeBook(characterId, { entries, folders: nextFolders });
  return { ok: true, entries, folders: nextFolders, reason: '' };
};

/**
 * 删除文件夹。里面的暗号全部移到"未分类"，一条都不丢。"未分类"不能删。
 * 返回 { ok, entries, folders, movedCount, reason }。
 */
export const deleteSecretCodeFolder = async (characterId, folderId) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const { entries, folders } = book;

  const target = folders.find((folder) => folder.id === folderId);
  if (!target) return { ok: false, entries, folders, reason: '这个文件夹已经不存在了。' };
  if (target.uncat) return { ok: false, entries, folders, reason: '"未分类"不能删除。' };

  let movedCount = 0;
  const nextEntries = entries.map((item) => {
    if (item.folderId !== folderId) return item;
    movedCount += 1;
    return { ...item, folderId: UNCATEGORIZED_FOLDER_ID };
  });
  const nextFolders = folders.filter((folder) => folder.id !== folderId);

  await writeBook(characterId, { entries: nextEntries, folders: nextFolders });
  return { ok: true, entries: nextEntries, folders: nextFolders, movedCount, reason: '' };
};

// ---------------------------------------------------------------------------
// 使用次数统计（切片C开始写入）
// ---------------------------------------------------------------------------

/**
 * 统计的起点：只统计这个时间之后的消息，避免第一次打开老聊天时把历史消息
 * 一次性全算进去。没记录过就取词典里最早一条暗号的创建时间（暗号建立之前
 * 的聊天不可能是在用它），并存起来；一条都没有就取现在。
 */
export const ensureSecretCodeCountingSince = async (characterId) => {
  const character = await db.characters.get(characterId);
  if (!character) return new Date().toISOString();

  if (character.secretCodeCountingSince) return character.secretCodeCountingSince;

  const entries = normalizeSecretCodes(character.secretCodes);
  const earliest = entries
    .map((entry) => entry.createdAt)
    .filter(Boolean)
    .sort()[0];
  const since = earliest || new Date().toISOString();

  await db.characters.update(characterId, { secretCodeCountingSince: since });
  return since;
};

/**
 * 批量记录使用次数：totals 是 { 暗号: 新增次数 }。只改 useCount 和 lastUsedAt，
 * 不碰 updatedAt（updatedAt 表示"内容被改过"，不是"被用过"）。
 */
export const recordSecretCodeUses = async (characterId, totals) => {
  const book = await readBook(characterId);
  if (!book) return { ...NOT_FOUND };

  const now = new Date().toISOString();
  let changed = false;

  const next = book.entries.map((entry) => {
    const add = Number(totals?.[entry.code]) || 0;
    if (add <= 0) return entry;
    changed = true;
    return { ...entry, useCount: entry.useCount + add, lastUsedAt: now };
  });

  if (!changed) return { ok: true, entries: book.entries, folders: book.folders, reason: '' };

  await writeBook(characterId, { entries: next, folders: book.folders });
  return { ok: true, entries: next, folders: book.folders, reason: '' };
};

// ---------------------------------------------------------------------------
// 是否允许角色提议新暗号（存在角色记录上的无索引字段，默认开启）
// ---------------------------------------------------------------------------

/** 纯函数：没设置过（undefined）就是开启，只有明确设成 false 才算关闭。 */
export const isSecretCodeProposalEnabled = (character) =>
  character?.secretCodeProposalEnabled !== false;

export const getSecretCodeProposalEnabled = async (characterId) => {
  if (!characterId) return true;
  const character = await db.characters.get(characterId);
  return isSecretCodeProposalEnabled(character);
};

export const setSecretCodeProposalEnabled = async (characterId, enabled) => {
  const next = Boolean(enabled);
  if (!characterId) return next;
  await db.characters.update(characterId, { secretCodeProposalEnabled: next });
  return next;
};
// src/apps/messages/secretCode/secretCodeService.js
//
// 专属暗号词典的数据层。词典存在角色记录上的一个新增无索引字段
// character.secretCodes（数组），同一个角色的所有聊天窗共用同一本；
// 不需要升级 db.version。
//
// 单条暗号的结构：
//   { id, code, meaning, source, useCount, lastUsedAt, createdAt, updatedAt }
//   - code     暗号本身，短的非 emoji 符号或 1-4 个字
//   - meaning  含义，一句话
//   - source   'manual'（用户手动添加）| 'ai'（角色提议、用户确认，切片B用）
//   - useCount / lastUsedAt  使用统计，切片A先占位，切片C/D才会真正更新
//
// 所有读写都先从 db 里重新读一次角色记录，再整体写回数组，避免界面上的
// 旧状态把别处的改动覆盖掉。
import db from '../../../db';

export const SECRET_CODE_LIMITS = {
  MAX_ENTRIES: 50,
  MAX_CODE_LENGTH: 4,
  MAX_MEANING_LENGTH: 60,
};

// 暗号里不能出现的东西：
// - 方括号和竖线：跟 [TAG: ...] 卡片语法、"|||" 气泡分隔符冲突
// - 空白：暗号要能被当成一个整体识别
// - emoji：站点全局不使用 emoji，而且 emoji 常被拆成多个 token，反而更贵
const FORBIDDEN_CHARS = /[\[\]|\s]/;
const EMOJI_LIKE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/u;

const toCodePointLength = (text) => Array.from(String(text || '')).length;

const makeEntryId = () =>
  `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const normalizeSecretCodes = (raw) => {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item) => item && typeof item.code === 'string' && item.code)
    .map((item) => ({
      id: item.id || makeEntryId(),
      code: item.code,
      meaning: String(item.meaning || ''),
      source: item.source === 'ai' ? 'ai' : 'manual',
      useCount: Number(item.useCount) || 0,
      lastUsedAt: item.lastUsedAt || null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    }));
};

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

const readEntries = async (characterId) => {
  const character = await db.characters.get(characterId);
  if (!character) return null;
  return normalizeSecretCodes(character.secretCodes);
};

const writeEntries = async (characterId, entries) => {
  await db.characters.update(characterId, { secretCodes: entries });
  return entries;
};

export const getSecretCodes = async (characterId) => {
  if (!characterId) return [];
  const entries = await readEntries(characterId);
  return entries || [];
};

/** 添加一条暗号。返回 { ok, entries, reason }。 */
export const addSecretCode = async (characterId, { code, meaning, source = 'manual' }) => {
  const entries = await readEntries(characterId);
  if (!entries) return { ok: false, entries: [], reason: '找不到这个角色。' };

  if (entries.length >= SECRET_CODE_LIMITS.MAX_ENTRIES) {
    return {
      ok: false,
      entries,
      reason: `词典最多 ${SECRET_CODE_LIMITS.MAX_ENTRIES} 条，先删掉一些不常用的。`,
    };
  }

  const check = validateSecretCode({ code, meaning }, entries);
  if (!check.ok) return { ok: false, entries, reason: check.reason };

  const now = new Date().toISOString();
  const next = [
    ...entries,
    {
      id: makeEntryId(),
      code: String(code).trim(),
      meaning: String(meaning).trim(),
      source: source === 'ai' ? 'ai' : 'manual',
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await writeEntries(characterId, next);
  return { ok: true, entries: next, reason: '' };
};

/** 修改一条暗号的文字或含义。返回 { ok, entries, reason }。 */
export const updateSecretCode = async (characterId, entryId, { code, meaning }) => {
  const entries = await readEntries(characterId);
  if (!entries) return { ok: false, entries: [], reason: '找不到这个角色。' };

  const target = entries.find((item) => item.id === entryId);
  if (!target) return { ok: false, entries, reason: '这条暗号已经不存在了。' };

  const check = validateSecretCode({ code, meaning }, entries, entryId);
  if (!check.ok) return { ok: false, entries, reason: check.reason };

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

  await writeEntries(characterId, next);
  return { ok: true, entries: next, reason: '' };
};

/** 删除一条暗号（不可恢复）。返回 { ok, entries }。 */
export const deleteSecretCode = async (characterId, entryId) => {
  const entries = await readEntries(characterId);
  if (!entries) return { ok: false, entries: [] };

  const next = entries.filter((item) => item.id !== entryId);
  await writeEntries(characterId, next);
  return { ok: true, entries: next };
};
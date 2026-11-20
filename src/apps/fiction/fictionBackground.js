// src/apps/fiction/fictionBackground.js
//
// 游玩页的上传背景图：每个存档各自一张，存在 fictionBackgrounds 表里
// （主键就是存档 id，一个存档最多一行）。
//
// 为什么单独一张表：图是大文件，放进 db.settings 会被自动调度和设置页那种
// 「整张表读出来」的代码反复整份读进内存。这张表只在进入游玩页时按 id 读一行。
// 它和 fictionImageFiles 一样只放 Blob，已在 backupService.js 里排除在备份之外。
//
// 一行的内容：{ saveId, blob, dim, blur, updatedAt }
//   blob  压缩后的 JPEG
//   dim   压暗，0 到 80（百分比）。盖的是阅读主题的纸色，不是黑色，
//         浅色主题下相当于压淡，深色字不会变得看不清
//   blur  模糊，0 到 20（px）

import db from '../../db';

export const BG_DIM_RANGE = { min: 0, max: 80, step: 1 };
export const BG_BLUR_RANGE = { min: 0, max: 20, step: 1 };
export const DEFAULT_BG_LOOK = { dim: 35, blur: 6 };

// 手机屏幕上图要被压暗、模糊，不需要高分辨率，1280 足够，体积在几百 KB 以内。
export const BG_COMPRESS_OPTIONS = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.72,
  outputType: 'blob',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pick = (value, range, fallback) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? clamp(Math.round(number), range.min, range.max)
    : fallback;
};

// 规整压暗和模糊两个值，缺字段、类型不对都退回默认值。
export const normalizeBgLook = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};

  return {
    dim: pick(source.dim, BG_DIM_RANGE, DEFAULT_BG_LOOK.dim),
    blur: pick(source.blur, BG_BLUR_RANGE, DEFAULT_BG_LOOK.blur),
  };
};

const isUsableRow = (row) => Boolean(row && row.blob instanceof Blob);

// 读这个存档的背景图，没有就返回 null。
export const getBackground = async (saveId) => {
  const row = await db.fictionBackgrounds.get(saveId);

  return isUsableRow(row) ? row : null;
};

// 换图。这个存档已有背景图时，保留原来的压暗和模糊。
export const saveBackgroundImage = async (saveId, blob) => {
  const existing = await db.fictionBackgrounds.get(saveId);
  const look = normalizeBgLook(existing || DEFAULT_BG_LOOK);

  await db.fictionBackgrounds.put({
    saveId,
    blob,
    ...look,
    updatedAt: Date.now(),
  });
};

// 只改压暗和模糊。这个存档没有背景图（比如刚被移除）时什么也不做，不会凭空建出一行。
export const updateBackgroundLook = async (saveId, patch) => {
  const existing = await db.fictionBackgrounds.get(saveId);

  if (!existing) return false;

  const look = normalizeBgLook({ ...existing, ...patch });

  await db.fictionBackgrounds.update(saveId, { ...look, updatedAt: Date.now() });

  return true;
};

export const deleteBackground = (saveId) => db.fictionBackgrounds.delete(saveId);

// 复制存档时把背景图一起复制过去（完整复制和只复制设置都带）。
// 要在已经包含 fictionBackgrounds 的事务里调用。
export const copyBackground = async (fromSaveId, toSaveId) => {
  const row = await db.fictionBackgrounds.get(fromSaveId);

  if (!isUsableRow(row)) return;

  await db.fictionBackgrounds.put({ ...row, saveId: toSaveId, updatedAt: Date.now() });
};
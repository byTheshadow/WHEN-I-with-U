// src/apps/layoutstudio/layoutWorksService.js
//
// 修图室相册（切片 C）：只存成品图和做这张图所需的信息，不存原图。
// 表：db.layoutWorks（见 db/index.js 的 db.version(108)）。
//   id, characterId, createdAt（有索引）
//   templateId, spec, blob(JPEG), why, praise, summary（不建索引）
// spec 里的 photo 只是照片序号，原图不存，所以相册里的作品不能重新渲染，只能看成品。

import db from '../../db';

const JPEG_QUALITY = 0.92;

// 把画布导出成 JPEG。JPEG 没有透明通道，先垫一层白底，免得透明处变黑。
export const canvasToJpegBlob = (canvas, quality = JPEG_QUALITY) =>
  new Promise((resolve) => {
    if (!canvas) {
      resolve(null);
      return;
    }
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    flat.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });

const clonePlain = (value) => {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
};

// 存一张作品。返回新记录的 id。
export const saveLayoutWork = async ({
  characterId,
  templateId,
  spec,
  blob,
  why = '',
  praise = '',
  summary = '',
}) => {
  if (!blob) throw new Error('没有可保存的成品图');
  return db.layoutWorks.add({
    characterId: characterId ?? null,
    createdAt: Date.now(),
    templateId: templateId || spec?.templateId || '',
    spec: clonePlain(spec),
    blob,
    why: String(why || ''),
    praise: String(praise || ''),
    summary: String(summary || ''),
  });
};

// 按时间倒序列出作品；传了 characterId 就只列这个角色的。
export const listLayoutWorks = async ({ characterId = null } = {}) => {
  const all =
    characterId == null
      ? await db.layoutWorks.toArray()
      : await db.layoutWorks.where('characterId').equals(characterId).toArray();
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const countLayoutWorks = () => db.layoutWorks.count();

export const updateLayoutWorkSummary = (id, summary) =>
  db.layoutWorks.update(id, { summary: String(summary || '') });

export const deleteLayoutWork = (id) => db.layoutWorks.delete(id);
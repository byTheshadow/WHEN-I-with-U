// src/apps/fiction/fictionImageGallery.js
//
// 「本存档的图片」页用的数据操作：分页读、读全部 id（给「全选」用）、批量删除、
// 算每张图属于第几段。读列表只读 fictionImages 的元数据和小缩略图，不碰原图 Blob，
// 所以翻页很快，也不会一次把整个存档的图都读进内存。
// 单张图的删除、重试、读原图在 fictionImageService.js 里。

import db from '../../db';
import { getPathToNode } from './fictionService';
import { FICTION_IMAGE_CHANGED_EVENT } from './fictionImageService';

export const GALLERY_PAGE_SIZE = 24;

/**
 * 读这个存档最新的 limit 张图（新的在前），同时返回这个存档一共有几张。
 */
export const listImagesPage = async (saveId, { limit = GALLERY_PAGE_SIZE } = {}) => {
  const [total, items] = await Promise.all([
    db.fictionImages.where('saveId').equals(saveId).count(),
    db.fictionImages.where('saveId').equals(saveId).reverse().limit(limit).toArray(),
  ]);

  return { items, total };
};

// 这个存档所有图的 id（只读主键，很轻），「全选」用。
export const listImageIds = (saveId) => db.fictionImages.where('saveId').equals(saveId).primaryKeys();

// 从当前节点一路往上的节点 id 集合，用来判断一张图在不在当前剧情路径上。
export const loadPathIds = async (currentNodeId) => (
  new Set((await getPathToNode(currentNodeId)).map((node) => node.id))
);

/**
 * 算每个节点是第几段、在不在当前路径上。返回 Map<节点id, { number, onPath }>。
 * 找不到的节点（理论上不会出现）不放进结果里。
 */
export const describeNodes = async ({ nodeIds, pathIds }) => {
  const result = new Map();

  for (const nodeId of nodeIds) {
    const path = await getPathToNode(nodeId);

    if (path.length > 0) result.set(nodeId, { number: path.length, onPath: pathIds.has(nodeId) });
  }

  return result;
};

/**
 * 批量删除：元数据、原图、各节点 imageIds 里的引用一起删，同一个事务。
 * 只会删属于这个存档的图。返回实际删掉的张数。
 */
export const deleteImages = async (saveId, imageIds) => {
  const wanted = [...new Set(imageIds || [])];
  const removed = [];

  if (wanted.length === 0) return 0;

  await db.transaction('rw', db.fictionImages, db.fictionImageFiles, db.fictionNodes, async () => {
    const rows = (await db.fictionImages.bulkGet(wanted)).filter((row) => row && row.saveId === saveId);

    if (rows.length === 0) return;

    const fileIds = rows.map((row) => row.fileId).filter((id) => id != null);

    if (fileIds.length > 0) await db.fictionImageFiles.bulkDelete(fileIds);

    await db.fictionImages.bulkDelete(rows.map((row) => row.id));

    const gone = new Set(rows.map((row) => row.id));
    const nodeIds = [...new Set(rows.map((row) => row.nodeId))];

    for (const nodeId of nodeIds) {
      const node = await db.fictionNodes.get(nodeId);

      if (node) {
        await db.fictionNodes.update(nodeId, {
          imageIds: (node.imageIds || []).filter((id) => !gone.has(id)),
        });
      }
    }

    removed.push(...rows);
  });

  if (typeof window !== 'undefined') {
    removed.forEach((row) => {
      window.dispatchEvent(new CustomEvent(FICTION_IMAGE_CHANGED_EVENT, {
        detail: { saveId, nodeId: row.nodeId, imageId: row.id, status: 'deleted' },
      }));
    });
  }

  return removed.length;
};
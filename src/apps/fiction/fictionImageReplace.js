// src/apps/fiction/fictionImageReplace.js
//
// 「重新生成」留下的旧图怎么处理。
// 重新生成会新增一张图，新图的记录上带 replacesImageId（旧图的 id），旧图原样保留；
// 新图生成完后，界面在图上方问「要删除旧图吗？」。用户点按钮后调用这里：
//   deleteOld = true   删掉旧图（元数据、原图、节点引用），再清掉新图上的标记
//   deleteOld = false  保留两张，只清掉新图上的标记
// 一直不点就是保留，标记留在记录里，刷新页面后提示还在。

import db from '../../db';
import { FICTION_IMAGE_CHANGED_EVENT, deleteImage } from './fictionImageService';

/**
 * 处理一张重新生成出来的图和它的旧图。返回是否真的处理了（这张图已经没有待处理的标记时返回 false）。
 */
export const resolveReplacement = async (imageId, { deleteOld }) => {
  const row = await db.fictionImages.get(imageId);

  if (!row || row.replacesImageId == null) return false;

  if (deleteOld) await deleteImage(row.replacesImageId);

  await db.fictionImages.update(imageId, { replacesImageId: null, updatedAt: Date.now() });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FICTION_IMAGE_CHANGED_EVENT, {
      detail: { saveId: row.saveId, nodeId: row.nodeId, imageId, status: row.status },
    }));
  }

  return true;
};

export default { resolveReplacement };
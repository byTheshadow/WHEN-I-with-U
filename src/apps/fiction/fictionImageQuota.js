// src/apps/fiction/fictionImageQuota.js
//
// 「图片太多了」的判断。原图都存在这台设备的本地数据库里（fictionImageFiles），
// 积累太多会占满空间，应用就可能变慢甚至打不开。这里只数张数：
//   total   所有存档加起来存着多少张原图（数 fictionImageFiles，很轻）
//   inSave  这个存档里有多少张图
// 张数到了 IMAGE_WARN_COUNT 就提醒，到了 IMAGE_STRONG_COUNT 语气加重。

import db from '../../db';

export const IMAGE_WARN_COUNT = 100;
export const IMAGE_STRONG_COUNT = 200;

export const IMAGE_USAGE_LEVEL = {
  OK: 'ok',
  WARN: 'warn',
  STRONG: 'strong',
};

export const levelOf = (total) => {
  if (total >= IMAGE_STRONG_COUNT) return IMAGE_USAGE_LEVEL.STRONG;
  if (total >= IMAGE_WARN_COUNT) return IMAGE_USAGE_LEVEL.WARN;

  return IMAGE_USAGE_LEVEL.OK;
};

export const getImageUsage = async (saveId) => {
  const [total, inSave] = await Promise.all([
    db.fictionImageFiles.count(),
    db.fictionImages.where('saveId').equals(saveId).count(),
  ]);

  return { total, inSave, level: levelOf(total) };
};

export default {
  IMAGE_WARN_COUNT,
  IMAGE_STRONG_COUNT,
  IMAGE_USAGE_LEVEL,
  levelOf,
  getImageUsage,
};
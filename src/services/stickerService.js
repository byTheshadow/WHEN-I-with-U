import db from '../db';

// 15 款专属预设表情包
export const DEFAULT_STICKERS = [
  { name: '心动', url: 'https://u2.fukit.cn/PcyFGX4gq', category: 'preset' },
  { name: '亲亲你', url: 'https://u2.fukit.cn/7ioPavcc6', category: 'preset' },
  { name: '无聊', url: 'https://u2.fukit.cn/QsQ3U486T', category: 'preset' },
  { name: '醒醒', url: 'https://u2.fukit.cn/IFFAjnNe0', category: 'preset' },
  { name: '我来啦', url: 'https://u2.fukit.cn/JZmOAwvK1', category: 'preset' },
  { name: '你好我吃一点', url: 'https://u2.fukit.cn/lAig21Rcu', category: 'preset' },
  { name: '乖宝宝', url: 'https://u2.fukit.cn/0Omv9Oy78', category: 'preset' },
  { name: '哄哄你', url: 'https://u2.fukit.cn/h09DfAhR2', category: 'preset' },
  { name: '开心', url: 'https://u2.fukit.cn/vENEKAqtS', category: 'preset' },
  { name: '喝酒咕噜噜', url: 'https://u2.fukit.cn/ZIscxjpk1', category: 'preset' },
  { name: '嗅嗅你', url: 'https://u2.fukit.cn/VjCrvNu26', category: 'preset' },
  { name: '有点生气', url: 'https://u2.fukit.cn/PacUkxYj8', category: 'preset' },
  { name: '超心动', url: 'https://u2.fukit.cn/mSVQW0LeA', category: 'preset' },
  { name: '你好可爱', url: 'https://u2.fukit.cn/RQmg53mU9', category: 'preset' },
  { name: '哭了', url: 'https://u2.fukit.cn/sBcqPCOgz', category: 'preset' },
];

/**
 * 初始化并补齐预设表情包。
 *
 * 不再通过 count === 0 判断是否初始化，
 * 而是根据 url 判断某个预设是否已经存在。
 * 这样在已有数据的情况下，也可以自动导入新增预设，
 * 同时不会删除或覆盖用户自定义的表情包。
 */
export const initDefaultStickers = async () => {
  try {
    await db.transaction('rw', db.stickers, async () => {
      const existingStickers = await db.stickers.toArray();

      // 使用 URL 作为唯一标识，避免重复导入
      const existingUrls = new Set(
        existingStickers.map((sticker) => sticker.url)
      );

      const missingStickers = DEFAULT_STICKERS
        .filter((sticker) => !existingUrls.has(sticker.url))
        .map((sticker) => ({
          ...sticker,
          createdAt: Date.now(),
        }));

      if (missingStickers.length > 0) {
        await db.stickers.bulkAdd(missingStickers);
      }
    });
  } catch (err) {
    console.error('Failed to init default stickers:', err);
  }
};

export const getAllStickers = async () => {
  try {
    // 获取表情包前，先补齐新增的预设表情
    await initDefaultStickers();

    return await db.stickers
      .orderBy('createdAt')
      .reverse()
      .toArray();
  } catch (err) {
    console.error('Failed to get stickers:', err);
    return [];
  }
};

export const addCustomSticker = async (name, url) => {
  try {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName) {
      throw new Error('Sticker name cannot be empty');
    }

    if (!trimmedUrl) {
      throw new Error('Sticker URL cannot be empty');
    }

    const payload = {
      name: trimmedName,
      url: trimmedUrl,
      category: 'custom',
      createdAt: Date.now(),
    };

    const id = await db.stickers.add(payload);

    return {
      id,
      ...payload,
    };
  } catch (err) {
    console.error('Failed to add sticker:', err);
    throw err;
  }
};

export const deleteSticker = async (id) => {
  try {
    await db.stickers.delete(id);
  } catch (err) {
    console.error('Failed to delete sticker:', err);
  }
};

export default {
  initDefaultStickers,
  getAllStickers,
  addCustomSticker,
  deleteSticker,
};

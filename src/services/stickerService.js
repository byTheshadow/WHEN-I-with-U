import db from '../db';

// 9 款专属预设表情包
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
];

export const initDefaultStickers = async () => {
  try {
    const count = await db.stickers.count();
    // 如果数据库中没有记录，全量写入这 9 款预设
    if (count === 0) {
      await db.stickers.bulkAdd(
        DEFAULT_STICKERS.map((s) => ({ ...s, createdAt: Date.now() }))
      );
    }
  } catch (err) {
    console.error('Failed to init default stickers:', err);
  }
};

export const getAllStickers = async () => {
  try {
    await initDefaultStickers();
    return await db.stickers.orderBy('createdAt').reverse().toArray();
  } catch (err) {
    console.error('Failed to get stickers:', err);
    return [];
  }
};

export const addCustomSticker = async (name, url) => {
  try {
    const payload = {
      name: name.trim(),
      url: url.trim(),
      category: 'custom',
      createdAt: Date.now()
    };
    const id = await db.stickers.add(payload);
    return { id, ...payload };
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
  deleteSticker
};

import db from '../db';

// 默认预设表情包 (首次使用时自动初始化)
export const DEFAULT_STICKERS = [
  { name: '摸摸头', url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=300&auto=format&fit=crop&q=80', category: 'preset' },
  { name: '抱抱', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&auto=format&fit=crop&q=80', category: 'preset' },
  { name: '暗中观察', url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=300&auto=format&fit=crop&q=80', category: 'preset' },
  { name: '委屈喵喵', url: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=300&auto=format&fit=crop&q=80', category: 'preset' },
];

export const initDefaultStickers = async () => {
  try {
    const count = await db.stickers.count();
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

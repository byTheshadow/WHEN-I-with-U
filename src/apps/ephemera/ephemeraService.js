// src/apps/ephemera/ephemeraService.js
import db from '../../db';

export const ephemeraService = {
  async getAll() {
    try {
      return await db.ephemeras.orderBy('createdAt').reverse().toArray();
    } catch (error) {
      console.error('读取时光票根失败：', error);
      return [];
    }
  },

  async getCharacters() {
    try {
      return await db.characters.toArray();
    } catch (error) {
      console.error('读取角色数据失败：', error);
      return [];
    }
  },

  async save(record) {
    const safeRecord = { ...record };

    if (safeRecord.id === null || safeRecord.id === undefined) {
      delete safeRecord.id;
    }

    return db.ephemeras.put(safeRecord);
  },

  async remove(id) {
    return db.ephemeras.delete(id);
  }
};

export default ephemeraService;

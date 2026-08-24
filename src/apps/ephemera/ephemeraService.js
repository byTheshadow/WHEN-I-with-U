// src/apps/ephemera/ephemeraService.js
import db from '../../db';

export const ephemeraService = {
  // 获取所有票券，并按铸造时间倒序排列
  async getAllEphemeras() {
    try {
      const list = await db.ephemeras.toArray();
      return list.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('获取时光票券失败：', error);
      return [];
    }
  },

  // 获取所有全局角色，用以绑定
  async getCharacters() {
    try {
      return await db.characters.toArray();
    } catch (error) {
      console.error('获取角色列表失败：', error);
      return [];
    }
  },

  // 保存或更新票券 (过滤自增 id null/undefined)
  async saveEphemera(ephemera) {
    try {
      const data = { ...ephemera };
      if (data.id === null || data.id === undefined) {
        delete data.id;
      }
      const savedId = await db.ephemeras.put(data);
      return savedId;
    } catch (error) {
      console.error('保存时光票券失败：', error);
      throw error;
    }
  },

  // 删除票券
  async deleteEphemera(id) {
    try {
      await db.ephemeras.delete(id);
      return true;
    } catch (error) {
      console.error('删除时光票券失败：', error);
      throw error;
    }
  }
};

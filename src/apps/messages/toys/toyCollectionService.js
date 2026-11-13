// src/apps/messages/toys/toyCollectionService.js
//
// "小玩具收藏页"的数据层（页面见 ToyCollectionPage.jsx）。
// 数据全部来自已有的 db.chatToys 表，不需要升级数据库版本：
//   - 收藏页新增的两个字段 playCount / lastPlayedAt 是 chatToys 记录上的无索引新增字段，
//     旧记录没有这两个字段，读取时一律按 0 处理；
//   - 列表只返回展示用的信息，不带 html 代码（代码只在真正试玩时由 getToy 读取）。

import db from '../../../db';
import { TOY_MESSAGE_TYPE, TOY_STATUS } from './toyConstants';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** 所有角色做给用户的小玩具，最新做的排在最前面。不含 html。 */
export const listAllToys = async () => {
  const rows = await db.chatToys.toArray();

  return rows
    .map(({ html, ...rest }) => ({
      ...rest,
      playCount: toNumber(rest.playCount),
      lastPlayedAt: toNumber(rest.lastPlayedAt),
      createdAt: toNumber(rest.createdAt),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * 记一次"玩过"。由 ToyPlayer 在成功读出代码时调用，
 * 所以从聊天卡片点开和从收藏页点开都会被算进去，且只算一次。
 */
export const recordToyPlay = async (toyId) => {
  if (toyId === undefined || toyId === null) return;

  const row = await db.chatToys.get(toyId);
  if (!row) return;

  await db.chatToys.update(toyId, {
    playCount: toNumber(row.playCount) + 1,
    lastPlayedAt: Date.now(),
  });
};

/** 找到聊天里对应的那张小玩具卡片消息（删除玩具时需要把卡片标成"已删除"）。 */
const findToyMessage = async (toy) => {
  if (!toy || toy.chatId === undefined || toy.chatId === null) return null;

  const message = await db.messages
    .where('chatId')
    .equals(toy.chatId)
    .filter((item) => item.type === TOY_MESSAGE_TYPE && item.metadata?.toyId === toy.id)
    .first();

  return message || null;
};

/**
 * 给 ToyPlayer 用的 message 参数。优先用聊天里真实的那条消息；
 * 如果找不到（比如聊天已经被删掉），退而求其次给一个只带必要信息的替身，
 * 这样仍然可以试玩，删除时也只会删掉玩具本身。
 */
export const resolvePlayerMessage = async (toy) => {
  const real = await findToyMessage(toy);
  if (real) return real;

  return {
    id: undefined,
    chatId: toy.chatId,
    characterId: toy.characterId,
    type: TOY_MESSAGE_TYPE,
    metadata: {
      status: TOY_STATUS.READY,
      toyId: toy.id,
      title: toy.title,
      rules: toy.rules,
    },
  };
};
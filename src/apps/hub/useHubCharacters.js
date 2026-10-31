// src/apps/hub/useHubCharacters.js
//
// 心碎先生「贴纸册」用的角色列表：角色（db.characters）加上各自最近一次
// 会话时间（db.chats 的 updatedAt）。只读，用 liveQuery 订阅，角色或会话
// 变化后自动刷新。按最近聊过的排前面，没聊过的排后面，最多 limit 个。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';

export const useHubCharacters = (limit = 12) => {
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [list, chats] = await Promise.all([db.characters.toArray(), db.chats.toArray()]);
      const lastByCharacter = new Map();
      for (const chat of chats) {
        const time = Number(chat.updatedAt) || 0;
        if (time > (lastByCharacter.get(chat.characterId) || 0)) {
          lastByCharacter.set(chat.characterId, time);
        }
      }
      return list
        .map((character) => ({
          id: character.id,
          name: character.name || '未命名',
          avatar: typeof character.avatar === 'string' ? character.avatar : '',
          lastChatAt: lastByCharacter.get(character.id) || 0,
        }))
        .sort((a, b) => b.lastChatAt - a.lastChatAt || a.id - b.id)
        .slice(0, limit);
    }).subscribe({
      next: setCharacters,
      error: (error) => console.warn('[HubCharacters] 读取角色失败：', error),
    });
    return () => subscription.unsubscribe();
  }, [limit]);

  return characters;
};

export const formatLastChat = (timestamp, now = Date.now()) => {
  if (!timestamp) return '还没聊过';
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return '很久以前';
};

export default useHubCharacters;
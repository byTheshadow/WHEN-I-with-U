// src/apps/layoutstudio/layoutChatContext.js
//
// 修图室读"最近聊天记录"，让角色出图、写话时口吻更贴近你们的关系。
//   - resolveChatFor        找角色的聊天室（发回聊天室和读记录共用同一条规则）；
//   - loadRecentChatContext 读最近 N 条文字消息，整理成一段提示词文字，没有就返回空串。
//
// 只读，不写任何数据。线下模式、泡泡模式的消息，出错的消息，以及修图室自己发的摘要都会跳过。

import Dexie from 'dexie';

import db from '../../db';

export const RECENT_CHAT_LIMIT = 12;
const SCAN_LIMIT = 40; // 先多取一些，过滤掉不合用的消息后再截到 RECENT_CHAT_LIMIT
const LINE_MAX = 160;

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// 取一条消息当前版本的文字（和记忆系统读取的规则一致：看 versions 和 currentVersionIndex）。
const getCurrentText = (message) => {
  const versions = Array.isArray(message?.versions) ? message.versions : [];
  const index = Number(message?.currentVersionIndex);
  if (versions.length > 0 && Number.isInteger(index) && versions[index]) {
    const version = versions[index];
    if (typeof version === 'string') return normalize(version);
    return normalize(version.content || version.text || version.message);
  }
  return normalize(message?.content);
};

/** 找角色的聊天室：有多个时取最近更新的那个。找不到返回 null。 */
export const resolveChatFor = async (characterId) => {
  const chats = await db.chats.where('characterId').equals(characterId).toArray();
  if (!chats.length) return null;
  return chats.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
};

const isUsable = (message) =>
  Boolean(message) &&
  message.type !== 'error' &&
  message.mode !== 'offline' &&
  message.mode !== 'bubble' &&
  !message.metadata?.autoReply &&
  message.metadata?.source !== 'layout-studio' &&
  ['user', 'character', 'ai', 'assistant'].includes(message.sender);

/**
 * 返回一段可直接放进提示词的文字；没有聊天室、没有可用消息或读取失败时返回空串。
 * 用户的称呼取聊天室的 userName，其次角色的 userName，都没有就写"User"。
 */
export const loadRecentChatContext = async ({ character, limit = RECENT_CHAT_LIMIT }) => {
  try {
    if (character?.id == null) return '';
    const chat = await resolveChatFor(character.id);
    if (!chat) return '';
    const characterName = character.name || '你';
    const userName = chat.userName || character.userName || 'User';

    const rows = await db.messages
      .where('[chatId+timestamp]')
      .between([chat.id, Dexie.minKey], [chat.id, Dexie.maxKey])
      .reverse()
      .limit(SCAN_LIMIT)
      .toArray();

    const lines = rows
      .filter(isUsable)
      .map((message) => ({ message, text: getCurrentText(message) }))
      .filter((item) => item.text)
      .slice(0, limit)
      .reverse()
      .map(({ message, text }) => {
        const who = message.sender === 'user' ? userName : characterName;
        const clipped = [...text].slice(0, LINE_MAX).join('');
        return `${who}：${clipped}`;
      });

    return lines.join('\n');
  } catch (error) {
    console.warn('[LayoutStudio] 读取最近聊天记录失败，已跳过：', error);
    return '';
  }
};
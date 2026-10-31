// src/apps/hub/useHubPreviews.js
//
// 首页 Messages、Ask Box 两个窗口里显示的「最近一条」：
//   useHubLatestChat   最近有动静的聊天：角色名 + 最后一条文字消息的开头
//   useHubAskPreview   最新一条还没回答的匿名问题（上锁的不显示内容）
// 都是只读的，用 Dexie liveQuery 订阅，写法对照 useHubPageLayout.js。
// 读不到、或者最后一条不是文字（图片、语音等）时，返回 null 或空文本，
// 窗口里会退回到通用的提示语，不会显示奇怪的内容。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';

const PREVIEW_LENGTH = 36;

const shorten = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
};

const loadLatestChat = async () => {
  const chat = await db.chats.orderBy('updatedAt').last();
  if (!chat) return null;

  const [character, lastMessage] = await Promise.all([
    chat.characterId ? db.characters.get(chat.characterId) : null,
    db.messages.where('chatId').equals(chat.id).last(),
  ]);

  const isText =
    lastMessage &&
    (lastMessage.type === undefined || lastMessage.type === 'text') &&
    typeof lastMessage.content === 'string';

  return {
    chatId: chat.id,
    characterName: character?.name || chat.title || '',
    text: isText ? shorten(lastMessage.content) : '',
    fromUser: lastMessage?.sender === 'user',
  };
};

const loadAskPreview = async () => {
  const unanswered = await db.askBoxQuestions
    .filter((question) => !question.reply)
    .toArray();
  if (unanswered.length === 0) return null;

  const latest = unanswered.reduce((best, question) =>
    (question.createdAt || 0) > (best.createdAt || 0) ? question : best
  );
  const locked = latest.needPassword === 1 && latest.isPasswordUnlocked !== 1;

  return { locked, text: locked ? '' : shorten(latest.content) };
};

const useLiveValue = (query, label) => {
  const [value, setValue] = useState(null);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (next) => setValue(next || null),
      error: (error) => {
        console.warn(`[HubPreviews] 读取${label}失败：`, error);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [query, label]);

  return value;
};

export const useHubLatestChat = () => useLiveValue(loadLatestChat, '最近聊天');
export const useHubAskPreview = () => useLiveValue(loadAskPreview, '最新问题');
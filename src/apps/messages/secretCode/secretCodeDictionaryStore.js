// src/apps/messages/secretCode/secretCodeDictionaryStore.js
//
// 聊天气泡用的词典缓存。聊天里每条消息都要用到词典，不能每条都读一次数据库：
// 这里按角色缓存一份，同一个角色同时只发一次读库请求；词典页改了东西，服务层
// 会发 SECRET_CODE_DICTIONARY_EVENT，缓存收到后重新读，所有气泡跟着刷新。
import { useEffect, useState } from 'react';
import { SECRET_CODE_DICTIONARY_EVENT, getSecretCodeBook } from './secretCodeService';

const EMPTY_BOOK = { entries: [], folders: [] };

const cache = new Map(); // characterId -> book
const inflight = new Map(); // characterId -> Promise
const listeners = new Map(); // characterId -> Set<fn>

const emit = (characterId) => {
  const set = listeners.get(characterId);
  if (!set) return;
  set.forEach((fn) => fn(cache.get(characterId) || EMPTY_BOOK));
};

const load = (characterId) => {
  if (inflight.has(characterId)) return inflight.get(characterId);

  const task = getSecretCodeBook(characterId)
    .then((book) => {
      cache.set(characterId, book);
      emit(characterId);
      return book;
    })
    .catch((error) => {
      console.warn('[secretCodeDictionaryStore] 读取词典失败：', error);
      return cache.get(characterId) || EMPTY_BOOK;
    })
    .finally(() => {
      inflight.delete(characterId);
    });

  inflight.set(characterId, task);
  return task;
};

let eventBound = false;
const bindEvent = () => {
  if (eventBound || typeof window === 'undefined') return;
  eventBound = true;
  window.addEventListener(SECRET_CODE_DICTIONARY_EVENT, (event) => {
    const id = event?.detail?.characterId;
    if (id !== undefined && id !== null) void load(id);
  });
};

/** 拿到某个角色当前的词典 { entries, folders }；加载完成前是空词典。 */
export const useSecretCodeDictionary = (characterId) => {
  const [book, setBook] = useState(() => cache.get(characterId) || EMPTY_BOOK);

  useEffect(() => {
    if (characterId === undefined || characterId === null) return undefined;
    bindEvent();

    let set = listeners.get(characterId);
    if (!set) {
      set = new Set();
      listeners.set(characterId, set);
    }
    set.add(setBook);

    if (cache.has(characterId)) setBook(cache.get(characterId));
    else void load(characterId);

    return () => {
      set.delete(setBook);
    };
  }, [characterId]);

  return book;
};
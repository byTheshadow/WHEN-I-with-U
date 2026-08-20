import Dexie from 'dexie';

export const db = new Dexie('WhenIWithUDatabase');

db.version(1).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, avatar, bio, worldBook, isAutoMessageActive',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, characterId, author, content, date',
  travels: '++id, destination, status, timestamp',
  todos: '++id, title, dueDate, isCompleted',
  settings: 'key, value'
});

db.version(2).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, characterId, author, content, date',
  travels: '++id, destination, status, timestamp',
  todos: '++id, title, dueDate, isCompleted',
  settings: 'key, value'
});

// Phase 4: Diaries 升级版本 v3 (支持聊天窗绑定、双向心绪与时间戳)
db.version(3).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  travels: '++id, destination, status, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value'
});

export default db;

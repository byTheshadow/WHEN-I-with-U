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

db.version(3).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value'
});

db.version(4).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value',

  travels: '++id, characterId, destination, status, userPersona, luggageNotes, durationHours, startTime, endTime, flightNo, hotelName, coverPhoto, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead'
});

// 📷 Version 5: Snapshots (IG 拍立得动态朋友圈 Sub-App 数据表)
db.version(5).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value',

  travels: '++id, characterId, destination, status, userPersona, luggageNotes, durationHours, startTime, endTime, flightNo, hotelName, coverPhoto, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  // Snapshots 表架构
  snapshots: '++id, authorType, characterId, npcId, authorName, authorAvatar, mediaUrl, imagePrompt, content, location, likes, isLiked, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, replyToCommentId, replyToName, senderType, characterId, npcId, senderName, senderAvatar, content, timestamp',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value'
});

export default db;

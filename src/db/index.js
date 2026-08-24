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
  settings: 'key, value',
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

  snapshots: '++id, authorType, characterId, npcId, authorName, authorAvatar, mediaUrl, imagePrompt, content, location, likes, isLiked, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, replyToCommentId, replyToName, senderType, characterId, npcId, senderName, senderAvatar, content, timestamp',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value'
});

db.version(6).stores({
  profile: 'id',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, isNpc',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, characterId, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, date, characterId',
  todos: '++id, category, dueDate, status',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
}).upgrade(async (tx) => {
  await tx.table('snapshots').toCollection().modify((snapshot) => {
    if (snapshot.createdAt == null && snapshot.timestamp != null) {
      snapshot.createdAt = snapshot.timestamp;
    }
  });

  await tx.table('snapshotComments').toCollection().modify((comment) => {
    if (comment.createdAt == null && comment.timestamp != null) {
      comment.createdAt = comment.timestamp;
    }
  });
});

db.version(7).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
});

db.version(8).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
});

db.version(9).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
});

db.version(10).stores({
  stickers: '++id, name, url, category, createdAt'
});

db.version(11).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt'
});

// 🛠️ Version 12: 羁绊大群 (The Ensemble) 逻辑表定义
db.version(12).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  // 👈 羁绊大群 (The Ensemble) 专属表
  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt'
});

// 🛠️ 新增 Version 13
db.version(13).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  // 👈 羁绊大群 (The Ensemble) 专属表
  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',
  travels: '++id, characterId, status, createdAt',
  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp', 
});

// 🛠️ Version 14: 共生生态瓶 (The Living Habitat) 逻辑表定义
db.version(14).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  // 👈 Version 14 新增表
  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp'
});

// 🛠️ Version 15: 时光票根影集 (The Ephemera) 逻辑表定义
db.version(15).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  // 👈 Version 15 新增票根数据表
  ephemeras: '++id, characterId, templateType, title, createdAt'
});

db.version(16).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt'
});


export default db;





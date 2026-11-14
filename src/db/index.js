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

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt'
});

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

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',
  travels: '++id, characterId, status, createdAt',
  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp', 
});

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

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp'
});

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

// 🛠️ Version 17: 提问箱 (AskBox) 逻辑表定义
db.version(17).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  // 👈 Version 17 新增提问箱数据表
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt'
});


// 🛠️ Version 18: 新增平行轨迹 (ParallelOrbit) 日常记录表
db.version(18).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  // 👈 Version 18 新增平行轨迹数据表
  parallelOrbits: '++id, chatId, characterId, timestamp'
});

// 🛠️ Version 19: 新增用户作息日程表
db.version(19).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',
  
  // 👈 Version 19 新增用户作息表
    schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt'

});

// 🛠️ Version 20: 新增用户作息日程表
db.version(20).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',
  
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date,weeks, createdAt'

});

db.version(21).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

  // 对话内由 AI 自主安排的稍后联系计划。
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt'
});

db.version(22).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

   // 对话内由 AI 自主安排的稍后联系计划。
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',
  memories: '++id, &memoryId, chatId, type, status, importance, confidence, createdAt, updatedAt, sourceState',
  memoryCandidates: '++id, &candidateId, chatId, type, status, priority, createdAt, updatedAt',

  // 每次人工或系统修订保留一份快照。
  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',

  // 每个聊天窗仅保留一条任务状态记录。
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',

  // 仅放全局记忆模块设置，不放 API Key。
  memorySettings: 'key'
});


db.version(23).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

   // 对话内由 AI 自主安排的稍后联系计划。
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',
  memories: '++id, &memoryId, chatId, type, status, importance, confidence, createdAt, updatedAt, sourceState',
  memoryCandidates: '++id, &candidateId, chatId, type, status, priority, createdAt, updatedAt',

  // 每次人工或系统修订保留一份快照。
  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',

  // 每个聊天窗仅保留一条任务状态记录。
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',

  // 仅放全局记忆模块设置，不放 API Key。
  memorySettings: 'key',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt'
}).upgrade(async (tx) => {
  const now = new Date().toISOString();

  await tx.table('memories').toCollection().modify((memory) => {
    const normalizedContent = String(memory.content || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[，。！？；：“”‘’、,.!?;:()[\]{}]/g, '');

    if (memory.status === 'corrected') {
      memory.status = 'dormant';
    }

    memory.normalizedContent = memory.normalizedContent || normalizedContent;
    memory.sourceKind = memory.sourceKind || 'conversation';
    memory.useCount = Number(memory.useCount || 0);
    memory.lastUsedAt = memory.lastUsedAt || null;
    memory.lastRetrievedAt = memory.lastRetrievedAt || null;
    memory.userEditedAt = memory.userEditedAt || null;
    memory.userConfirmedAt = memory.userConfirmedAt || null;
    memory.supersedesMemoryId = memory.supersedesMemoryId || null;
    memory.supersededByMemoryId = memory.supersededByMemoryId || null;
    memory.duplicateOfMemoryId = memory.duplicateOfMemoryId || null;
    memory.conflictWithMemoryIds = Array.isArray(memory.conflictWithMemoryIds)
      ? memory.conflictWithMemoryIds
      : [];
    memory.updatedAt = memory.updatedAt || now;
  });

  await tx.table('memoryCandidates').toCollection().modify((candidate) => {
    candidate.proposalType = candidate.proposalType || 'create';
    candidate.targetMemoryId = candidate.targetMemoryId || null;
    candidate.relatedMemoryIds = Array.isArray(candidate.relatedMemoryIds)
      ? candidate.relatedMemoryIds
      : [];
    candidate.similarityScore = Number(candidate.similarityScore || 0);
    candidate.conflictReason = candidate.conflictReason || '';
  });
});

db.version(24).stores({
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
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  /*
   * The Bond Connection
   *
   * 所有连接与工具配置仅保存在当前用户的 IndexedDB。
   * 认证信息未来可保存于 mcpConnections.auth，但绝不进入导出文件。
   */
  mcpConnections: `
    &id,
    enabled,
    endpoint,
    transport,
    status,
    createdAt,
    updatedAt
  `,

  /*
   * 每个 MCP Server 发现的工具，以及用户对单个工具的本地开关与风险标记。
   */
  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  /*
   * 用户明确作出的调用授权。
   *
   * scope:
   * - once：仅本次，实际不持久化
   * - chat：当前聊天
   * - character：当前角色
   * - global：全局
   */
  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  /*
   * 仅记录调用摘要和状态，不能保存聊天全文、认证 Token 或敏感工具结果。
   */
  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    status,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt]
  `
});

db.version(25).stores({
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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  /*
   * provider:
   * generic | modelscope | bridge | custom
   *
   * transport:
   * streamable-http | bridge-http | sse | bridge-websocket | custom
   *
   * executionMode:
   * browser-direct | user-bridge | user-executor
   */
  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    status,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt]
  `,

  /*
   * OAuth 的临时 state / PKCE 信息。
   * access token、refresh token 不得写入导出文件。
   */
  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  /*
   * 用户自行运行的 Bridge 的登记和健康状态。
   * 并不代表本项目负责启动、托管或维护 Bridge。
   */
  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  /*
   * 自动化 / 后台执行器接口预留。
   * 本轮先建立数据兼容，不启用自动任务 UI。
   */
  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});


db.version(26).stores({
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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  /*
   * provider:
   * generic | modelscope | bridge | custom
   *
   * transport:
   * streamable-http | bridge-http | sse | bridge-websocket | custom
   *
   * executionMode:
   * browser-direct | user-bridge | user-executor
   */
  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

 mcpActivities: `
  ++id,
  connectionId,
  toolName,
  chatId,
  characterId,
  source,
  automationId,
  executorId,
  status,
  errorCode,
  createdAt,
  [connectionId+createdAt],
  [chatId+createdAt],
  [source+createdAt]
`,

  /*
   * OAuth 的临时 state / PKCE 信息。
   * access token、refresh token 不得写入导出文件。
   */
  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  /*
   * 用户自行运行的 Bridge 的登记和健康状态。
   * 并不代表本项目负责启动、托管或维护 Bridge。
   */
  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  /*
   * 自动化 / 后台执行器接口预留。
   * 本轮先建立数据兼容，不启用自动任务 UI。
   */
  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});

db.version(27).stores({
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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});


db.version(28).stores({
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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});


db.version(29).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,
});


db.version(30).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt'
});

db.version(31).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
});

db.version(31).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
});



db.version(32).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
});

db.version(33).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,
});

db.version(34).stores({

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
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,
});


db.version(35).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',

  pinnedGallery: 'id, title, caption, photos',

  characters:
    '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',

  chats:
    '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',

  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks:
    '++id, type, title, isEnabled',

  homeBoard:
    '++id, characterId, characterName, avatar, content, timestamp, isRead',

  diaries:
    '++id, chatId, characterId, author, title, date, timestamp',

  todos:
    '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels:
    '++id, characterId, status, createdAt',

  travelWishlists:
    '++id, characterId, creator, destination, reason, isMatched, createdAt',

  travelPostcards:
    '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots:
    '++id, characterId, createdAt, linkedChatId, timestamp',

  snapshotComments:
    '++id, snapshotId, characterId, createdAt',

  snapshotRelations:
    '++id, characterId, targetCharacterId, relation',

  snapshotSettings:
    'key, value',

  settings:
    'key',

  pebblings:
    '++id, characterId, status, stoneType, createdAt, respondAt',

  stickers:
    '++id, name, url, category, createdAt',

  imaginariumChats:
    '++id, title, createdAt, updatedAt',

  imaginariumMessages:
    '++id, chatId, senderId, timestamp',

  imaginariumSummaries:
    '++id, chatId, createdAt',

  ensembleChats:
    '++id, title, createdAt, updatedAt',

  ensembleMessages:
    '++id, chatId, senderId, timestamp',

  ensembleSummaries:
    '++id, chatId, createdAt',

  habitats:
    '++id, name, type, guardianCharacterId, createdAt',

  habitatLogs:
    '++id, habitatId, logType, timestamp',

  ephemeras:
    '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages:
    '++id, createdAt, updatedAt',

  dailyOfferings:
    'date, characterId, createdAt',

  askBoxQuestions:
    '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits:
    '++id, chatId, characterId, timestamp',

  schedules:
    '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

  scheduledMessages:
    '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions:
    '++id, &revisionId, memoryId, chatId, action, createdAt',

  memoryJobs:
    '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',

  memorySettings:
    'key',

  characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `,

  newspapers:
    '++id, date, characterId, createdAt',

  marginNotes:
    '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,

  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,

  almanacConfigs:
    '&chatId, updatedAt',

  almanacRecords: `
    ++id,
    chatId,
    characterId,
    eventType,
    timestamp,
    dateKey,
    localHour,
    [chatId+dateKey],
    [chatId+eventType],
    [chatId+eventType+dateKey]
  `
});

db.version(36).stores({
  almanacConfigs:
    '&chatId, updatedAt, timezone',

  almanacRecords: `
    ++id,
    chatId,
    characterId,
    eventType,
    timestamp,
    dateKey,
    localHour,
    timezone,
    count,
    firstTimestamp,
    lastTimestamp,
    [chatId+dateKey],
    [chatId+eventType],
    [chatId+eventType+dateKey]
  `
});

db.version(37).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, [chatId+timestamp]',
 
  scheduledMessages:
    '++id, chatId, characterId, status, scheduledFor, createdAt, [status+scheduledFor]'
});

db.version(38).stores({
  almanacMilestones: `
    ++id,
    chatId,
    type,
    date,
    isRecurring,
    showCountdown,
    allowNaturalReminder,
    createdAt,
    updatedAt,
    [chatId+date],
    [chatId+type]
  `
});

db.version(39).stores({
  xinjiEntries:
    '++id, chatId, characterId, type, date, isRecurringYearly, createdAt',
});

db.version(40).stores({
  workflows: `
    ++id,
    chatId,
    characterId,
    enabled,
    lastRunDate,
    [chatId+enabled]
  `,
});

db.version(41).stores({
  workflowRuns: `
    ++id,
    workflowId,
    chatId,
    characterId,
    status,
    source,
    runAt,
    [workflowId+runAt]
  `,
});

db.version(42).stores({
  // 工作流/档案专属的用户主页配置，与全局 profile 彻底解耦
  // key 可以是 'user_profile' 或者角色专属自定义ID
  workflowProfiles: '&key, updatedAt',
});

db.version(43).stores({
  // 内心主页：每个chat一条，随日期滚动重置（密码、当日尝试次数）
  innerWorldAccess: `
    &chatId,
    characterId,
    date,
    password,
    attemptsUsed,
    isUnlocked,
    updatedAt
  `,

  // 内心主页：每天一条历史记录，用于心情/性格维度的成长曲线
  innerWorldEntries: `
    ++id,
    chatId,
    characterId,
    date,
    createdAt,
    updatedAt,
    [chatId+date]
  `,
});


db.version(44).stores({
  places: `
    ++id,
    chatId,
    name,
    lat,
    lng,
    radius,
    isNamed,
    firstVisitAt,
    lastVisitAt,
    visitCount,
    createdAt,
    [chatId+isNamed]
  `,
  locationSettings: `
    &chatId,
    enabled,
    currentPlaceId,
    pendingNamingPlaceId,
    lastCheckAt,
    updatedAt
  `,
});

db.version(45).stores({
  rhythmNotes: `
    ++id,
    scheduleId,
    characterId,
    date,
    content,
    createdAt,
    [scheduleId+date],
    [characterId+date]
  `
});

db.version(46).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, [chatId+timestamp], [chatId+mode]',

  offlineSessions: `
    ++id,
    chatId,
    characterId,
    status,
    proposedBy,
    scheduledFor,
    createdAt,
    updatedAt,
    [chatId+status]
  `,

  archivedMessages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, archivedAt, [chatId+timestamp]',

  archiveStats:
    '&chatId, totalArchivedDays, totalArchivedMessages, lastArchivedAt, updatedAt',
});


// 追加在 src/db/index.js 的最后（在 db.version(46)... 之后）

db.version(47).stores({
  // snapshots 升级：增加 chatId, authorType, npcId 索引，便于按消息框沙盒快速筛选
  snapshots:
    '++id, chatId, characterId, authorType, npcId, createdAt, timestamp',

  // snapshotComments 升级：增加 chatId, senderType 索引
  snapshotComments:
    '++id, snapshotId, chatId, senderType, characterId, npcId, createdAt',

  // 独立主页表：每个 chatId 独立的 User 或 Char 资料
  // profileKey 格式: `user_${chatId}` 或 `char_${chatId}_${characterId}`
  snapshotProfiles:
    '&profileKey, chatId, targetType, targetId, updatedAt'
}).upgrade(async (tx) => {
  // 平滑迁移旧动态：如果有 linkedChatId 则写入 chatId，补齐 authorType
  await tx.table('snapshots').toCollection().modify((snapshot) => {
    if (!snapshot.chatId && snapshot.linkedChatId) {
      snapshot.chatId = Number(snapshot.linkedChatId);
    }
    if (!snapshot.authorType) {
      snapshot.authorType = snapshot.characterId ? 'character' : 'user';
    }
    if (!snapshot.createdAt) {
      snapshot.createdAt = snapshot.timestamp || Date.now();
    }
  });

  // 平滑迁移旧评论：补齐 createdAt 与 senderType
  await tx.table('snapshotComments').toCollection().modify((comment) => {
    if (!comment.senderType) {
      comment.senderType = comment.characterId ? 'character' : (comment.npcId ? 'npc' : 'user');
    }
    if (!comment.createdAt) {
      comment.createdAt = comment.timestamp || Date.now();
    }
  });
});

db.version(48).stores({
  // 轻提醒：用户自定义的生活化提醒（如"中午提醒吃保健品"）
  almanacReminders: `
    ++id,
    chatId,
    content,
    time,
    enabled,
    lastFiredDateKey,
    createdAt,
    updatedAt,
    [chatId+enabled]
  `,

  // 重要日期：简化版的生日/纪念日记录
  almanacImportantDates: `
    ++id,
    chatId,
    title,
    date,
    isRecurringYearly,
    createdAt,
    updatedAt,
    [chatId+date]
  `,
});

// ============================================================
// 【局部替换说明】
// 位置：src/db/index.js
// 操作：在现有 `db.version(48).stores({...});` 代码块之后、
//       `export default db;` 之前，插入下面这一整段 `db.version(49)`。
// 不要动 v48 及之前的任何代码，也不要删除 export default db; 之后的内容。
// ============================================================

db.version(49).stores({
  // NPC 改为按 chatId 专属：每个消息框/世界线拥有自己独立的 NPC 列表
  snapshotNpcs: `
    ++id,
    chatId,
    name,
    roleTag,
    avatar,
    createdAt,
    [chatId+createdAt]
  `,

  // snapshotRelations 结构改造：从"仅角色↔角色"扩展为通用的
  // "角色/NPC 之间任意组合的关系"，且限定在具体某个 chatId（世界线）下。
  // sourceType / targetType 取值: 'character' | 'npc'
  // 关系无方向性要求，查询时按需双向匹配。
  snapshotRelations: `
    ++id,
    chatId,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relation,
    createdAt,
    [chatId+sourceType+sourceId],
    [chatId+targetType+targetId]
  `
}).upgrade(async (tx) => {
  // ---- 迁移 1：旧的全局 NPC 列表 -> 复制进所有已存在的 chats ----
  try {
    const oldNpcsSetting = await tx.table('snapshotSettings').get('npcs');
    const oldNpcs = oldNpcsSetting?.value || [];

    if (oldNpcs.length > 0) {
      const allChats = await tx.table('chats').toArray();
      const now = Date.now();

      for (const chat of allChats) {
        for (const npc of oldNpcs) {
          await tx.table('snapshotNpcs').add({
            chatId: chat.id,
            name: npc.name || '未命名NPC',
            roleTag: npc.roleTag || '路人NPC',
            avatar: npc.avatar || '',
            createdAt: now
          });
        }
      }
    }
  } catch (err) {
    console.error('[db v49 迁移] 复制旧 NPC 数据失败:', err);
  }

  // ---- 迁移 2：旧的 snapshotRelations（角色↔角色）-> 软废弃，物理保留 ----
  // 旧数据无法推断归属哪个 chatId，因此保留数据但标记 chatId: null，
  // 新的按 chatId 查询逻辑不会再读到这些记录，相当于软废弃，不物理删除。
  try {
    await tx.table('snapshotRelations').toCollection().modify((rel) => {
      if (rel.chatId === undefined) {
        rel.chatId = null;
        rel.sourceType = 'character';
        rel.sourceId = rel.characterId;
        rel.targetType = 'character';
        rel.targetId = rel.targetCharacterId;
      }
    });
  } catch (err) {
    console.error('[db v49 迁移] 软废弃旧 snapshotRelations 失败:', err);
  }
});

// ============================================================
// v50：一次性数据修复
// messages 表结构本身不变（索引跟 v46 一致），单纯为了挂一个
// upgrade 钩子，所以照抄一遍现有的 messages 索引声明。
// ============================================================
db.version(50).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, [chatId+timestamp], [chatId+mode]',
}).upgrade(async (tx) => {
  // ---- 迁移：把 messages 表里数字型 timestamp（少数几处旧代码路径
  // 遗留下来的，比如发表情贴纸、提问箱转发消息）统一转换成字符串型
  // ISO 时间戳，跟其余绝大多数消息保持同一类型。
  // 原因：IndexedDB 的复合索引 [chatId+timestamp] 是先比较数据类型、
  // 再比较值的，数字和字符串混在一起会导致同一个聊天框里的消息
  // 按索引查询时整体分成两堆，顺序错乱。这里只改类型，不改语义上
  // 代表的具体时刻。 ----
  try {
    let fixedCount = 0;
    await tx.table('messages').toCollection().modify((msg) => {
      if (typeof msg.timestamp === 'number') {
        msg.timestamp = new Date(msg.timestamp).toISOString();
        fixedCount += 1;
      }
    });
    console.log(`[db v50 迁移] 已修复 ${fixedCount} 条消息的 timestamp 类型`);
  } catch (err) {
    console.error('[db v50 迁移] 修复 messages timestamp 类型失败:', err);
  }
});

// ============================================================
// 【局部替换说明】
// 位置：src/db/index.js
// 操作：在现有 `db.version(50).stores({...});` 代码块之后、
//       `export default db;` 之前，插入下面这一整段 `db.version(51)`。
// 不要动 v50 及之前的任何代码，也不要删除 export default db; 之后的内容。
// ============================================================

db.version(51).stores({
  // 首页小组件实例：用户在首页编辑模式里自己添加的小组件。
  // type 对应 src/apps/hub/widgets/widgetRegistry.js 里的某个类型，
  // config 是该类型自己的配置（比如纪念日倒数存 { importantDateId }）。
  // 全新的表，没有旧数据需要迁移。
  homeWidgets: `
    ++id,
    type,
    createdAt
  `,
});


db.version(52).stores({
    characterDailyPlans: `
    ++id,
    chatId,
    characterId,
    dateStr,
    [chatId+dateStr]
  `,
});

// ============================================================
// 【局部替换说明】
// 位置：src/db/index.js
// 操作：在现有 `db.version(52).stores({...});` 代码块之后、
//       `export default db;` 之前，插入下面这一整段 `db.version(53)`。
// 不要动 v52 及之前的任何代码，也不要删除 export default db; 之后的内容。
//
// 背景：如果浏览器里已经把 v52 走成了旧的 characterId 索引结构，
// 光是修改 v52 那一段代码本身不会生效——IndexedDB 只认版本号
// 有没有往上涨，不会因为同一个版本号里的内容变了就重新升级。
// 这里通过一个新的版本号，让 Dexie 真正跑一次升级，
// 把索引从旧的 [characterId+dateStr] 改成新的 [chatId+dateStr]，
// 并顺手清空这张表里可能存在的、按旧结构生成的今日安排
// （反正只是当天的自动生成内容，重新打开一次就会用新结构重建）。
// ============================================================

db.version(53).stores({
  characterDailyPlans: `
    ++id,
    chatId,
    characterId,
    dateStr,
    [chatId+dateStr]
  `,
}).upgrade(async (tx) => {
  try {
    await tx.table('characterDailyPlans').clear();
    console.log('[db v53 迁移] 已清空旧结构的今日安排缓存，下次进入 Rhythm 会按新结构重新生成。');
  } catch (err) {
    console.error('[db v53 迁移] 清空今日安排缓存失败:', err);
  }
});

db.version(54).stores({
  userSavedInfo: '++id, title, createdAt, updatedAt',
});

// v55："今日穿搭"记录（Rhythm 里的小区域）。
// owner 区分是用户自己的还是角色的；按天保存，超过保留天数的会被自动清理。
db.version(55).stores({
  outfitRecords: `
    ++id,
    chatId,
    dateStr,
    owner,
    [chatId+dateStr]

  `,
});

// v56：地点记忆（地点小册子里"这里发生过的事"）。
// author: 'user' | 'char'；按地点保存，地点被删除时一起删除。
db.version(56).stores({
  placeMemories: `
    ++id,
    chatId,
    placeId,
    author,
    createdAt,
    [placeId+createdAt]
  `,
});

// v57：#6 聊天窗宠物"小伙伴"（第一步：核心养成循环）。
// 一个聊天窗最多养一只（&chatId 是唯一索引），user 和角色共同照顾；
// 完全是新表，跟 habitats/habitatLogs（旧"领养"）、桌宠的 db.settings 键
// 都没有代码或数据共享。
db.version(57).stores({
  companions: `
    ++id,
    &chatId,
    characterId,
    createdAt,
    updatedAt
  `,
  // 拥有的商店道具：食物买下即用不占行，这里主要存衣服（category:'clothing'）。
  companionInventory: `
    ++id,
    companionId,
    category,
    acquiredAt
  `,
  // 互动/自主照料日志，logType: 'user_action' | 'co_care'（参照 habitatLogs）。
  companionLogs: `
    ++id,
    companionId,
    logType,
    timestamp
  `,
});

// 回忆录：点外卖 / 转账 / 使用 MCP 这几类"共同经历"，双向都记
// （MCP 只记角色主动使用这一侧）。sourceMessageId 用于日后从回忆卡片
// 跳回聊天记录，也用于 user 送出心意后、角色下一次回复带感受标签时回填。
db.version(58).stores({
  memoirs: `
    ++id,
    chatId,
    characterId,
    eventType,
    sourceMessageId,
    timestamp
  `,
});

// 「共享世界」：全局共用的设定 / 规则小册子，可选对全部角色或指定角色生效。
// 完全是新表，不改动任何已有表。
db.version(59).stores({
  sharedWorldEntries: `
    ++id,
    isEnabled,
    sortOrder,
    createdAt
  `,
});


// 「信号沙漏」：记录主聊天模型请求（哪个 chat、成功/失败、耗时），
// 供新增的 hourglass 子应用展示。完全是新表，不改动任何已有表。
db.version(60).stores({
  apiCallLogs: `
    ++id,
    chatId,
    characterId,
    timestamp
  `,
});

// 羁绊大群 (Ensemble) 分页加载：ensembleMessages 表之前只有独立的
// chatId / timestamp 索引，每次都要 .sortBy('timestamp') 把某个大群
// 的全部消息读进内存再排序，消息一多就会越来越卡。
// 参照主聊天 messages 表 v37/v46 的做法，加一个 [chatId+timestamp]
// 复合索引，让"取最近 N 条 / 取某个时间点之前的 N 条"都能直接走索引
// 区间查询，不用整表扫描。ensembleMessages.timestamp 一直都是
// Date.now() 数字型时间戳（不像 messages 表历史上混过字符串型），
// 所以这里不需要额外的类型迁移脚本。
db.version(61).stores({
  ensembleMessages: '++id, chatId, senderId, timestamp, [chatId+timestamp]',
});

// Obsidian 文件夹订阅（OB 导入"入口2"）：记录用户通过 File System Access
// API 授权的 Obsidian 文件夹，绑定到哪个消息框，以及每个笔记文件当前的
// mtime，用于"打开记忆页时检查一次有没有改动"。directoryHandle 是浏览器
// 原生的 FileSystemDirectoryHandle（可结构化克隆，Dexie 能直接存取），
// fileState 是一个 { [相对路径]: { mtime, lastImportedAt } } 的普通对象，
// 两者都是非索引字段，跟着整条记录读写即可，不需要单独建表拆分。
db.version(62).stores({
  obsidianWatchFolders: '++id, chatId, createdAt',
});

// 泡泡模式（Bubble Mode）切片A：房间外壳。
// 参照 ensembleChats 的写法——只索引 title/createdAt/updatedAt，成员名单
// selectedCharacterIds 是非索引数组字段，跟着整条记录读写即可，不需要
// 单独的成员关系表。消息表 bubbleMessages 留到切片B（消息收发主链路）
// 实现的时候再建，这一版先不加，避免这轮加一张暂时用不上的空表。
db.version(63).stores({
  bubbleRooms: '++id, title, createdAt, updatedAt',
});

// 修一个从 v1 就带着的老毛病：pinnedGallery（首页"置顶图集"）和 profile
// （个人资料）这两张表把 photos / avatar / banner 这些存着大段 base64
// 图片的字段也一起声明成了索引字段。这两张表全应用范围内都只用
// db.xxx.get(id) / .put(...) 整行读写，从没有任何地方用
// .where('photos') / .where('avatar') / .where('banner') 查询过——
// 建索引纯粹是白费功夫：每次换一张图，IndexedDB 除了要写正文，还要
// 额外维护一份几乎同样大小的索引条目，新旧索引条目的回收时机又不一定
// 跟正文同步，这基本就是"换新图后旧数据没删干净、存储占用跟着叠"这个
// 反馈的根源。这里只去掉多余的索引声明，两张表都只留 id 这个主键，
// 已有数据的字段值不受影响，不需要迁移脚本。
// chats / characters / homeBoard / snapshotNpcs 也有同样问题，先不动，
// 范围明确后单独一轮再处理。
db.version(64).stores({
  pinnedGallery: 'id',
  profile: 'id',
});

// ============================================================
// v65：一次性数据修复 —— 把之前被自动/手动归档误搬进 archivedMessages
// 表的 call 类型消息（语音通话记录）搬回 messages 表。
//
// 背景：archiveService.js 此前对 call 类型消息一视同仁地参与归档，
// 消息被搬进 archivedMessages 后，CallReviewModal（保留/下载/删除
// 语音）和归档查看器互相不认识对方——call 消息的语音存在
// message.metadata.turns[].audio.audioBlob，跟归档查看器/
// archiveMediaCleanupService.js 认的 metadata.audioBlob 是两套
// 完全不同的字段形状，导致语音数据还在但没有任何界面能管理。
// 现在 archiveService.js 已经改成从源头排除 call 类型消息，不会再
// 归档新的通话记录；这里再补一次历史数据修复，把过去已经被搬进
// archivedMessages 的 call 记录挪回 messages 表，配合新的全局
// "通话记录"管理界面（src/apps/callHistory）统一查看/删除/打包
// 下载语音。
//
// messages/archivedMessages 表结构本身不变（索引跟 v46 一致），
// 这里只是为了挂一个 upgrade 钩子，照抄一遍现有的索引声明。
// ============================================================
db.version(65).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, [chatId+timestamp], [chatId+mode]',
  archivedMessages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, archivedAt, [chatId+timestamp]',
}).upgrade(async (tx) => {
  const v65GetDayKey = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  try {
    const archivedTable = tx.table('archivedMessages');
    const messagesTable = tx.table('messages');
    const statsTable = tx.table('archiveStats');

    const callRecords = await archivedTable
      .where('type')
      .equals('call')
      .toArray();

    if (callRecords.length === 0) {
      console.log('[db v65 迁移] 没有发现被误归档的通话记录，跳过。');
      return;
    }

    const idsToDelete = callRecords.map((record) => record.id);
    const affectedChatIds = [...new Set(callRecords.map((record) => record.chatId))];

    const payload = callRecords.map((record) => {
      const restored = { ...record };
      delete restored.id;
      delete restored.archivedAt;
      return restored;
    });

    await messagesTable.bulkAdd(payload);
    await archivedTable.bulkDelete(idsToDelete);

    // 顺带修正 archiveStats：这些记录搬走之后，受影响聊天的归档统计
    // （总归档消息数/归档天数）要跟着重新算一遍，避免展示的数字比
    // 实际剩下的归档内容多。逻辑跟 archiveService.js 里
    // recomputeArchiveStatsAfterDeletion 一致，这里不能直接 import
    // 那个文件（会跟 db/index.js 形成循环依赖），所以就地重写一份。
    for (const chatId of affectedChatIds) {
      // eslint-disable-next-line no-await-in-loop
      const remaining = await archivedTable.where('chatId').equals(chatId).toArray();

      const dayKeys = new Set(
        remaining
          .map((message) => v65GetDayKey(message.timestamp))
          .filter(Boolean)
      );

      // eslint-disable-next-line no-await-in-loop
      const currentStats = await statsTable.get(chatId);

      if (currentStats) {
        // eslint-disable-next-line no-await-in-loop
        await statsTable.put({
          ...currentStats,
          archivedDayKeys: Array.from(dayKeys),
          totalArchivedDays: dayKeys.size,
          totalArchivedMessages: remaining.length,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    console.log(
      `[db v65 迁移] 已把 ${callRecords.length} 条被误归档的通话记录搬回 messages 表，涉及 ${affectedChatIds.length} 个聊天窗。`
    );
  } catch (error) {
    console.error('[db v65 迁移] 迁移被误归档的通话记录失败：', error);
  }
});

// ============================================================
// v66：新增"角色头像历史相册"表（对应待办 3 的后半段）。
//
// 只记录角色头像（characters.avatar）被换掉之前的旧图，不覆盖聊天
// 背景/该角色的用户人设头像——范围是跟用户确认过的。avatar 字段本身
// 存的是大段 base64，参照 v64 那次教训，这里只给 characterId /
// createdAt 建索引，不给 avatar 字段建索引（避免重复维护一份几乎
// 同样大小的索引条目）。
// ============================================================
db.version(66).stores({
  characterAvatarHistory: '++id, characterId, createdAt',
});

// ============================================================
// v67：泡泡模式（Bubble Mode）切片B——消息表 bubbleMessages。
//
// 房间里的每一条消息（用户的广播 + 每个角色各自的回复）都存在这一张表，
// 是渲染房间聊天记录、以及给每个角色组装"隔离上下文"的唯一数据源。
// senderId 是 'user' 或角色 id，senderType 是 'user'/'character'，跟
// bubbleRooms.selectedCharacterIds 的角色 id 对应。groupId：同一次AI
// 回复用 ||| 拆出来的好几条消息共享同一个 groupId，用于UI折叠显示——
// 从建表第一天就把 [roomId+timestamp] 复合索引加上，不像 ensembleMessages
// 当初那样后补。
//
// 角色在房间里的回复，为了免费接入现有记忆系统，还会额外镜像写一份进
// messages 表（该角色自己真实的一对一聊天 chatId 下面，打 mode:'bubble' +
// bubbleRoomId 标记，跟"线下邀约"用 mode:'offline' 是同一个做法）——
// 这次迁移不改 messages 表结构，mode 字段本来就是不限定值的字符串，
// 不需要为 'bubble' 这个新值单独加索引或迁移。
// ============================================================
db.version(67).stores({
  bubbleMessages: '++id, roomId, senderId, senderType, timestamp, groupId, [roomId+timestamp]',
});

// ============================================================
// v68：长RP（长文/SillyTavern式）子应用切片A —— 只建 rpSessions 一张表。
//
// 跟泡泡模式切片A当初的做法一样：只建这一局真正用得到的表，消息表/
// 预设表/世界书表全部留到各自要用到的切片再建。presetId/
// attachedWorldBookIds 这些字段先在记录里占位好（写 null / []），
// 等预设系统、世界书系统的切片落地了再真正读写。
// ============================================================
db.version(68).stores({
  rpSessions: '++id, characterId, createdAt, updatedAt',
});

db.version(69).stores({
  rpPresets: '++id, name, createdAt, updatedAt',
});
db.version(70).stores({
  rpMessages: '++id, sessionId, senderType, timestamp, [sessionId+timestamp]',
});
db.version(71).stores({
  rpWorldBooks: '++id, name, createdAt, updatedAt',
});
db.version(72).stores({
  shellCatches: '++id, characterId, chatId, tier, identity, form, createdAt, [characterId+createdAt]',
});

// ============================================================
// v73：每月限定聊天成就图标——兑换/佩戴切片A。
//
// monthlyBadgeUnlocks：每个聊天窗口 × 每个赛季(seasonKey，形如 "2026-10")
// 一行，记录这个赛季有没有解锁、靠哪个条件解锁、AI 自定条件的内容。
// monthlyBadgeEquips：每个聊天窗口一行，记录现在戴着哪个图标——单独一张
// 表是因为佩戴状态要跨赛季持续有效（上个月解锁的图标，这个月依然能戴），
// 不能跟着某一行赛季记录一起"过期"。
// ============================================================
db.version(73).stores({
  monthlyBadgeUnlocks: '++id, chatId, seasonKey, [chatId+seasonKey]',
  monthlyBadgeEquips: '++id, chatId',
});

// v74：和好券（情侣兑换券）。只存用户发出的券，角色主动发的券走普通
// chat message（type: 'coupon'），不占这张表——见 couponService.js 注释。
db.version(74).stores({
  coupons: '++id, chatId, status, createdAt',
});

// ============================================================
// v75：异地任务挑战（情侣任务打卡板）切片A —— 数据模型 + 面板外壳。
//
// 跟DIY小屋一样挂在"这个聊天"（chatId）上，不是挂在角色身上。三张表，
// 具体字段形状和取舍见 challengeService.js 顶部的详细注释，这里只记
// 迁移本身要注意的点：
//
//   - challengeBoards：每个聊天一行，装饰性内容（拍立得画廊/歌单/
//     情书便签），只建 chatId 索引，不需要别的。
//   - challengePresets：情侣问卷/情侣任务模板库，全局共享（不挂
//     chatId），建 type 索引方便按"问卷"/"任务"分开取。内置种子数据
//     不在这次迁移里塞——交给 challengeService.js 的
//     ensurePresetsSeeded() 在第一次真正被用到时惰性写入，保持这个
//     文件对 apps/ 目录零依赖的既有约定（这张表为空就代表还没播过种，
//     不需要额外的"是否已播种"标记字段）。
//   - challengeTasks：真正的任务卡，一条一行（照抄 rpMessages 的做法，
//     不用数组字段），[chatId+status] 复合索引方便面板按"待完成/
//     已完成"筛选同一个聊天下的任务。
// ============================================================
db.version(75).stores({
  challengeBoards: '++id, chatId',
  challengePresets: '++id, type, isBuiltin, createdAt',
  challengeTasks:
    '++id, chatId, status, assignedBy, sourceType, sourcePresetId, createdAt, [chatId+status]',
});

// ============================================================
// v76：文字游戏大厅——井字棋的对局记录。
//
// 大厅本身（目录页）不需要任何表，纯静态数据，见 textGameCatalog.js。
// 这张表设计成"文字游戏大厅"里任何一个跟角色对弈的游戏都能共用，不是
// 井字棋专属：按 gameId 区分是哪款游戏，一局一行（照抄 shellCatches
// 的思路——不额外维护一张"胜负次数"汇总表，战绩统计直接从这张表的行
// 聚合算出来，避免汇总表跟实际记录不同步）。
//
// "只保留最新10局"不是靠查询时 limit(10) 简单截断：recordTextGameMatch
// 写完新的一局之后，会把同一个 [gameId+characterId] 下超出最近10条的
// 旧行物理删除，这张表本身永远只存得下最近10局，跟潮汐贝壳"配额直接
// 从实际记录算"同一个"不另外维护冗余计数"的哲学一致。
// ============================================================
db.version(76).stores({
  textGameMatches:
    '++id, gameId, characterId, chatId, endedAt, [gameId+characterId]',
});

db.version(77).stores({
  // 每个聊天窗口独立的打卡火花 streak
  chatStreaks: '++id, chatId',
  // 每个小伙伴（companionId）独立的日签抽取记录
  fortuneDraws: '++id, companionId',
});


// ============================================================
// v78：小游戏大厅切片A —— 「接住掉落物」每日次数与奖励记录。
//
// catchPlays：每玩一局记一行，不是"一天一行"（跟 fortuneDraws 不同，
// 这个小游戏一天能玩很多次，只是超过每日奖励次数之后 rewarded 为
// false，照样能记录、照样能看到自己的分数，只是不再给小伙伴加成）。
// [companionId+dateStr] 复合索引从建表第一天就加上，跟 v67/v75 一个
// 道理：这张表最常见的查询就是"这个小伙伴今天玩了几局 / 拿了几次奖励"，
// 不想后补。
// ============================================================
db.version(78).stores({
  catchPlays: '++id, companionId, dateStr, createdAt, [companionId+dateStr]',
});

// ============================================================
// v79：小伙伴新增"清洁度"数值（companions.cleanliness，0-100）。
//
// 不新增索引字段——跟 satiety/mood 一样是非索引字段，直接整行读写。
// 这里只是升版本号挂一个 upgrade 钩子，给已存在的小伙伴补上默认值
// 100（全新领养的小伙伴走 adoptCompanion 的 record 初始化，不经过
// 这个钩子）。
// ============================================================
db.version(79).stores({
  companions: `
    ++id,
    &chatId,
    characterId,
    createdAt,
    updatedAt
  `,
}).upgrade(async (tx) => {
  try {
    const companionsTable = tx.table('companions');
    const all = await companionsTable.toArray();

    for (const companion of all) {
      if (companion.cleanliness === undefined) {
        // eslint-disable-next-line no-await-in-loop
        await companionsTable.update(companion.id, { cleanliness: 100 });
      }
    }

    console.log(`[db v79 迁移] 已给 ${all.length} 个小伙伴补上清洁度默认值。`);
  } catch (error) {
    console.error('[db v79 迁移] 补充清洁度默认值失败：', error);
  }
});

// ============================================================
// v80：免费互动（喂食/清洁/玩耍）改成每天各 1 次。
//
// 跟 chatHeartProgress 的存法一致：companions.freeActionDaily 是
// { dateStr, feed, clean, play } 的普通对象字段，不新建表、不加索引。
// dateStr 对不上今天就代表翻篇了，companionService.js 里判断时直接
// 当成"今天还没用过"处理，不需要这里的 upgrade 钩子帮忙按天重置——
// 这里只负责给老数据补一个初始结构，避免字段是 undefined。
// ============================================================
db.version(80).stores({
  companions: `
    ++id,
    &chatId,
    characterId,
    createdAt,
    updatedAt
  `,
}).upgrade(async (tx) => {
  try {
    const companionsTable = tx.table('companions');
    const all = await companionsTable.toArray();

    for (const companion of all) {
      if (!companion.freeActionDaily) {
        // eslint-disable-next-line no-await-in-loop
        await companionsTable.update(companion.id, {
          freeActionDaily: { dateStr: '', feed: 0, clean: 0, play: 0 },
        });
      }
    }

    console.log(`[db v80 迁移] 已给 ${all.length} 个小伙伴补上免费互动每日计数初始结构。`);
  } catch (error) {
    console.error('[db v80 迁移] 补充免费互动每日计数失败：', error);
  }
});

// ============================================================
// v81：背包系统——食物（common/rare）、清洁道具、玩具购买后不再
// 立即生效，改成放进背包，点击使用才生效。
//
// companionBackpack：一个 companionId + itemId 一行，quantity（非
// 索引字段）记数量，用完数量归零就物理删除这一行，不留 0 的空行
// （思路跟 textGameMatches"只保留最近10局"一样：配额/数量直接从
// 实际记录算，不额外维护汇总字段）。[companionId+itemId] 复合索引
// 从建表第一天就加上，因为最常见的查询就是"这个小伙伴的某个道具还
// 有几个"。category 只是为了背包 UI 分栏展示方便，不是查询条件，
// 但加上也不费事，一起索引了。
//
// 稀有清洁道具/玩具的解锁状态，复用跟 unlockedRareFoodIds 一样的
// 思路，但不共用同一个字段（避免解锁食物顺带解锁了道具）：
// companions.unlockedRareCleanIds / unlockedRareToyIds，两个独立
// 的字符串数组字段，不建索引，整行读写。
// ============================================================
db.version(81).stores({
  companionBackpack: '++id, companionId, itemId, category, [companionId+itemId]',
}).upgrade(async (tx) => {
  try {
    const companionsTable = tx.table('companions');
    const all = await companionsTable.toArray();

    for (const companion of all) {
      const patch = {};
      if (!companion.unlockedRareCleanIds) patch.unlockedRareCleanIds = [];
      if (!companion.unlockedRareToyIds) patch.unlockedRareToyIds = [];

      if (Object.keys(patch).length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await companionsTable.update(companion.id, patch);
      }
    }

    console.log(`[db v81 迁移] 已给 ${all.length} 个小伙伴补上清洁道具/玩具解锁状态初始结构。`);
  } catch (error) {
    console.error('[db v81 迁移] 补充清洁道具/玩具解锁状态失败：', error);
  }
});

db.version(82).stores({
  artistTagPresets: '++id, name, createdAt, updatedAt',
});

db.version(83).stores({
  imageGenerations: '++id, source, chatId, characterId, createdAt, [source+createdAt]',
  imageGenerationFiles: 'generationId',
});

// AI 拼词的「给AI预设」库：每条是一段写给AI的指导词（人设/风格要求），
// 比如"你是一位顶级插画师，擅长写 MJ 风格的提示词"。用户可以存多条、
// 拼词时切换着用。见 promptComposerPresetService.js。
db.version(84).stores({
  imagePromptPresets: '++id, name, createdAt, updatedAt',
});

// ============================================================
// v85：飞行棋（事件卡骰子棋）子应用切片A —— 棋盘库 + 对局会话两张新表。
//
// flightChessBoards：一条记录 = 一张棋盘。tiles 是内联的非索引数组
// 字段（下标0固定是起点，最后一个固定是终点，走子顺序就是数组顺序），
// 不单独建格子表 —— 跟 rpPresets.prompts / rpWorldBooks.entries「小
// 数组直接内联」的思路一致，格子数不会很多，没必要为它单独起一张表。
// 每个格子目前只有 { type }，type 取值见 flightChessBoardData.js 的
// TILE_TYPES（'start'/'end'/'event'/'question'），以后要加新格子类型
// 不用动表结构，只是 tiles 数组里多一种 type 取值。isBuiltin 区分内置
// 示例棋盘和用户自己导入的，导入一律新建一条记录、不覆盖任何已有棋盘
// （跟 rpPresetService 的导入约定一致）。
//
// flightChessSessions：一局游戏。mainChatId + mainCharacterId 是用户
// 选的「主聊天框」——决定终局总结消息发去哪个聊天、以及默认的反应声音
// 是谁；extraCharacterIds 是另外从角色库里多选的最多2个角色（内联
// 数组，不建成员表，参照 bubbleRooms.selectedCharacterIds）。players
// 是这局真正要走格子的棋子列表，固定顺序 [user, mainCharacter,
// ...extraCharacters]，每个元素是 { type: 'user'|'character',
// characterId, position, finished }。questionCards 存开局时用户和
// 主角色各自写的3张提问卡（{ userCards: [], characterCards: [] }）。
// status 这一切片只会停在 'setup'（建局向导走完就创建成这个状态，
// 真正掷骰子/移动/问答走进 Slice B 才会把它推进到 'active'/'finished'）。
// ============================================================
db.version(85).stores({
  flightChessBoards: '++id, title, isBuiltin, createdAt, updatedAt',
  flightChessSessions: '++id, mainChatId, status, createdAt, updatedAt',
});

// v86：页边注「我的藏书」。readerBooks 存书的信息，readerBookFiles 存书的正文，
// 拆开是为了清理文件后书的信息和以后的批注留言还能保留。
db.version(86).stores({
  readerBooks: '++id, chatId, title, lastReadAt, createdAt, updatedAt',
  readerBookFiles: 'bookId',
});

// v87：阅读时长。每本书每天一行，[bookId+date] 是唯一索引。
db.version(87).stores({
  readerDailyReading: '++id, &[bookId+date], bookId, date',
});

// v88：划线和批注。[bookId+chapterIndex] 方便只取当前这一章的。
db.version(88).stores({
  readerAnnotations: '++id, bookId, chapterIndex, [bookId+chapterIndex], createdAt',
});

// v89：飞行棋卡组管理。内置5副卡组（心动试探/心跳升温/灵魂深聊/甜蜜暴击/
// 赢家福利）的题目原本写死在 flightChessCardData.js 里，现在用户可以在
// 「卡组管理」页里改文字、增删卡片——这张表只存「跟内置默认不一样的部分」，
// 一副卡组一条记录（deckId 当主键，不用自增 id），cards 是覆盖后的完整
// 卡片列表。库里没有对应 deckId 的记录，就说明用户没改过这副卡，直接用
// 代码里的内置默认。赢家福利卡这种带固定 effect 的卡组，保存时 effect
// 和张数都锁死在内置默认上，只会搬动文字，所以不需要在表结构里单独
// 校验（见 flightChessDeckService.js 的 saveDeckCards）。
db.version(89).stores({
  flightChessDeckOverrides: 'deckId, updatedAt',
});

// v90：小伙伴日记（companion.js「小伙伴」板块新一轮功能第一个切片）。
// 由重要事件触发写一篇第一人称小日记，用户可以点赞/留言，这个互动会在
// companionStatusPrompt.js 里被概率性地喂给角色感知/提起。完全新表，
// 跟 companionLogs（互动/自主照料的轻量流水日志）是两回事，不共用。
db.version(90).stores({
  companionDiaries: `
    ++id,
    companionId,
    timestamp,
    [companionId+timestamp]
  `,
});

// v91：心情日历（companion.js「小伙伴」板块新一轮功能第二个切片，入口放
// 在小伙伴页面，但记的是 char 的心情）。一天一条记录，date 是本地日期
// 字符串 'YYYY-MM-DD'。charMood 是角色（char，也就是小伙伴背后真正在
// 聊天的那个角色）当天的心情（每天晚上由 AI 固定判断一次，见后续切片的
// 调度器，这张表先只有字段，写入逻辑还没做）——跟 companion.mood（小伙伴
// 自己的养成数值）是两回事，不互相读写。userMood 是用户自己点格子选的、
// 覆盖式，不留历史版本。完全新表，跟 companionDiaries/companionLogs 都
// 不共用。
db.version(91).stores({
  companionMoods: `
    ++id,
    companionId,
    date,
    [companionId+date]
  `,
});

// v92：每日问答（companion.js「小伙伴」板块新一轮功能第三个切片）。小伙伴
// 每天出一对问题——一个问 char（角色，小伙伴背后真正在聊天的那个角色），
// 一个问 user——两边的回答互相可见。一天一条记录，date 是本地日期字符串
// 'YYYY-MM-DD'，[companionId+date] 保证一天只有一条。
//
// questionForChar/questionForUser 当天定下来之后不再变；charAnswer 是 AI
// 代入角色视角给出的回答，生成失败就先留 null（界面上会显示"还没想好"的
// 空状态 + 重roll 按钮，用户可以随时再试，不会因为失败一次就卡死一整天，
// 也不跟"今天出没出题"这件事绑在一起）。userAnswer 是用户自己写的回答，
// 提交前会有二次确认，提交后 userAnsweredAt 就有值，界面侧会把它当成"已
// 锁定、不能再改"的标记（这张表本身不做任何校验，锁定逻辑在
// companionDailyQaService.js 的 submitUserAnswer 里）。
//
// 历史记录只保留最近 5 天：companionDailyQaService.js 每次确保今天的题目
// 存在时，会顺手删掉超过 5 天的旧记录（不单独起定时任务，省事且足够——
// 用户打开小伙伴页面、或小伙伴页面在后台被 globalChatScheduler 触发检查
// 的频率本身就够密了），另外历史 tab 里也留了手动"现在清空"的入口。
//
// 完全新表，跟 companionDiaries/companionMoods/companionLogs 都不共用。
db.version(92).stores({
  companionDailyQA: `
    ++id,
    companionId,
    date,
    [companionId+date]
  `,
});

// v93：上学（companion.js「小伙伴」板块新一轮功能第四个切片，第一期）。
// 7 张完全新表，全部用 companionId 关联，跟 companions / companionLogs /
// companionDiaries / companionMoods / companionDailyQA 都不共用。
//
// companionSchool        学籍，一个小伙伴一行（&companionId）。没入学就没有这一行。
//                        stage / classId / teacherId / enrolledAt / promotedAt，
//                        另有 stageSets（本学段累计做完的组数，升班用）、
//                        dayKey + daySets（今天做了几组）、lastSetAt（冷却用）。
//                        这几个计数字段都不建索引，直接读整行。
// companionSchoolAlbum   学校相册（入学 / 升班 / 特别活动纪念卡），type 区分。
//                        image 存压缩后的 jpeg dataURL。
// companionSchoolSets    做题记录，一组一行；answers 里是每题的作答明细。
//                        第二期考试要从这里抽题，所以不设上限、不清理。
// companionSchoolWrong   错题本；[companionId+qid] 一题一行，snapshot 存一份
//                        题目快照，自己出的题被删了错题本也不会坏。
// companionSchoolQuestions 自己出的题（手写或 AI 出题确认后入库）。
// companionSchoolLife    在校生活记录（家校练习册 + 特别活动共用），kind 区分；
//                        第三期的朋友往来放 meta.friendId。
// companionSchoolReports 周评语 / 三方会谈，kind 区分；signedAt 为 null 表示
//                        家长还没签字。
//
// 课程表不存库：按学段 + 星期几从 school/companionSchoolData.js 里取。
db.version(93).stores({
  companionSchool: `
    ++id,
    &companionId
  `,
  companionSchoolAlbum: `
    ++id,
    companionId,
    type,
    createdAt
  `,
  companionSchoolSets: `
    ++id,
    companionId,
    finishedAt
  `,
  companionSchoolWrong: `
    ++id,
    companionId,
    qid,
    [companionId+qid]
  `,
  companionSchoolQuestions: `
    ++id,
    companionId,
    subject,
    createdAt
  `,
  companionSchoolLife: `
    ++id,
    companionId,
    date,
    kind,
    [companionId+date]
  `,
  companionSchoolReports: `
    ++id,
    companionId,
    kind,
    weekKey,
    [companionId+weekKey]
  `,
});

// v94：上学第二个切片——随机收藏卡。卡池本身是静态数据（见
// school/companionSchoolCardCatalog.js），不进数据库；这张表只存"抽到过
// 哪些卡、各抽到了几张"。[companionId+cardId] 一张卡一行，count 直接累加，
// 不单独建 count 的索引（只会按整行读，不会拿 count 去查询）。
db.version(94).stores({
  companionSchoolCards: `
    ++id,
    companionId,
    cardId,
    [companionId+cardId]
  `,
});

// 旅行小屋（src/apps/tripHome/）：每个聊天角色一条居民记录，每趟旅行一条
// 车票记录。旅费、背包、签到记录放在 settings 表 key = 'tripHomeState' 的
// 一行里，不需要单独建表。
db.version(95).stores({
  tripResidents: '++id, characterId, status',
  tripJourneys: '++id, residentId, characterId, status, arriveAt',
});

// 旅行小屋·留言板（切片 B）：一条留言/回应一条记录，不挂在具体某个居民
// 身上（留言板是整个小屋共用的）。authorType 区分是用户贴的还是角色
// 回来时贴的。只保留最近 20 条，旧的在 tripRoomService.js 里物理删除。
db.version(96).stores({
  tripBoardPosts: '++id, createdAt',
});

db.version(97).stores({
  marblePlays: '++id, companionId, dateStr, createdAt, [companionId+dateStr]',
});

db.version(98).stores({
  wishPlays: '++id, companionId, dateStr, createdAt, [companionId+dateStr]',
});

db.version(99).stores({
  sweetShopStates: '++id, companionId, shopId, [companionId+shopId], updatedAt',
  sweetWorkSessions: '++id, companionId, chatId, status, startedAt, [companionId+status]',
});
db.version(100).stores({
  companionMessages: '++id, companionId, timestamp, [companionId+timestamp]',
});
db.version(101).stores({
  characterPlaces: `
    ++id,
    chatId,
    characterId,
    name,
    visitCount,
    firstVisitAt,
    lastVisitAt,
    createdAt,
    [chatId+name]
  `,
  characterPlaceMemories: `
    ++id,
    chatId,
    placeId,
    author,
    createdAt,
    [placeId+createdAt]
  `,
});
// 像素衣橱（src/apps/pixelDoll/）：每个聊天一行档案（chatId 唯一），
// 自定义部件库（scopeChatId = 0 全局共用，否则只属于那个聊天），
// 礼物记录（每个聊天只保留最近 60 条，在 pixelDollService.js 里物理删除）。
db.version(102).stores({
  pixelDollProfiles: '++id, &chatId, updatedAt',
  pixelDollParts: '++id, scopeChatId, category, [scopeChatId+category+partId], createdAt',
  pixelDollGifts: '++id, chatId, status, createdAt, [chatId+createdAt]',
});

// 互动文游（src/apps/fiction/）：存档、剧情节点、配图元数据、配图本体。
// fictionImageFiles 只放 Blob，和 imageGenerationFiles 一样要排除在备份之外，
// 第 7 轮开始存图之前，要把它加进 backupService.js 的 BACKUP_EXCLUDED_TABLES。
db.version(103).stores({
  fictionSaves: '++id, updatedAt, mode',
  fictionNodes: '++id, saveId, parentId, [saveId+parentId]',
  fictionImages: '++id, saveId, nodeId',
  fictionImageFiles: '++id',
});

// 新东西订阅条（src/apps/hub/NewThingsBar.jsx）：后台自动功能更新的轻量提醒，
// 用完即删——不做"已读"状态，收下时直接物理删除这一行。
db.version(104).stores({
  backgroundUpdates: '++id, source, chatId, createdAt',
});

// 星光小竖琴（src/apps/harp/）：每个聊天自己的收藏旋律（只存音符编号和间隔，不存音频）。
db.version(105).stores({
  harpMelodies: '++id, chatId, createdBy, createdAt, [chatId+createdAt]',
});

db.version(106).stores({
  greetingCards: '++id, characterId, status, source, createdAt, revealAt, [characterId+createdAt]',
});

// 立体书（src/apps/greeting/popupBook*.js）：和贺卡同一个收藏夹，独立一张表。
db.version(107).stores({
  popupBooks: '++id, characterId, status, source, createdAt, revealAt, [characterId+createdAt]',
});

// 修图室相册（src/apps/layoutstudio/layoutWorksService.js）：只存成品图（JPEG Blob）和版面信息，不存原图。
db.version(108).stores({
  layoutWorks: '++id, characterId, createdAt',
});

db.version(109).stores({
  longDiaries: '++id, chatId, characterId, createdAt',
});

// ST 记忆桥(src/apps/stmemory/):导入的剧情记录做成"记忆包",原文切块存成独立的行,
// 不放进包记录的大数组字段里。聊天侧只在 chats 上加无索引字段 stPackLinks,不需要新表。
// importId 先建好索引,给以后"整批撤销"和增量导入用,避免再升一次版本。
db.version(110).stores({
  stMemoryPacks: '++id, createdAt, updatedAt',
  stPackChunks: '++id, packId, importId, [packId+index]',
});

// 聊天里的小玩具（src/apps/messages/toys/）：角色做的小游戏代码单独存一行，
// 聊天消息里只留标题和规则，这样代码不会出现在消息列表数据里，也不会进入任何 AI 上下文。
db.version(111).stores({
  chatToys: '++id, chatId, characterId, createdAt, [chatId+createdAt]',
});

// 角色专属区域 + 角色自我任务（src/apps/characterArea/）：
//   - characterAreas：每个聊天窗口最多一行（chatId 唯一索引），角色按人设发明的"小本子"。
//   - characterAreaEntries：区域里的条目（标题 + 正文），按聊天和时间取最近几条。
//   - characterTasks：角色给自己布置的定时任务，每个聊天最多同时 3 条未完成的。
// "每晚自动整理/仅手动"的开关不在这里，存在 chats 表的无索引字段 privateAreaAutoOrganize 上。
db.version(112).stores({
  characterAreas: '++id, &chatId, characterId, createdAt',
  characterAreaEntries: '++id, chatId, areaId, createdAt, [chatId+createdAt]',
  characterTasks: '++id, chatId, characterId, status, createdAt, [chatId+status]',
});

export default db;
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

export default db;





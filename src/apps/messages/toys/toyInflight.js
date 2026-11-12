// src/apps/messages/toys/toyInflight.js
//
// "这个聊天里是不是正在做小玩具"的内存状态。单独放一个没有任何依赖的小文件，
// 是为了让 toyDirective.js（被 aiService.js 导入）能读到它，又不用导入 toyService.js
// （toyService → toyAiService → aiService，直接导入会形成循环依赖）。
//
// 只存在内存里：应用重启后丢失，所以重启后还停在 making 的消息一定是被中断了的
// （见 toyService.js 的 reconcileInterruptedToy）。

const inflightChats = new Set();

export const isToyMakingInChat = (chatId) => inflightChats.has(String(chatId));

export const markToyMaking = (chatId) => {
  inflightChats.add(String(chatId));
};

export const unmarkToyMaking = (chatId) => {
  inflightChats.delete(String(chatId));
};
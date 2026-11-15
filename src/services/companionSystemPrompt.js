// 小伙伴相关功能（自主照顾、日记、心情、每日问答、小学堂等）专用的系统提示词入口。
//
// 跟 buildChatSystemPrompt 的区别只有一点：不把角色编辑器里填的世界书/知识库条目
// 拼进去。小伙伴不是角色本人，这批条目多半是以角色视角写的，带进去容易让小伙伴
// 写日记、回话时串成角色的口吻。角色人设、旧的专属世界书、全局世界书照常保留。

import { buildChatSystemPrompt } from './aiService';

export const buildCompanionSystemPrompt = (chatId, chat, character) => (
  buildChatSystemPrompt(chatId, chat, character, { skipCharacterEntries: true })
);
// src/apps/messages/friends/friendIntroDirective.js
//
// 角色"介绍一位朋友给用户"，写法沿用 greetingDirective.js 的两段式：
//   1. 聊天提示词里只在「总开关开 + 这位角色没被关 + 名额够」时才带一小段说明；
//   2. 角色想介绍，就在回复末尾单独一行写 [FRIEND_INTRO: 一句话理由]，
//      本文件把标签一律从正文摘掉（不管有没有生效），告诉调用方"想介绍"；
//   3. 调用方（aiService.js）在回复写入之后，动态 import friendRequestAiService.js
//      另外生成这位朋友的申请，不阻塞回复。
//
// 本文件只依赖 friendRequestService，不 import aiService（避免循环依赖）。

import { canCharacterIntroduce, isFriendIntroEnabled } from './friendRequestService';
import db from '../../../db';

const FRIEND_INTRO_PATTERN = /\s*\[FRIEND_INTRO(?::\s*([^\]]*))?\]\s*/i;
const FRIEND_INTRO_PATTERN_ALL = /\s*\[FRIEND_INTRO(?::\s*[^\]]*)?\]\s*/gi;

export const FRIEND_INTRO_PROMPT_NOTE = `
【可选行为：介绍一位朋友给用户】
如果聊着聊着，你自然地想让用户认识你生活里的某一位朋友（比如聊到了TA、觉得他们会聊得来），可以自己决定介绍，不用征求同意；没有这个念头就不要写，不要为了介绍而介绍。
想介绍就在回复正文最后单独一行写（用户看不到这行）：
[FRIEND_INTRO: 一句话理由]
理由写你为什么想让他们认识，简短即可，不确定就只写 [FRIEND_INTRO]。
重要：这次回复里不要描述这位朋友的名字、长相或来历，只像平时聊天一样接话再加标签；真正的朋友是系统另外安排的，对方会以"陌生人"的身份来申请，由用户决定通不通过。`;

// 聊天提示词用：没开、被关、名额不够，都返回空字符串，不带这段说明。
export const buildFriendIntroPromptNote = async ({ characterId }) => {
  try {
    if (characterId == null) return '';
    const [globalEnabled, character] = await Promise.all([
      isFriendIntroEnabled(),
      db.characters.get(Number(characterId)),
    ]);
    return canCharacterIntroduce(character, globalEnabled) ? FRIEND_INTRO_PROMPT_NOTE : '';
  } catch (error) {
    console.warn('[FriendIntroDirective] 读取状态失败，本次不带说明：', error);
    return '';
  }
};

// 摘标签。返回去掉标签后的正文，以及角色是否想介绍、给的理由。
export const applyFriendIntroDirective = ({ content }) => {
  const rawContent = String(content || '');
  const match = FRIEND_INTRO_PATTERN.exec(rawContent);

  return {
    content: rawContent.replace(FRIEND_INTRO_PATTERN_ALL, ''),
    wantsIntro: Boolean(match),
    reason: match ? String(match[1] || '').trim().slice(0, 80) : '',
  };
};
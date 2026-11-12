// src/apps/messages/toys/toyDirective.js
//
// 角色"自己决定给用户做一个小玩具"。写法沿用 greetingDirective.js 的两段式，省 token：
//   1. 聊天提示词里只在合适的时候带一小段说明（本文件的 NOTE）；
//   2. 角色想做，就在回复末尾单独一行写 [TOY_WANT: 一句想法]，本文件把标签一律从正文摘掉
//      （不管有没有生效），告诉调用方"想做"以及想法；
//   3. 调用方（aiService.js）在回复写入之后，动态 import toySession.js 另外跑一次生成，
//      完整的写代码规则只在那一次里给（见 toyAiService.js）。
// 没有定时器：什么时候做完全由聊天里角色自己的回复触发。
//
// 什么时候把说明交给角色（buildToyPromptNote）：
//   - 这个聊天里已经有一个小玩具在做：不给，避免角色又许诺第二个；
//   - 用户在聊天里明确提出想要小玩具 / 小游戏：一定给，不受开关、冷却、概率限制
//     （用户已经亲口要了，不该因为这些被拒绝）；
//   - 其余情况：聊天设置里的开关开着、不在冷却期、并且抽中概率，才给。
//
// 本文件不能导入 toyService.js / aiService.js（会形成循环依赖），
// "正在制作"的状态从 toyInflight.js 读。

import { TOY_AUTO, TOY_LIMITS } from './toyConstants';
import { isToyMakingInChat } from './toyInflight';

const TOY_WANT_PATTERN = /\s*\[TOY_WANT(?::\s*([^\]]*))?\]\s*/i;
const TOY_WANT_PATTERN_ALL = /\s*\[TOY_WANT(?::\s*[^\]]*)?\]\s*/gi;

// 用户有没有明确提出想要小玩具：动词在前、名词在后，中间最多隔几个字。
// 只是粗略判断，误判的后果很小（说明交给角色了，写不写标签仍然由它自己决定）。
const TOY_REQUEST_PATTERN =
  /(?:做|制作|弄|整|搞|编|写|来|给我|帮我|想要|想玩|要玩)[^。！？!?\n]{0,8}(?:小玩具|小游戏|玩具|游戏)/;

export const TOY_PROMPT_NOTE = `
【可选行为：给用户做一个小玩具】
如果你此刻特别想亲手给用户做一个能在手机上玩的小游戏（比如想逗TA开心、陪TA打发时间），可以自己决定做，不用征求同意；没有这个念头就不要写，不要为了做而做。
想做就在回复正文最后单独一行写（用户看不到这行）：
[TOY_WANT: 一句话说想做什么]
例如 [TOY_WANT: 一个限时点地鼠的小游戏]。
重要：这次回复里不要写游戏的代码，也不要描述玩法细节，只像平时聊天一样接话再加标签；真正做是系统另外单独交给你的那一次，做好后会以卡片的形式出现在聊天里。`;

const EXPLICIT_ADDON = `
用户这次明确说想要你做一个小玩具 / 小游戏：请答应下来，并用上面的办法去做。标签里写的想法，请照用户说的主题来写，不要改成别的。`;

const NOT_OFFERED = Object.freeze({ note: '', offered: false, explicit: false });

export const normalizeToySettings = (raw) => ({
  allowCharacterToy: Boolean(raw && typeof raw === 'object' && raw.allowCharacterToy === true),
});

export const isCharacterToyAllowed = (chat) => normalizeToySettings(chat?.toySettings).allowCharacterToy;

export const hasExplicitToyRequest = (userTexts) => (
  (Array.isArray(userTexts) ? userTexts : []).some((text) => TOY_REQUEST_PATTERN.test(String(text || '')))
);

/**
 * 这一次回复要不要把"可以做小玩具"的说明交给角色。
 * 返回 { note, offered, explicit }：
 *   note     要追加到提示词里的文字；不该给的时候是空字符串（一个字都不加）；
 *   offered  这次是不是真的交给了角色（调用方只认交给过之后角色写的标签）；
 *   explicit 是不是因为用户明确点名。
 * 全部是纯计算，只读 chat 记录上的字段和内存状态，没有数据库读写。
 */
export const buildToyPromptNote = ({
  chat,
  userTexts = [],
  now = Date.now(),
  random = Math.random,
} = {}) => {
  if (!chat?.id) return NOT_OFFERED;
  if (isToyMakingInChat(chat.id)) return NOT_OFFERED;

  if (hasExplicitToyRequest(userTexts)) {
    return { note: `${TOY_PROMPT_NOTE}${EXPLICIT_ADDON}`, offered: true, explicit: true };
  }

  if (!isCharacterToyAllowed(chat)) return NOT_OFFERED;

  const lastAutoAt = Number(chat.toyLastAutoAt) || 0;
  if (now - lastAutoAt < TOY_AUTO.cooldownMs) return NOT_OFFERED;

  if (random() >= TOY_AUTO.offerProbability) return NOT_OFFERED;

  return { note: TOY_PROMPT_NOTE, offered: true, explicit: false };
};

/**
 * 摘标签。返回去掉标签后的正文，以及角色是否想做、写的想法。
 * 标签一律从正文摘掉（用户看不到），不管这次有没有把说明交给过角色。
 */
export const applyToyDirective = ({ content }) => {
  const rawContent = String(content || '');
  const match = TOY_WANT_PATTERN.exec(rawContent);

  return {
    content: rawContent.replace(TOY_WANT_PATTERN_ALL, ''),
    wantsToy: Boolean(match),
    idea: match ? String(match[1] || '').replace(/\s+/g, ' ').trim().slice(0, TOY_LIMITS.requestChars) : '',
  };
};
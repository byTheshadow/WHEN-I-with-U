// src/apps/messages/friends/friendRumorNote.js
//
// 好友申请 · 切片 E：风声（给介绍人用的那一半）。
//
// 风声 = 一句很模糊的情绪话，不存原话。介绍人角色下次聊天时，提示词里带上"听说你和 TA 最近……"，
// 角色可以借此自然地关心或劝和一句。风声只存在朋友名片上：
//   card.rumorToIntroducer  { text, tone, createdAt }   朋友聊天 -> 介绍人
//   card.rumorToFriend      { text, tone, createdAt }   介绍人聊天 -> 朋友（朋友那边的提示词用，见 friendChatService.js）
//   tone：conflict（有矛盾）/ cold（冷淡）/ happy（开心）；平淡的不生成，所以没有 calm。
//
// 本文件只依赖 db，不 import aiService，也不 import 调 AI 的 friendRumorService，
// 这样 aiService.js 可以直接静态 import 它而不会形成循环引用。
//
// 用后即清：buildFriendRumorPromptNote 把风声放进提示词的同时就把它从名片上清掉；
// 过期（FRIEND_RUMOR_EXPIRE_MS）还没被用到的也顺手清掉。

import db from '../../../db';

// ====== 数值常量（以后想调手感，只改这里） ======
export const FRIEND_RUMOR_EXPIRE_MS = 3 * 24 * 60 * 60 * 1000; // 没被用到的风声多久后作废
export const FRIEND_RUMOR_INTRO_MAX = 2; // 介绍人一次最多收到几条风声（多位朋友同时有风声时）

export const isRumorFresh = (rumor, now = Date.now()) =>
  Boolean(rumor?.text) && now - (rumor.createdAt || 0) <= FRIEND_RUMOR_EXPIRE_MS;

/**
 * 聊天提示词用：这位角色有没有"介绍出去的朋友"带来的风声。没有就返回空字符串。
 * 带上之后立刻从名片上清掉（用后即清），也顺手清掉已过期的。
 */
export const buildFriendRumorPromptNote = async ({ characterId, now = Date.now() }) => {
  try {
    if (characterId === null || characterId === undefined) return '';
    const char = await db.characters.get(Number(characterId));
    const friends = Array.isArray(char?.friends) ? char.friends : [];
    if (friends.length === 0) return '';

    const fresh = friends
      .filter((f) => isRumorFresh(f.rumorToIntroducer, now))
      .sort((a, b) => (b.rumorToIntroducer.createdAt || 0) - (a.rumorToIntroducer.createdAt || 0))
      .slice(0, FRIEND_RUMOR_INTRO_MAX);

    // 有风声的（不管这次带不带）、已过期的，都清掉；只有"没有风声"的名片原样保留。
    const usedIds = new Set(fresh.map((f) => f.id));
    let changed = false;
    const nextFriends = friends.map((f) => {
      if (!f.rumorToIntroducer) return f;
      if (usedIds.has(f.id) || !isRumorFresh(f.rumorToIntroducer, now)) {
        changed = true;
        return { ...f, rumorToIntroducer: null };
      }
      return f;
    });
    if (changed) await db.characters.update(Number(characterId), { friends: nextFriends });

    if (fresh.length === 0) return '';

    const lines = fresh.map((f) => {
      const name = f.realName || f.alias || '那位朋友';
      return `- 你介绍给用户的朋友「${name}」那边：${f.rumorToIntroducer.text}`;
    });

    return `
【隐约听说的事（风声）】
你从别处模糊听说了一点事，只有感觉，没有任何细节：
${lines.join('\n')}
怎么用：
- 只在聊到合适的时候才提，没有合适的时机就不提，不用特意提起。
- 要提的话，用“听说”“好像”“感觉你最近不太开心”这样的口吻，轻轻关心一句，或者自然地劝和，不要说教。
- 不要复述任何细节，不要追问，不要假装亲眼看见，也不要说是谁告诉你的。
- 这件事你以后不会再收到提醒，说过一次就够了。`;
  } catch (error) {
    console.warn('[FriendRumorNote] 读取风声失败，本次不带：', error);
    return '';
  }
};

export default { buildFriendRumorPromptNote, isRumorFresh };
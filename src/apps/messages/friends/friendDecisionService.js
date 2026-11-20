// src/apps/messages/friends/friendDecisionService.js
//
// 好友申请 · 切片 C：用户点「通过 / 拒绝」之后的善后。
//   通过：
//     1. 申请状态改为 accepted（hidden 里的真实身份保留，申请页揭晓用）；
//     2. 写一张好友名片：介绍来的挂在介绍人 characters.friends；自己来的放 db.settings 的 friendCardsGlobal；
//     3. 往介绍人的长期记忆里写一条摘要（走现有的 createMemory，不新造格式）；
//     4. 在介绍人的聊天里留一条提示行（content 留空，不会被当成聊天内容重复吸收进记忆；
//        角色靠 aiService 的 formatMsgContentForPrompt 看到这件事，下次聊天自然提起）。
//   拒绝：
//     1. 申请状态改为 declined，并且把 hidden（真实身份）清空——拒绝后这位朋友就被遗忘；
//     2. 介绍人 / 全局的 blockedUntil 设为 24 小时之后（这段时间不再来新申请、提示词里不再带说明）；
//     3. 聊天里同样留一条提示行让角色知道结果，但不写任何长期记忆。
// 失败只留 console.warn，不影响申请状态本身已经改好。
//
// 只依赖 db / friendRequestService / memoryService，不 import aiService。

import db from '../../../db';
import { createMemory } from '../../memory/memoryService';
import {
  MEMORY_CONFIDENCES,
  MEMORY_RECALL_POLICIES,
  MEMORY_SCOPES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STABILITIES,
  MEMORY_SUBJECTS,
  MEMORY_TYPES,
} from '../../memory/memoryConstants';
import { decideFriendRequest, FRIEND_DECLINE_COOLDOWN_MS } from './friendRequestService';

export const FRIEND_RESULT_MESSAGE_TYPE = 'friend_result_notice';

// 与 friendRequestService.js 里的 GLOBAL_STATE_KEY 保持一致（那边没有导出）。
const GLOBAL_STATE_KEY = 'friendRequestsGlobal';
const GLOBAL_CARDS_KEY = 'friendCardsGlobal';

const EMPTY_HIDDEN = { realName: '', relation: '', personality: '', speechStyle: '' };

// ====== 名片 ======
const buildCard = (item, now) => ({
  id: item.id,
  requestId: item.id,
  alias: item.alias,
  realName: item.hidden?.realName || item.alias,
  relation: item.hidden?.relation || '',
  personality: item.hidden?.personality || '',
  speechStyle: item.hidden?.speechStyle || '',
  avatarId: item.avatarId ?? null,
  introducedBy: item.ownerType === 'character' ? Number(item.ownerId) : null,
  introReason: item.introReason || '',
  source: item.source || '',
  acceptedAt: now,
  memorySummary: '',
});

const saveCard = async (item, card) => {
  if (item.ownerType === 'character') {
    const char = await db.characters.get(Number(item.ownerId));
    if (!char) return;
    const list = Array.isArray(char.friends) ? char.friends : [];
    if (list.some((f) => f.id === card.id)) return;
    await db.characters.update(Number(item.ownerId), { friends: [card, ...list] });
    return;
  }

  const row = await db.settings.get(GLOBAL_CARDS_KEY);
  const list = Array.isArray(row?.value) ? row.value : [];
  if (list.some((f) => f.id === card.id)) return;
  await db.settings.put({ key: GLOBAL_CARDS_KEY, value: [card, ...list] });
};

// ====== 聊天里留痕 + 介绍人记忆 ======
const getLatestChat = async (characterId) => {
  const chats = await db.chats.where('characterId').equals(Number(characterId)).toArray();
  if (chats.length === 0) return null;
  return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
};

const insertResultNotice = async ({ chat, characterId, metadata, now }) => {
  await db.messages.add({
    chatId: chat.id,
    characterId: Number(characterId),
    sender: 'user',
    type: FRIEND_RESULT_MESSAGE_TYPE,
    content: '',
    metadata,
    isRead: true,
    timestamp: now,
  });
  await db.chats.update(chat.id, { updatedAt: now });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('new-local-message-inserted', { detail: { chatId: chat.id } }),
    );
  }
};

const writeIntroducerMemory = async ({ chat, character, card }) => {
  const parts = [
    `用户通过了我介绍的朋友「${card.alias}」的好友申请。`,
    card.source === 'checkin' ? '这次是我很久没联系用户时，我的朋友来问候的。' : '',
    card.realName && card.realName !== card.alias ? `TA 的真名是${card.realName}。` : '',
    card.relation ? `TA 和我的关系：${card.relation}。` : '',
    card.personality ? `性格：${card.personality}。` : '',
  ].filter(Boolean);

  await createMemory({
    chatId: chat.id,
    title: `介绍给用户的朋友：${card.alias}`,
    content: parts.join(''),
    type: MEMORY_TYPES.RELATIONSHIP,
    importance: 3,
    confidence: MEMORY_CONFIDENCES.CONFIRMED,
    subject: MEMORY_SUBJECTS.SHARED,
    topicKey: `friend_${card.id}`,
    stability: MEMORY_STABILITIES.STABLE,
    memoryScope: MEMORY_SCOPES.RELATIONSHIP_SETTING,
    recallPolicy: MEMORY_RECALL_POLICIES.WHEN_RELEVANT,
    sourceState: MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
    sourceKind: MEMORY_SOURCE_KINDS.SUMMARY_ASSISTED,
    note: `用户通过好友申请后系统自动写入（介绍人：${character?.name || ''}），非对话内容提取。`,
  });
};

// ====== 通过 ======
const afterAccepted = async (item, now) => {
  const card = buildCard(item, now);
  await saveCard(item, card);

  if (item.ownerType !== 'character') return;

  const [character, chat] = await Promise.all([
    db.characters.get(Number(item.ownerId)),
    getLatestChat(item.ownerId),
  ]);
  if (!chat) return;

  try {
    await writeIntroducerMemory({ chat, character, card });
  } catch (error) {
    console.warn('[FriendDecision] 写入介绍人记忆失败：', error);
  }

  await insertResultNotice({
    chat,
    characterId: item.ownerId,
    now,
    metadata: {
      requestId: item.id,
      result: 'accepted',
      alias: card.alias,
      realName: card.realName,
      relation: card.relation,
    },
  });
};

// ====== 拒绝 ======
const wipeAndBlock = (list, itemId, now) =>
  (Array.isArray(list) ? list : []).map((r) =>
    r.id === itemId ? { ...r, hidden: { ...EMPTY_HIDDEN } } : r,
  );

const afterDeclined = async (item, now) => {
  const blockedUntil = now + FRIEND_DECLINE_COOLDOWN_MS;

  if (item.ownerType === 'character') {
    const char = await db.characters.get(Number(item.ownerId));
    if (!char) return;
    await db.characters.update(Number(item.ownerId), {
      friendRequests: wipeAndBlock(char.friendRequests, item.id, now),
      friendRequestMeta: { ...(char.friendRequestMeta || {}), blockedUntil },
    });

    const chat = await getLatestChat(item.ownerId);
    if (chat) {
      await insertResultNotice({
        chat,
        characterId: item.ownerId,
        now,
        metadata: { requestId: item.id, result: 'declined' },
      });
    }
    return;
  }

  const row = await db.settings.get(GLOBAL_STATE_KEY);
  const value = row?.value || {};
  await db.settings.put({
    key: GLOBAL_STATE_KEY,
    value: {
      ...value,
      requests: wipeAndBlock(value.requests, item.id, now),
      meta: { ...(value.meta || {}), blockedUntil },
    },
  });
};

/**
 * 申请页的「通过 / 拒绝」改调这个。item: loadFriendRequestItems 返回的一项。
 * 返回 decideFriendRequest 的结果（false 表示这封已经被处理过了，什么都没做）。
 */
export const resolveFriendRequest = async (item, nextStatus, now = Date.now()) => {
  const changed = await decideFriendRequest(item, nextStatus, now);
  if (!changed) return false;

  try {
    if (nextStatus === 'accepted') await afterAccepted(item, now);
    else await afterDeclined(item, now);
  } catch (error) {
    console.warn('[FriendDecision] 处理善后失败（申请状态已更新）：', error);
  }
  return true;
};

export default { resolveFriendRequest, FRIEND_RESULT_MESSAGE_TYPE };
// src/apps/messages/friends/friendChatService.js
//
// 好友申请 · 切片 D：和已通过的朋友聊天。
//
// 朋友不是真角色：不进 db.characters、不进消息列表、不进 db.messages，所以也不会被记忆系统、
// 各种定时器当成角色处理。朋友只活在两个地方：
//   - 名片：介绍来的在 characters.friends（挂在介绍人身上），自己来的在 db.settings 的 friendCardsGlobal
//   - 聊天记录：db.friendMessages（索引 [friendId+timestamp]，friendId 就是名片 id）
//
// 名片在 C 切片的字段之外，D 新增两个字段（都是名片上的普通字段，不用升 schema）：
//   fullPersona              首次聊天时 AI 扩写出来的完整人设（只生成一次，之后一直用它）
//   summaryCoveredThroughId  memorySummary 已经覆盖到 friendMessages 的哪条 id
// 已有的 memorySummary 从 C 起就是空字符串，D 起由滚动摘要来写。
//
// 提示词里放：名片 + 完整人设 + memorySummary + 最近对话 + 和介绍人的共同背景（带上限）
// + “你不是介绍人，说话风格必须不同”。
//
// 约定：
//   - 走 aiService 导出的 generateResponse（和长RP 一样），不碰在线聊天的标签解析；
//   - 回复里用 ||| 拆成多条气泡，和现有角色一致；
//   - 失败不写进聊天记录，只把错误信息交给界面，界面可以点“让 TA 回复”重试；
//   - 本文件只被界面引用，aiService 不会 import 它，所以不会循环引用。

import Dexie from 'dexie';
import db from '../../../db';
import { generateResponse } from '../../../services/aiService';
import { isRumorFresh } from './friendRumorNote';

// ====== 数值常量（以后想调手感，只改这里） ======
export const FRIEND_CONTEXT_LIMIT = 30; // 每次回复最多带最近多少条对话
export const FRIEND_SUMMARY_TRIGGER = 40; // 还没被摘要覆盖的消息攒到多少条，就折一次摘要
export const FRIEND_SUMMARY_KEEP_RECENT = 20; // 折摘要时，最近这么多条原样留着不折
export const FRIEND_SUMMARY_MAX = 400; // 摘要最多多少字
export const FRIEND_PERSONA_MAX = 600; // 扩写人设最多多少字
export const FRIEND_MAX_BUBBLES = 5; // 一次回复最多拆成几条气泡
export const FRIEND_BACKGROUND_MESSAGES = 12; // 共同背景：取用户和介绍人最近多少条聊天
export const FRIEND_BACKGROUND_LINE_MAX = 80; // 共同背景：每条最多多少字
export const FRIEND_BACKGROUND_BIO_MAX = 300; // 共同背景：介绍人人设最多多少字
export const FRIEND_RECENT_LOAD = 100; // 界面一次读最近多少条

const GLOBAL_CARDS_KEY = 'friendCardsGlobal';
const REQUEST_GAP_MS = 700; // 多条气泡之间的间隔上限

// ====== 名片读写 ======
// ref: { id, ownerId }。id 是名片 id（= 申请 id），ownerId 是介绍人角色 id，自己来的传 null。
const cleanOwnerId = (ownerId) =>
  ownerId === null || ownerId === undefined || ownerId === '' ? null : Number(ownerId);

export const getFriendCard = async (ref) => {
  if (!ref?.id) return null;
  const ownerId = cleanOwnerId(ref.ownerId);

  if (ownerId !== null) {
    const char = await db.characters.get(ownerId);
    const list = Array.isArray(char?.friends) ? char.friends : [];
    return list.find((f) => f.id === ref.id) || null;
  }

  const row = await db.settings.get(GLOBAL_CARDS_KEY);
  const list = Array.isArray(row?.value) ? row.value : [];
  return list.find((f) => f.id === ref.id) || null;
};

export const updateFriendCard = async (ref, patch) => {
  if (!ref?.id || !patch) return null;
  const ownerId = cleanOwnerId(ref.ownerId);
  let updated = null;

  const apply = (list) =>
    (Array.isArray(list) ? list : []).map((f) => {
      if (f.id !== ref.id) return f;
      updated = { ...f, ...patch };
      return updated;
    });

  if (ownerId !== null) {
    const char = await db.characters.get(ownerId);
    if (!char) return null;
    await db.characters.update(ownerId, { friends: apply(char.friends) });
    return updated;
  }

  const row = await db.settings.get(GLOBAL_CARDS_KEY);
  await db.settings.put({ key: GLOBAL_CARDS_KEY, value: apply(row?.value) });
  return updated;
};

// ====== 聊天记录 ======
export const getRecentFriendMessages = async (friendId, limit = FRIEND_RECENT_LOAD) => {
  if (!friendId) return [];
  try {
    const rows = await db.friendMessages
      .where('[friendId+timestamp]')
      .between([friendId, Dexie.minKey], [friendId, Dexie.maxKey])
      .reverse()
      .limit(limit)
      .toArray();
    return rows.reverse();
  } catch (err) {
    console.error('[friendChatService] 读取聊天记录失败:', err);
    return [];
  }
};

const getAllFriendMessages = async (friendId) =>
  db.friendMessages
    .where('[friendId+timestamp]')
    .between([friendId, Dexie.minKey], [friendId, Dexie.maxKey])
    .toArray();

const addFriendMessage = async (friendId, sender, content, timestamp = Date.now()) =>
  db.friendMessages.add({ friendId, sender, content, timestamp });

// ====== 小工具 ======
const clip = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);

const getLatestChatOf = async (characterId) => {
  const chats = await db.chats.where('characterId').equals(Number(characterId)).toArray();
  if (chats.length === 0) return null;
  return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
};

// 介绍人那边的背景：人设 + 用户和介绍人最近的几句话。只拿来当"隐约听说过的事"。
const loadIntroducerBackground = async (card) => {
  if (card?.introducedBy === null || card?.introducedBy === undefined) return null;

  const character = await db.characters.get(Number(card.introducedBy));
  if (!character) return null;

  const chat = await getLatestChatOf(character.id);
  let lines = [];
  if (chat) {
    const rows = await db.messages
      .where('[chatId+timestamp]')
      .between([chat.id, Dexie.minKey], [chat.id, Dexie.maxKey])
      .reverse()
      .limit(FRIEND_BACKGROUND_MESSAGES * 2)
      .toArray();

    const userName = String(chat.userName || '用户').trim();
    lines = rows
      .reverse()
      .filter((row) => row.type === 'text' && row.content)
      .slice(-FRIEND_BACKGROUND_MESSAGES)
      .map((row) => `${row.sender === 'user' ? userName : character.name}：${clip(row.content, FRIEND_BACKGROUND_LINE_MAX)}`);
  }

  return {
    name: character.name || '介绍人',
    bio: clip(character.bio, FRIEND_BACKGROUND_BIO_MAX),
    userName: String(chat?.userName || '用户').trim(),
    lines,
  };
};

// ====== 首次聊天：把名片扩写成完整人设（只生成一次） ======
const personaInFlight = new Map();

const buildPersonaPrompt = (card, background) => `你要把一张“朋友名片”扩写成一份完整的人物设定，供聊天时扮演这个人。

【名片】
- 真名：${card.realName || card.alias}
- 对方一开始用的化名：${card.alias || card.realName}
- 与${background?.name || '用户'}的关系：${card.relation || '（没有写明）'}
- 性格：${card.personality || '（没有写明）'}
- 说话风格：${card.speechStyle || '（没有写明）'}
${background ? `\n【介绍人${background.name}的设定（只用来保证你和 TA 不一样）】\n${background.bio || '（无）'}\n` : ''}
请写一份 ${FRIEND_PERSONA_MAX} 字以内的设定，用几段自然的话，不要列表、不要标题、不要 Markdown，包含：
1. 日常身份、生活和一两个小习惯；
2. 说话方式，比如句子长短、口头禅、爱用的语气，要具体；
3. 对用户的态度：${card.introducedBy === null || card.introducedBy === undefined ? '是自己主动来加用户的，带着好奇' : `是通过${background?.name || '朋友'}认识用户的，刚加上好友，有点熟又有点生`}。

要求：
- 必须和名片一致，不要改动真名、关系、性格；
- 这个人不是${background?.name || '介绍人'}，说话风格必须明显不同，不要复制 TA 的口头禅；
- 不要出现 AI、系统、模型、角色扮演之类的字眼。
只输出设定正文。`;

const fallbackPersona = (card) =>
  [
    card.relation ? `和${card.introducedBy === null || card.introducedBy === undefined ? '用户' : '介绍人'}的关系：${card.relation}` : '',
    card.personality ? `性格：${card.personality}` : '',
    card.speechStyle ? `说话风格：${card.speechStyle}` : '',
  ]
    .filter(Boolean)
    .join('\n');

/**
 * 保证名片上有 fullPersona。已经有就直接返回；没有就调一次 AI 扩写并存回名片。
 * AI 失败时不存任何东西（下次再试），本次返回原名片，提示词会退回用名片字段。
 */
export const ensureFriendPersona = (ref) => {
  if (!ref?.id) return Promise.resolve(null);
  if (personaInFlight.has(ref.id)) return personaInFlight.get(ref.id);

  const job = (async () => {
    const card = await getFriendCard(ref);
    if (!card) return null;
    if (card.fullPersona) return card;

    try {
      const background = await loadIntroducerBackground(card);
      const text = await generateResponse([
        { role: 'system', content: buildPersonaPrompt(card, background) },
        { role: 'user', content: '请开始。' },
      ]);
      const persona = String(text || '').trim().slice(0, FRIEND_PERSONA_MAX * 2);
      if (!persona) return card;
      return (await updateFriendCard(ref, { fullPersona: persona })) || card;
    } catch (error) {
      console.warn('[FriendChat] 扩写人设失败，先用名片字段聊：', error);
      return card;
    }
  })().finally(() => {
    personaInFlight.delete(ref.id);
  });

  personaInFlight.set(ref.id, job);
  return job;
};

// ====== 提示词 ======
const buildSystemPrompt = ({ card, background, userName, rumor }) => {
  const name = card.realName || card.alias;
  const fromIntroducer = card.introducedBy !== null && card.introducedBy !== undefined;
  const persona = card.fullPersona || fallbackPersona(card);

  const parts = [
    `你是「${name}」，一个真实生活里的普通人，正在手机上和「${userName}」聊天。你们刚刚互相加了好友。`,
    '',
    '【你是谁】',
    persona || '（没有更多设定，按自然的普通人来）',
  ];

  if (card.alias && card.alias !== name) {
    parts.push(`你申请好友时用过化名“${card.alias}”，现在对方已经知道你是谁了。`);
  }

  if (fromIntroducer && background) {
    parts.push('', `【你和${background.name}的关系】`, card.relation || '是朋友。');
    parts.push(
      `${background.name}把你介绍给了${userName}。${background.name}的大致情况：${background.bio || '（不详）'}`,
    );
    if (background.lines.length > 0) {
      parts.push(
        '',
        `【你隐约听${background.name}提起过的、TA 和${userName}最近聊的事（只是风声，可能不准）】`,
        ...background.lines,
        '这些你只是模糊听说，不要复述细节，不要假装亲眼看见，想提也只能用“听说”“好像”的口吻。',
      );
    }
  } else if (!fromIntroducer) {
    parts.push('', '你是自己主动来加对方的，没有谁介绍。');
  }

  if (card.memorySummary) {
    parts.push('', `【你和${userName}之前聊过的内容（摘要）】`, card.memorySummary);
  }

  // 风声（切片 E）：介绍人和用户最近的一点模糊情绪，只能用“听说”的口吻提，用一次就清掉。
  if (rumor?.text && background) {
    parts.push(
      '',
      '【你隐约听说的事（风声，只是感觉）】',
      `你从别处模糊听说：${background.name}和${userName}${rumor.text}。只有感觉，没有任何细节。`,
      '想提的话只能用“听说”“好像”的口吻，不要复述细节，不要假装亲眼看见，也不要追问；没有合适的时机就不提。',
    );
  }

  parts.push(
    '',
    '【聊天规则】',
    `- 你不是${background?.name || '介绍你的那个人'}，你们是两个不同的人，说话风格必须不同，不要用 TA 的口头禅和语气。`,
    '- 像手机聊天一样说话：短句，口语，一次回复可以分成 1 到 3 条消息，条与条之间用 ||| 隔开。',
    `- 最多分 ${FRIEND_MAX_BUBBLES} 条，每条不要太长。`,
    '- 只输出你要发的话本身，不要加姓名前缀，不要加动作描写和旁白，不要使用表情符号。',
    '- 你只知道上面写到的信息。不知道的就说不知道，不要编造用户的经历。',
    '- 不要出现 AI、系统、模型、角色扮演之类的字眼。',
  );

  return parts.join('\n');
};

const toPromptMessages = (rows) => {
  const list = rows.map((row) => ({
    role: row.sender === 'user' ? 'user' : 'assistant',
    content: String(row.content || ''),
  }));

  if (list.length === 0) {
    return [{ role: 'user', content: '（你们刚加上好友，用户还没说话。你先打个招呼。）' }];
  }
  if (list[list.length - 1].role !== 'user') {
    list.push({ role: 'user', content: '（用户暂时没说话。你可以接着聊，或者问一句。）' });
  }
  return list;
};

// ====== 回复拆分 ======
const escapeRegExp = (text) => String(text || '').replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');

// 模型偶尔会在开头加“名字：”，这里去掉。
const splitBubbles = (raw, name) => {
  const safeName = escapeRegExp(name);
  const prefix = safeName ? new RegExp(`^[「\\[]?${safeName}[」\\]]?\\s*[:：]\\s*`) : null;
  return String(raw || '')
    .split('|||')
    .map((part) => {
      const trimmed = part.trim();
      return prefix ? trimmed.replace(prefix, '').trim() : trimmed;
    })
    .filter(Boolean)
    .slice(0, FRIEND_MAX_BUBBLES);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ====== 滚动摘要 ======
const summaryInFlight = new Set();

const buildSummaryPrompt = ({ card, userName, rows }) => {
  const name = card.realName || card.alias;
  const transcript = rows
    .map((row) => `${row.sender === 'user' ? userName : name}：${clip(row.content, 200)}`)
    .join('\n');

  return `下面是「${name}」和「${userName}」的聊天。请把已有摘要和新增的聊天合并成一份新的摘要，用「${name}」的视角、第一人称来写，供以后聊天时回忆。

【已有摘要】
${card.memorySummary || '（还没有）'}

【新增的聊天】
${transcript}

要求：
- ${FRIEND_SUMMARY_MAX} 字以内，几句连贯的话，不要列表，不要 Markdown；
- 记住：聊过哪些事、对方的喜好和近况、两个人之间的氛围和没说完的话题；
- 不要照抄原话，不要写成系统报告的口吻。
只输出摘要正文。`;
};

/**
 * 没被摘要覆盖的消息攒够 FRIEND_SUMMARY_TRIGGER 条，就把更早的部分折进 memorySummary，
 * 最近 FRIEND_SUMMARY_KEEP_RECENT 条原样保留。失败不推进进度，下次回复后自动再试。
 */
export const maybeSummarizeFriendChat = async (ref) => {
  if (!ref?.id || summaryInFlight.has(ref.id)) return false;
  summaryInFlight.add(ref.id);

  try {
    const card = await getFriendCard(ref);
    if (!card) return false;

    const covered = Number(card.summaryCoveredThroughId || 0);
    const uncovered = (await getAllFriendMessages(ref.id)).filter((row) => row.id > covered);
    if (uncovered.length < FRIEND_SUMMARY_TRIGGER) return false;

    const toFold = uncovered.slice(0, uncovered.length - FRIEND_SUMMARY_KEEP_RECENT);
    if (toFold.length === 0) return false;

    const background = await loadIntroducerBackground(card);
    const userName = background?.userName || '用户';

    const text = await generateResponse([
      { role: 'system', content: buildSummaryPrompt({ card, userName, rows: toFold }) },
      { role: 'user', content: '请开始。' },
    ]);
    const summary = String(text || '').trim().slice(0, FRIEND_SUMMARY_MAX);
    if (!summary) return false;

    await updateFriendCard(ref, {
      memorySummary: summary,
      summaryCoveredThroughId: toFold[toFold.length - 1].id,
    });
    return true;
  } catch (error) {
    console.warn('[FriendChat] 滚动摘要失败，下次再试：', error);
    return false;
  } finally {
    summaryInFlight.delete(ref.id);
  }
};

// ====== 发送 / 回复 ======
const replyInFlight = new Set();

/**
 * 让朋友回复一次（不新增用户消息）。界面的“让 TA 回复 / 重试”直接调它。
 * onChange：每写入一条消息后调用，界面用它刷新列表。
 * 返回 { ok, error? }。
 */
export const requestFriendReply = async (ref, { onChange } = {}) => {
  if (!ref?.id) return { ok: false, error: '找不到这位朋友' };
  if (replyInFlight.has(ref.id)) return { ok: false, error: 'TA 正在回复中' };
  replyInFlight.add(ref.id);

  try {
    const card = await ensureFriendPersona(ref);
    if (!card) return { ok: false, error: '找不到这位朋友的名片' };

    const background = await loadIntroducerBackground(card);
    const userName = background?.userName || '用户';

    const rumor = background && isRumorFresh(card.rumorToFriend) ? card.rumorToFriend : null;

    const covered = Number(card.summaryCoveredThroughId || 0);
    const rows = (await getRecentFriendMessages(ref.id, FRIEND_CONTEXT_LIMIT + FRIEND_SUMMARY_TRIGGER))
      .filter((row) => row.id > covered)
      .slice(-FRIEND_CONTEXT_LIMIT);

    const raw = await generateResponse([
      { role: 'system', content: buildSystemPrompt({ card, background, userName, rumor }) },
      ...toPromptMessages(rows),
    ]);

    const bubbles = splitBubbles(raw, card.realName || card.alias);
    if (bubbles.length === 0) return { ok: false, error: 'TA 没有回话，再试一次吧' };

    const base = Date.now();
    for (let i = 0; i < bubbles.length; i += 1) {
      if (i > 0) await sleep(Math.min(REQUEST_GAP_MS, 250 + bubbles[i].length * 30));
      await addFriendMessage(ref.id, 'friend', bubbles[i], Math.max(Date.now(), base + i));
      if (typeof onChange === 'function') onChange();
    }

    // 风声用后即清（也顺手清掉已过期的）。
    if (card.rumorToFriend) {
      await updateFriendCard(ref, { rumorToFriend: null }).catch(() => null);
    }

    void maybeSummarizeFriendChat(ref);
    return { ok: true };
  } catch (error) {
    console.warn('[FriendChat] 回复失败：', error);
    return { ok: false, error: String(error?.message || '回复失败，请稍后再试') };
  } finally {
    replyInFlight.delete(ref.id);
  }
};

/**
 * 用户发一条消息，然后让朋友回复。用户消息先落库（回复失败也不会丢）。
 */
export const sendFriendMessage = async (ref, text, { onChange } = {}) => {
  const content = String(text || '').trim();
  if (!ref?.id || !content) return { ok: false, error: '' };

  await addFriendMessage(ref.id, 'user', content);
  if (typeof onChange === 'function') onChange();

  return requestFriendReply(ref, { onChange });
};

export default {
  getFriendCard,
  updateFriendCard,
  getRecentFriendMessages,
  ensureFriendPersona,
  maybeSummarizeFriendChat,
  requestFriendReply,
  sendFriendMessage,
};
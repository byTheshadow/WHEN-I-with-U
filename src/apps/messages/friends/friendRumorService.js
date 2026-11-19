// src/apps/messages/friends/friendRumorService.js
//
// 好友申请 · 切片 E：风声的生成（要调 AI 的那一半）。
//
//   makeRumorAfterFriendChat(ref)      退出朋友聊天页时调：这次和朋友聊的内容，有没有明显的矛盾 / 冷淡 / 开心。
//                                      有，就在名片上留一句给介绍人的风声（card.rumorToIntroducer）。
//   refreshRumorAboutIntroducer(ref)   打开朋友聊天页时调：介绍人和用户自上次以来的聊天，有没有明显的情绪。
//                                      有，就在名片上留一句给朋友的风声（card.rumorToFriend）。
//
// 约定：
//   - 只存一句不超过 FRIEND_RUMOR_TEXT_MAX 字的模糊话，不存原话；
//   - 判为平淡的什么都不留；判断失败也什么都不留，不报错；
//   - 只有自己来的（没有介绍人）的朋友不生成风声；
//   - 每次判断只看"上次判断之后"的新消息，新消息不够 FRIEND_RUMOR_MIN_MESSAGES 条就先攒着。
//
// 本文件会 import aiService（调 generateResponse），所以只能被界面引用，aiService 不能反过来 import 它；
// aiService 那一侧用的是只依赖 db 的 friendRumorNote.js。

import Dexie from 'dexie';
import db from '../../../db';
import { generateResponse } from '../../../services/aiService';
import { getFriendCard, getRecentFriendMessages, updateFriendCard } from './friendChatService';

// ====== 数值常量（以后想调手感，只改这里） ======
export const FRIEND_RUMOR_MIN_MESSAGES = 6; // 新消息攒到多少条才判断一次
export const FRIEND_RUMOR_TEXT_MAX = 30; // 风声最多多少字
const TRANSCRIPT_LIMIT = 30; // 判断时最多看最近多少条
const LINE_MAX = 120; // 每条最多取多少字

const TONES = new Set(['conflict', 'cold', 'happy']);

const toTime = (value) => {
  if (typeof value === 'number') return value;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

const clip = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);

const isIntroduced = (card) => card?.introducedBy !== null && card?.introducedBy !== undefined;

// ====== 判断 ======
const buildJudgePrompt = ({ transcript, nameA, nameB }) => `下面是「${nameA}」和「${nameB}」最近的一段聊天。你是一个只在旁边隐约听到风声的人，不知道细节。
请判断这段聊天里，两个人之间有没有明显的情绪：
- conflict：明显的争吵、闹僵、互相不高兴；
- cold：明显变冷淡、敷衍、疏远；
- happy：明显很开心、很投缘、关系变近；
- calm：其余的一切，包括普通闲聊、互相问候、小打小闹，拿不准就一律算 calm。

聊天：
${transcript}

如果不是 calm，再写一句模糊的话 text，描述“这两个人最近的状态”：
- ${FRIEND_RUMOR_TEXT_MAX} 字以内，以“最近”开头，不写主语，例如“最近好像闹得有点僵”；
- 只写感觉，不写具体事件、话题、原话，不出现人名；
- 不要出现 AI、系统、模型之类的字眼。

只输出一个 JSON 对象，不要 Markdown，不要多余的话：
{"tone":"calm|conflict|cold|happy","text":""}`;

const parseJudge = (raw) => {
  const text = String(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let obj;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  const tone = String(obj?.tone || '').trim().toLowerCase();
  if (!TONES.has(tone)) return { tone: 'calm', text: '' };

  const line = String(obj?.text || '').trim().slice(0, FRIEND_RUMOR_TEXT_MAX);
  if (!line) return { tone: 'calm', text: '' };
  return { tone, text: line };
};

// 返回 { tone, text } 或 null（请求/解析失败）。
const judgeTone = async ({ transcript, nameA, nameB }) => {
  try {
    const raw = await generateResponse([
      { role: 'system', content: buildJudgePrompt({ transcript, nameA, nameB }) },
      { role: 'user', content: '请开始。' },
    ]);
    return parseJudge(raw);
  } catch (error) {
    console.warn('[FriendRumor] 判断失败，这次不留风声：', error);
    return null;
  }
};

const inFlight = new Set();

// ====== 退出朋友聊天页：给介绍人的风声 ======
export const makeRumorAfterFriendChat = async (ref) => {
  const key = `after:${ref?.id}`;
  if (!ref?.id || inFlight.has(key)) return false;
  inFlight.add(key);

  try {
    const card = await getFriendCard(ref);
    if (!card || !isIntroduced(card)) return false;

    const since = Number(card.rumorFriendChatCheckedAt || 0);
    const fresh = (await getRecentFriendMessages(ref.id, TRANSCRIPT_LIMIT * 2)).filter(
      (row) => toTime(row.timestamp) > since,
    );
    if (fresh.length < FRIEND_RUMOR_MIN_MESSAGES) return false;

    const character = await db.characters.get(Number(card.introducedBy));
    if (!character) return false;

    const friendName = card.realName || card.alias || '朋友';
    const transcript = fresh
      .slice(-TRANSCRIPT_LIMIT)
      .map((row) => `${row.sender === 'user' ? '用户' : friendName}：${clip(row.content, LINE_MAX)}`)
      .join('\n');

    const verdict = await judgeTone({ transcript, nameA: '用户', nameB: friendName });
    if (!verdict) return false; // 判断失败：不推进进度，下次退出时再试

    const patch = { rumorFriendChatCheckedAt: toTime(fresh[fresh.length - 1].timestamp) };
    if (verdict.tone !== 'calm') {
      patch.rumorToIntroducer = { text: verdict.text, tone: verdict.tone, createdAt: Date.now() };
    }
    await updateFriendCard(ref, patch);
    return verdict.tone !== 'calm';
  } catch (error) {
    console.warn('[FriendRumor] 生成给介绍人的风声失败：', error);
    return false;
  } finally {
    inFlight.delete(key);
  }
};

// ====== 打开朋友聊天页：给朋友的风声 ======
export const refreshRumorAboutIntroducer = async (ref) => {
  const key = `intro:${ref?.id}`;
  if (!ref?.id || inFlight.has(key)) return false;
  inFlight.add(key);

  try {
    const card = await getFriendCard(ref);
    if (!card || !isIntroduced(card)) return false;

    const character = await db.characters.get(Number(card.introducedBy));
    if (!character) return false;

    const chats = await db.chats.where('characterId').equals(Number(character.id)).toArray();
    if (chats.length === 0) return false;
    const chat = chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

    const since = Number(card.introducerChatCheckedAt || card.acceptedAt || 0);
    const rows = await db.messages
      .where('[chatId+timestamp]')
      .between([chat.id, Dexie.minKey], [chat.id, Dexie.maxKey])
      .reverse()
      .limit(TRANSCRIPT_LIMIT * 3)
      .toArray();

    const fresh = rows
      .reverse()
      .filter((row) => row.type === 'text' && row.content && toTime(row.timestamp) > since);
    if (fresh.length < FRIEND_RUMOR_MIN_MESSAGES) return false;

    const userName = String(chat.userName || '用户').trim();
    const introducerName = character.name || '介绍人';
    const transcript = fresh
      .slice(-TRANSCRIPT_LIMIT)
      .map((row) => `${row.sender === 'user' ? userName : introducerName}：${clip(row.content, LINE_MAX)}`)
      .join('\n');

    const verdict = await judgeTone({ transcript, nameA: userName, nameB: introducerName });
    if (!verdict) return false;

    const patch = { introducerChatCheckedAt: toTime(fresh[fresh.length - 1].timestamp) };
    if (verdict.tone !== 'calm') {
      patch.rumorToFriend = { text: verdict.text, tone: verdict.tone, createdAt: Date.now() };
    }
    await updateFriendCard(ref, patch);
    return verdict.tone !== 'calm';
  } catch (error) {
    console.warn('[FriendRumor] 生成给朋友的风声失败：', error);
    return false;
  } finally {
    inFlight.delete(key);
  }
};

export default { makeRumorAfterFriendChat, refreshRumorAboutIntroducer };
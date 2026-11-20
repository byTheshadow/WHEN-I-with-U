// src/apps/messages/friends/friendCheckinService.js
//
// 好友申请 · 切片 F：用户很久没找某位角色时，这位角色的一位朋友以化名来打个招呼。
// 用户每次打开消息页，本地判断哪些角色"久未联系"，有候选就按 FRIEND_CHECKIN_CHANCE 掷一次，
// 掷中后随机挑一位，在后台生成一封申请（挂在这位角色身上，source: 'checkin'），红点随后亮起。
// 没有定时器，不阻塞页面；接口没配 / 失败就用本地备用名单，不报错给用户。
//
// 判断"久未联系"：只看 db.messages 里该角色聊天中最近一条 sender === 'user' 且 type === 'text' 的消息，
// 不用 chats.updatedAt（好友申请自己的提示行会刷新它）。取不到就当没聊过，不触发。
//
// 同一段沉默期只来一次：角色身上记 friendCheckinMeta = { lastCheckinAt, lastCheckinSilenceSince }，
// 只有用户之后又找过 TA（最近一条消息晚于 lastCheckinSilenceSince）才允许再来一次。
// friendCheckinMeta 是新的不建索引字段，不升 db 版本。
//
// 只依赖 db / friendRequestService / friendRequestAiService，不 import aiService。

import db from '../../../db';
import Dexie from 'dexie';
import {
  canCharacterIntroduce,
  createFriendRequest,
  isFriendIntroEnabled,
} from './friendRequestService';
import { parseDraft, pickFallback } from './friendRequestAiService';

// 多久没找 TA 算"久未联系"（想调手感只改这里）。
export const FRIEND_CHECKIN_IDLE_MS = 3 * 24 * 60 * 60 * 1000;
// 有候选角色时，每次打开消息页来一封的概率。
export const FRIEND_CHECKIN_CHANCE = 0.3;
export const FRIEND_CHECKIN_SOURCE = 'checkin';
export const FRIEND_CHECKIN_REASON = '久未联系';

const REQUEST_TIMEOUT_MS = 45000;
let running = false;

// 本地备用名单用的问候（接口没配 / 失败时替换备用名单里的陌生人开场白）。
const FALLBACK_GREETINGS = [
  '听说你最近有点忙，来打个招呼。',
  '好久没你的消息了，过来看看。',
  '路过，顺便问候一下你。',
  '最近还好吗？想认识一下你。',
];

const buildPrompt = ({ character, userName, usedNames, idleDays }) => `你要为一部陪伴类应用虚构一位“角色的朋友”。
用户「${userName}」已经大约 ${idleDays} 天没有找角色「${character.name}」聊天了。${character.name}有点惦记，让自己的一位朋友以陌生人的身份去加用户好友，打个招呼，看看用户最近怎么样。

【角色设定】
- 姓名：${character.name}
- 人设：${character.bio || '无'}
- 补充设定：${character.extraNotes || '无'}

【已经用过的名字，不要重复】
${usedNames.length > 0 ? usedNames.join('、') : '（无）'}

请创造这位朋友，并且遵守：
1. 这位朋友不是${character.name}，是另一个独立的人：性格、说话方式必须和${character.name}明显不同，不要复制${character.name}的口头禅。
2. alias 是对方申请时用的化名或昵称，可以和真实姓名相同；realName 是真实姓名。
3. openingLine 是对方在申请里写的一句话，带一点问候，可以淡淡暗示有人惦记着用户，但不要点明是谁，不要提到${character.name}的名字，20 字以内。
4. relation 写对方和${character.name}是什么关系、怎么认识的，一两句话。
5. personality 写性格，speechStyle 写说话风格，各一两句话。
6. 不要出现 AI、系统、模型、角色扮演之类的字眼。

只输出一个 JSON 对象，不要 Markdown，不要多余的话：
{"alias":"","openingLine":"","realName":"","relation":"","personality":"","speechStyle":""}`;

const extractText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  }
  return '';
};

const requestDraft = async (promptArgs) => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: buildPrompt(promptArgs) },
          { role: 'user', content: '请开始。' },
        ],
        temperature: 0.9,
        max_tokens: 600,
      }),
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return parseDraft(extractText(data?.choices?.[0]?.message?.content));
  } catch (error) {
    console.warn('[FriendCheckin] 生成朋友失败，改用备用名单：', error);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// 这位角色的所有聊天里，用户最近一条文本消息的时间；取不到返回 0。
const getLastUserTextAt = async (characterId) => {
  const chats = await db.chats.where('characterId').equals(Number(characterId)).toArray();
  let latest = 0;
  for (const chat of chats) {
    const row = await db.messages
      .where('[chatId+timestamp]')
      .between([chat.id, Dexie.minKey], [chat.id, Dexie.maxKey])
      .reverse()
      .filter((m) => m.sender === 'user' && m.type === 'text')
      .first();
    if (row?.timestamp > latest) latest = row.timestamp;
  }
  return latest;
};

// 是否算候选。force 时跳过"多久没联系"和"同一段沉默期只来一次"（仍要求用户找过 TA、名额够）。
const evaluateCandidate = async (character, globalEnabled, now, force) => {
  if (character.isWorkAssistant === true) return null;
  if (!canCharacterIntroduce(character, globalEnabled, now)) return null;

  const lastUserAt = await getLastUserTextAt(character.id);
  if (!lastUserAt) return null;

  if (!force) {
    if (now - lastUserAt < FRIEND_CHECKIN_IDLE_MS) return null;
    const since = character.friendCheckinMeta?.lastCheckinSilenceSince || 0;
    if (since && lastUserAt <= since) return null;
  }
  return { character, lastUserAt };
};

/**
 * 打开消息页时调一次。返回 true 表示这次真的写入了一封新申请（调用方可以刷新红点，并跳过"自己来的"）。
 * force: 测试用，跳过概率、"多久没联系"和沉默期判断（总开关、名额、用户找过 TA 仍要满足）。
 */
export const maybeCheckinFriendRequest = async ({ force = false } = {}) => {
  if (running) return false;
  running = true;

  try {
    if (!(await isFriendIntroEnabled())) return false;

    const now = Date.now();
    const characters = await db.characters.toArray();
    const checked = await Promise.all(characters.map((c) => evaluateCandidate(c, true, now, force)));
    const candidates = checked.filter(Boolean);
    if (candidates.length === 0) return false;

    if (!force && Math.random() >= FRIEND_CHECKIN_CHANCE) return false;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const { character, lastUserAt } = pick;

    const chat = (await db.chats.where('characterId').equals(Number(character.id)).toArray()).find(
      (c) => c.userName,
    );
    const userName = String(chat?.userName || character.userName || '用户').trim();
    const usedNames = [
      ...new Set(
        (character.friendRequests || []).flatMap((r) => [r.alias, r.hidden?.realName]).filter(Boolean),
      ),
    ];
    const idleDays = Math.max(1, Math.round((now - lastUserAt) / (24 * 60 * 60 * 1000)));

    let draft = await requestDraft({ character, userName, usedNames, idleDays });
    if (draft && (usedNames.includes(draft.alias) || usedNames.includes(draft.hidden.realName))) {
      draft = null;
    }
    if (!draft) {
      const fb = pickFallback(new Set(usedNames));
      draft = {
        ...fb,
        openingLine: FALLBACK_GREETINGS[Math.floor(Math.random() * FALLBACK_GREETINGS.length)],
        hidden: {
          ...fb.hidden,
          relation: `是${character.name}的朋友。${fb.hidden?.relation || ''}`.slice(0, 120),
        },
      };
    }

    // 写入前用最新的角色记录再确认一次（生成期间用户可能已经处理 / 关了开关 / 又找了 TA）。
    const [fresh, stillEnabled] = await Promise.all([
      db.characters.get(Number(character.id)),
      isFriendIntroEnabled(),
    ]);
    if (!fresh || !stillEnabled || !canCharacterIntroduce(fresh, true)) return false;

    const request = await createFriendRequest(
      { type: 'character', id: character.id },
      { ...draft, introReason: FRIEND_CHECKIN_REASON, source: FRIEND_CHECKIN_SOURCE },
    );
    if (!request) return false;

    await db.characters.update(Number(character.id), {
      friendCheckinMeta: { lastCheckinAt: Date.now(), lastCheckinSilenceSince: lastUserAt },
    });
    return true;
  } catch (error) {
    console.warn('[FriendCheckin] 这一轮失败，已跳过：', error);
    return false;
  } finally {
    running = false;
  }
};

export default {
  maybeCheckinFriendRequest,
  FRIEND_CHECKIN_IDLE_MS,
  FRIEND_CHECKIN_CHANCE,
};
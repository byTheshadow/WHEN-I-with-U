// src/apps/messages/friends/friendRequestAiService.js
//
// 角色在聊天里写了 [FRIEND_INTRO] 之后，回复写入完成、aiService.js 动态 import 本文件
// 并调用 runFriendIntroSession：单独再调用一次模型，生成"来加你的这位朋友"（化名、
// 一句开场白、隐藏的真实身份），写成一封好友申请，并在聊天里留一条提示行。
//
// 约定：
//   - 不阻塞角色的那次回复；失败不报错给用户，直接用本地备用名单兜底；
//   - 申请写入和聊天提示行是同时出现的，所以红点亮的时候提示行也在；
//   - 直接对 db.settings 里的 apiConfig 发请求，不 import aiService（避免循环依赖）。

import Dexie from 'dexie';
import db from '../../../db';
import {
  canCharacterIntroduce,
  createFriendRequest,
  isFriendIntroEnabled,
} from './friendRequestService';

export const FRIEND_INTRO_MESSAGE_TYPE = 'friend_intro_notice';

const HISTORY_LIMIT = 10;
const HISTORY_LINE_MAX = 120;
const REQUEST_TIMEOUT_MS = 45000;

// 同一位角色同一时间只跑一个生成，避免连续两次回复都带标签时重复写两封。
const inFlight = new Set();

// ====== 本地备用名单（接口没配 / 请求失败 / 解析失败时用） ======
const FALLBACK_ROSTER = [
  {
    alias: '阿遥',
    openingLine: '听说你，想认识一下。',
    hidden: { realName: '周遥', relation: '多年的老朋友，毕业后一直保持联系。', personality: '话不多，但很会观察，嘴上不饶人。', speechStyle: '短句、爱用反问，偶尔冒出一句冷幽默。' },
  },
  {
    alias: '何老师',
    openingLine: '常听人提起你，我也想打个招呼。',
    hidden: { realName: '何柏', relation: '以前的同事，现在偶尔一起吃饭。', personality: '稳重，爱照顾人，有点爱操心。', speechStyle: '说话慢，爱用“嗯，我想想”开头。' },
  },
  {
    alias: '岚',
    openingLine: '路过这里，觉得你应该是个有趣的人。',
    hidden: { realName: '岚', relation: '在街角认识的熟人。', personality: '随性，好奇心重，坐不住。', speechStyle: '口语化，爱用感叹句，语速很快。' },
  },
  {
    alias: '小满',
    openingLine: '嗨，我是被拉进来的，请多关照。',
    hidden: { realName: '林满', relation: '邻居家的孩子，现在已经长大了。', personality: '热情，爱笑，有点冒失。', speechStyle: '语气词多，爱用“哈哈”和感叹号。' },
  },
  {
    alias: '沈先生',
    openingLine: '冒昧打扰，想认识一下。',
    hidden: { realName: '沈既白', relation: '常去同一家店的熟客。', personality: '克制礼貌，内里很细腻。', speechStyle: '措辞书面，从不说脏话。' },
  },
];

const pickFallback = (usedNames) => {
  const free = FALLBACK_ROSTER.filter(
    (item) => !usedNames.has(item.alias) && !usedNames.has(item.hidden.realName),
  );
  const pool = free.length > 0 ? free : FALLBACK_ROSTER;
  return pool[Math.floor(Math.random() * pool.length)];
};

// ====== 取近期聊天（只做背景，让生成的朋友跟聊天内容搭得上） ======
const getRecentHistoryText = async (chatId, character) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(HISTORY_LIMIT)
    .toArray();

  return rows
    .reverse()
    .filter((row) => row.type === 'text' && row.content)
    .map((row) => {
      const who = row.sender === 'user' ? '用户' : character?.name || '角色';
      return `${who}：${String(row.content).replace(/\s+/g, ' ').slice(0, HISTORY_LINE_MAX)}`;
    })
    .join('\n');
};

// ====== 提示词 ======
const buildPrompt = ({ character, userName, reason, historyText, usedNames }) => `你要为一部陪伴类应用虚构一位“角色的朋友”。
角色「${character.name}」想把自己的一位朋友介绍给用户「${userName}」认识，这位朋友会以陌生人的身份发来一条好友申请。

【介绍人设定】
- 姓名：${character.name}
- 人设：${character.bio || '无'}
- 补充设定：${character.extraNotes || '无'}
- 介绍的理由：${reason || '（没有写明）'}

【最近的聊天（只作背景）】
${historyText || '（暂时没有聊天记录）'}

【已经用过的名字，不要重复】
${usedNames.length > 0 ? usedNames.join('、') : '（无）'}

请创造这位朋友，并且遵守：
1. 这位朋友不是${character.name}，是另一个独立的人：性格、说话方式必须和${character.name}明显不同，不要复制介绍人的口头禅。
2. alias 是对方申请时用的化名或昵称，可以和真实姓名相同；realName 是真实姓名。
3. openingLine 是对方在申请里写的一句话，像陌生人打招呼，20 字以内，不要透露真实身份，不要提到介绍人的名字。
4. relation 写对方和${character.name}是什么关系、怎么认识的，一两句话。
5. personality 写性格，speechStyle 写说话风格，各一两句话。
6. 不要出现 AI、系统、模型、角色扮演之类的字眼。

只输出一个 JSON 对象，不要 Markdown，不要多余的话：
{"alias":"","openingLine":"","realName":"","relation":"","personality":"","speechStyle":""}`;

// ====== 请求 + 解析 ======
const extractText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  }
  return '';
};

const parseDraft = (text) => {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let obj;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }

  const pick = (key) => String(obj?.[key] || '').trim();
  const alias = pick('alias');
  const realName = pick('realName');
  const openingLine = pick('openingLine');
  if (!alias || !openingLine) return null;

  return {
    alias: alias.slice(0, 20),
    openingLine: openingLine.slice(0, 60),
    hidden: {
      realName: (realName || alias).slice(0, 20),
      relation: pick('relation').slice(0, 120),
      personality: pick('personality').slice(0, 120),
      speechStyle: pick('speechStyle').slice(0, 120),
    },
  };
};

const requestDraft = async ({ character, userName, reason, historyText, usedNames }) => {
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
          { role: 'system', content: buildPrompt({ character, userName, reason, historyText, usedNames }) },
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
    console.warn('[FriendRequestAi] 生成朋友失败，改用备用名单：', error);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// ====== 聊天提示行 ======
const insertIntroNotice = async ({ chatId, character, request }) => {
  const timestamp = Date.now();
  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: FRIEND_INTRO_MESSAGE_TYPE,
    content: `${character.name}介绍了一位朋友，可在 + 里查看`,
    metadata: { requestId: request.id },
    isRead: true,
    timestamp,
  });
  await db.chats.update(chatId, { updatedAt: timestamp });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
    window.dispatchEvent(new CustomEvent('friend-requests-changed'));
  }
};

// ====== 入口 ======
export const runFriendIntroSession = async ({ chatId, character, triggerReply, reason }) => {
  const characterId = character?.id;
  if (!chatId || characterId == null) return { created: false };
  if (inFlight.has(characterId)) return { created: false, reason: 'busy' };
  inFlight.add(characterId);

  try {
    // 回复写入期间状态可能变了（开关、名额），用最新的角色记录再判断一次。
    const [fresh, globalEnabled] = await Promise.all([
      db.characters.get(Number(characterId)),
      isFriendIntroEnabled(),
    ]);
    if (!fresh || !canCharacterIntroduce(fresh, globalEnabled)) {
      return { created: false, reason: 'no-quota' };
    }

    const chat = await db.chats.get(chatId);
    const userName = String(chat?.userName || fresh.userName || '用户').trim();
    const usedNames = [
      ...new Set(
        (fresh.friendRequests || []).flatMap((r) => [r.alias, r.hidden?.realName]).filter(Boolean),
      ),
    ];

    let historyText = '';
    try {
      historyText = await getRecentHistoryText(chatId, fresh);
    } catch (error) {
      console.warn('[FriendRequestAi] 读取最近聊天失败，改用空历史：', error);
    }

    const introReason = reason || String(triggerReply || '').slice(0, 60);
    let draft = await requestDraft({
      character: fresh,
      userName,
      reason: introReason,
      historyText,
      usedNames,
    });

    // 模型偶尔会重名，撞了就换成备用名单里没用过的。
    if (draft && (usedNames.includes(draft.alias) || usedNames.includes(draft.hidden.realName))) {
      draft = null;
    }
    if (!draft) draft = pickFallback(new Set(usedNames));

    const request = await createFriendRequest(
      { type: 'character', id: characterId },
      { ...draft, introReason: reason || '' },
    );
    if (!request) return { created: false };

    await insertIntroNotice({ chatId, character: fresh, request });
    return { created: true, requestId: request.id };
  } catch (error) {
    console.warn('[FriendRequestAi] 介绍朋友这一轮失败，已跳过：', error);
    return { created: false };
  } finally {
    inFlight.delete(characterId);
  }
};

export default { runFriendIntroSession, FRIEND_INTRO_MESSAGE_TYPE };
// src/apps/messages/friends/friendWanderService.js
//
// 好友申请 · 切片 B2：朋友"自己来"（没有介绍人）。
// 用户每次打开消息页，按 FRIEND_WANDER_CHANCE 的概率掷一次；掷中、总开关开、全局名额够，
// 就在后台生成一位陌生人写成申请（标签「自己来的」），红点随后亮起。
// 没有定时器，不阻塞页面；接口没配 / 失败就用本地备用名单，不报错给用户。
//
// 只依赖 db / friendRequestService / friendRequestAiService，不 import aiService。

import db from '../../../db';
import {
  createFriendRequest,
  getGlobalFriendState,
  hasFriendQuota,
  isFriendIntroEnabled,
} from './friendRequestService';
import { parseDraft, pickFallback } from './friendRequestAiService';

// 每次打开消息页，有多大概率来一封"自己来的"（想调手感只改这里）。
export const FRIEND_WANDER_CHANCE = 0.15;

const REQUEST_TIMEOUT_MS = 45000;
let running = false;

const buildPrompt = ({ userName, characterNames, usedNames }) => `你要为一部陪伴类应用虚构一位“自己来加用户好友的陌生人”。
这个人听说过用户「${userName}」（也许是通过用户身边的角色：${characterNames.length > 0 ? characterNames.join('、') : '暂无'}，也许只是偶然路过），想认识一下。

【已经用过的名字，不要重复】
${usedNames.length > 0 ? usedNames.join('、') : '（无）'}

请创造这个人，并且遵守：
1. alias 是对方申请时用的化名或昵称，可以和真实姓名相同；realName 是真实姓名。
2. openingLine 是对方在申请里写的一句话，像陌生人打招呼，20 字以内，不要透露真实身份。
3. relation 写对方是谁、为什么会注意到用户（可以和上面的角色有关，也可以无关），一两句话。
4. personality 写性格，speechStyle 写说话风格，各一两句话。
5. 不要出现 AI、系统、模型、角色扮演之类的字眼。

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
    console.warn('[FriendWander] 生成陌生人失败，改用备用名单：', error);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * 打开消息页时调一次。返回 true 表示这次真的写入了一封新申请（调用方可以刷新红点）。
 * force: 测试用，跳过概率判断（名额和总开关仍然要满足）。
 */
export const maybeWanderFriendRequest = async ({ force = false } = {}) => {
  if (running) return false;
  running = true;

  try {
    if (!force && Math.random() >= FRIEND_WANDER_CHANCE) return false;
    if (!(await isFriendIntroEnabled())) return false;

    const state = await getGlobalFriendState();
    if (!hasFriendQuota(state)) return false;

    const [characters, chats] = await Promise.all([db.characters.toArray(), db.chats.toArray()]);
    const userName = String(chats.find((c) => c.userName)?.userName || '用户').trim();
    const characterNames = characters
      .filter((c) => c.isWorkAssistant !== true && c.name)
      .map((c) => c.name)
      .slice(0, 5);
    const usedNames = [
      ...new Set(state.requests.flatMap((r) => [r.alias, r.hidden?.realName]).filter(Boolean)),
    ];

    let draft = await requestDraft({ userName, characterNames, usedNames });
    if (draft && (usedNames.includes(draft.alias) || usedNames.includes(draft.hidden.realName))) {
      draft = null;
    }
    if (!draft) draft = pickFallback(new Set(usedNames));

    // 写入前再确认一次名额（生成期间用户可能已经处理 / 关了开关）。
    if (!(await isFriendIntroEnabled()) || !hasFriendQuota(await getGlobalFriendState())) {
      return false;
    }

    const request = await createFriendRequest({ type: 'global' }, { ...draft, introReason: '' });
    return Boolean(request);
  } catch (error) {
    console.warn('[FriendWander] 这一轮失败，已跳过：', error);
    return false;
  } finally {
    running = false;
  }
};

export default { maybeWanderFriendRequest, FRIEND_WANDER_CHANCE };
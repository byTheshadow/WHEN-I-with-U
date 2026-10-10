// src/apps/messages/screenEffects/screenEffectSession.js
//
// 角色在正常回复里写了 [SCREEN_WANT] 之后，立刻补的那一次单独调用。
// 氛围预设名单和"暗号"的完整规则只在这里出现，平时的主聊天提示词里
// 只有一小段说明。写法跟 bubbleStyleSession.js 一样：直接 fetch 到
// db.settings 里的 apiConfig，不经过 aiService.js（避免循环依赖），
// 失败一律静默，不影响已经写入的正常回复。
//
// 角色在这里二选一：
//   接受：用户最近的消息里已经说了暗号，角色回一句含同一暗号的话 ->
//         代码核对用户消息和这句话里都有暗号 -> 插入这句话并立刻播放。
//   邀请：角色自拟一句暗号并发出邀请 -> 代码核对邀请里确实含暗号 ->
//         插入邀请并记为待接，用户之后说出暗号时由
//         consumePendingScreenEffect 播放。

import Dexie from 'dexie';
import db from '../../../db';
import { AMBIENT_PRESETS, getAmbientPresetByName } from './screenEffectPresets';
import {
  MAX_PHRASE_CHARS,
  MIN_PHRASE_CHARS,
  dispatchScreenEffect,
  normalizeForMatch,
  textsContainPhrase,
} from './screenEffectDirective';

const HISTORY_LIMIT = 8;
const HISTORY_LINE_MAX = 120;
const MAX_SAY_CHARS = 60;
const MAX_CAPTION_CHARS = 28;

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', { detail: { chatId } }),
  );
};

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
      const who = row.sender === 'user' ? '用户' : (character?.name || '你');
      return `${who}：${String(row.content).replace(/\s+/g, ' ').slice(0, HISTORY_LINE_MAX)}`;
    })
    .join('\n');
};

const buildSessionPrompt = ({ character, historyText, triggerReply, userTexts, pending }) => {
  const presetGuide = AMBIENT_PRESETS
    .map((preset) => `- ${preset.name}：${preset.desc}`)
    .join('\n');

  const userBlock = userTexts.length > 0
    ? userTexts.slice().reverse().map((text) => `- ${String(text).replace(/\s+/g, ' ').slice(0, HISTORY_LINE_MAX)}`).join('\n')
    : '（没有）';

  const pendingLine = pending
    ? `\n你之前已经邀请过用户说暗号"${pending.phrase}"，TA还没说。这次如果你选择邀请，会替换掉那一条。\n`
    : '';

  return `你正在扮演角色：${character?.name || '角色'}。

角色设定：
${String(character?.bio || '无').slice(0, 800)}

补充设定：
${String(character?.extraNotes || '无').slice(0, 400)}

你刚才在和用户聊天时，表示想用一场全屏氛围动画。这种动画需要"暗号"：必须你和用户都说出同一句暗号才会播放，这是你们之间的小默契。现在请你决定怎么做。

最近的聊天：
${historyText || '（暂无）'}

你刚才说的这句话：${String(triggerReply || '').slice(0, 200)}

用户最近还没被回复的消息：
${userBlock}
${pendingLine}
可选的氛围（名字照抄，不要自己编）：
${presetGuide}

二选一：
A. 接受：用户的消息里已经说了一句明显是暗号的话（比如"下雪吧"），你想接。暗号就是用户消息里原样出现的那句话。
B. 邀请：用户还没说暗号，你想给TA一个小惊喜，自己想一句暗号并邀请TA也说一遍。

规则：
- 暗号是 ${MIN_PHRASE_CHARS} 到 ${MAX_PHRASE_CHARS} 个字的短语，不要用日常聊天里很容易撞上的词。
- 选择接受时，暗号必须是用户消息里一字不差出现过的；选择邀请时，暗号由你自拟。
- 你说的这一句话（SAY）必须原样包含暗号，口吻符合你的性格，${MAX_SAY_CHARS} 个字以内，不要用 Emoji。接受时，这句话就是你回应暗号的话；邀请时，这句话就是你发出的邀请。
- 氛围可以带一行小字（CAPTION，${MAX_CAPTION_CHARS} 个字以内，是你想对用户说的一句话）。落樱、萤火、暖炉微光有默认的小字，不写就用默认的；其它氛围不写就没有小字。

严格按下面的标签格式输出，不要有任何多余的话、不要加代码块围栏：
[MODE: 接受 或 邀请]
[PRESET: 氛围名]
[PHRASE: 暗号]
[SAY: 你说的那一句话]
[CAPTION: 可选的小字，不写就整行省略]

例子：
[MODE: 邀请]
[PRESET: 落樱]
[PHRASE: 等一场花落]
[SAY: 想给你看点好看的，如果你愿意，对我说一句"等一场花落"。]
[CAPTION: 花落的时候，风也很温柔。]`;
};

const callModel = async (systemPrompt) => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请按照上面的要求执行。' },
      ],
      temperature: 0.9,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
};

const readTag = (text, tagName) => {
  const match = new RegExp(`\\[${tagName}:\\s*([^\\]]*)\\]`, 'i').exec(text);
  return match ? match[1].trim() : '';
};

const insertCharacterText = async ({ chatId, character, content }) => {
  const nowIso = new Date().toISOString();

  await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'text',
    content,
    metadata: {},
    versions: [{ type: 'text', content, metadata: {}, timestamp: nowIso }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: nowIso,
  });

  await db.chats.update(chatId, { updatedAt: nowIso });
};

/*
 * userTexts：触发这次回复的、用户还没被回复的消息（由调用方在角色回复写入
 * 之前取好——写入之后"最后一条角色消息"就变了，再取就取不到了）。
 */
export const runScreenEffectSession = async ({
  chatId,
  character,
  triggerReply,
  userTexts = [],
}) => {
  try {
    if (!chatId || !character) return { applied: false };

    const chat = await db.chats.get(chatId);
    if (!chat) return { applied: false };

    const historyText = await getRecentHistoryText(chatId, character);
    const prompt = buildSessionPrompt({
      character,
      historyText,
      triggerReply,
      userTexts,
      pending: chat.pendingScreenEffect || null,
    });

    const rawText = await callModel(prompt);
    if (!rawText) return { applied: false };

    const mode = readTag(rawText, 'MODE');
    const preset = getAmbientPresetByName(readTag(rawText, 'PRESET'));
    const phrase = readTag(rawText, 'PHRASE');
    const say = readTag(rawText, 'SAY').slice(0, MAX_SAY_CHARS);
    const customCaption = readTag(rawText, 'CAPTION').slice(0, MAX_CAPTION_CHARS);

    const normalizedPhrase = normalizeForMatch(phrase);
    if (!preset || !say) return { applied: false };
    if (normalizedPhrase.length < MIN_PHRASE_CHARS || normalizedPhrase.length > MAX_PHRASE_CHARS) {
      return { applied: false };
    }

    // 角色这句话里必须真的说了暗号
    if (!normalizeForMatch(say).includes(normalizedPhrase)) return { applied: false };

    const caption = customCaption || preset.defaultCaption || '';
    const isAccept = mode.includes('接');

    if (isAccept) {
      // 用户那边也必须真的说了
      if (!textsContainPhrase(userTexts, phrase)) return { applied: false };

      await insertCharacterText({ chatId, character, content: say });
      await db.chats.update(chatId, { pendingScreenEffect: null });
      dispatchLocalMessageEvent(chatId);
      dispatchScreenEffect(chatId, { kind: 'preset', presetId: preset.id, caption });
      return { applied: true, mode: 'accept' };
    }

    await insertCharacterText({ chatId, character, content: say });
    await db.chats.update(chatId, {
      pendingScreenEffect: {
        presetId: preset.id,
        phrase,
        caption,
        createdAt: new Date().toISOString(),
      },
    });
    dispatchLocalMessageEvent(chatId);
    return { applied: true, mode: 'invite' };
  } catch (error) {
    console.warn('[ScreenEffectSession] 氛围特效这一轮失败，已跳过：', error);
    return { applied: false };
  }
};
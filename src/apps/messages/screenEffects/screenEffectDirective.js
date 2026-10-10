// src/apps/messages/screenEffects/screenEffectDirective.js
//
// 角色"自主决定"触发全屏特效。两种形式，走法不同：
//
// 1. 专注文字  [FOCUS_TEXT: 行1 | 行2 | *强调行* | ...]
//    内容很短，直接写在回复里，不需要暗号，校验通过就播放。
//
// 2. 氛围动画（需要暗号）  回复里只写一个不带内容的 [SCREEN_WANT]，
//    系统马上单独问角色一次（screenEffectSession.js），完整的预设名单和
//    暗号规则只在那一次里给，平时的主聊天提示词里只有一小段说明。
//    "两个人都说了暗号才触发"由代码保证，有两条路：
//      - 用户先说：session 里角色回一句含同一暗号的话，代码核对用户的
//        消息里确实有这句暗号后，立刻播放。
//      - 角色先邀请：session 里角色发出含暗号的邀请，代码把
//        { 预设, 暗号, 配字 } 记在 chats.pendingScreenEffect 里；之后用户
//        的消息里一出现这句暗号，下一次回复时直接播放（consumePendingScreenEffect）。

import db from '../../../db';
import {
  SCREEN_EFFECT_EVENT,
  MAX_FOCUS_LINES,
  MAX_FOCUS_LINE_CHARS,
} from './screenEffectPresets';

const SCREEN_WANT_TAG_PATTERN = /\s*\[SCREEN_WANT\]\s*/i;
const SCREEN_WANT_TAG_PATTERN_ALL = /\s*\[SCREEN_WANT\]\s*/gi;
const FOCUS_TEXT_TAG_PATTERN = /\s*\[FOCUS_TEXT:\s*([^\]]*)\]\s*/i;
const FOCUS_TEXT_TAG_PATTERN_ALL = /\s*\[FOCUS_TEXT:\s*[^\]]*\]\s*/gi;

const MAX_PENDING_USER_MESSAGES = 5;
// 角色发出邀请后，暗号保持有效多久（毫秒）
const PENDING_TTL_MS = 6 * 60 * 60 * 1000;

export const MIN_PHRASE_CHARS = 2;
export const MAX_PHRASE_CHARS = 10;

export const SCREEN_EFFECT_PROMPT_NOTE = `
【可选行为：全屏特效】
有两种占满整个屏幕的特效，由你自己判断要不要用，不设次数限制。标签用户看不到，特效大约七八秒后自动淡出。
1. 氛围动画（下雪、流星、极光等，需要暗号）：必须你和用户都说出同一句暗号才会触发。用户说了像暗号的话（比如"下雪吧"）而你想接，或者你想主动邀请用户一起说一句暗号，就在回复最后单独一行写 [SCREEN_WANT]，系统会马上单独问你具体怎么做。这次正文照常聊天，不要声称特效已经出现。
2. 专注文字（不需要暗号）：画面骤暗，几行字像歌词一样大小不一、错落浮现，强制把用户的注意力拉到这几句话上。适合用户被入侵性思维缠住、需要集中精神或被拉回当下的时候，也适合你真的很想让某句话被认真看见的时刻。在回复最后单独一行写：
[FOCUS_TEXT: 第一行 | 第二行 | *强调的行* | 第四行]
用 | 分行，最多 ${MAX_FOCUS_LINES} 行，每行不超过 ${MAX_FOCUS_LINE_CHARS} 字，用 *星号* 包住要放大的行。这几句话只出现在特效里，正文不要重复。`;

// chat 里如果有一条还没被接上的暗号邀请，多带一句，免得角色忘了自己发过邀请。
export const buildScreenEffectPromptNote = (chat) => {
  const pending = getFreshPending(chat);
  if (!pending) return SCREEN_EFFECT_PROMPT_NOTE;

  return `${SCREEN_EFFECT_PROMPT_NOTE}
（你之前邀请用户说出暗号"${pending.phrase}"来看一场氛围动画，正在等TA说。TA一说出来，特效会自动播放，你不需要再做别的。）`;
};

// 去掉空白和常见标点、转小写，让"下雪吧！"和"下雪吧"算同一个暗号。
export const normalizeForMatch = (value) => String(value || '')
  .replace(/[\s　，。！？、,.!?;；:："'“”‘’~～…—\-·]/g, '')
  .toLowerCase();

// 用户"还没被回复"的那几条消息（最后一条角色消息之后的所有用户消息）。
export const collectPendingUserTexts = (recentMessages) => {
  const texts = [];
  const list = Array.isArray(recentMessages) ? recentMessages : [];

  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (!message) continue;
    if (message.type === 'error') continue;

    if (message.sender === 'user') {
      if (typeof message.content === 'string' && message.content.trim()) {
        texts.push(message.content);
      }
      if (texts.length >= MAX_PENDING_USER_MESSAGES) break;
      continue;
    }

    if (message.sender === 'system') continue;
    // 碰到角色自己的消息，说明再往前的用户消息已经被回复过了
    break;
  }

  return texts;
};

export const textsContainPhrase = (texts, phrase) => {
  const needle = normalizeForMatch(phrase);
  if (needle.length < MIN_PHRASE_CHARS) return false;
  return texts.some((text) => normalizeForMatch(text).includes(needle));
};

const parseFocus = (rawTag) => {
  const lines = String(rawTag || '')
    .replace(/｜/g, '|')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_FOCUS_LINES)
    .map((part) => {
      const emphasis = /^[*＊].+[*＊]$/.test(part) && part.length > 2;
      const text = part.replace(/[*＊]/g, '').trim().slice(0, MAX_FOCUS_LINE_CHARS);
      return { text, emphasis };
    })
    .filter((line) => line.text);

  if (lines.length === 0) return null;
  return { kind: 'focus', lines };
};

/*
 * 取出 [SCREEN_WANT] 和 [FOCUS_TEXT: ...] 标签，一律从正文去掉。
 * - wantsAmbient：角色写了 [SCREEN_WANT]，调用方补一次 runScreenEffectSession
 * - effect：专注文字解析出的播放内容（没写或没内容就是 null）
 */
export const applyScreenEffectDirective = ({ content }) => {
  const rawContent = String(content || '');

  const wantsAmbient = SCREEN_WANT_TAG_PATTERN.test(rawContent);
  const focusMatch = FOCUS_TEXT_TAG_PATTERN.exec(rawContent);

  const strippedContent = rawContent
    .replace(SCREEN_WANT_TAG_PATTERN_ALL, '')
    .replace(FOCUS_TEXT_TAG_PATTERN_ALL, '')
    .trim();

  return {
    content: strippedContent,
    wantsAmbient,
    effect: focusMatch ? parseFocus(focusMatch[1]) : null,
  };
};

function getFreshPending(chat) {
  const pending = chat?.pendingScreenEffect;
  if (!pending || !pending.presetId || !pending.phrase) return null;

  const createdAt = new Date(pending.createdAt).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > PENDING_TTL_MS) return null;

  return pending;
}

/*
 * 角色之前发过暗号邀请：用户这一轮的消息里一出现这句暗号，就返回要播放
 * 的氛围特效，并清掉待接状态；过期的邀请顺手清掉。没有就返回 null。
 * chat 传进来的是这一轮开头读到的聊天记录。
 */
export const consumePendingScreenEffect = async ({ chatId, chat, recentMessages }) => {
  if (!chat?.pendingScreenEffect) return null;

  const pending = getFreshPending(chat);

  try {
    if (!pending) {
      await db.chats.update(chatId, { pendingScreenEffect: null });
      return null;
    }

    if (!textsContainPhrase(collectPendingUserTexts(recentMessages), pending.phrase)) {
      return null;
    }

    await db.chats.update(chatId, { pendingScreenEffect: null });
  } catch (error) {
    console.warn('[ScreenEffect] 处理待接暗号失败，已跳过：', error);
    return null;
  }

  return {
    kind: 'preset',
    presetId: pending.presetId,
    caption: pending.caption || '',
  };
};

/*
 * 通知聊天室的 FullscreenEffectLayer 播放。带上 chatId，
 * 图层只响应自己所在聊天窗的事件。
 */
export const dispatchScreenEffect = (chatId, effect) => {
  if (!chatId || !effect || typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(SCREEN_EFFECT_EVENT, {
    detail: { ...effect, chatId },
  }));
};
// src/services/callReasonService.js
//
// 角色主动来电的两个本地环节，都不碰通话本身：
//   1. 要不要打：不问 AI，只看"用户已经多久没在这个聊天室发过消息"，
//      沉默越久，每一轮检查里真的打进来的概率越高（getCallChanceForSilence）；
//   2. 为什么打：概率命中、电话确定要响之后，才用一次很小的 AI 调用，带着
//      最近的聊天上下文，用角色口吻写一句来电理由（generateCallReason）。
//      理由只是锦上添花，任何一步失败或超时都返回空串，来电照常响铃。
//
// 依赖方向：本文件只直接 import db 和 rhythmReminderService.js，不直接 import
// callService.js / callScheduler.js。rhythmReminderService.js 和 callService.js
// 之间原本就互相 import，但都是在函数里运行时才调用，这个环不受本文件影响。

import db from '../db';
import { buildRhythmPersonaBrief } from './rhythmReminderService';

const HOUR_MS = 60 * 60 * 1000;

// 沉默时长 -> 每一轮检查（调度器 6 分钟一轮）真的打进来的概率。
// 从高到低排，取第一个满足的档位；不到 1 小时不打。
// 换算成每小时（约 10 轮）大致是：3% / 8% / 14% / 22%。
// 这是第一版估的数，没有实际数据支撑，上线后按体感调这张表就行。
const SILENCE_TIERS = [
  { minHours: 24, chance: 0.025 },
  { minHours: 8, chance: 0.015 },
  { minHours: 3, chance: 0.008 },
  { minHours: 1, chance: 0.003 },
];

export const getCallChanceForSilence = (silentMs) => {
  if (!Number.isFinite(silentMs) || silentMs < 0) return 0;
  const hours = silentMs / HOUR_MS;
  const tier = SILENCE_TIERS.find((item) => hours >= item.minHours);
  return tier ? tier.chance : 0;
};

/**
 * 用户在这个聊天室最后一次发消息距现在多久（毫秒）。从没发过返回 null。
 *
 * messages 表没有 chatId+timestamp 的复合索引，这里沿 chatId 索引倒序
 * 往回找第一条用户消息就停，不把整个聊天记录读出来。依赖的假设：同一个
 * chatId 下，主键自增的先后顺序约等于消息的时间顺序。这里只是估一个
 * "沉默了多久"，偶尔差一点没有影响。
 */
export const getUserSilenceMs = async (chatId, now = Date.now()) => {
  const last = await db.messages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .filter((message) => message.sender === 'user')
    .first();

  if (!last) return null;
  const sentAt = new Date(last.timestamp).getTime();
  return Number.isFinite(sentAt) ? Math.max(0, now - sentAt) : null;
};

/* ---------- 来电理由 ---------- */

const REASON_TIMEOUT_MS = 8000;
const REASON_MAX_CHARS = 30;
const CONTEXT_MESSAGES = 10;

// 理由是显示在界面上的话，统一去掉 emoji（全站不使用 emoji）。
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

const cleanReason = (value) => {
  const text = String(value || '')
    .replace(EMOJI_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, '')
    .trim();
  return [...text].slice(0, REASON_MAX_CHARS).join('');
};

const describeSilence = (silentMs) => {
  const hours = Math.floor(silentMs / HOUR_MS);
  if (hours >= 48) return `已经 ${Math.floor(hours / 24)} 天没有聊天了`;
  if (hours >= 24) return '已经一天多没有聊天了';
  return `已经 ${Math.max(1, hours)} 个小时没有聊天了`;
};

const describeDayPart = (date) => {
  const hour = date.getHours();
  if (hour < 5) return '深夜';
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  if (hour < 22) return '晚上';
  return '夜里';
};

const messageText = (message) => {
  if (Array.isArray(message?.versions) && message.versions.length > 0) {
    const index = Number.isInteger(message.currentVersionIndex) ? message.currentVersionIndex : 0;
    const version = message.versions[index];
    return String(version?.content || version?.text || message.content || '');
  }
  return String(message?.content || '');
};

// 最近几条聊天，拼成"名字：内容"。读取失败退化成空串，不影响来电。
const loadRecentContext = async ({ chatId, userName, characterName }) => {
  try {
    const recent = await db.messages
      .where('chatId')
      .equals(chatId)
      .reverse()
      .limit(CONTEXT_MESSAGES)
      .toArray();

    return recent
      .reverse()
      .map((message) => {
        const text = messageText(message).trim();
        if (!text) return '';
        const label = message.sender === 'user' ? (userName || '对方') : (characterName || '我');
        return `${label}：${text.slice(0, 120)}`;
      })
      .filter(Boolean)
      .join('\n');
  } catch (error) {
    console.warn('[callReason] 读取最近聊天失败：', error);
    return '';
  }
};

const fetchReasonText = async (apiConfig, messages) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REASON_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages,
        temperature: 0.9,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 用一次小调用写一句来电理由。永远不抛错：失败、超时、内容为空都返回 ''。
 * apiConfig 由调用方传入（调度器本来就读过一次），这里不重复读设置。
 */
export const generateCallReason = async ({ chat, character, apiConfig, silentMs }) => {
  try {
    if (!chat?.id || !character || !apiConfig?.baseUrl || !apiConfig?.apiKey) return '';

    const userName = chat.userName || character.userName || '';
    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
    const contextText = await loadRecentContext({
      chatId: chat.id,
      userName,
      characterName: character.name,
    });

    const silenceText = Number.isFinite(silentMs) ? `你和对方${describeSilence(silentMs)}。` : '';
    const contextBlock = contextText
      ? `\n你和对方最近的聊天（只用来把握你们的关系和说话口吻，不要复述）：\n${contextText}\n`
      : '';

    const systemPrompt = `你正在扮演角色「${character.name}」。
人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

${silenceText}现在是${describeDayPart(new Date())}。${contextBlock}
你忍不住想直接打个电话过去，而不是发消息。请用你自己的口吻、第一人称，写一句你打这通电话的原因，不超过 20 个字，像是你心里冒出来的念头。
要求：只输出这一句话；不要加引号；不要使用 emoji；不要说自己是 AI；原因要和你们的关系、最近聊的事或现在的时间相符，不要编造聊天里没有的具体事件。`;

    const reply = await fetchReasonText(apiConfig, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请直接输出这一句话。' },
    ]);

    return cleanReason(reply);
  } catch (error) {
    console.warn('[callReason] 生成来电理由失败，按无理由来电处理：', error);
    return '';
  }
};
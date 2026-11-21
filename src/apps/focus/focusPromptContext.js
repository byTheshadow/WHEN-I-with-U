// src/apps/focus/focusPromptContext.js
//
// 生成拼接进 system prompt 的"用户正在专注"文字块，写法仿照
// locationPromptContext.js：任何失败都安全降级为空字符串，
// 绝不能因为专注状态阻断正常聊天。
//
// 只在"专注中"返回内容；缓冲期（专注已结束、主动消息还没恢复）不返回。
// 这个块只影响角色在被用户主动发消息时怎么回，主动消息本身是在入口处被直接拦掉的。

import db from '../../db';
import { getFocusMuteState } from './focusMuteState';

const MINUTE_MS = 60 * 1000;

const formatMinutes = (ms) => `${Math.max(1, Math.round(ms / MINUTE_MS))}分钟`;

export const buildFocusPromptText = (chat, now = new Date()) => {
  const state = getFocusMuteState(chat, now);

  if (!state.muted || !state.focusing) return '';

  const lines = ['', '', '【用户正在专注】'];

  const what = state.task ? `「${state.task}」` : '一件需要集中精力的事';
  const where = state.place ? `，地点是${state.place}` : '';

  lines.push(`用户事先告诉了你：现在要专注做${what}${where}。`);

  if (state.startedAt) {
    lines.push(`已经专注了${formatMinutes(now.getTime() - state.startedAt.getTime())}。`);
  }

  if (state.endsAt) {
    lines.push(`大约还有${formatMinutes(state.endsAt.getTime() - now.getTime())}结束。`);
  }

  lines.push(
    '他希望这段时间里不被打扰。请这样做：',
    '1. 如果他在这段时间里仍然给你发了消息，你可以回复，但要简短，一两句话就好，并轻轻提醒他现在正在专注，让他先忙。',
    '2. 不要追问他在做什么、做得怎么样，也不要要求他马上回应你。',
    '3. 他暂时没有回复是完全正常的，不要因此生气、失落，也不要抱怨被冷落。',
    '4. 不要主动开启新的话题，不要主动发起通话或邀约。',
  );

  return lines.join('\n');
};

export const getFocusPromptContext = async (chatId) => {
  try {
    const id = Number(chatId);

    if (!Number.isFinite(id)) return '';

    const chat = await db.chats.get(id);

    return buildFocusPromptText(chat);
  } catch (error) {
    console.warn('[focusPromptContext] 生成专注状态说明失败，已降级为空：', error);
    return '';
  }
};
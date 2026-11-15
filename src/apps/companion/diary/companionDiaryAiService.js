/*
 * "小伙伴"日记——唯一调用 AI 的一步：由重要事件触发时，让小伙伴用自己的
 * 第一人称口吻写一篇简短日记。
 *
 * 写法照抄 companionAiService.js 的 callCompanionAi（那边是角色自主照顾
 * 小伙伴时留的一句日志）：直接 fetch、读同一套 buildChatSystemPrompt
 * （保证小伙伴所在的世界观/角色人设背景一致），不带聊天历史、不写
 * db.messages、不走 triggerAiResponse。
 *
 * 之所以在这里重新写一份而不是直接 import companionAiService.js 里的
 * callCompanionAi：那个函数本身没有导出（只导出了组装好的
 * generateAutonomousCareNote），而且日记这里需要的 token 预算/措辞指引
 * 跟"自主照顾一句话"完全不同，分开两份反而更清楚，不算重复造轮子。
 *
 * 没配置 API、或者请求失败，一律返回 null，调用方退回本地兜底文案
 * （见 companionDiaryService.js 的 DIARY_FALLBACKS）。
 */

import db from '../../../db';
import { buildCompanionSystemPrompt as buildChatSystemPrompt } from '../../../services/companionSystemPrompt';

export const generateDiaryText = async ({ chatId, chat, character, companion, triggerLabel, triggerDetail }) => {
  if (!chatId || !chat || !character || !companion) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

    const guideText = `

【注意：这不是一句普通聊天，而是你正在以"${companion.name}"（你们共同养的小伙伴）自己的身份、自己的口吻写一篇私人日记】
刚刚发生的事：${triggerLabel}${triggerDetail ? `（${triggerDetail}）` : ''}。
请用小伙伴自己第一人称的语气（用"我"）写一篇简短日记（60-120字），口吻要像小朋友或小动物写日记：软萌、直白、带点撒娇和小心思，可以有一点点小得意或小委屈，可以写当时的心情、一些细节、小小的念头，
写感受和经过即可。
不要出现"系统"、"面板"、"程序"、"App"这类词，不要使用表情符号，不要加引号，不要署名，不要分点，写成一段自然的文字。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        temperature: 0.95,
        max_tokens: 260,
        messages: [
          { role: 'system', content: `${systemPrompt}${guideText}` },
          { role: 'user', content: '（写下今天的日记）' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    return text || null;
  } catch (error) {
    console.warn('[CompanionDiary] AI 日记生成失败，退回兜底文字:', error);
    return null;
  }
};
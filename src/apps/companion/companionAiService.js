/*
 * "小伙伴"里唯一还会调用 AI 的互动：角色自主照顾宠物时留下的日志一句话。
 *
 * 喂食/清洁/玩耍的即时反馈原本也走这里（复用整个 buildChatSystemPrompt
 * 生成），2026-10 改成了纯兜底文案（见 companionService.js 的
 * FEED_FALLBACKS/CLEAN_FALLBACKS/PLAY_FALLBACKS）——这几个按键点击
 * 频率高，之前每点一次都要带上世界书/待办/日记等一整套大提示词去换一句
 * 旁白式反应，用户觉得不值这个 token/API 成本，而且这几句本来就是
 * "小伙伴自己的反应"、不依赖角色人设，AI 生成带来的变化有限。跟戳一戳
 * 一样改成纯本地文案池，不再调用这个文件里的 callCompanionAi。
 *
 * 角色自主照顾的日志不一样：这是角色自己的口吻、低频（有冷却限制，不是
 * 按钮点击触发），继续保留 AI 生成以维持角色人设一致性。
 *
 * 写法照抄 src/apps/pet/petWidgetService.js 的 generateAiReactionReply：
 * 读同一套 buildChatSystemPrompt（保证角色人设/心情跟正式聊天一致），
 * 但不带聊天历史、不写 db.messages、不走 triggerAiResponse——这些互动
 * 本来就不是正式聊天，见启动包第 6 节"用户不在时角色也会主动做点什么"。
 * 没配置 API、或者请求失败，一律返回 null，调用方退回本地兜底文案。
 */

import db from '../../db';
import { buildCompanionSystemPrompt as buildChatSystemPrompt } from '../../services/companionSystemPrompt';

const callCompanionAi = async ({ chatId, chat, character, guideText, userLine }) => {
  if (!chatId || !chat || !character) {
    return null;
  }

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        temperature: 0.9,
        max_tokens: 120,
        messages: [
          { role: 'system', content: `${systemPrompt}${guideText}` },
          { role: 'user', content: userLine },
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
    console.warn('[Companion] AI 反应生成失败，退回兜底文字:', error);
    return null;
  }
};

const CO_CARE_FALLBACKS = [
  '我顺路过来看了看它，陪它玩了一会儿，它看起来很开心。',
  '刚刚喂了它一点吃的，它蹭了蹭我，好像在说谢谢。',
  '路过的时候顺手照顾了一下，它现在应该很满足。',
];

const pickFallback = (pool) => pool[Math.floor(Math.random() * pool.length)];

/*
 * 角色"自主"去看小伙伴时留下的一句日志——不占聊天上下文，
 * 只是给 companionLogs 加一条 logType:'co_care' 的记录。
 */
export const generateAutonomousCareNote = async ({ chatId, chat, character, companion }) => {
  const guideText = `

【注意：这不是一句普通聊天，而是你在用户不在场的时候，自己顺路去照顾了一下你们共同养的小伙伴"${companion?.name || '它'}"】
请用你自己的口吻，写一句留给用户看的简短记录（30 字以内），说说你刚才做了什么、它的反应怎么样。
不要提到"系统"、"面板"、"程序"、"App"这类词，不要使用表情符号，不要加引号，不要署名。`;

  const reply = await callCompanionAi({
    chatId,
    chat,
    character,
    guideText,
    userLine: '（你刚刚顺路去看了看小伙伴）',
  });

  return reply || pickFallback(CO_CARE_FALLBACKS);
};
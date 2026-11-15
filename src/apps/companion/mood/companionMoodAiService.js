/*
 * companionMoodAiService.js —— 心情日历 Slice B 唯一调用 AI 的一步：
 * 根据今天的聊天记录，判断 char（角色）今天总体的心情，只能是五选一
 * （happy / calm / sad / surprised / angry），不是自由发挥的文本。
 *
 * 写法照抄 companionDiaryAiService.js：直接 fetch、复用 buildChatSystemPrompt
 * 保证角色人设背景一致，不写 db.messages、不走 triggerAiResponse。跟日记
 * 不一样的地方是这里要带一点"今天聊了什么"的片段，不然 AI 没有依据判断
 * 心情；而且输出要收敛成五个词之一，不能自由发挥。
 *
 * 没配置 API、请求失败、或者 AI 没回出一个能识别的心情词，一律返回
 * null——调用方（companionMoodScheduler.js）这种情况下就跳过今天，
 * 不写一个瞎编的心情（宁可这天的格子空着，也不编一个不准的）。
 */

import db from '../../../db';
import { buildCompanionSystemPrompt as buildChatSystemPrompt } from '../../../services/companionSystemPrompt';

const MOOD_KEY_LIST = ['happy', 'calm', 'sad', 'surprised', 'angry'];

// AI 有时候会回"happy（开心）"这种带中文注解的，或者多余的标点——
// 不强求完全匹配，只要回复里出现了某个心情词就算数；真认不出来才算失败。
const extractMoodKey = (text) => {
  const lower = String(text || '').toLowerCase();
  return MOOD_KEY_LIST.find((key) => lower.includes(key)) || null;
};

const MAX_MESSAGE_CHARS = 200;

const formatTranscript = (todayMessages, characterName) => (
  (todayMessages || [])
    .map((m) => {
      const speaker = m.sender === 'user' ? '用户' : (characterName || '角色');
      const content = String(m.content || '').slice(0, MAX_MESSAGE_CHARS);
      return `${speaker}：${content}`;
    })
    .join('\n')
);

/*
 * chatId/chat/character/companion：跟 companionDiaryAiService.generateDiaryText
 * 一样的四件套。todayMessages：今天的聊天记录（已经按时间排好序、截过数量，
 * 由调用方 companionMoodScheduler.js 查好传进来），可以是空数组（今天没聊天
 * 也要能判断，没特别的事就倾向 calm）。
 */
export const judgeCharMood = async ({ chatId, chat, character, companion, todayMessages }) => {
  if (!chatId || !chat || !character || !companion) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const transcript = formatTranscript(todayMessages, character.name);

    const guideText = `

【注意：这不是一句普通聊天，而是要你站在自己的视角，回顾今天跟用户相处的内容，判断自己今天总体的心情】
${transcript ? `今天的聊天片段（可能不完整，按时间顺序）：\n${transcript}` : '今天几乎没有聊天记录。'}
请只从下面五个词里选一个最贴近你今天心情的词，原样输出这一个英文单词本身，不要输出别的任何文字、标点、解释、中文翻译：
happy
calm
sad
surprised
angry
如果没有发生什么特别的事，默认倾向 calm。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        temperature: 0.4,
        max_tokens: 12,
        messages: [
          { role: 'system', content: `${systemPrompt}${guideText}` },
          { role: 'user', content: '（只回一个心情词，不要别的）' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim();
    return extractMoodKey(raw);
  } catch (error) {
    console.warn('[CompanionMood] AI 心情判断失败:', error);
    return null;
  }
};
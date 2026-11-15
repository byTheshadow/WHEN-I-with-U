/*
 * companionDailyQaAiService.js —— 每日问答唯一调用 AI 的两步，写法照抄
 * companionDiaryAiService.js / companionMoodAiService.js：直接 fetch、复用
 * buildChatSystemPrompt 保证角色人设背景一致，不写 db.messages、不走
 * triggerAiResponse。
 *
 * 故意拆成两个独立函数、两次调用，而不是一次性生成"问题+角色回答"：
 * - generateQuestionPair：出题（问 char 的 + 问 user 的）。
 * - generateCharAnswer：只回答一个已经定好的问题。
 * 这样角色回答失败不会连累题目本身，重roll（companionDailyQaService.js
 * 的 rerollCharAnswer）也只需要再调一次 generateCharAnswer，问题保持不变。
 *
 * 没配置 API、请求失败、或者解析不出预期格式，一律返回 null——
 * generateQuestionPair 失败时调用方会退回 FALLBACK_QUESTION_PAIRS 固定
 * 题库；generateCharAnswer 失败时调用方把 charAnswer 留空，不瞎编。
 */

import db from '../../../db';
import { buildCompanionSystemPrompt as buildChatSystemPrompt } from '../../../services/companionSystemPrompt';

// 出题失败/没配置 API 时的固定题库兜底，一对一对地配好（一个问 char，
// 一个问 user），风格尽量轻松、具体，避免抽象到不知道怎么答。
const FALLBACK_QUESTION_PAIRS = [
  { questionForChar: '如果可以选一种天气形容今天的心情，你会选哪种？', questionForUser: '今天有没有什么事，哪怕很小，让你觉得有点开心？' },
  { questionForChar: '要是今天能选一样东西变大十倍，你会选什么？', questionForUser: '今天最想偷懒不想做的一件事是什么？' },
  { questionForChar: '如果今天是一种颜色，你觉得是什么颜色？', questionForUser: '今天有没有什么事让你有点小烦恼？' },
  { questionForChar: '如果可以现在许一个很小的愿望，你会许什么？', questionForUser: '今天吃到的东西里，哪样最好吃？' },
  { questionForChar: '要是今天能换一个地方待一会儿，你想去哪？', questionForUser: '今天有没有哪一刻，觉得时间过得特别慢或者特别快？' },
  { questionForChar: '如果今天要用一首歌的调子形容心情，会是快歌还是慢歌？', questionForUser: '今天跟谁说的话最多？' },
  { questionForChar: '要是今天能多出一个小时，你想拿来干嘛？', questionForUser: '今天有没有什么事做得比自己预期的好？' },
  { questionForChar: '如果今天能变成一种小动物待一下午，你想变成什么？', questionForUser: '今天出门了吗？如果出门了，印象最深的是什么？' },
];

export const pickFallbackQuestionPair = () => (
  FALLBACK_QUESTION_PAIRS[Math.floor(Math.random() * FALLBACK_QUESTION_PAIRS.length)]
);

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;
  return apiConfig;
};

const callChatCompletion = async (apiConfig, systemPrompt, userHint, maxTokens) => {
  const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      temperature: 0.8,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userHint },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

/*
 * 从 AI 的自由格式回复里抠出"问TA：xxx"「问你：xxx」两行，宽松匹配（允许
 * 中英文冒号、前后空格），两行都抠出来才算成功，少一行就整体判失败。
 */
const parseQuestionPair = (text) => {
  const forCharMatch = text.match(/问\s*TA\s*[:：]\s*(.+)/);
  const forUserMatch = text.match(/问\s*你\s*[:：]\s*(.+)/);
  if (!forCharMatch || !forUserMatch) return null;

  const questionForChar = forCharMatch[1].split('\n')[0].trim();
  const questionForUser = forUserMatch[1].split('\n')[0].trim();
  if (!questionForChar || !questionForUser) return null;

  return { questionForChar, questionForUser };
};

/*
 * 出一对今天的问题：一个问 char，一个问 user。chatId/chat/character/
 * companion 跟其它直连 AI 服务一样的四件套。
 */
export const generateQuestionPair = async ({ chatId, chat, character, companion }) => {
  if (!chatId || !chat || !character || !companion) return null;

  try {
    const apiConfig = await getApiConfig();
    if (!apiConfig) return null;

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const guideText = `

【注意：这不是一句普通聊天，而是要你以"小伙伴每日问答"的出题人身份，想两个今天的问题】
请出两个轻松、具体、容易回答的小问题（不要抽象、不要说教），一个是问你自己（角色）的，一个是问用户的，严格按下面的格式输出，只输出这两行，不要别的任何文字：
问TA：（这里是问角色自己的问题）
问你：（这里是问用户的问题）`;

    const raw = await callChatCompletion(apiConfig, `${systemPrompt}${guideText}`, '（只按格式回两行，不要别的）', 150);
    return parseQuestionPair(raw);
  } catch (error) {
    console.warn('[CompanionDailyQA] AI 出题失败:', error);
    return null;
  }
};

/*
 * 只回答一个已经定好的问题（questionForChar），不重新出题。用于当天首次
 * 生成，也用于失败后的重roll——两种场景走的是同一个函数。
 */
export const generateCharAnswer = async ({ chatId, chat, character, companion, questionForChar }) => {
  if (!chatId || !chat || !character || !companion || !questionForChar) return null;

  try {
    const apiConfig = await getApiConfig();
    if (!apiConfig) return null;

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const guideText = `

【注意：这不是一句普通聊天，而是小伙伴每日问答里，你要站在自己的视角回答下面这一个问题】
问题：${questionForChar}
请用第一人称回答这个问题，1 到 3 句话，语气自然、符合你平时说话的样子，只输出回答本身，不要加称呼、不要加多余的解释。`;

    const raw = await callChatCompletion(apiConfig, `${systemPrompt}${guideText}`, '（只回答，不要别的）', 150);
    return raw || null;
  } catch (error) {
    console.warn('[CompanionDailyQA] AI 生成角色回答失败:', error);
    return null;
  }
};
/*
 * companionSchoolReportAiService.js —— 「家校练习册」唯一调用 AI 的地方。
 * 写法照抄 companionDailyQaAiService.js：直接 fetch、复用
 * buildChatSystemPrompt 保证角色人设背景一致，不写 db.messages、不走
 * triggerAiResponse。没配置 API / 请求失败 / 解析不出来，一律返回 null——
 * 调用方（companionSchoolReportService.js）负责兜底，这个文件不编任何
 * "看起来合理"的假内容。
 *
 * 第 2 轮加了 generateLifeNarrative（"今天在学校"的一句话叙事）。
 * 第 3 轮加了 generateWeeklyComment（周评语）、generateMeetingLines
 * （三方会谈的老师发言 + 小伙伴回应两句话）。
 *
 * 【评语/会谈怎么切出"老师的声音"】
 * 老师是纯静态数据（companionSchoolData.js 里的 SCHOOL_TEACHERS），没有
 * 自己的 chat/character，没法像小伙伴那样走 buildChatSystemPrompt 锁定
 * 人设。写法照抄 companionDailyQaAiService.js 的 generateQuestionPair——
 * 那个函数也是借着小伙伴本身的 systemPrompt，用 guideText 临时让模型切到
 * "出题人"这个旁白身份，不是让它继续演小伙伴自己。评语/会谈的老师发言
 * 同理：guideText 临时让模型切到"{teacher.name}老师"这个身份，把
 * teacher.persona 整段喂给它当人设依据。
 */

import db from '../../../db';
import { buildCompanionSystemPrompt as buildChatSystemPrompt } from '../../../services/companionSystemPrompt';
import { findSubject } from './companionSchoolData';

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
      temperature: 0.85,
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

/** 科目 id 列表 -> 中文名列表，不认识的 id（比如自己出的题没填科目）直接跳过 */
const subjectLabels = (subjectIds = []) => subjectIds
  .map((id) => findSubject(id)?.label)
  .filter(Boolean);

/*
 * 根据今天的做题统计，写一句第一人称的"在校生活"小叙事。
 *
 * @param {{chatId:number, chat:object, character:object, companion:object,
 *          stats:{subjectIds:string[], correct:number, total:number, setCount:number}}} args
 * @returns {string|null}
 */
export const generateLifeNarrative = async ({ chatId, chat, character, companion, stats }) => {
  if (!chatId || !chat || !character || !companion || !stats) return null;

  try {
    const apiConfig = await getApiConfig();
    if (!apiConfig) return null;

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const subjects = subjectLabels(stats.subjectIds);
    const subjectText = subjects.length > 0 ? subjects.join('、') : '不同科目';

    const guideText = `

【注意：这不是一句普通聊天，而是要你以"小伙伴"的第一人称视角，给家长写一句今天在学校做题的小记录，会被放进"家校练习册"的"今天在学校"卡片里】
今天的真实数据：练了${stats.setCount}组题，涉及${subjectText}，一共对了${stats.correct}/${stats.total}道。
请用第一人称写 1 到 2 句话，语气轻松自然、符合你平时说话的样子，内容要贴着上面这些真实数字（不要编不存在的具体题目内容、不要编今天发生的其它事件，比如交到新朋友——那些这次没有发生），只输出这句话本身，不要加称呼、不要加多余的解释。`;

    const raw = await callChatCompletion(apiConfig, `${systemPrompt}${guideText}`, '（只写这一两句话，不要别的）', 150);
    return raw || null;
  } catch (error) {
    console.warn('[CompanionSchoolReport] AI 生成在校叙事失败:', error);
    return null;
  }
};

/** 把一周的做题统计拼成给 AI 读的一句话素材，评语和会谈共用 */
const buildWeekStatsText = (stats) => {
  const subjects = subjectLabels(stats.subjectIds);
  const subjectText = subjects.length > 0 ? subjects.join('、') : '功课';
  if (stats.setCount === 0) {
    return '这周一组题都没做，没去上课。';
  }
  return `这周上了 ${stats.daysAttended} 天课，做了 ${stats.setCount} 组题，练了${subjectText}，一共对了 ${stats.correct}/${stats.total} 道。`;
};

/*
 * 周评语：以 teacher 的人设和口吻，给家长写这周的评语。
 *
 * @param {{chatId, chat, character, companion,
 *          teacher:object, stats:object}} args
 * @returns {string|null}
 */
export const generateWeeklyComment = async ({ chatId, chat, character, companion, teacher, stats }) => {
  if (!chatId || !chat || !character || !companion || !teacher || !stats) return null;

  try {
    const apiConfig = await getApiConfig();
    if (!apiConfig) return null;

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const statsText = buildWeekStatsText(stats);

    const guideText = `

【注意：这不是一句普通聊天，而是要你暂时切换身份——不再是${character.name}，而是扮演"${teacher.name}"这位老师，给家长写${companion.name}这周的评语，会被放进"家校练习册"的评语卡里】
${teacher.name}的人设：${teacher.persona}
这周的真实数据：${statsText}
请用${teacher.name}的语气写 2 到 3 句话的评语，要贴着上面这些真实数字和具体表现来写（不要编没发生的具体情节，比如交到新朋友、某次课堂上的对话——那些这次没有素材），只输出评语本身，不要加"评语："之类的前缀、不要加多余的解释。`;

    const raw = await callChatCompletion(apiConfig, `${systemPrompt}${guideText}`, '（只写评语本身，不要别的）', 220);
    return raw || null;
  } catch (error) {
    console.warn('[CompanionSchoolReport] AI 生成周评语失败:', error);
    return null;
  }
};

/*
 * 从 AI 的自由格式回复里抠出"老师：xxx"「我：xxx」两行，宽松匹配，写法
 * 照抄 companionDailyQaAiService.js 的 parseQuestionPair。
 */
const parseMeetingLines = (text) => {
  const teacherMatch = text.match(/老师\s*[:：]\s*(.+)/);
  const petMatch = text.match(/我\s*[:：]\s*(.+)/);
  if (!teacherMatch || !petMatch) return null;

  const teacherText = teacherMatch[1].split('\n')[0].trim();
  const petText = petMatch[1].split('\n')[0].trim();
  if (!teacherText || !petText) return null;

  return { teacherText, petText };
};

/*
 * 三方会谈的开场两句话：老师先说一句这周的情况，小伙伴再接一句自己的话。
 *
 * @param {{chatId, chat, character, companion,
 *          teacher:object, stats:object}} args
 * @returns {{teacherText:string, petText:string}|null}
 */
export const generateMeetingLines = async ({ chatId, chat, character, companion, teacher, stats }) => {
  if (!chatId || !chat || !character || !companion || !teacher || !stats) return null;

  try {
    const apiConfig = await getApiConfig();
    if (!apiConfig) return null;

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const statsText = buildWeekStatsText(stats);

    const guideText = `

【注意：这不是一句普通聊天，而是"三方会谈"的开场——先切换成"${teacher.name}"老师的身份说一句话，再切回${character.name}自己说一句话，都会被放进"家校练习册"的三方会谈里】
${teacher.name}的人设：${teacher.persona}
这周的真实数据：${statsText}
请严格按下面的格式输出，只输出这两行，不要别的任何文字：
老师：（这里是${teacher.name}跟家长说的一句话，贴着上面的真实数据，不要编没发生的具体情节）
我：（这里是${character.name}自己接的一句话，第一人称，语气符合平时说话的样子）`;

    const raw = await callChatCompletion(apiConfig, `${systemPrompt}${guideText}`, '（只按格式回两行，不要别的）', 220);
    return parseMeetingLines(raw);
  } catch (error) {
    console.warn('[CompanionSchoolReport] AI 生成三方会谈失败:', error);
    return null;
  }
};
/*
 * companionSchoolQuizAiService.js —— 「我出的题」里"AI 出题"唯一调用 AI
 * 的地方。写法照抄同目录下 companionSchoolReportAiService.js / 照抄
 * companionDailyQaAiService.js：直接 fetch、复用 buildChatSystemPrompt
 * 保证角色人设背景一致，不写 db.messages、不走 triggerAiResponse。
 *
 * 【跟评语/会谈那几个 AI 调用不一样的地方】
 * 评语、会谈、"今天在学校"叙事都是"用户不点按钮也会自动触发"的后台生成，
 * 失败了就静默退回一句用真实数据拼出的兜底文案，绝不让用户看到"AI 失败"
 * 这种字样。但"AI 出题"是用户主动点按钮触发的一次性动作——出不出题全看
 * 用户给没给资料、点没点生成，失败了没有"真实数据"可以兜底编成一道题
 * （编一道假题比编一句叙事更不负责任），所以这里反过来：失败就老实告诉
 * 用户"没生成出来，再试一次"，不自动顶一道看起来合理的题目上去。
 *
 * 【为什么要 hasApiConfig 这个额外导出】
 * 评语那几个函数全部靠返回 null 掩盖"没配置 API"和"请求失败"这两种
 * 情况的区别——对静默兜底来说够用了。但这里 UI 要在用户点"开始生成"
 * 之前就能分辨"根本没配置，别白等"和"配置了但这次没生成出来，可以重试"
 * 这两种提示语（抄的是项目里其它需要 AI 的小游戏同款的提示文案），所以
 * 多导出这一个轻量检查。
 *
 * 【输出格式为什么用 JSON 而不是评语/会谈那种"标签：内容"两行解析】
 * 评语/会谈只需要解析固定的一两行文本；出题要解析"N 道题，每道题还带
 * 选项数组、正确答案下标"这种嵌套结构，两行正则解析不出来，所以照抄
 * flightChessAiService.js 里 generateCharacterQuestionCards 的路数——
 * 让模型只输出一个 JSON 数组，用宽松正则抠出 `[...]` 这一段再 JSON.parse，
 * 解析失败同样返回 null，调用方负责提示重试。
 *
 * 【生成出来的是"草稿"，不是已经入库的题】
 * 这里只负责"问 AI 要几道题、把像样的部分抠出来"，不做
 * companionSchoolQuizService.js 里 normalizeCustomQuestion 那么严格的校验
 * （字数上限等按同一套数字本地抄了一份防止明显超标，但没有强一致性
 * 保证）。草稿拿去给用户预览、增删、确认之后，由调用方交给
 * addCustomQuestions 批量入库——那个函数本来就是"AI 出题预览确认后用"，
 * 真正的校验和每条题目的失败原因都在那边报出来，这里不重复一遍。
 */

import db from '../../../db';
import { buildCompanionSystemPrompt as buildChatSystemPrompt } from '../../../services/companionSystemPrompt';

// 跟 companionSchoolQuizService.js 里的 STEM_MAX / OPTION_MAX / EXPLAIN_MAX
// 是同一套数字，这里只是本地抄一份用来在预览阶段先粗略裁一刀，真正说了
// 算的校验仍然是 addCustomQuestions 调 normalizeCustomQuestion 那一遍。
const STEM_MAX = 120;
const OPTION_MAX = 40;
const EXPLAIN_MAX = 200;

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) return null;
  return apiConfig;
};

/** UI 在用户点"开始生成"之前先用这个判断要不要提示"还没配置 AI 接口"。 */
export const hasApiConfig = async () => Boolean(await getApiConfig());

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

/* 把 AI 吐出来的单条 item 整理成草稿；不像样（题型不对、题干空、选项数量
   不对、答案下标越界……）就返回 null，调用方直接把这一条跳过，不是整批
   作废——AI 出 5 道，有 1 道格式歪了，不该连累另外 4 道。 */
const sanitizeDraftItem = (item, { subjectId, stage }) => {
  if (!item || typeof item !== 'object') return null;

  const type = item.type === 'judge' ? 'judge' : item.type === 'choice' ? 'choice' : null;
  if (!type) return null;

  const stem = String(item.stem || '').trim().slice(0, STEM_MAX);
  if (!stem) return null;

  const explain = String(item.explain || '').trim().slice(0, EXPLAIN_MAX);

  if (type === 'judge') {
    if (typeof item.answer !== 'boolean') return null;
    return { subject: subjectId, stage, type, stem, options: null, answer: item.answer, explain };
  }

  const options = Array.isArray(item.options)
    ? item.options.map((o) => String(o || '').trim().slice(0, OPTION_MAX)).filter(Boolean)
    : [];
  if (options.length < 2 || options.length > 4) return null;
  if (new Set(options).size !== options.length) return null;
  if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= options.length) return null;

  return { subject: subjectId, stage, type, stem, options, answer: item.answer, explain };
};

/*
 * 根据一段资料/主题，让 AI 出 count 道题（选择题/判断题混着出）。
 *
 * @param {{chatId, chat, character, companion,
 *          subjectId:string, stage:string, material:string, count:number}} args
 *        subjectId  — companionSchoolData.js 里 SCHOOL_SUBJECTS 的某个 id，
 *                      或者 CUSTOM_SUBJECT_ID（"自定义"）；整批题目都归到
 *                      这一个科目下，不让 AI 自己每道题挑一个（省掉"AI 选
 *                      了个不存在的科目"这一种失败可能）。
 *        stage      — SCHOOL_STAGE 的某个取值，或者 QUESTION_STAGE_BOTH。
 *        material   — 用户给的资料/主题文字。
 *        count      — 想要几道题（UI 上限制成几个固定档位）。
 * @returns {Array<{subject,stage,type,stem,options,answer,explain}>|null}
 *          草稿数组（已经带 subject/stage，source 留给调用方自己填
 *          QUESTION_SOURCE.AI，这里不写死，避免这个文件也要 import 一遍
 *          只是为了拼一个字段）；一道都没解析出来、没配置 API、请求失败、
 *          JSON 解析不出来，统一返回 null。
 */
export const generateQuizQuestions = async ({
  chatId, chat, character, companion, subjectId, stage, material, count,
}) => {
  if (!chatId || !chat || !character || !companion || !material || !count) return null;

  try {
    const apiConfig = await getApiConfig();
    if (!apiConfig) return null;

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);
    const subjectLabel = subjectId === 'custom' ? '自定义（不局限某一科）' : subjectId;
    const stageLabel = stage === 'kindergarten' ? '幼儿园' : stage === 'primary' ? '小学' : '不限学段';

    const guideText = `

【注意：这不是一句普通聊天，而是要你暂时切换身份——不再是${character.name}，而是「上学」功能里的出题老师，根据下面这段资料给${companion.name}出几道练习题，这些题会被加进"我出的题"题库，之后给${companion.name}自己复习用】
科目：${subjectLabel}
适用学段：${stageLabel}
资料／主题：${material}

请出 ${count} 道题，选择题和判断题可以混着出，题目内容要贴着上面的资料/主题，不要编跟资料无关的内容。严格按下面的 JSON 格式输出，只输出这一个 JSON 数组本身，不要加任何别的文字、不要用 markdown 代码块包裹：
[{"type":"choice","stem":"题干，不超过120字","options":["选项1","选项2","选项3"],"answer":0,"explain":"一句解析，可以留空字符串，不超过200字"},{"type":"judge","stem":"题干","answer":true,"explain":""}]

type 只能是 "choice" 或 "judge"；choice 需要 2 到 4 个不重复的选项，answer 是正确选项在 options 数组里的下标（从 0 开始数）；judge 没有 options 字段，answer 是 true 或 false。`;

    const maxTokens = Math.min(1800, Math.max(300, count * 220));
    const raw = await callChatCompletion(apiConfig, `${systemPrompt}${guideText}`, '（只输出 JSON 数组，不要别的）', maxTokens);

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) return null;

    const drafts = parsed
      .map((item) => sanitizeDraftItem(item, { subjectId, stage }))
      .filter(Boolean)
      .slice(0, count);

    return drafts.length > 0 ? drafts : null;
  } catch (error) {
    console.warn('[CompanionSchoolQuiz] AI 出题失败:', error);
    return null;
  }
};
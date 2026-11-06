// src/apps/badges/monthlyBadgeAiService.js
//
// 每月限定聊天成就图标——"AI 自己定一个解锁要求"这一步。
//
// 每个赛季（每个聊天窗口 × 每个月）只在第一次打开兑换页时调用一次 AI，
// 结果落库之后就不会再重新生成。为了让这个要求"达成后能被程序验证"，
// 不接受开放式描述：提示词里把能选的范围限定在 AI_CUSTOM_TEMPLATES 这
// 三种模板里，角色只能从里面选一种、填一个数字（如果这种模板需要数字），
// 并用自己的语气写一句话呈现给用户，格式和 outfitAiService.js 的
// "一次性、不进聊天记录"请求是同一个写法。
//
// 同一次调用里，还会让角色从本月的图标里挑一个自己"想要"的（纯展示
// 用，兑换页会把它标成"TA 想要的"），不影响解锁判定本身。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import { buildRhythmPersonaBrief } from '../../services/rhythmReminderService';
import { AI_CUSTOM_TEMPLATES } from './monthlyBadgeCatalog';

const REQUEST_TIMEOUT_MS = 60000;

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

const isConfigMissingError = (err) => String(err?.message || '').includes('请先在系统设置中配置');

const loadContext = async (chatId) => {
  const chat = await db.chats.get(chatId);
  if (!chat) return null;

  const character = await db.characters.get(chat.characterId);
  if (!character) return null;

  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
  const userName = String(chat.userName || character.userName || '对方').trim();

  return { character, userName, worldBookText, extraNotesText };
};

const buildPrompt = ({ context, seasonDef }) => {
  const { character, userName, worldBookText, extraNotesText } = context;

  const templateLines = AI_CUSTOM_TEMPLATES.map(
    (tpl, index) => `${index + 1}. ${tpl.templateId}｜${tpl.aiPrompt}`
  ).join('\n');

  // 本月已经定好的固定条件（每个赛季不一样），从赛季数据里读，不写死。
  const fixedConditions = seasonDef.conditions.filter((condition) => condition.kind === 'fixed');
  const fixedConditionText = fixedConditions.map((condition) => condition.title).join(' / ');

  const badgeLines = seasonDef.badges
    .map((badge, index) => `${index + 1}. ${badge.id}｜${badge.title}｜${badge.description}`)
    .join('\n');

  return `你正在扮演角色「${character.name}」。人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}
你对用户的称呼是「${userName}」。

现在是「${seasonDef.seasonTitle}」聊天成就图标开放的月份。除了已经定好的另外${fixedConditions.length}个解锁条件（${fixedConditionText}），你还可以自己给${userName}定一个小小的要求——三个条件要一起全部达成，才能解锁整套图标，所以这个要求不用太难，是三个里的其中一个而已。

你只能从下面这三种要求里选一种（不要自己编造新的要求类型）：
${templateLines}

另外，本月一共有这些图标，请你凭自己的喜好挑一个你自己想要的（不影响解锁判定，只是你私心想要哪个）：
${badgeLines}

严格按以下格式输出，每行一项，字段之间用 ||| 分隔，一共 4 行，不要标题、不要编号、不要 Markdown、不要多余说明：

模板|||从 extra_messages / stickers_in_month / late_night_chat 三者中选一个
数字|||如果选的模板需要数字就填具体数字，不需要数字就填 无
想要的图标|||从上面图标列表里选一个 id
一句话|||用你自己的语气和${userName}说这个要求，不超过 40 个字，不要直接报出模板名或字段名

要求：
- 全站零 Emoji。
- 「一句话」要自然、符合你的性格，像是你自己提出的小心愿或小考验，不要写成系统提示的语气。`;
};

const parseAiCustomResponse = (rawText, seasonDef) => {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields = {};

  lines.forEach((line) => {
    const segments = line.split(/\|\|\||｜｜｜/);
    if (segments.length < 2) return;

    const label = segments[0].replace(/[\s*#>·•:：\d.、()（）【】「」"'-]/g, '');
    const value = segments[1].replace(/^[\s*"“「]+|[\s*"”」]+$/g, '').trim();

    if (label.includes('模板')) fields.templateId = value;
    else if (label.includes('数字')) fields.rawTarget = value;
    else if (label.includes('想要') || label.includes('图标')) fields.wantedBadgeId = value;
    else if (label.includes('一句话')) fields.title = value;
  });

  const template = AI_CUSTOM_TEMPLATES.find((tpl) => tpl.templateId === fields.templateId);
  if (!template) return null;

  let target = null;
  if (template.minTarget !== null) {
    const parsed = Number.parseInt(fields.rawTarget, 10);
    if (!Number.isFinite(parsed)) return null;
    target = Math.min(template.maxTarget, Math.max(template.minTarget, parsed));
  }

  const wantedBadge = seasonDef.badges.find((badge) => badge.id === fields.wantedBadgeId);

  return {
    templateId: template.templateId,
    target,
    title: fields.title ? fields.title.slice(0, 60) : template.title,
    wantedBadgeId: wantedBadge ? wantedBadge.id : null,
  };
};

/**
 * 生成并落库这一赛季的 AI 自定条件 + 角色想要的图标。
 * 已经生成过的赛季直接返回已有记录，不会重复调用 AI。
 */
export const ensureMonthlyAiCondition = async ({ chatId, seasonKey, seasonDef, unlockRow }) => {
  if (!chatId || !seasonDef || !unlockRow) return { status: 'no_data' };

  if (unlockRow.aiCondition) {
    return { status: 'already_exists', unlockRow };
  }

  const context = await loadContext(chatId);
  if (!context) return { status: 'no_chat' };

  const prompt = buildPrompt({ context, seasonDef });

  let rawText;
  try {
    rawText = await withTimeout(
      generateResponse([
        { role: 'system', content: prompt },
        { role: 'user', content: '请按要求的格式输出。' },
      ]),
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    if (!isConfigMissingError(err)) {
      console.error('[monthlyBadgeAiService] 生成本月自定条件失败：', err);
    }
    return { status: isConfigMissingError(err) ? 'no_api_config' : 'error', error: err?.message };
  }

  const parsed = parseAiCustomResponse(rawText, seasonDef);
  if (!parsed) {
    return { status: 'bad_response' };
  }

  const updated = {
    ...unlockRow,
    aiCondition: {
      templateId: parsed.templateId,
      target: parsed.target,
      title: parsed.title,
      generatedAt: new Date().toISOString(),
    },
    characterWantedBadgeId: parsed.wantedBadgeId,
  };

  await db.monthlyBadgeUnlocks.put(updated);

  return { status: 'success', unlockRow: updated };
};
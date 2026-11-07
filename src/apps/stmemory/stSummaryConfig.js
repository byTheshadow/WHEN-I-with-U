// src/apps/stmemory/stSummaryConfig.js
//
// 总结式导入的提示词与设置。
//   - 三个默认模板（剧情 / 关系变化 / 设定事实），用户可以直接改，改了就变成"自定义"。
//   - 设置（用哪个模板、自定义的提示词、每批多少条消息）存在 db.settings，全局共用。
//   - 真正发给模型的请求 = 模板 + 固定的输出要求 + 这一批的聊天记录（见 buildBatchRequest）。
//     输出要求里那条"占位符原样保留"是固定的，不让用户改坏：包里存的名字都是
//     {{char}} / {{user}}，总结里必须保持这样，注入时才能换成当前聊天的名字。
//
// 注意：这个文件不要 import aiService。
import db from '../../db';

export const SUMMARY_SETTINGS_KEY = 'stMemorySummarySettings';

export const DEFAULT_BATCH_MESSAGES = 40;
export const MIN_BATCH_MESSAGES = 5;
export const MAX_BATCH_MESSAGES = 300;

export const CUSTOM_TEMPLATE_ID = 'custom';

export const SUMMARY_TEMPLATES = [
  {
    id: 'plot',
    label: '剧情',
    text: '你是一个聊天记忆整理模块。下面是一段聊天记录的片段。\n\n'
      + '请把这段记录总结成一份简短的剧情摘要：按时间顺序写出发生了什么、做了什么决定、'
      + '留下了哪些约定和伏笔。去掉寒暄和重复的细节，尽量精炼。',
  },
  {
    id: 'relation',
    label: '关系变化',
    text: '你是一个聊天记忆整理模块。下面是一段聊天记录的片段。\n\n'
      + '请只整理这段记录里 {{user}} 和 {{char}} 之间关系的变化：态度、称呼、亲密程度、'
      + '冲突与和解、彼此说过的重要的话和做出的承诺。没有变化的方面不用写，也不要复述剧情经过。',
  },
  {
    id: 'facts',
    label: '设定事实',
    text: '你是一个聊天记忆整理模块。下面是一段聊天记录的片段。\n\n'
      + '请从这段记录里提取已经确定下来的设定和事实：人物的身份、外貌、习惯、喜好、经历，'
      + '世界观设定，重要的地点和物品。用简短的条目式句子，每条一个事实，不要写剧情经过。',
  },
];

export const getTemplateText = (templateId) => (
  SUMMARY_TEMPLATES.find((template) => template.id === templateId)?.text || ''
);

export const clampBatchMessages = (value) => {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return DEFAULT_BATCH_MESSAGES;
  return Math.min(MAX_BATCH_MESSAGES, Math.max(MIN_BATCH_MESSAGES, number));
};

export const DEFAULT_SUMMARY_SETTINGS = {
  templateId: SUMMARY_TEMPLATES[0].id,
  customText: '',
  batchMessages: DEFAULT_BATCH_MESSAGES,
};

/** 当前生效的提示词正文：选了模板用模板，选了自定义用用户写的。 */
export const getEffectivePromptText = (settings) => (
  settings?.templateId === CUSTOM_TEMPLATE_ID
    ? String(settings.customText || '')
    : getTemplateText(settings?.templateId)
);

export const loadSummarySettings = async () => {
  try {
    const row = await db.settings.get(SUMMARY_SETTINGS_KEY);
    const value = row?.value || {};
    const known = value.templateId === CUSTOM_TEMPLATE_ID
      || SUMMARY_TEMPLATES.some((template) => template.id === value.templateId);
    return {
      templateId: known ? value.templateId : DEFAULT_SUMMARY_SETTINGS.templateId,
      customText: String(value.customText || ''),
      batchMessages: clampBatchMessages(value.batchMessages ?? DEFAULT_BATCH_MESSAGES),
    };
  } catch (error) {
    console.warn('[stmemory] 读取总结设置失败，用默认值：', error);
    return { ...DEFAULT_SUMMARY_SETTINGS };
  }
};

export const saveSummarySettings = async (settings) => {
  await db.settings.put({
    key: SUMMARY_SETTINGS_KEY,
    value: {
      templateId: settings.templateId,
      customText: String(settings.customText || ''),
      batchMessages: clampBatchMessages(settings.batchMessages),
    },
  });
};

/** 拼出真正发给模型的请求文本。 */
export const buildBatchRequest = (promptText, batchText) => (
  `${String(promptText || '').trim()}\n\n`
  + '要求：只输出摘要正文本身，不要加标题，不要加"总结："这类前缀，不要解释或客套。'
  + '记录里的 {{char}} 和 {{user}} 是名字占位符，输出时必须原样保留，'
  + '不要替换成具体的名字，也不要自己编造名字。\n\n'
  + `【聊天记录】\n${batchText}`
);
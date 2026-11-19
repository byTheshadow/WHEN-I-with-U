// src/apps/fiction/fictionAppearance.js
//
// 角色「外貌特征」的纯函数（不碰数据库、不发请求，方便单独测试）。
//
// 外貌特征是存档里每个角色（我的设定、新建主角色、导入角色的副本、存档专属 NPC）
// 各自带的一段文字，只属于这份存档，专门喂给生图：配图时 AI 会拿到它，
// 并且只写这一幕看得见的部分（闭着眼就不写瞳色）。不读生图室里的外貌。
// 留空也行，留空时 AI 照旧从人设里自己读。

export const APPEARANCE_MAX = 400;

const SETTING_MAX = 1500;
const BACKGROUND_MAX = 600;

const str = (value) => String(value ?? '').trim();

const clip = (text, max) => {
  const value = str(text);

  return value.length > max ? `${value.slice(0, max)}…` : value;
};

export const APPEARANCE_SYSTEM_PROMPT = [
  '你是文生图的人物设计助手。根据下面的人物设定，写出这个人物的外貌特征，供之后给这个人物配图时使用。',
  '要求：',
  '1. 只写长相和穿着：发色发型、瞳色、肤色、年龄感、身形、常穿的衣服和随身配饰、显眼的特征（疤痕、痣、眼镜等）。',
  '2. 人物设定里已经写明的外貌必须照写，不要改动；没写的部分，按人物的气质和设定合理补全，补全的要具体（写明颜色、长短），不要含糊。',
  '3. 如果给了「已有的外貌特征」，以它为准，只做整理和补全，不要推翻。',
  '4. 用简短的词组，用中文逗号分隔，写成一段话，不超过 120 字。',
  '5. 不要写性格、心理、经历，不要写名字，不要解释，不要加引号或序号，只输出外貌特征本身。',
].join('\n');

/**
 * 拼出「让 AI 写外貌」这一次请求的用户消息。
 * @param name        角色名字
 * @param setting     这个角色的人设文字（人设 + 补充，或身份经历 + 补充，或 NPC 的一句话描述）
 * @param existing    框里已经有的外貌特征（可为空）
 * @param background  故事背景（可为空，帮助判断时代和服装风格）
 */
export const buildAppearanceMessage = ({
  name = '',
  setting = '',
  existing = '',
  background = '',
} = {}) => [
  `## 人物\n名字：${str(name) || '（未命名）'}`,
  str(setting) ? `## 人物设定\n${clip(setting, SETTING_MAX)}` : '',
  str(existing) ? `## 已有的外貌特征\n${clip(existing, APPEARANCE_MAX)}` : '',
  str(background) ? `## 故事背景\n${clip(background, BACKGROUND_MAX)}` : '',
  '请写出这个人物的外貌特征。',
].filter(Boolean).join('\n\n');

// AI 有时会带代码块、思考标签、前缀或多余的引号，统一洗掉，只留外貌本身。
export const cleanAppearance = (raw) => {
  let text = String(raw ?? '');

  text = text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
  text = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
  text = text.trim();
  text = text.replace(/^(?:外貌特征|外貌|外观)\s*[:：]\s*/, '');
  text = text.replace(/^["“「『'`]+|["”」』'`]+$/g, '');

  return text.trim().slice(0, APPEARANCE_MAX);
};

export default {
  APPEARANCE_MAX,
  APPEARANCE_SYSTEM_PROMPT,
  buildAppearanceMessage,
  cleanAppearance,
};
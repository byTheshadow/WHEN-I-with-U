// src/apps/fiction/fictionImagePromptDefaults.js
//
// 「配图要求」的默认文本和纯函数（不碰数据库，方便单独测试）。
//
// 配图要求是一份全局设置，包含两类、每类两版：
//   - auto   自动配图：AI 写正文时，顺带在最后给出一幕的画面描述（[IMAGE]…[/IMAGE]）。
//            这里存的只是「描述怎么写」的要求，[IMAGE] 外壳由 buildAutoImageLine 固定加。
//   - manual 手动配图：点段末相机图标时，另外让 AI 读一遍这一段，写出画面描述。
//            这里存的是那次请求的整段系统提示词。
//   - tags     NovelAI 用：输出英文逗号标签
//   - natural  其他后端（OpenAI 兼容）用：输出一两句中文
//
// 存进 db.settings 的值形如
//   { auto: { tags: '', natural: '' }, manual: { tags: '', natural: '' } }
// 空字符串表示「没改过，用默认」。

import { BACKEND_NOVELAI } from '../imagestudio/imageGenRules';

export const IMAGE_PROMPTS_SETTING_KEY = 'fictionImagePrompts';

export const IMAGE_PROMPT_MAX = 2000;

export const IMAGE_PROMPT_KIND = {
  AUTO: 'auto',
  MANUAL: 'manual',
};

export const IMAGE_PROMPT_VARIANT = {
  TAGS: 'tags',
  NATURAL: 'natural',
};

const KINDS = Object.values(IMAGE_PROMPT_KIND);
const VARIANTS = Object.values(IMAGE_PROMPT_VARIANT);

const DEFAULT_AUTO_TAGS = [
  '只写一行英文提示词标签，用英文逗号分隔（例如：1girl, black hair, smiling, window, rain, night）。',
  '写人数与性别（1girl、1boy、2girls 等），人物的发色发型、表情、动作、服装，场景，光线，构图。',
  '人物的外貌以「人物设定」为准，不要写人名，不要出现文字、对白、水印。',
].join('\n');

const DEFAULT_AUTO_NATURAL = [
  '用一两句中文写出这一幕：谁在哪里、在做什么、神态和穿着、环境与光线。',
  '人物的外貌以「人物设定」为准，只描写看得见的画面，不要写心理活动，不要出现文字、对白。',
].join('\n');

const DEFAULT_MANUAL_TAGS = [
  '你是文生图的提示词助手。读下面这一段小说正文，选出最适合配一张图的那个画面，',
  '只输出一行英文提示词标签，用英文逗号分隔（例如：1girl, black hair, smiling, window, rain, night）。',
  '要写进去的：人数与性别（1girl、1boy、2girls 等），人物的发色发型、表情、动作、服装，场景，光线，构图。',
  '人物的外貌以「人物设定」为准，正文没写的细节可以按设定补全。',
  '不要写人名，不要出现文字、对白、水印，不要解释，不要加引号或序号，只输出那一行标签。',
].join('\n');

const DEFAULT_MANUAL_NATURAL = [
  '你是文生图的提示词助手。读下面这一段小说正文，选出最适合配一张图的那个画面，',
  '用一两句中文写出这一幕的画面描述：谁在哪里、在做什么、神态和穿着、环境与光线。',
  '人物的外貌以「人物设定」为准，正文没写的细节可以按设定补全。',
  '只描写看得见的画面，不要写人物的心理活动，不要出现文字、对白、水印，不要解释，不要加引号或序号。',
].join('\n');

const DEFAULTS = {
  [IMAGE_PROMPT_KIND.AUTO]: {
    [IMAGE_PROMPT_VARIANT.TAGS]: DEFAULT_AUTO_TAGS,
    [IMAGE_PROMPT_VARIANT.NATURAL]: DEFAULT_AUTO_NATURAL,
  },
  [IMAGE_PROMPT_KIND.MANUAL]: {
    [IMAGE_PROMPT_VARIANT.TAGS]: DEFAULT_MANUAL_TAGS,
    [IMAGE_PROMPT_VARIANT.NATURAL]: DEFAULT_MANUAL_NATURAL,
  },
};

const str = (value) => String(value ?? '').trim();

const isKind = (value) => KINDS.includes(value);

const isVariant = (value) => VARIANTS.includes(value);

export const EMPTY_IMAGE_PROMPTS = {
  auto: { tags: '', natural: '' },
  manual: { tags: '', natural: '' },
};

// 生图后端对应哪一版：NovelAI 用标签版，其他（包括读不到）用自然语言版。
export const variantOfBackend = (backend) => (
  backend === BACKEND_NOVELAI ? IMAGE_PROMPT_VARIANT.TAGS : IMAGE_PROMPT_VARIANT.NATURAL
);

export const getDefaultPrompt = (kind, variant) => (
  DEFAULTS[isKind(kind) ? kind : IMAGE_PROMPT_KIND.AUTO][
    isVariant(variant) ? variant : IMAGE_PROMPT_VARIANT.NATURAL
  ]
);

// 把库里读出来的值整理成固定形状，缺的补空，超长的截断。
export const normalizeImagePrompts = (raw) => {
  const result = { auto: { tags: '', natural: '' }, manual: { tags: '', natural: '' } };

  KINDS.forEach((kind) => {
    VARIANTS.forEach((variant) => {
      result[kind][variant] = str(raw?.[kind]?.[variant]).slice(0, IMAGE_PROMPT_MAX);
    });
  });

  return result;
};

// 这一类、这一版现在实际用的文本：改过的用改过的，没改过用默认。
export const resolvePromptText = (prompts, kind, variant) => {
  const custom = str(prompts?.[kind]?.[variant]);

  return custom || getDefaultPrompt(kind, variant);
};

export const isPromptModified = (prompts, kind, variant) => {
  const custom = str(prompts?.[kind]?.[variant]);

  return Boolean(custom) && custom !== getDefaultPrompt(kind, variant);
};

// 一共改过几项（最多 4 项：自动 / 手动 各两版）。
export const countModifiedPrompts = (prompts) => {
  let count = 0;

  KINDS.forEach((kind) => {
    VARIANTS.forEach((variant) => {
      if (isPromptModified(prompts, kind, variant)) count += 1;
    });
  });

  return count;
};

// 改一项，返回新对象，不改原对象。写成空、或者写得和默认一模一样，都当作「没改过」存成空。
export const setPromptText = (prompts, kind, variant, text) => {
  const base = normalizeImagePrompts(prompts);

  if (!isKind(kind) || !isVariant(variant)) return base;

  const value = str(text).slice(0, IMAGE_PROMPT_MAX);

  base[kind][variant] = value === getDefaultPrompt(kind, variant) ? '' : value;

  return base;
};

// 自动配图时塞进「输出格式」里的那一句。[IMAGE] 外壳固定由程序加，
// 用户的文本只是「画面描述的要求」，所以不管怎么改都不会破坏解析。
export const buildAutoImageLine = (requirement) => {
  const text = str(requirement) || DEFAULT_AUTO_NATURAL;

  return [
    '最后另起一行，用 [IMAGE]这一幕的画面描述[/IMAGE] 给出一张插图的描述。',
    `画面描述的要求：\n${text}`,
  ].join('\n');
};

export default {
  IMAGE_PROMPTS_SETTING_KEY,
  IMAGE_PROMPT_MAX,
  IMAGE_PROMPT_KIND,
  IMAGE_PROMPT_VARIANT,
  EMPTY_IMAGE_PROMPTS,
  variantOfBackend,
  getDefaultPrompt,
  normalizeImagePrompts,
  resolvePromptText,
  isPromptModified,
  countModifiedPrompts,
  setPromptText,
  buildAutoImageLine,
};
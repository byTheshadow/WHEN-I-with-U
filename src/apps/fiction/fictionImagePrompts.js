// src/apps/fiction/fictionImagePrompts.js
//
// 「配图要求」的读写：存在 db.settings 的 fictionImagePrompts 里（全局一份，所有存档共用）。
// 默认文本和纯函数在 fictionImagePromptDefaults.js。
//
// 读取失败一律退回默认，不影响生成；写入失败会抛错，由调用方提示用户。

import db from '../../db';
import { getImageGenConfig } from '../imagestudio/imageGenConfigService';
import {
  EMPTY_IMAGE_PROMPTS,
  IMAGE_PROMPTS_SETTING_KEY,
  IMAGE_PROMPT_KIND,
  normalizeImagePrompts,
  resolvePromptText,
  variantOfBackend,
} from './fictionImagePromptDefaults';

export const loadImagePrompts = async () => {
  try {
    const row = await db.settings.get(IMAGE_PROMPTS_SETTING_KEY);

    return normalizeImagePrompts(row?.value);
  } catch (error) {
    console.warn('[Fiction] 读取配图要求失败，用默认：', error);

    return normalizeImagePrompts(EMPTY_IMAGE_PROMPTS);
  }
};

export const saveImagePrompts = async (prompts) => {
  await db.settings.put({
    key: IMAGE_PROMPTS_SETTING_KEY,
    value: normalizeImagePrompts(prompts),
  });
};

// 当前生图后端：'novelai' / 'third_party'，读不到返回空字符串（按自然语言版处理）。
export const readImageBackend = async () => {
  try {
    return (await getImageGenConfig())?.backend || '';
  } catch (error) {
    console.warn('[Fiction] 读取生图后端失败，按自然语言版处理：', error);

    return '';
  }
};

// 按当前生图后端，取出自动 / 手动两类实际要用的文本。
export const loadResolvedImagePrompts = async () => {
  const [prompts, backend] = await Promise.all([loadImagePrompts(), readImageBackend()]);
  const variant = variantOfBackend(backend);

  return {
    backend,
    variant,
    auto: resolvePromptText(prompts, IMAGE_PROMPT_KIND.AUTO, variant),
    manual: resolvePromptText(prompts, IMAGE_PROMPT_KIND.MANUAL, variant),
  };
};

export default {
  loadImagePrompts,
  saveImagePrompts,
  readImageBackend,
  loadResolvedImagePrompts,
};
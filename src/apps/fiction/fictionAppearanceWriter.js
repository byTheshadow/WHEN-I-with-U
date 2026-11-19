// src/apps/fiction/fictionAppearanceWriter.js
//
// 「让 AI 写」外貌特征：读角色的人设，把已写的外貌整理好、没写的部分合理补全。
// 走文游自己的接口（和续写同一套 API 配置，含备用 API 回退），不走生图室。
// 写进框里之后就固定了，之后每张图里这个角色的长相保持一致。
//
// 失败（没配置接口、网络错误、AI 没写出东西）会抛错，调用方提示用户自己写。

import { callFictionApi } from './fictionAiService';
import {
  APPEARANCE_SYSTEM_PROMPT,
  buildAppearanceMessage,
  cleanAppearance,
} from './fictionAppearance';

export const APPEARANCE_MAX_TOKENS = 600;

export const writeAppearance = async ({
  name,
  setting,
  existing,
  background,
  signal,
}) => {
  const result = await callFictionApi({
    systemPrompt: APPEARANCE_SYSTEM_PROMPT,
    userMessage: buildAppearanceMessage({ name, setting, existing, background }),
    maxTokens: APPEARANCE_MAX_TOKENS,
    signal,
  });

  const text = cleanAppearance(result?.content);

  if (!text) throw new Error('AI 没有写出外貌特征。');

  return text;
};

export default {
  writeAppearance,
};
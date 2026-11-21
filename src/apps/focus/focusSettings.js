// src/apps/focus/focusSettings.js
//
// 专注页用到的两条设置，都存在通用的 db.settings 键值表里（不需要改数据库结构）：
//   focusGrowthStyle  成长图标风格：'plant' | 'jar' | 'moon'
//   focusLastPrefs    上一次开始专注时的选择（时长、地点、被通知的聊天、是否休息），下次作为默认值

import db from '../../db';
import { DEFAULT_GROWTH_STYLE, normalizeGrowthStyle } from './focusGrowthIcons';

export const FOCUS_GROWTH_STYLE_KEY = 'focusGrowthStyle';
export const FOCUS_LAST_PREFS_KEY = 'focusLastPrefs';

export const getFocusGrowthStyle = async () => {
  try {
    const row = await db.settings.get(FOCUS_GROWTH_STYLE_KEY);
    return normalizeGrowthStyle(row?.value);
  } catch {
    return DEFAULT_GROWTH_STYLE;
  }
};

export const saveFocusGrowthStyle = async (style) => {
  const value = normalizeGrowthStyle(style);
  await db.settings.put({ key: FOCUS_GROWTH_STYLE_KEY, value });
  return value;
};

export const getFocusLastPrefs = async () => {
  try {
    const row = await db.settings.get(FOCUS_LAST_PREFS_KEY);
    return row?.value && typeof row.value === 'object' ? row.value : {};
  } catch {
    return {};
  }
};

export const saveFocusLastPrefs = async (prefs) => {
  try {
    await db.settings.put({ key: FOCUS_LAST_PREFS_KEY, value: prefs });
  } catch (error) {
    console.warn('[focus] 保存上次选择失败:', error);
  }
};

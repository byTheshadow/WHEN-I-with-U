// src/apps/messages/screenEffects/screenEffectPrefs.js
//
// 全屏特效的用户偏好：每种卡片是否开启"底色"。
// 存在 db.settings 的一行里（key/value 表，不需要升级数据库版本），
// 默认全部开启；备份导出会自然带上这一行。

import db from '../../../db';
import { ALL_EFFECT_CARDS } from './screenEffectPresets';

const BACKDROP_PREFS_KEY = 'screen_effect_backdrop_prefs';

const buildDefaults = () => {
  const defaults = {};
  ALL_EFFECT_CARDS.forEach((card) => {
    defaults[card.id] = true;
  });
  return defaults;
};

export const getBackdropPrefs = async () => {
  const defaults = buildDefaults();

  try {
    const record = await db.settings.get(BACKDROP_PREFS_KEY);
    const saved = record?.value;
    if (saved && typeof saved === 'object') {
      Object.keys(defaults).forEach((id) => {
        if (typeof saved[id] === 'boolean') {
          defaults[id] = saved[id];
        }
      });
    }
  } catch (error) {
    console.warn('[ScreenEffect] 读取底色偏好失败，使用默认值：', error);
  }

  return defaults;
};

export const getBackdropPref = async (presetId) => {
  const prefs = await getBackdropPrefs();
  return prefs[presetId] !== false;
};

export const setBackdropPref = async (presetId, enabled) => {
  const prefs = await getBackdropPrefs();
  prefs[presetId] = Boolean(enabled);
  await db.settings.put({ key: BACKDROP_PREFS_KEY, value: prefs });
  return prefs;
};
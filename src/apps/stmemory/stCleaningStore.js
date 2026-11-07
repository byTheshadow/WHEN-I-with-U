// src/apps/stmemory/stCleaningStore.js
//
// 清洗规则的保存与读取。规则是全局共用的一份，存在 db.settings 里
// （key/value 形式，不需要新表，也不需要升数据库版本）。
import db from '../../db';
import { CLEANING_RULES_SETTING_KEY } from './stPackConstants';

export const loadCleaningRules = async () => {
  try {
    const row = await db.settings.get(CLEANING_RULES_SETTING_KEY);
    return Array.isArray(row?.value) ? row.value : [];
  } catch (error) {
    console.warn('[stmemory] 读取清洗规则失败：', error);
    return [];
  }
};

export const saveCleaningRules = async (rules) => {
  await db.settings.put({
    key: CLEANING_RULES_SETTING_KEY,
    value: Array.isArray(rules) ? rules : [],
  });
};

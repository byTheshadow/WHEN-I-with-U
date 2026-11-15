// src/apps/characterArea/characterAreaSectionApply.js
//
// 角色专属区域——把整理输出里的 [SECTION_NEW] 写进区域那一行（切片 F3）。
//
// 规则（上限 4 个、间隔 3 天、重名跳过、一次最多建一个）都在 characterAreaSections.js
// 的纯函数里，这里只负责：读最新的区域行、套规则、写回、通知页面刷新。
// 任何出错都只是"这次没建成"，返回原来的栏目，不影响整理本身。
//
// 刷新页面复用 characterAreaStyleSession 的 AREA_STYLE_UPDATED_EVENT：区域页
// 收到这个事件就会重新读一遍区域行，栏目在区域行上，所以同一个事件就够了。
import db from '../../db';
import { getAreaForChat } from './characterAreaService';
import { AREA_STYLE_UPDATED_EVENT } from './characterAreaStyleSession';
import {
  addSections,
  getSections,
  hasSectionTag,
  parseSectionDefinitions,
} from './characterAreaSections';

const dispatchAreaRowUpdated = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AREA_STYLE_UPDATED_EVENT, { detail: { chatId } }));
};

// 返回 { sections, created }：sections 是这次处理之后区域上的全部栏目，
// 调用方拿它去给同一次整理里写的条目找归属。
export const applySectionOutput = async ({ chatId, area, rawText, now = Date.now() }) => {
  const fallback = { sections: getSections(area), created: 0 };

  if (!hasSectionTag(rawText)) return fallback;

  try {
    const definitions = parseSectionDefinitions(rawText);
    if (definitions.length === 0) return fallback;

    const latest = (await getAreaForChat(chatId)) || area;
    const result = addSections(getSections(latest), definitions, { now });

    if (result.created === 0) return { sections: result.sections, created: 0 };

    await db.characterAreas.update(latest.id, { sections: result.sections });
    dispatchAreaRowUpdated(chatId);

    return { sections: result.sections, created: result.created };
  } catch (error) {
    console.warn('[characterArea] 新建栏目失败，本次跳过：', error);
    return fallback;
  }
};
// src/apps/characterArea/characterAreaInjection.js
//
// 角色专属区域——把小本子的内容注入主聊天系统提示词（切片 C）。
//
// 做法跟小伙伴状态、角色日常话题那几块一致：按概率抽（抽不中这一轮就完全不
// 查库、不带这一段，跟没有小本子时一样），抽中才注入。注入量刻意压小：
//   - 最近约 8 条的标题；
//   - 另外拿最近几条聊天里的文字去匹配条目自带的关键词，最多带出 2 条正文，
//     每条正文截断到字数上限。
//
// 纯函数部分（pickInjectionEntries / formatInjectionBlock）不碰数据库，单独可测；
// buildPrivateAreaInjectionBlock 是给 aiService.js 的 buildChatSystemPrompt
// 调用的唯一入口，内部整个包了 try/catch，任何出错都只返回空字符串，不影响聊天。
import Dexie from 'dexie';
import db from '../../db';
import { getAreaForChat } from './characterAreaService';
import { getAreaEntries } from './characterAreaEntryService';

export const PRIVATE_AREA_INJECT_PROBABILITY = 0.3;

const MAX_TITLES = 8;
const MAX_BODIES = 2;
const BODY_CHAR_LIMIT = 120;
const RECENT_MESSAGES_FOR_MATCH = 4;


export const pickInjectionEntries = (entries, recentText) => {
  const list = Array.isArray(entries) ? entries : [];
  const haystack = String(recentText || '').toLowerCase();

  const titles = list.slice(0, MAX_TITLES).map((entry) => entry.title);

  const bodies = haystack
    ? list
        .filter(
          (entry) =>
            Array.isArray(entry.keywords) &&
            entry.keywords.some((word) => word && haystack.includes(String(word).toLowerCase()))
        )
        .slice(0, MAX_BODIES)
        .map((entry) => ({
          title: entry.title,
          content: String(entry.content || '').slice(0, BODY_CHAR_LIMIT),
        }))
    : [];

  return { titles, bodies };
};

export const formatInjectionBlock = (area, picked) => {
  if (!area || !picked || picked.titles.length === 0) return '';

  const titleLines = picked.titles.map((title) => `- ${title}`).join('\n');

  const bodyText =
    picked.bodies.length > 0
      ? `\n这次聊到的话题，恰好和下面几条有关（可以自然想起来，不用原样复述）：\n${picked.bodies
          .map((body) => `- ${body.title}：${body.content}`)
          .join('\n')}`
      : '';

  return `\n【你的专属小本子「${area.name}」（只有你自己知道里面写了什么；用户只能看到标题，想翻开正文得你同意）】
你最近记下的：
${titleLines}${bodyText}
这些是你自己的小心思，不是每次都要提，顺着聊天自然带出来就好；不要刻意引导话题，也不要向用户解释"小本子"这套机制本身。\n`;
};

const getRecentMatchText = async (chatId) => {
  const rows = await db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(RECENT_MESSAGES_FOR_MATCH)
    .toArray();

  return rows
    .filter((message) => message.type === 'text' && message.content)
    .map((message) => String(message.content))
    .join('\n');
};

export const buildPrivateAreaInjectionBlock = async (chatId, { random = Math.random } = {}) => {
  if (random() >= PRIVATE_AREA_INJECT_PROBABILITY) return '';

  try {
    const area = await getAreaForChat(chatId);
    if (!area) return '';

    const entries = await getAreaEntries(chatId);
    if (entries.length === 0) return '';

    const recentText = await getRecentMatchText(chatId);

    return formatInjectionBlock(area, pickInjectionEntries(entries, recentText));
  } catch (error) {
    console.warn('[characterArea] 注入小本子内容失败，本轮跳过：', error);
    return '';
  }
};
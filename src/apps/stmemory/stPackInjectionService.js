// src/apps/stmemory/stPackInjectionService.js
//
// 把聊天上挂着的记忆包拼成一段系统提示词文本。
// aiService.js 只在 getSafeChatMemoryContext 里调用 getStPackPromptContext 一次，
// 和"记忆来源开关"无关（内置记忆关掉，挂着的包照常注入）。
//
// 任何异常都降级为空字符串，绝不阻断正常聊天。
//
// 注意：这个文件不要 import aiService，避免循环引用。
import db from '../../db';
import {
  OVERVIEW_MODE_NOTE,
  PLACEHOLDER_CHAR,
  PLACEHOLDER_USER,
} from './stPackConstants';
import {
  getActivePinnedRange,
  getFramingText,
  getSummaryEntries,
  hasSummaryEntries,
  isOverviewLinkEmpty,
  isOverviewMode,
  normalizeRange,
  planStPackInjection,
} from './stPackBudget';
import { getChatBudget, getChatLinks } from './stPackLinkService';
import { getChunksInRange, getPacksByIds } from './stPackService';

const replacePlaceholders = (text, charName, userName) => (
  text
    .split(PLACEHOLDER_CHAR).join(charName)
    .split(PLACEHOLDER_USER).join(userName)
);

// 概览模式：只带概览 + 一段说明，外加用户手动钉住的那段原文（如果有）。
// 概览为空又没钉住原文时返回空串（整块跳过，不注入一个空壳）。
const buildOverviewBlock = async (item) => {
  const { pack, link } = item;
  if (isOverviewLinkEmpty(pack, link)) return '';

  const parts = [`【记忆包：${pack.title}】`, getFramingText(link)];

  const overview = String(pack.overview || '').trim();
  if (overview) parts.push(`【概览】\n${overview}`);

  parts.push(`【说明】\n${OVERVIEW_MODE_NOTE}`);

  const pinned = getActivePinnedRange(pack, link);
  if (pinned) {
    const chunks = await getChunksInRange(pack.id, pinned.from, pinned.to);
    const text = chunks.map((chunk) => chunk.text).join('').trim();
    if (text) {
      parts.push(
        `【正在翻阅的原文（第 ${pinned.from + 1} 到 ${pinned.to + 1} 块，每条消息以 ${PLACEHOLDER_USER}: 或 ${PLACEHOLDER_CHAR}: 开头）】\n${text}`,
      );
    }
  }

  return parts.join('\n');
};

const buildPackBlock = async (item) => {
  const { pack, link } = item;
  if (isOverviewMode(link)) return buildOverviewBlock(item);

  const useSummary = hasSummaryEntries(pack);

  let body = '';
  if (useSummary) {
    // 总结条目优先：有总结就只注入总结（按条目范围），不读原文块。
    const entries = getSummaryEntries(pack);
    const range = normalizeRange(link.entryRange, entries.length);
    body = range
      ? entries.slice(range.from, range.to + 1).map((entry) => String(entry.text || '').trim()).filter(Boolean).join('\n\n')
      : '';
  } else {
    const range = normalizeRange(link.range, pack.chunkCount);
    const chunks = range ? await getChunksInRange(pack.id, range.from, range.to) : [];
    body = chunks.map((chunk) => chunk.text).join('');
  }

  const parts = [`【记忆包：${pack.title}】`, getFramingText(link)];

  const overview = String(pack.overview || '').trim();
  if (overview) parts.push(`【概览】\n${overview}`);

  if (body.trim()) parts.push(`${useSummary ? '【剧情总结】' : '【内容】'}\n${body.trim()}`);

  return parts.join('\n');
};

export const getStPackPromptContext = async (chatId) => {
  try {
    if (chatId == null) return '';

    const chat = await db.chats.get(chatId);
    const links = getChatLinks(chat);
    if (!links.some((link) => link.enabled)) return '';

    const packsById = await getPacksByIds(links.map((link) => link.packId));
    const plan = planStPackInjection({
      links,
      packsById,
      budget: getChatBudget(chat),
    });

    const included = plan.items.filter((item) => item.status === 'included');
    if (included.length === 0) return '';

    const blocks = [];
    for (const item of included) {
      const block = await buildPackBlock(item);
      if (block) blocks.push(block);
    }
    if (blocks.length === 0) return '';

    const character = chat.characterId ? await db.characters.get(chat.characterId) : null;
    const charName = String(character?.name || '').trim() || '角色';
    const userName = String(chat.userName || character?.userName || '').trim() || '用户';

    const text = `\n\n【外部导入的剧情记录】\n${blocks.join('\n\n---\n\n')}\n`;
    return replacePlaceholders(text, charName, userName);
  } catch (error) {
    console.warn('[stmemory] 记忆包注入已安全跳过：', error);
    return '';
  }
};
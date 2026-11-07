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
  PLACEHOLDER_CHAR,
  PLACEHOLDER_USER,
} from './stPackConstants';
import {
  getFramingText,
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

const buildPackBlock = async (item) => {
  const { pack, link } = item;
  const range = normalizeRange(link.range, pack.chunkCount);
  const chunks = range ? await getChunksInRange(pack.id, range.from, range.to) : [];
  const body = chunks.map((chunk) => chunk.text).join('');

  const parts = [`【记忆包：${pack.title}】`, getFramingText(link)];

  const overview = String(pack.overview || '').trim();
  if (overview) parts.push(`【概览】\n${overview}`);

  if (body.trim()) parts.push(`【内容】\n${body.trim()}`);

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
      blocks.push(await buildPackBlock(item));
    }

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

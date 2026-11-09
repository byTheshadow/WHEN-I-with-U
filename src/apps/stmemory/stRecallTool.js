// src/apps/stmemory/stRecallTool.js
//
// M2 切片 2：给角色用的内置工具，让它在拿不准细节时自己去查往事原文。
// 和 savedInfoTool.js 同一个做法：不是 MCP 工具，只读本地数据库，不走 MCP 审批，
// 只在 aiToolOrchestrator.js 的工具循环里被调用，结果回到同一轮回答里。
//
// 只给"概览模式、会被注入、并且有总结条目带原文位置"的挂载注册；
// 没有这样的挂载时 createStRecallSession 返回 null，请求格式完全不变。
//
// 注意：这个文件不要 import aiService（也不要 import stSummaryEngine），避免循环引用。
import db from '../../db';
import {
  CHUNK_TARGET_CHARS,
  PLACEHOLDER_CHAR,
  PLACEHOLDER_USER,
  RECALL_CATALOG_MAX,
  RECALL_MAX_PER_RESPONSE,
  RECALL_MAX_SEARCHES_PER_RESPONSE,
  RECALL_MAX_TOKENS,
} from './stPackConstants';
import {
  estimateTokens,
  getSummaryEntries,
  hasSummaryEntries,
  isOverviewMode,
  planStPackInjection,
} from './stPackBudget';
import { getChatBudget, getChatLinks } from './stPackLinkService';
import { getChunksInRange, getPacksByIds } from './stPackService';

export const ST_RECALL_TOOL_NAME = 'recall_past_story';

export const ST_RECALL_PROMPT_RULE = `
【查阅往事原文】
挂载的往事只带了概览，并不完整。当对话涉及的具体细节（谁说过什么、事情的先后、某个场景的经过）你拿不准时，先用工具 ${ST_RECALL_TOOL_NAME} 查阅对应条目的原文，再据此回答，不要凭印象编造。
用户明确要你去翻一翻、查一查往事时，也用它。
查不到、或没有对应条目时，坦率说记不清。查到的原文只用于这一次回答，不必大段复述。
`;

const TITLE_MAX_CHARS = 20;
const MAX_KEYWORD_RESULTS = 8;
// chunkTokens 缺失时的保守估计，只影响分页，不影响内容。
const FALLBACK_CHUNK_TOKENS = Math.ceil(CHUNK_TARGET_CHARS * 0.6);

const replacePlaceholders = (text, charName, userName) => (
  String(text || '')
    .split(PLACEHOLDER_CHAR).join(charName)
    .split(PLACEHOLDER_USER).join(userName)
);

/**
 * 条目标题：总结正文的第一句，最多约 20 个字。不存进数据库，每次现算，
 * 所以改了总结正文，标题自动跟着变；旧总结不需要任何迁移。
 */
export const makeEntryTitle = (text) => {
  const firstLine = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/^[\s#>*\-•]+/, '').replace(/^\d+[.、)）]\s*/, '').trim())
    .find(Boolean) || '';

  const sentenceEnd = firstLine.search(/[。！？!?；;]/);
  const sentence = sentenceEnd >= 0 ? firstLine.slice(0, sentenceEnd) : firstLine;

  const chars = Array.from(sentence);
  if (chars.length > TITLE_MAX_CHARS) return `${chars.slice(0, TITLE_MAX_CHARS).join('')}…`;
  return chars.join('') || '（空）';
};

const hasOriginal = (entry) => Number.isFinite(entry?.coveredChunkThrough);

/**
 * 第 entryIndex 条总结对应的原文块范围（块下标，含两端）。
 * 起点取前一条带原文位置的总结的终点块（块是按字数切的、不和消息对齐，
 * 相邻两批共用的边界块会各取一份，所以可能多带前一批的最后几条消息，宁多勿漏）。
 * 手写条目（没有原文位置）返回 null。
 */
export const getEntryChunkRange = (pack, entryIndex) => {
  const entries = getSummaryEntries(pack);
  const entry = entries[entryIndex];
  if (!hasOriginal(entry)) return null;

  const lastChunk = (Number(pack?.chunkCount) || 0) - 1;
  if (lastChunk < 0) return null;

  const to = Math.min(Math.max(Math.floor(entry.coveredChunkThrough), 0), lastChunk);
  let from = 0;
  for (let i = entryIndex - 1; i >= 0; i -= 1) {
    if (hasOriginal(entries[i])) {
      from = Math.min(Math.max(Math.floor(entries[i].coveredChunkThrough), 0), to);
      break;
    }
  }
  return { from, to };
};

/** 把一段块范围按 maxTokens 切成若干页（贪心；单块超过上限时它自己占一页）。 */
export const splitRangeIntoPages = (pack, range, maxTokens = RECALL_MAX_TOKENS) => {
  const tokens = Array.isArray(pack?.chunkTokens) ? pack.chunkTokens : [];
  const pages = [];
  let current = null;

  for (let index = range.from; index <= range.to; index += 1) {
    const chunkTokens = Number.isFinite(tokens[index]) ? tokens[index] : FALLBACK_CHUNK_TOKENS;
    if (current && current.tokens + chunkTokens > maxTokens) {
      pages.push(current);
      current = null;
    }
    if (!current) current = { from: index, to: index, tokens: 0 };
    current.to = index;
    current.tokens += chunkTokens;
  }
  if (current) pages.push(current);
  return pages;
};

const buildCatalogLines = (pack, packNumber) => {
  const entries = getSummaryEntries(pack);
  const startIndex = Math.max(0, entries.length - RECALL_CATALOG_MAX);
  const lines = [`往事${packNumber}《${pack.title}》，共 ${entries.length} 条`];

  if (startIndex > 0) {
    lines.push(`  （只列最近 ${RECALL_CATALOG_MAX} 条，更早的请用 keyword 搜索）`);
  }
  for (let i = startIndex; i < entries.length; i += 1) {
    const entry = entries[i];
    lines.push(`  ${i + 1}. ${makeEntryTitle(entry.text)}${hasOriginal(entry) ? '' : '（手写，无原文）'}`);
  }
  return lines;
};

const loadContext = async (chatId) => {
  if (chatId == null) return null;

  const chat = await db.chats.get(chatId);
  const links = getChatLinks(chat);
  if (!links.some((link) => link.enabled && isOverviewMode(link))) return null;

  const packsById = await getPacksByIds(links.map((link) => link.packId));
  const plan = planStPackInjection({ links, packsById, budget: getChatBudget(chat) });

  const packs = plan.items
    .filter((item) => (
      item.status === 'included'
      && isOverviewMode(item.link)
      && item.pack
      && hasSummaryEntries(item.pack)
      && (Number(item.pack.chunkCount) || 0) > 0
      && getSummaryEntries(item.pack).some(hasOriginal)
    ))
    .map((item) => item.pack);
  if (packs.length === 0) return null;

  const character = chat.characterId ? await db.characters.get(chat.characterId) : null;
  const charName = String(character?.name || '').trim() || '角色';
  const userName = String(chat.userName || character?.userName || '').trim() || '用户';

  return { packs, charName, userName };
};

const buildDefinition = ({ packs, charName, userName }) => {
  const catalog = packs.flatMap((pack, index) => buildCatalogLines(pack, index + 1)).join('\n');

  const description = replacePlaceholders([
    '查阅已挂载往事的原文。概览并不完整，拿不准具体细节时用它，不要凭印象编造。',
    '可查阅的往事与条目（条目前的编号就是 entry 参数）：',
    catalog,
    '用法：传 entry 取该条对应的原文；条目很多、不确定是哪一条时，先传 keyword 搜出相关条目的编号。',
    `原文很长时会分部分返回，可传 part 继续取后面的部分。一次回复里最多取 ${RECALL_MAX_PER_RESPONSE} 次原文。`,
  ].join('\n'), charName, userName);

  return {
    type: 'function',
    function: {
      name: ST_RECALL_TOOL_NAME,
      description,
      parameters: {
        type: 'object',
        properties: {
          pack: {
            type: 'integer',
            description: '往事编号（上面"往事N"的 N）。只有一份往事时可以不填。',
          },
          entry: {
            type: 'integer',
            description: '条目编号，取这一条对应的原文。',
          },
          part: {
            type: 'integer',
            description: '原文较长时的第几部分，从 1 开始，默认 1。',
          },
          keyword: {
            type: 'string',
            description: '不确定是哪一条时，用关键词在全部条目里搜，返回匹配条目的编号和标题。',
          },
        },
      },
    },
  };
};

const parseArguments = (rawArguments) => {
  if (rawArguments === undefined || rawArguments === null) return {};
  let parsed = rawArguments;
  if (typeof rawArguments === 'string') {
    const text = rawArguments.trim();
    if (!text) return {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

const toPositiveInt = (value, fallback) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 1 ? number : fallback;
};

/**
 * 为这一次角色回复创建召回会话。没有可召回的挂载时返回 null。
 * 次数、去重这些状态只存在于这一个会话里，下一条用户消息会重新创建。
 *
 * 返回 { definition, promptRule, run(rawArguments) -> 工具结果文本 }
 */
export const createStRecallSession = async (chatId) => {
  try {
    const context = await loadContext(chatId);
    if (!context) return null;

    const { packs, charName, userName } = context;
    const fill = (text) => replacePlaceholders(text, charName, userName);

    let recallCount = 0;
    let searchCount = 0;
    const seen = new Set();

    const runSearch = (pack, keyword) => {
      if (searchCount >= RECALL_MAX_SEARCHES_PER_RESPONSE) {
        return `本次回复里已经搜索过 ${RECALL_MAX_SEARCHES_PER_RESPONSE} 次了，请根据已有的内容回答，查不到就如实说记不清。`;
      }
      searchCount += 1;

      const needle = keyword.toLowerCase();
      const hits = [];
      getSummaryEntries(pack).forEach((entry, index) => {
        if (String(entry?.text || '').toLowerCase().includes(needle)) hits.push(index);
      });

      if (hits.length === 0) return `没有条目提到“${keyword}”。`;

      const shown = hits.slice(0, MAX_KEYWORD_RESULTS);
      const lines = shown.map((index) => {
        const entry = getSummaryEntries(pack)[index];
        return `${index + 1}. ${makeEntryTitle(entry.text)}${hasOriginal(entry) ? '' : '（手写，无原文）'}`;
      });
      const more = hits.length > shown.length ? `\n（还有 ${hits.length - shown.length} 条匹配，请换更具体的关键词）` : '';
      return `提到“${keyword}”的条目：\n${lines.join('\n')}${more}\n用 entry 传编号即可取对应原文。`;
    };

    const runRecall = async (pack, entryNumber, partNumber) => {
      const entries = getSummaryEntries(pack);
      const entryIndex = entryNumber - 1;
      const entry = entries[entryIndex];
      if (!entry) return `没有第 ${entryNumber} 条，这份往事一共 ${entries.length} 条。`;

      const key = `${pack.id}:${entryNumber}:${partNumber}`;
      if (seen.has(key)) return '这一部分在本次回复里已经取过了，内容就在上文，请直接据此回答。';

      if (recallCount >= RECALL_MAX_PER_RESPONSE) {
        return `本次回复里已经查阅过 ${RECALL_MAX_PER_RESPONSE} 次了，请根据已有的内容回答，查不到就如实说记不清。`;
      }

      const range = getEntryChunkRange(pack, entryIndex);
      if (!range) {
        recallCount += 1;
        seen.add(key);
        return `第 ${entryNumber} 条是手写的总结，没有对应的原文。它的内容是：\n${String(entry.text || '').trim()}`;
      }

      const pages = splitRangeIntoPages(pack, range);
      if (partNumber > pages.length) {
        return `这一条的原文一共只有 ${pages.length} 部分。`;
      }

      recallCount += 1;
      seen.add(key);

      const page = pages[partNumber - 1];
      const chunks = await getChunksInRange(pack.id, page.from, page.to);
      chunks.sort((a, b) => a.index - b.index);
      const text = chunks.map((chunk) => chunk.text).join('').trim();
      if (!text) return '这一部分的原文是空的，没有取到内容。';

      const header = `【往事${packs.indexOf(pack) + 1}《${pack.title}》第 ${entryNumber} 条对应的原文，第 ${partNumber}/${pages.length} 部分，估算约 ${estimateTokens(text)} token；每条消息以 ${PLACEHOLDER_USER}: 或 ${PLACEHOLDER_CHAR}: 开头】`;
      const footer = partNumber < pages.length
        ? `\n（后面还有 ${pages.length - partNumber} 部分，需要时传 part=${partNumber + 1} 继续取）`
        : '';
      const edgeNote = '\n（原文按字数切块，开头或结尾可能带有相邻段落的几条消息）';

      return `${header}\n${text}${edgeNote}${footer}`;
    };

    const run = async (rawArguments) => {
      try {
        const args = parseArguments(rawArguments);
        const packNumber = toPositiveInt(args.pack, 1);
        const pack = packs[packNumber - 1];
        if (!pack) return `没有往事${packNumber}，目前可查阅的往事编号是 1 到 ${packs.length}。`;

        const hasEntry = args.entry !== undefined && args.entry !== null && args.entry !== '';
        const keyword = String(args.keyword ?? '').trim();

        if (hasEntry) {
          const result = await runRecall(pack, toPositiveInt(args.entry, 0), toPositiveInt(args.part, 1));
          return fill(result);
        }
        if (keyword) return fill(runSearch(pack, keyword));
        return '请传 entry（条目编号）取原文，或传 keyword 先搜出相关条目。';
      } catch (error) {
        // 召回失败不能阻断正常对话：只告诉模型"这次没取到"。
        console.warn('[stmemory] 召回往事原文失败：', error);
        return '这次没能取到原文。请凭概览如实回答，不确定的细节不要编造，可以坦率说记不清。';
      }
    };

    return {
      definition: buildDefinition(context),
      promptRule: ST_RECALL_PROMPT_RULE,
      run,
    };
  } catch (error) {
    console.warn('[stmemory] 无法生成召回工具：', error);
    return null;
  }
};
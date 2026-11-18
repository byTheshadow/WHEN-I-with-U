// src/apps/fiction/fictionPromptAssembler.js
//
// 互动文游的提示词组装（纯函数，不碰数据库）。
//
// 组装顺序：故事规则与输出格式 → 文风与字数 → 世界观 → 大纲 → 角色块
//   → 世界书命中条目 → 当前数值 → 前情总结 → 当前路径最近 FULL_TEXT_SEGMENTS 段原文
// 用户这一轮的行动放在单独一条 user 消息里，末尾再重复一遍输出格式
// （上下文长了以后，只在开头写一次的格式要求容易被忽略）。
//
// 历史原文放在 system 提示词里、写成叙述文本，而不是拆成一来一回的聊天消息：
// 拆开的话，assistant 那一侧只剩正文没有选项，模型会照着学，之后也不写选项了。

import { buildInitialSnapshot, normalizeStatDefs } from './fictionParser';
import { clampThinkingMaxTokens } from './fictionThinkingPresets';
import { buildPerspectiveLines } from './fictionPerspective';
import { buildAutoImageLine } from './fictionImagePromptDefaults';
// 当前路径最多带多少段原文（上限，防止总结一直没做、原文窗口无限变大）。
export const FULL_TEXT_SEGMENTS = 50;

// 第 5A 轮：每满这么多段就算一「批」，总结之后整批原文都可以不带了。
export const SUMMARY_BATCH_SIZE = 50;

// 即使某一段已经被总结覆盖，最近这几段仍然带原文，保证和总结之间衔接自然，
// 不会让 AI 在「总结句子」后面硬接下一段。
export const RECENT_FULL_SEGMENTS = 4;

// 角色人设每个字段最多带多少字，防止一份很长的设定把提示词撑爆。
export const CAST_FIELD_MAX = 2500;

export const ACTION_TYPES = {
  START: 'start',
  OPTION: 'option',
  FREE: 'free',
  CONTINUE: 'continue',
  GUIDE: 'guide',
  NEXT_CHAPTER: 'nextChapter',
};

const str = (value) => String(value ?? '').trim();

const clip = (text, max = CAST_FIELD_MAX) => {
  const value = str(text);

  return value.length > max ? `${value.slice(0, max)}…` : value;
};

// ---------------- 行动 ----------------

// 同一个父节点下 actionKey 相同的节点互为「重 roll 版本」，不同的是「分支」。
export const buildActionKey = (action) => {
  if (!action || action.type === ACTION_TYPES.START) return 'start';

  switch (action.type) {
    case ACTION_TYPES.OPTION:
      return `opt:${action.optionKey}`;
    case ACTION_TYPES.FREE:
      return `free:${str(action.text).toLowerCase().slice(0, 80)}`;
    case ACTION_TYPES.GUIDE:
      return `guide:${str(action.text).toLowerCase().slice(0, 80)}`;
    case ACTION_TYPES.NEXT_CHAPTER:
      return 'next';
    case ACTION_TYPES.CONTINUE:
    default:
      return 'continue';
  }
};

// 写进历史原文里的一行「玩家做了什么」。总结草稿（fictionAiService.js）也要用，
// 所以导出。
export const describeActionForHistory = (action) => {
  if (!action) return '';

  switch (action.type) {
    case ACTION_TYPES.OPTION:
      return `玩家选择了「${str(action.text)}」`;
    case ACTION_TYPES.FREE:
      return `玩家自己写了行动：${str(action.text)}`;
    case ACTION_TYPES.GUIDE:
      return `玩家给了一句引导：${str(action.text)}`;
    case ACTION_TYPES.NEXT_CHAPTER:
      return '玩家要求进入下一章';
    case ACTION_TYPES.CONTINUE:
      return '玩家要求继续';
    default:
      return '';
  }
};

// ---------------- 角色 ----------------

const pickCharacter = (source) => ({
  name: str(source?.name),
  bio: clip(source?.bio),
  extraNotes: clip(source?.extraNotes),
});

/**
 * 把存档里的引用展开成三组：
 *   main    主角色（没选时为 null）
 *   others  其他导入角色，以 NPC 身份登场
 *   npcs    用户指定一定要出场的专属 NPC
 */
export const resolveCast = (save) => {
  const imported = Array.isArray(save?.importedCharacters) ? save.importedCharacters : [];
  const main = save?.mainCharacter || null;

  let mainCharacter = null;
  let mainImportedId = null;

  if (main?.source === 'imported') {
    const found = imported.find((item) => item.localId === main.importedId);

    if (found) {
      mainCharacter = pickCharacter(found);
      mainImportedId = found.localId;
    }
  } else if (main?.source === 'custom') {
    mainCharacter = pickCharacter(main);
  }

  return {
    main: mainCharacter,
    others: imported.filter((item) => item.localId !== mainImportedId).map(pickCharacter),
    npcs: (Array.isArray(save?.npcs) ? save.npcs : [])
      .filter((npc) => str(npc?.name))
      .map((npc) => ({ name: str(npc.name), desc: clip(npc.desc, 500) })),
  };
};

const renderCharacter = (character) => {
  const lines = [`【${character.name || '（未命名）'}】`];

  if (character.bio) lines.push(character.bio);
  if (character.extraNotes) lines.push(`补充：${character.extraNotes}`);

  return lines.join('\n');
};

const buildCastBlock = (save) => {
  const cast = resolveCast(save);
  const blocks = [];

  if (cast.main) {
    blocks.push(`## 重点角色（故事的重点，戏份可以更多）\n${renderCharacter(cast.main)}`);
  }

  if (cast.others.length > 0) {
    blocks.push(`## ${cast.main ? '其他登场角色' : '登场角色'}\n${cast.others.map(renderCharacter).join('\n\n')}`);
  }

  if (cast.npcs.length > 0) {
    blocks.push(`## 一定要出场的 NPC\n${cast.npcs.map((npc) => `- ${npc.name}${npc.desc ? `：${npc.desc}` : ''}`).join('\n')}`);
  }

  blocks.push('除上面列出的人物外，可以按剧情需要自行引入新角色。');

  return blocks.join('\n\n');
};

const buildPersonaBlock = (save) => {
  const persona = save?.persona;

  if (!persona) return '';

  const lines = [];

  if (str(persona.name)) lines.push(`姓名：${str(persona.name)}`);
  if (str(persona.identity)) lines.push(`身份与经历：${clip(persona.identity)}`);
  if (str(persona.extra)) lines.push(`补充：${clip(persona.extra)}`);

  return lines.length > 0 ? `## 玩家扮演的角色（「我的设定」）\n${lines.join('\n')}` : '';
};

// ---------------- 数值 ----------------

const buildStatsBlock = (stats, snapshot) => {
  const defs = normalizeStatDefs(stats);

  if (defs.length === 0) return '';

  const lines = defs.map((stat) => {
    const value = snapshot && snapshot[stat.id] !== undefined ? snapshot[stat.id] : stat.initial;

    return `- ${stat.name}（范围 ${stat.min} 到 ${stat.max}，当前 ${value}）${stat.desc ? `：${stat.desc}` : ''}`;
  });

  return [
    '## 当前数值',
    lines.join('\n'),
    '数值会影响人物的态度与剧情走向，请让它自然地体现在剧情里（例如好感度高，对方会更愿意透露心事），但不要在正文里直接写出数字。',
  ].join('\n');
};

// ---------------- 输出格式 ----------------

const buildFormatRules = ({ save, stats, isFreeAction, imagePrompt = '' }) => {
  const mode = save.mode === 'novel' ? 'novel' : 'choice';
  const defs = normalizeStatDefs(stats);
  const wordMin = Number(save.wordMin) || 2000;
  const optionMin = Number(save.optionMin) || 3;
  const lines = [];

  if (mode === 'choice') {
    const exampleDelta = defs.length > 0 ? `${defs[0].name}:+2${defs[1] ? `,${defs[1].name}:-1` : ''}` : '';

    lines.push(
      '严格按下面的格式输出，不要输出格式之外的任何说明、前言或客套话：',
      '[STORY]',
      `这一段的剧情正文（不少于 ${wordMin} 字）`,
      '[/STORY]',
      '[OPTIONS]',
      `A|选项文字|${exampleDelta}`,
      `B|选项文字|${defs.length > 0 ? `${defs[0].name}:-1` : ''}`,
      `C|选项文字|`,
      '[/OPTIONS]',
      '',
      `选项规则：至少给出 ${optionMin} 个选项（最多 6 个），每个选项是玩家（「你」）下一步可以做的一件事，一句话写清，用纯文字，不要在选项文字里写数值。选项要真正通向不同的方向，可以有稳妥的也可以有冒险的，不要让某个选项明显最优。`,
    );

    if (defs.length > 0) {
      lines.push(
        `选项后面的第三段是这个选项带来的数值增减，格式是「数值名:+2,数值名:-1」，只能使用这些数值名：${defs.map((stat) => stat.name).join('、')}。没有影响就留空。增减幅度要和数值范围相称，一般在 -10 到 +10 之间。`,
      );
    }

    if (isFreeAction && defs.length > 0) {
      lines.push(
        '因为玩家这次是自己写的行动，请在 [/OPTIONS] 之后另起一行，用 [DELTA]数值名:+1,数值名:-2[/DELTA] 给出玩家这个行动本身造成的数值增减；没有变化就写 [DELTA][/DELTA]。',
      );
    }
  } else {
    lines.push(
      '严格按下面的格式输出，不要输出格式之外的任何说明、前言或客套话：',
      '[STORY]',
      `这一节的正文（不少于 ${wordMin} 字）`,
      '[/STORY]',
    );
  }

  if (save.imageMode === 'auto') {
    lines.push(buildAutoImageLine(imagePrompt));
  }

  return lines.join('\n');
};

// ---------------- 前情总结（第 5A 轮） ----------------
//
// 总结挂在「这一批最后一段」对应的节点上：比如总结 1-50 段，就存在路径上
// 第 50 个节点的 summaryText 里。不同分支走的是不同节点，天然各自独立。
// 回 roll / 另开分支不会动旧节点的 summaryText，所以已经做好的总结不会失效；
// 分支出去的新路径如果比原来短，单纯是还没走到那一段，不影响已有总结。

// 从当前路径里，按顺序收集「已经做好的总结」。
export const collectSummaryBatches = (pathNodes) => {
  const nodes = Array.isArray(pathNodes) ? pathNodes : [];
  const batches = [];
  let from = 1;

  nodes.forEach((node, index) => {
    const position = index + 1;
    const text = str(node.summaryText);

    if (text) {
      batches.push({ from, to: position, text, nodeId: node.id });
      from = position + 1;
    }
  });

  return batches;
};

// 当前路径里最早一个「已经满一批却还没有总结」的区间；没有就返回 null。
// 总结要按顺序做——这样「前情总结」永远是连续的，不会中间空一段。
export const findPendingSummaryBatch = (pathNodes) => {
  const nodes = Array.isArray(pathNodes) ? pathNodes : [];
  const batches = collectSummaryBatches(nodes);
  const coveredTo = batches.length > 0 ? batches[batches.length - 1].to : 0;
  const nextBoundary = coveredTo + SUMMARY_BATCH_SIZE;

  if (nodes.length < nextBoundary) return null;

  return { from: coveredTo + 1, to: nextBoundary };
};

// 算一次「原文窗口」从哪段开始：从「已总结到」的下一段开始；但至少留
// RECENT_FULL_SEGMENTS 段做衔接，同时封顶 FULL_TEXT_SEGMENTS 段（总结一直
// 没做时，退回到原来「最近 50 段」的省略提示）。buildHistoryBlock 和
// buildFictionRequest 的 meta 统计共用这一个函数，口径不会对不上。
const planHistoryWindow = (pathNodes) => {
  const nodes = Array.isArray(pathNodes) ? pathNodes : [];
  const total = nodes.length;
  const batches = collectSummaryBatches(nodes);
  const coveredTo = batches.length > 0 ? batches[batches.length - 1].to : 0;

  const rawStart = total === 0 ? 1 : Math.min(
    Math.max(coveredTo + 1, total - FULL_TEXT_SEGMENTS + 1, 1),
    Math.max(total - RECENT_FULL_SEGMENTS + 1, 1),
  );
  const omittedCount = Math.max(0, rawStart - 1 - coveredTo);

  return { batches, coveredTo, rawStart, omittedCount };
};

// ---------------- 前情 ----------------

const buildHistoryBlock = (pathNodes) => {
  const nodes = Array.isArray(pathNodes) ? pathNodes : [];
  const total = nodes.length;

  if (total === 0) return '';

  const { batches, coveredTo, rawStart, omittedCount } = planHistoryWindow(nodes);
  const parts = [];

  if (batches.length > 0) {
    const summaryBlock = batches
      .map((batch) => `【第 ${batch.from}-${batch.to} 段总结】\n${batch.text}`)
      .join('\n\n');

    parts.push(`## 前情总结\n${summaryBlock}`);
  }

  const slice = nodes.slice(rawStart - 1);

  if (slice.length > 0) {
    const segments = slice.map((node, index) => {
      const heading = `【第 ${rawStart + index} 段】`;
      const actionLine = describeActionForHistory(node.userAction);

      return [heading, actionLine ? `（${actionLine}）` : '', str(node.text)].filter(Boolean).join('\n');
    });

    const omitted = omittedCount > 0
      ? `（第 ${coveredTo + 1}-${rawStart - 1} 段剧情已省略且还没有总结，请以下面的内容为准。）\n\n`
      : '';

    parts.push(`## 此前的剧情（按时间顺序，最后一段是刚刚发生的）\n${omitted}${segments.join('\n\n')}`);
  }

  return parts.join('\n\n');
};

// ---------------- 思维链 ----------------
//
// 存档开了思维链时：输出格式里在 [STORY] 前面多一块 [THINK]，系统提示词里多一块
// 「思考预设」，把开着的条目按顺序列给模型。思考不限篇幅，字数要求只管正文。
// 历史里不带以前的思考（buildHistoryBlock 只读 node.text），所以不会越滚越长。

const THINK_FORMAT_LINES = [
  '[THINK]',
  '按「思考预设」逐条写下你的思考（篇幅不限，不计入正文字数）',
  '[/THINK]',
].join('\n');

const withThinkingFormat = (formatRules) => formatRules.replace('[STORY]', `${THINK_FORMAT_LINES}\n[STORY]`);

const buildThinkingBlock = (entries) => {
  const head = [
    '## 思考预设（动笔之前必须先完成）',
    '写正文之前，先在 [THINK]…[/THINK] 里把下面的条目按顺序逐条想一遍：每一条都要写，不能跳过，每条以它的标题开头。思考时要对照上面「文风与字数」里的文风要求。',
    '思考的篇幅不限，想清楚为止；字数要求只针对 [STORY] 里的正文。思考是写给你自己的草稿，不会出现在正文里，思考当中不要写 [STORY]、[OPTIONS] 这些格式标签。',
    '全部条目想完、写下 [/THINK] 之后，再严格依照思考得出的结论写正文。',
  ].join('\n');

  if (entries.length === 0) {
    return `${head}\n\n（没有指定条目：请自己梳理前文、在场人物的状态、这一段要推进什么，再动笔。）`;
  }

  const list = entries
    .map((entry, index) => `${index + 1}. ${entry.title || `第 ${index + 1} 条`}\n${entry.content}`)
    .join('\n\n');

  return `${head}\n\n${list}`;
};

// ---------------- 对外 ----------------

/**
 * 估算这次请求该给多少输出 token。字数下限 2000 字大约要 3000 以上 token，
 * 再留出选项和格式标签的余量；封顶 8192，因为不少服务商的上限就是这个数。
 * 想调整的话改这一个函数就行。
 */
export const estimateMaxTokens = (wordMin) => {
  const words = Number(wordMin) || 2000;

  return Math.min(8192, Math.max(2048, Math.ceil(words * 2) + 1200));
};

const buildUserMessage = ({ action, formatReminder }) => {
  let head;

  switch (action?.type) {
    case ACTION_TYPES.OPTION:
      head = `玩家选择了：${str(action.text)}\n请接着写这个选择之后发生的事。`;
      break;
    case ACTION_TYPES.FREE:
      head = `玩家自己写了一个行动：${str(action.text)}\n请接着写这个行动之后发生的事（行动的结果要合理，不要无条件让它成功）。`;
      break;
    case ACTION_TYPES.GUIDE:
      head = `玩家给了一句引导：${str(action.text)}\n请顺着这个引导继续往下写。`;
      break;
    case ACTION_TYPES.NEXT_CHAPTER:
      head = '玩家要求进入下一章。请收束上一章，开启新的一章。';
      break;
    case ACTION_TYPES.CONTINUE:
      head = '请紧接上一段继续往下写。';
      break;
    default:
      head = '请开始这个故事，写出开场的第一段。';
  }

  return `${head}\n\n${formatReminder}`;
};

/**
 * 组装一次生成请求。
 *
 * @param save           存档记录
 * @param pathNodes      从开场到「父节点」的节点数组（含父节点）；写开场时传空数组
 * @param action         这一轮的行动 { type, text, optionKey }；写开场时可以不传
 * @param statsSnapshot  传给 AI 看的「当前数值」（点选项时应该是已经加上该选项增减量之后的值）
 * @param stylePrompt    已经拼好的文风描述（预设 + 自定义）
 * @param worldBookText  命中的世界书文本（第 5B 轮接入，现在传空）
 * @returns { systemPrompt, userMessage, maxTokens, meta }  meta 里是日志用的统计
 */
export const buildFictionRequest = ({
  save,
  pathNodes = [],
  action = null,
  statsSnapshot = null,
  stylePrompt = '',
  worldBookText = '',
  thinking = null,
  imagePrompt = '',
}) => {
  const stats = save.stats || [];
  const snapshot = statsSnapshot || buildInitialSnapshot(stats);
  const isFreeAction = action?.type === ACTION_TYPES.FREE;
  const mode = save.mode === 'novel' ? 'novel' : 'choice';
  const wordMin = Number(save.wordMin) || 2000;

  // thinking 不为空表示这份存档开了思维链，形如 { entries: [{ title, content }] }
  const useThinking = Boolean(thinking);
  const thinkingEntries = (Array.isArray(thinking?.entries) ? thinking.entries : [])
    .map((entry) => ({ title: str(entry?.title), content: str(entry?.content) }))
    .filter((entry) => entry.content);
  const thinkingBlock = useThinking ? buildThinkingBlock(thinkingEntries) : '';
  const baseFormatRules = buildFormatRules({ save, stats, isFreeAction, imagePrompt });
  const formatRules = useThinking ? withThinkingFormat(baseFormatRules) : baseFormatRules;

  const intro = [
    '你是一名互动小说的叙述者，正在和玩家一起写一个故事。',
    ...buildPerspectiveLines(save),
    mode === 'choice'
      ? '每一段都要把剧情推进到一个需要玩家做决定的时刻再停下，不要替玩家做决定，也不要替玩家说话或行动。'
      : '每一节都要把剧情自然往前推进，可以停在一个有余味的地方，不要替玩家做决定。',
    '不要重复上一段已经写过的内容，不要提前收束整个故事，保持悬念和节奏。',
  ].join('\n');

  const styleBlock = [
    '## 文风与字数',
    str(stylePrompt) || '没有指定文风，请用自然流畅的小说笔法。',
    `每一段正文不少于 ${wordMin} 字。`,
  ].join('\n');

  const outlineBlock = str(save.outline)
    ? `## 故事大纲（请大体按它发展，但可以灵活处理细节）\n${clip(save.outline, 4000)}`
    : '## 故事大纲\n没有提供大纲，请自由发展，让故事有起伏和余地。';

  const blocks = [
    intro,
    `## 输出格式\n${formatRules}`,
    styleBlock,
    thinkingBlock,
    `## 故事背景\n${clip(save.background, 4000)}`,
    outlineBlock,
    buildCastBlock(save),
    buildPersonaBlock(save),
    str(worldBookText),
    buildStatsBlock(stats, snapshot),
    buildHistoryBlock(pathNodes),
  ].filter((block) => str(block));

  const systemPrompt = blocks.join('\n\n');
  const userMessage = buildUserMessage({
    action,
    formatReminder: `（记得按格式输出：${useThinking ? '先在 [THINK]…[/THINK] 里按思考预设逐条想完，再写 ' : '先 '}[STORY]…[/STORY]${mode === 'choice' ? '，再 [OPTIONS]…[/OPTIONS]' : ''}${isFreeAction && normalizeStatDefs(stats).length > 0 ? '，最后 [DELTA]…[/DELTA]' : ''}，正文不少于 ${wordMin} 字。）`,
  });

  const { batches, rawStart, omittedCount } = planHistoryWindow(pathNodes);

  return {
    systemPrompt,
    userMessage,
    maxTokens: useThinking
      ? Math.max(estimateMaxTokens(wordMin), clampThinkingMaxTokens(save.thinkingMaxTokens))
      : estimateMaxTokens(wordMin),
    meta: {
        systemChars: systemPrompt.length,
      thinkingEntries: useThinking ? thinkingEntries.length : -1,
      historySegments: Math.max(0, pathNodes.length - rawStart + 1),
      historyOmitted: omittedCount,
      summaryBatches: batches.length,
      summarizedTo: batches.length > 0 ? batches[batches.length - 1].to : 0,
    },
  };
};

export default {
  FULL_TEXT_SEGMENTS,
  SUMMARY_BATCH_SIZE,
  RECENT_FULL_SEGMENTS,
  CAST_FIELD_MAX,
  ACTION_TYPES,
  buildActionKey,
  describeActionForHistory,
  resolveCast,
  estimateMaxTokens,
  collectSummaryBatches,
  findPendingSummaryBatch,
  buildFictionRequest,
};
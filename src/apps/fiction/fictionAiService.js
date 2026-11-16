// src/apps/fiction/fictionAiService.js
//
// 互动文游的 AI 层：调用接口 → 解析 → 数值结算 → 写入节点。
//
// 为什么不直接用 aiService.generateResponse：它不接受 max_tokens（输出长度
// 会落在服务商的默认值上，2000 字的段落很容易被截断），也不能中止。
// 这里自己发请求，读法和主聊天一致：先读 settings 里的 apiConfig，
// 网络错误 / HTTP 错误时再试 apiConfigBackup（有配置才试）。
//
// 对外三个入口，都返回 { node, warnings }，失败抛出带 code 的 Error：
//   generateOpening(saveId, { signal })               生成开场，写入开场节点
//   generateNext(saveId, parentNodeId, action, ...)   在某个节点后续写一段；这个行动之前走过的话，
//                                                     直接回到已有的那一段，不重新生成（返回 reused: true）
//   rerollNode(saveId, nodeId, { signal })            重 roll 一个「还没有后续」的节点：在它旁边新增一个
//                                                     同父同 actionKey 的新版本，旧版本原样保留
//   generateSummaryDraft(saveId, { from, to, signal }) 第 5A 轮：给当前路径第 from-to 段生成一份总结草稿，
//                                                     只返回文本，不写库——存不存、改不改由用户在总结总览页决定
//
// 数值在这里结算：点选项 = 父节点快照 + 该选项的增减量；自由输入 = 父节点
// 快照 + AI 在 [DELTA] 里给的增减量；都截断到 [min, max]。快照用数值 id 做 key。

import db from '../../db';
import {
  ROOT_PARENT_ID,
  getSave,
  getNode,
  getPathToNode,
  getRootNode,
  hasChildren,
  findExistingChild,
  appendNode,
  setCurrentNode,
} from './fictionService';
import { getStylePreset } from './fictionWizardService';
import {
  THINKING_PRESETS_SETTING_KEY,
  pickThinkingEntries,
  resolveThinkingPreset,
} from './fictionThinkingPresets';
import {
  buildWorldBookScanText,
  matchWorldBookEntries,
  renderWorldBookBlock,
} from './fictionWorldBook';
import {
  ACTION_TYPES,
  buildActionKey,
  buildFictionRequest,
  describeActionForHistory,
} from './fictionPromptAssembler';
import {
  PARSE_WARNING,
  applyDeltas,
  buildInitialSnapshot,
  parseFictionReply,
} from './fictionParser';

export const FICTION_ERROR = {
  CONFIG_MISSING: 'CONFIG_MISSING',
  NETWORK: 'NETWORK_ERROR',
  HTTP: 'HTTP_ERROR',
  EMPTY: 'EMPTY_RESPONSE',
  NO_STORY: 'NO_STORY',
  ABORTED: 'ABORTED',
  BAD_STATE: 'BAD_STATE',
};

const fail = (code, message) => {
  const error = new Error(message);

  error.code = code;
  return error;
};

// ---------------- 调用接口 ----------------

const attemptOnce = async ({ apiConfig, systemPrompt, userMessage, maxTokens, signal, tokenParam }) => {
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) {
    return { error: fail(FICTION_ERROR.CONFIG_MISSING, '请先在系统设置中配置有效的 API Base URL 与 API Key。') };
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        [tokenParam]: maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      let detail = response.statusText || '请求未成功';

      try {
        const data = await response.json();

        detail = data?.error?.message || data?.message || detail;
      } catch {
        // 返回的不是 JSON（HTML 错误页之类），保留状态文本。
      }

      const error = fail(FICTION_ERROR.HTTP, `[API Error ${response.status}] ${detail}`);

      error.status = response.status;
      return { error };
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = String(choice?.message?.content || '').trim();
    // 推理型模型的原生思考：不同服务商放在 reasoning_content 或 reasoning 里
    const reasoningRaw = choice?.message?.reasoning_content ?? choice?.message?.reasoning;
    const reasoning = typeof reasoningRaw === 'string' ? reasoningRaw.trim() : '';

    if (!content) {
           return {
        error: fail(
          FICTION_ERROR.EMPTY,
          choice?.finish_reason === 'length'
            ? '输出额度在思考阶段就用完了，正文没有写出来。可以在「编辑设定」里调高输出上限，或者直接重试。'
            : 'AI 返回内容为空，请检查当前模型或 API 服务状态。',
        ),
      };
    }

    return {
      content,
           finishReason: choice?.finish_reason || '',
      reasoning,
      usage: data?.usage || null,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { error: fail(FICTION_ERROR.ABORTED, '已取消本次生成') };
    }

    return { error: fail(FICTION_ERROR.NETWORK, `网络请求失败: ${error?.message || '未知错误'}`) };
  }
};

// 部分新模型不认 max_tokens，要求写成 max_completion_tokens；服务商会返回 400
// 并在报错里点名这个参数。遇到这种情况换个参数名重试一次。
const attemptWithTokenFallback = async (args) => {
  const first = await attemptOnce({ ...args, tokenParam: 'max_tokens' });

  if (
    first.error?.status === 400
    && /max_tokens|max_completion_tokens/i.test(first.error.message)
  ) {
    return attemptOnce({ ...args, tokenParam: 'max_completion_tokens' });
  }

  return first;
};

const isBackupWorthy = (error) => (
  error.code === FICTION_ERROR.NETWORK
  || error.code === FICTION_ERROR.CONFIG_MISSING
  || error.code === FICTION_ERROR.HTTP
);

const callFictionApi = async ({ systemPrompt, userMessage, maxTokens, signal }) => {
  const primarySetting = await db.settings.get('apiConfig');
  const primary = await attemptWithTokenFallback({
    apiConfig: primarySetting?.value || {},
    systemPrompt,
    userMessage,
    maxTokens,
    signal,
  });

  if (!primary.error) return primary;
  if (!isBackupWorthy(primary.error)) throw primary.error;

  let backupConfig = null;

  try {
    backupConfig = (await db.settings.get('apiConfigBackup'))?.value || null;
  } catch {
    backupConfig = null;
  }

  if (!backupConfig?.baseUrl || !backupConfig?.apiKey) throw primary.error;

  const backup = await attemptWithTokenFallback({
    apiConfig: backupConfig,
    systemPrompt,
    userMessage,
    maxTokens,
    signal,
  });

  if (!backup.error) return backup;

  const combined = fail(backup.error.code, `[主 API] ${primary.error.message}\n[备用 API] ${backup.error.message}`);

  throw combined;
};

// ---------------- 组装与生成 ----------------

const buildStylePrompt = (save) => {
  const preset = getStylePreset(save.style?.presetId);

  return [preset?.prompt, String(save.style?.custom || '').trim()].filter(Boolean).join('\n');
};

// 根据节点上记录的 userAction 找回完整的「行动」。点选项的行动里只存了
// 选项字母，选项文字和增减量要回父节点的 options 里取。
const resolveAction = (parentNode, userAction) => {
  if (!userAction) return { type: ACTION_TYPES.START };

  if (userAction.type !== ACTION_TYPES.OPTION) return { ...userAction };

  const option = (parentNode?.options || []).find((item) => item.key === userAction.optionKey);

  if (!option) throw fail(FICTION_ERROR.BAD_STATE, '找不到这个选项，可能是上一段已经被重新生成了。');

  return { type: ACTION_TYPES.OPTION, optionKey: option.key, text: option.text, deltas: option.deltas || {} };
};

// 第 5B 轮：取出这份存档能用的全部世界书条目（全局世界书在前，本存档专属条目在后）。
// 世界书是聊天里共用的 rpWorldBooks，被删掉的书直接跳过，不报错。
const loadWorldBookEntries = async (save) => {
  const ids = (Array.isArray(save.worldBookIds) ? save.worldBookIds : []).map(Number).filter(Number.isFinite);
  let books = [];

  if (ids.length > 0) {
    try {
      const rows = await db.rpWorldBooks.where('id').anyOf(ids).toArray();

      // 按存档里勾选的顺序排，而不是数据库返回的顺序
      books = ids.map((id) => rows.find((row) => row.id === id)).filter(Boolean);
    } catch (bookError) {
      console.warn('[Fiction] 读取世界书失败，这一轮不带全局世界书：', bookError);
    }
  }

  return [
    ...books.flatMap((book) => (Array.isArray(book.entries) ? book.entries : [])),
    ...(Array.isArray(save.localEntries) ? save.localEntries : []),
  ];
};

const logRequest = (label, request, result) => {
  // 项目之前出现过主聊天 token 暴涨，这里每次生成都留一行日志，方便排查。
  console.info('[Fiction]', label, {
       systemChars: request.meta.systemChars,
    thinkingEntries: request.meta.thinkingEntries,
    historySegments: request.meta.historySegments,
    historyOmitted: request.meta.historyOmitted,
    summaryBatches: request.meta.summaryBatches,
    summarizedTo: request.meta.summarizedTo,
    userChars: request.userMessage.length,
    worldBook: request.worldBook,
    maxTokens: request.maxTokens,
    finishReason: result.finishReason,
    usage: result.usage,
  });
};

/**
 * 跑一次「组装 → 调用 → 解析 → 结算」，不写库。
 * parentNode 为 null 表示写开场。
 */
const runGeneration = async ({ save, parentNode, action, signal, label }) => {
  const stats = save.stats || [];
  const parentSnapshot = parentNode?.statsSnapshot && Object.keys(parentNode.statsSnapshot).length > 0
    ? parentNode.statsSnapshot
    : buildInitialSnapshot(stats);

  // 点选项：先把选项的增减量算进去，AI 看到的是选择之后的数值。
  const promptSnapshot = action.type === ACTION_TYPES.OPTION
    ? applyDeltas(stats, parentSnapshot, action.deltas)
    : parentSnapshot;

  const pathNodes = parentNode ? await getPathToNode(parentNode.id) : [];

  const worldBook = matchWorldBookEntries(
    await loadWorldBookEntries(save),
    buildWorldBookScanText(pathNodes, action),
  );

   // 思维链：存档开了才带。预设库读不到、或者选的预设已经不在了，就用内置默认预设。
  let thinking = null;

  if (save.thinkingChain) {
    let library = null;

    try {
      library = (await db.settings.get(THINKING_PRESETS_SETTING_KEY))?.value || null;
    } catch (presetError) {
      console.warn('[Fiction] 读取思考预设失败，这一轮用内置默认预设：', presetError);
    }

    thinking = {
      entries: pickThinkingEntries(resolveThinkingPreset(library, save.thinkingPresetId), save.mode),
    };
  }

  const request = buildFictionRequest({
    save,
    pathNodes,
    action,
    statsSnapshot: promptSnapshot,
    stylePrompt: buildStylePrompt(save),
     worldBookText: renderWorldBookBlock(worldBook.picked),
    thinking,
  });

  // 日志用：这一轮带了几条世界书（常驻几条、关键词命中几条、因上限没带几条）
  request.worldBook = {
    picked: worldBook.picked.length,
    always: worldBook.always,
    byKeyword: worldBook.byKeyword,
    skippedByLimit: worldBook.skippedByLimit,
    chars: worldBook.chars,
  };

  const result = await callFictionApi({
    systemPrompt: request.systemPrompt,
    userMessage: request.userMessage,
    maxTokens: request.maxTokens,
    signal,
  });

  logRequest(label, request, result);

  const parsed = parseFictionReply(result.content, {
    mode: save.mode,
    stats,
    optionMin: save.optionMin,
  });

  if (!parsed.story) {
      throw fail(
      FICTION_ERROR.NO_STORY,
      result.finishReason === 'length'
        ? '思考太长，输出额度用完了，正文没有写出来。可以在「编辑设定」里调高输出上限，或者直接重试。'
        : 'AI 没有返回可用的正文，可以重新生成。',
    );
  }

  const warnings = [...parsed.warnings];

  if (result.finishReason === 'length') {
    warnings.push({ code: PARSE_WARNING.TRUNCATED });
  }

  // 自由输入：本步增减量由 AI 在 [DELTA] 里给；点选项在上面已经算进了 promptSnapshot。
  const statsSnapshot = action.type === ACTION_TYPES.FREE
    ? applyDeltas(stats, parentSnapshot, parsed.freeDelta)
    : promptSnapshot;

  return {
    fields: {
      text: parsed.story,
      options: parsed.options,
      statsSnapshot,
      imagePrompt: parsed.imagePrompt,
          parseWarnings: warnings,
      // 思考过程：模型原生思考在前，[THINK] 在后；内容完全相同的只留一份。只存不发。
      thinkingText: [result.reasoning, parsed.nativeThinking, parsed.thinking]
        .filter((piece, index, list) => piece && list.indexOf(piece) === index)
        .join('\n\n'),
    },
    warnings,
  };
};

const loadPlayableSave = async (saveId) => {
  const save = await getSave(saveId);

  if (!save) throw fail(FICTION_ERROR.BAD_STATE, '存档不存在。');
  if (save.isDraft) throw fail(FICTION_ERROR.BAD_STATE, '草稿还没有完成创建，不能开始游玩。');

  return save;
};

// ---------------- 对外入口 ----------------

export const generateOpening = async (saveId, { signal } = {}) => {
  const save = await loadPlayableSave(saveId);

  if (await getRootNode(saveId)) {
    throw fail(FICTION_ERROR.BAD_STATE, '这份存档已经有开场了。');
  }

  const { fields, warnings } = await runGeneration({
    save,
    parentNode: null,
    action: { type: ACTION_TYPES.START },
    signal,
    label: '开场',
  });

  const nodeId = await appendNode(saveId, {
    parentId: ROOT_PARENT_ID,
    userAction: null,
    actionKey: buildActionKey({ type: ACTION_TYPES.START }),
    chapter: 1,
    ...fields,
  });

  return { node: await getNode(nodeId), warnings };
};

/**
 * 在 parentNodeId 之后续写一段。
 * action: { type: 'option', optionKey: 'B' }
 *       | { type: 'free', text }
 *       | { type: 'continue' } | { type: 'guide', text } | { type: 'nextChapter' }（后三种留给纯小说式）
 */
export const generateNext = async (saveId, parentNodeId, action, { signal } = {}) => {
  const save = await loadPlayableSave(saveId);
  const parentNode = await getNode(parentNodeId);

  if (!parentNode || parentNode.saveId !== saveId) {
    throw fail(FICTION_ERROR.BAD_STATE, '找不到要接着写的那一段。');
  }

  if (action?.type === ACTION_TYPES.FREE) {
    if (!save.allowFreeInput) throw fail(FICTION_ERROR.BAD_STATE, '这份存档没有开启自由输入。');
    if (!String(action.text || '').trim()) throw fail(FICTION_ERROR.BAD_STATE, '请先写下你的行动。');
  }

  const fullAction = resolveAction(parentNode, action);

  // 这个行动之前走过（回退之后又选了同一个选项、或写了同一句话）：
  // 直接回到已有的那一段，不重新生成，也不花一次请求。
  const existing = await findExistingChild(saveId, parentNode.id, buildActionKey(fullAction));

  if (existing) {
    await setCurrentNode(saveId, existing.id);

    return { node: existing, warnings: existing.parseWarnings || [], reused: true };
  }

  const { fields, warnings } = await runGeneration({
    save,
    parentNode,
    action: fullAction,
    signal,
    label: `第 ${(save.segmentCount || 0) + 1} 段`,
  });

  // 节点上只存「玩家做了什么」，不存选项的增减量（那在父节点的 options 里）。
  const userAction = fullAction.type === ACTION_TYPES.OPTION
    ? { type: ACTION_TYPES.OPTION, optionKey: fullAction.optionKey, text: fullAction.text }
    : { type: fullAction.type, text: String(fullAction.text || '').trim() };

  const nodeId = await appendNode(saveId, {
    parentId: parentNode.id,
    userAction,
    actionKey: buildActionKey(fullAction),
    chapter: parentNode.chapter || 1,
    ...fields,
  });

  return { node: await getNode(nodeId), warnings };
};

/**
 * 重 roll：用同样的行动再请求一次，结果作为一个新版本写在原节点旁边
 * （同父、同 actionKey），并切换为当前节点；旧版本原样保留，可以切回去。
 * 只允许对「还没有后续」的节点用——有后续的话，后续是接着这个版本写的，
 * 另起一个版本会让剧情对不上。
 *
 * 版本不算分支：appendNode 看到 actionKey 相同，不会增加 branchCount。
 */
export const rerollNode = async (saveId, nodeId, { signal } = {}) => {
  const save = await loadPlayableSave(saveId);
  const node = await getNode(nodeId);

  if (!node || node.saveId !== saveId) {
    throw fail(FICTION_ERROR.BAD_STATE, '找不到这一段。');
  }

  if (await hasChildren(saveId, nodeId)) {
    throw fail(FICTION_ERROR.BAD_STATE, '这一段后面已经接着写了，只能重新生成最后一段。');
  }

  const parentNode = node.parentId === ROOT_PARENT_ID ? null : await getNode(node.parentId);
  const action = resolveAction(parentNode, node.userAction);

  const { fields, warnings } = await runGeneration({
    save,
    parentNode,
    action,
    signal,
    label: '重 roll',
  });

  const newId = await appendNode(saveId, {
    parentId: node.parentId,
    userAction: node.userAction,
    actionKey: node.actionKey,
    chapter: node.chapter || 1,
    ...fields,
  });

  return { node: await getNode(newId), warnings };
};

// ---------------- 总结草稿（第 5A 轮） ----------------
//
// 和主生成流程分开：不走「写节点」的那一套，只是单独问一次 AI「帮我把这几段
// 总结一下」，把文本原样返回。要不要存、存之前要不要改，交给总结总览页
// （FictionSummaryOverview.jsx）处理，这里不碰数据库。

const SUMMARY_MAX_TOKENS = 1200;

const str = (value) => String(value ?? '').trim();

const buildSummaryRequest = ({ nodes, from, to }) => {
  const segments = nodes.map((node, index) => {
    const position = from + index;
    const heading = `【第 ${position} 段】`;
    const actionLine = describeActionForHistory(node.userAction);

    return [heading, actionLine ? `（${actionLine}）` : '', str(node.text)].filter(Boolean).join('\n');
  }).join('\n\n');

  const systemPrompt = [
    '你是一名故事总结助手，要把下面这段互动小说的剧情浓缩成一份前情提要，供之后继续写故事时参考（不会给玩家看）。',
    '写清楚：按时间顺序发生了哪些关键事件、人物之间的关系和情绪怎么变化、留下了什么悬念或承诺。用流畅的叙述段落，不要分点列举，不要逐段复述，用自己的话概括；大致 400-600 字。',
    `## 需要总结的剧情（第 ${from}-${to} 段）`,
    segments,
  ].join('\n\n');

  return { systemPrompt, userMessage: '请给出这段剧情的总结。' };
};

export const generateSummaryDraft = async (saveId, { from, to, signal } = {}) => {
  const save = await loadPlayableSave(saveId);

  if (!save.currentNodeId) throw fail(FICTION_ERROR.BAD_STATE, '这份存档还没有任何剧情。');

  const pathNodes = await getPathToNode(save.currentNodeId);
  const slice = pathNodes.slice(from - 1, to);

  if (slice.length === 0) {
    throw fail(FICTION_ERROR.BAD_STATE, `找不到第 ${from}-${to} 段，当前路径只有 ${pathNodes.length} 段。`);
  }

  const { systemPrompt, userMessage } = buildSummaryRequest({ nodes: slice, from, to });
  const result = await callFictionApi({ systemPrompt, userMessage, maxTokens: SUMMARY_MAX_TOKENS, signal });

  console.info('[Fiction]', `总结草稿 第${from}-${to}段`, {
    systemChars: systemPrompt.length,
    finishReason: result.finishReason,
    usage: result.usage,
  });

  return result.content.trim();
};

// 控制台调试入口：在页面控制台里直接试，例如
//   await __fictionAi.generateOpening(存档id)
if (typeof window !== 'undefined') {
  window.__fictionAi = { generateOpening, generateNext, rerollNode, generateSummaryDraft };
}

export default {
  FICTION_ERROR,
  generateOpening,
  generateNext,
  rerollNode,
  generateSummaryDraft,
};
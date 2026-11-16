// src/apps/fiction/fictionParser.js
//
// 互动文游的「纯函数」：解析 AI 输出、结算数值。不碰数据库、不发请求，
// 所以可以脱离浏览器单独测试。
//
// AI 输出约定（bracket 标签）：
//   [STORY]正文[/STORY]
//   [OPTIONS]
//   A|选项文字|好感度:+2,金钱:-10
//   B|选项文字|
//   [/OPTIONS]
//   [DELTA]好感度:+1[/DELTA]        仅自由输入时
//   [IMAGE]画面描述[/IMAGE]          仅自动配图时
//
// 数值一律用「数值 id」做 key 存（不是名字）：名字可能被改，id 不会。
// AI 看到和写出的都是名字，解析时按名字（不分大小写）换成 id。
// AI 只给增减量，最终数值由 applyDeltas 在前端结算并截断到 [min, max]。

export const PARSE_WARNING = {
  NO_STORY_TAG: 'noStoryTag',       // 没有 [STORY] 标签，已把标签之外的文字当正文
  NO_OPTIONS: 'noOptions',          // 选择式但解析不出任何选项
  FEW_OPTIONS: 'fewOptions',        // 选项数少于存档要求的下限
  BAD_OPTION_LINE: 'badOptionLine', // 有选项行格式不对，已忽略
  UNKNOWN_STAT: 'unknownStat',      // AI 写了不存在的数值名，已忽略（warnings 里带名字）
  TRUNCATED: 'truncated',           // 输出被 max tokens 截断（由调用方在 finish_reason 为 length 时加上）
};

const TAGS = ['STORY', 'OPTIONS', 'DELTA', 'IMAGE'];

// ---------------- 数值 ----------------

const toInt = (value, fallback = 0) => {
  const number = Math.round(Number(value));

  return Number.isFinite(number) ? number : fallback;
};

export const clampStat = (stat, value) => (
  Math.min(stat.max, Math.max(stat.min, toInt(value, stat.initial)))
);

// 把存档里的 stats 规整成数字，防止历史数据里混进字符串。
export const normalizeStatDefs = (stats) => (
  (Array.isArray(stats) ? stats : [])
    .filter((stat) => stat && stat.id && stat.name)
    .map((stat) => ({
      id: stat.id,
      name: String(stat.name),
      initial: toInt(stat.initial),
      min: toInt(stat.min),
      max: toInt(stat.max, 100),
      desc: String(stat.desc || ''),
    }))
);

export const buildInitialSnapshot = (stats) => {
  const snapshot = {};

  normalizeStatDefs(stats).forEach((stat) => {
    snapshot[stat.id] = clampStat(stat, stat.initial);
  });

  return snapshot;
};

// 新快照 = 旧快照 + 增减量，逐项截断。快照里缺的数值用初始值补上，
// 这样存档后来才加数值（或旧节点没有快照）也不会算出 NaN。
export const applyDeltas = (stats, snapshot, deltas) => {
  const next = {};

  normalizeStatDefs(stats).forEach((stat) => {
    const base = snapshot && snapshot[stat.id] !== undefined ? snapshot[stat.id] : stat.initial;
    const delta = deltas && deltas[stat.id] !== undefined ? deltas[stat.id] : 0;

    next[stat.id] = clampStat(stat, toInt(base, stat.initial) + toInt(delta));
  });

  return next;
};

// 全角符号换成半角，方便统一解析。
const toHalfWidth = (text) => String(text || '')
  .replace(/[＋]/g, '+')
  .replace(/[−－—–]/g, '-')
  .replace(/：/g, ':')
  .replace(/[，、；;]/g, ',')
  .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));

// 「好感度:+2,金钱:-10」→ { deltas: { 数值id: 2, ... }, unknown: ['不存在的名字'] }
export const parseDeltaText = (text, stats) => {
  const defs = normalizeStatDefs(stats);
  const deltas = {};
  const unknown = [];
  const source = toHalfWidth(text).trim();

  if (!source) return { deltas, unknown };

  source.split(',').forEach((piece) => {
    const match = piece.match(/^\s*(.+?)\s*:\s*([+-]?\s*\d+(?:\.\d+)?)/);

    if (!match) return;

    const name = match[1].trim().replace(/^[「『"'“]|[」』"'”]$/g, '');
    const value = toInt(match[2].replace(/\s+/g, ''));
    const stat = defs.find((item) => item.name.toLowerCase() === name.toLowerCase());

    if (!stat) {
      if (name) unknown.push(name);
      return;
    }

    deltas[stat.id] = (deltas[stat.id] || 0) + value;
  });

  return { deltas, unknown };
};

// ---------------- 标签提取 ----------------

const findOpen = (text, tag, from = 0) => {
  const index = text.toUpperCase().indexOf(`[${tag}]`, from);

  return index === -1 ? null : { index, end: index + tag.length + 2 };
};

// 取出 [TAG]...[/TAG] 之间的内容。没写结束标签也能取：取到下一个已知标签的
// 开头，或者文本末尾。
const extractBlock = (text, tag) => {
  const open = findOpen(text, tag);

  if (!open) return null;

  const upper = text.toUpperCase();
  const closeIndex = upper.indexOf(`[/${tag}]`, open.end);

  if (closeIndex !== -1) return text.slice(open.end, closeIndex);

  const nextOpens = TAGS
    .filter((other) => other !== tag)
    .map((other) => findOpen(text, other, open.end))
    .filter(Boolean)
    .map((found) => found.index);

  const stop = nextOpens.length > 0 ? Math.min(...nextOpens) : text.length;

  return text.slice(open.end, stop);
};

// 去掉所有已知标签块，剩下的是「标签之外的文字」。
const stripAllBlocks = (text) => {
  let result = text;

  TAGS.forEach((tag) => {
    const block = extractBlock(result, tag);

    if (block === null) return;

    const open = findOpen(result, tag);
    const closeIndex = result.toUpperCase().indexOf(`[/${tag}]`, open.end);
    const end = closeIndex !== -1 ? closeIndex + tag.length + 3 : open.end + block.length;

    result = result.slice(0, open.index) + result.slice(end);
  });

  return result;
};

// 推理模型会带 <think>…</think>，代码围栏偶尔也会被包上，先清掉。
const cleanRaw = (raw) => String(raw || '')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/^\s*```[a-z]*\s*\n/i, '')
  .replace(/\n\s*```\s*$/i, '')
  .trim();

// ---------------- 思考 ----------------

// 模型自带的思考：<think>…</think>（也认 <thinking>）。
// 没写结束标签（输出被截断）时，从开始标签到末尾都算思考；
// 只有结束标签（有的中转会吃掉开始标签）时，结束标签之前的都算思考。
const splitNativeThink = (raw) => {
  const pieces = [];

  let rest = String(raw || '').replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, (_match, inner) => {
    pieces.push(String(inner).trim());
    return '';
  });

  const openIndex = rest.search(/<think(?:ing)?>/i);

  if (openIndex !== -1) {
    pieces.push(rest.slice(openIndex).replace(/^<think(?:ing)?>/i, '').trim());
    rest = rest.slice(0, openIndex);
  } else {
    const closeMatch = rest.match(/<\/think(?:ing)?>/i);

    if (closeMatch) {
      pieces.push(rest.slice(0, closeMatch.index).trim());
      rest = rest.slice(closeMatch.index + closeMatch[0].length);
    }
  }

  return { rest, thinking: pieces.filter(Boolean).join('\n\n') };
};

// 我们自己约定的 [THINK]…[/THINK]：位置不限，写了几块就收几块。
// 先把它从文本里整块拿掉，再去找 [STORY] 等标签，这样思考里的文字不会混进正文。
// 没写结束标签时，取到下一个已知标签的开头或文本末尾。
const splitThinkBlock = (text) => {
  const pieces = [];
  let rest = String(text || '');

  for (let guard = 0; guard < 8; guard += 1) {
    const open = findOpen(rest, 'THINK');

    if (!open) break;

    const block = extractBlock(rest, 'THINK') || '';
    const closeIndex = rest.toUpperCase().indexOf('[/THINK]', open.end);
    const end = closeIndex !== -1 ? closeIndex + '[/THINK]'.length : open.end + block.length;

    pieces.push(block.trim());
    rest = rest.slice(0, open.index) + rest.slice(end);
  }

  return { rest: rest.replace(/\[\/THINK\]/gi, ''), thinking: pieces.filter(Boolean).join('\n\n') };
};

// ---------------- 选项 ----------------

const OPTION_LINE = /^\s*(?:[-*•]\s*)?(?:[A-Za-z]|\d{1,2})\s*(?:[|｜]|[.、)）:：]\s*)(.*)$/;

const stripWrapping = (text) => text
  .trim()
  .replace(/^[「『"'“]+|[」』"'”]+$/g, '')
  .trim();

const parseOptions = (block, stats, warnings) => {
  const options = [];

  String(block || '').split('\n').forEach((line) => {
    if (!line.trim()) return;

    const match = line.match(OPTION_LINE);

    if (!match) {
      warnings.push({ code: PARSE_WARNING.BAD_OPTION_LINE, detail: line.trim().slice(0, 40) });
      return;
    }

    const parts = match[1].split(/[|｜]/);
    const text = stripWrapping(parts[0] || '');

    if (!text) {
      warnings.push({ code: PARSE_WARNING.BAD_OPTION_LINE, detail: line.trim().slice(0, 40) });
      return;
    }

    const { deltas, unknown } = parseDeltaText(parts.slice(1).join(','), stats);

    unknown.forEach((name) => warnings.push({ code: PARSE_WARNING.UNKNOWN_STAT, detail: name }));

    // 选项字母一律按出现顺序重新编 A、B、C……，不信任 AI 自己写的字母，
    // 这样不会因为 AI 写重、跳号，导致两个选项撞同一个 key。
    options.push({ key: String.fromCharCode(65 + options.length), text, deltas });
  });

  return options.slice(0, 26);
};

// ---------------- 总入口 ----------------

/**
 * 解析一次 AI 回复。
 * @param raw   AI 原始文本
 * @param opts  { mode: 'choice' | 'novel', stats, optionMin }
 * @returns { story, options, freeDelta, imagePrompt, warnings }
 *          warnings 里每项是 { code, detail? }，code 见 PARSE_WARNING
 *          story 为空字符串表示完全没解析出正文，调用方应当当作失败处理。
 */
export const parseFictionReply = (raw, { mode = 'choice', stats = [], optionMin = 3 } = {}) => {
  const native = splitNativeThink(raw);
  const thought = splitThinkBlock(cleanRaw(native.rest));
  const text = thought.rest.trim();
  const warnings = [];

  let story = extractBlock(text, 'STORY');

  if (story === null) {
    warnings.push({ code: PARSE_WARNING.NO_STORY_TAG });
    story = stripAllBlocks(text);
  }

  story = String(story || '').trim();

  const optionsBlock = extractBlock(text, 'OPTIONS');
  const options = mode === 'choice' ? parseOptions(optionsBlock, stats, warnings) : [];

  if (mode === 'choice') {
    if (options.length === 0) {
      warnings.push({ code: PARSE_WARNING.NO_OPTIONS });
    } else if (options.length < optionMin) {
      warnings.push({ code: PARSE_WARNING.FEW_OPTIONS, detail: `${options.length}/${optionMin}` });
    }
  }

  const deltaBlock = extractBlock(text, 'DELTA');
  const parsedDelta = parseDeltaText(deltaBlock, stats);

  parsedDelta.unknown.forEach((name) => warnings.push({ code: PARSE_WARNING.UNKNOWN_STAT, detail: name }));

  const imagePrompt = String(extractBlock(text, 'IMAGE') || '').trim();

  return {
    story,
    options,
    freeDelta: parsedDelta.deltas,
    imagePrompt,
    thinking: thought.thinking,
    nativeThinking: native.thinking,
    warnings,
  };
};

export default {
  PARSE_WARNING,
  clampStat,
  normalizeStatDefs,
  buildInitialSnapshot,
  applyDeltas,
  parseDeltaText,
  parseFictionReply,
};
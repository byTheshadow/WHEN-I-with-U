// src/apps/characterArea/characterAreaParse.js
//
// 角色专属区域——"创建区域"那次单独AI调用的输出解析。纯函数，不碰数据库、
// 不碰网络，所以可以单独测。写法参照 textgames 里的 texasLinesParse.js：
// 一个正则去掉emoji（整个项目禁用emoji，AI万一输出了也要在入库前清掉）。
//
// AI要么输出：
//   [AREA_SKIP]
// 要么输出：
//   [AREA_CREATE]
//   名称：...
//   图标：...
//   简介：...
//   护食程度：...
//   拒绝话术：
//   1. ...
//   2. ...
//
// 解析尽量宽松（模型常常在标签前后多说几句、用全角冒号、用 - 或数字做列表），
// 但必须同时拿到"名称"和至少 3 条拒绝话术才算成功，否则返回 invalid，由调用方
// 当作"这次没成功"处理，不拿编造的内容兜底。

const EMOJI_RE = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;

export const AREA_ICON_NAMES = [
  'Book',
  'Pencil',
  'Heart',
  'Flame',
  'Star',
  'Moon',
  'Key',
  'Feather',
  'Leaf',
  'Ghost',
  'Gem',
  'Cloud',
  'Sparkles',
  'Coffee',
  'Camera',
  'Music',
];

export const DEFAULT_AREA_ICON = 'Book';

const MAX_NAME_LENGTH = 10;
const MAX_INTRO_LENGTH = 40;
const MIN_REFUSAL_LINES = 3;
const MAX_REFUSAL_LINES = 10;
const MIN_REFUSAL_LINE_LENGTH = 2;
const MAX_REFUSAL_LINE_LENGTH = 60;

// 护食程度拿不到数字时的兜底（只兜这一个数字，不兜名称和话术）。
const FALLBACK_REFUSE_PROB = 0.3;
const MIN_REFUSE_PROB = 0.05;
const MAX_REFUSE_PROB = 0.85;

const cleanText = (value) =>
  String(value || '')
    .replace(EMOJI_RE, '')
    .replace(/^[\s"'「」『』“”]+|[\s"'「」『』“”]+$/g, '')
    .trim();

const readField = (body, label) => {
  const match = body.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]+)`));
  return match ? match[1].trim() : '';
};

const parseRefuseProb = (rawValue) => {
  const match = String(rawValue || '').match(/\d+(?:\.\d+)?/);
  if (!match) return FALLBACK_REFUSE_PROB;

  let value = Number(match[0]);
  if (!Number.isFinite(value)) return FALLBACK_REFUSE_PROB;

  // 写成 0 到 1 之间的小数就直接用，写成 0 到 100 的整数/百分数就除以 100。
  if (value > 1) value /= 100;

  return Math.min(MAX_REFUSE_PROB, Math.max(MIN_REFUSE_PROB, value));
};

const parseRefusalLines = (body) => {
  const markerMatch = body.match(/拒绝话术\s*[:：]?/);
  if (!markerMatch) return [];

  const afterMarker = body.slice(markerMatch.index + markerMatch[0].length);

  return afterMarker
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+\s*[.、)）])\s*/, ''))
    .map(cleanText)
    .filter(
      (line) =>
        line.length >= MIN_REFUSAL_LINE_LENGTH && line.length <= MAX_REFUSAL_LINE_LENGTH
    )
    .slice(0, MAX_REFUSAL_LINES);
};

// 返回：
//   { kind: 'skip' }                       角色这次选择先不创建
//   { kind: 'invalid' }                    格式不对/内容不够，当作失败
//   { kind: 'create', area: {name, icon, intro, refuseProb, refusalLines} }
export const parseAreaCreationOutput = (rawText, { allowSkip = true } = {}) => {
  const text = String(rawText || '').trim();
  if (!text) return { kind: 'invalid' };

  const hasCreateTag = /\[AREA_CREATE\]/i.test(text);

  if (allowSkip && !hasCreateTag && /\[AREA_SKIP\]/i.test(text)) {
    return { kind: 'skip' };
  }

  const body = hasCreateTag ? text.split(/\[AREA_CREATE\]/i).slice(1).join('\n') : text;

  const name = cleanText(readField(body, '名称')).slice(0, MAX_NAME_LENGTH);
  if (!name) return { kind: 'invalid' };

  const refusalLines = parseRefusalLines(body);
  if (refusalLines.length < MIN_REFUSAL_LINES) return { kind: 'invalid' };

  const iconRaw = readField(body, '图标').replace(/[^A-Za-z0-9]/g, '');
  const icon = AREA_ICON_NAMES.includes(iconRaw) ? iconRaw : DEFAULT_AREA_ICON;

  const intro = cleanText(readField(body, '简介')).slice(0, MAX_INTRO_LENGTH);
  const refuseProb = parseRefuseProb(readField(body, '护食程度'));

  return {
    kind: 'create',
    area: { name, icon, intro, refuseProb, refusalLines },
  };
};
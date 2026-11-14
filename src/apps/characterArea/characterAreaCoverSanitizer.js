// src/apps/characterArea/characterAreaCoverSanitizer.js
//
// 角色专属区域——封面 HTML 的白名单过滤器（切片 F1）。纯函数。
//
// 封面是角色自己写的一小段 HTML，会用 dangerouslySetInnerHTML 渲染，所以
// AI 写的东西不能直接信。这里的做法不是"从原文里删掉坏东西"，而是"逐个标签
// 重新拼一份新的"：
//   - 标签只认下面这几个排版用的；script/style/iframe/svg 这类连内容一起丢，
//     其它不认识的标签（a、img、button……）只丢标签本身
//   - 属性只认 style，其它属性（onclick、href、src、class……）一律不要
//   - style 里的每一条声明：属性名要在白名单里、值只能由安全字符组成、
//     值里出现的函数名要在白名单里（所以 url()、expression() 这类天然进不来）、
//     var() 只能引用 --area-* 这几个变量、数值有上限、不许用视口单位
//   - 文字内容转义后输出，并且去掉 emoji
//   - 元素个数、嵌套深度、总长度、可见文字数都有上限
//
// 返回 { ok, html, text, reason }。html 是可以直接渲染的安全 HTML；text 是
// 里面的可见文字（页面用它判断封面里有没有写出区域名称）。
// 过滤是幂等的：已经过滤过的 html 再过一遍结果不变，所以渲染时可以再过一次。
import { COVER_ANIMATION_NAMES } from './characterAreaTheme';

const EMOJI_RE = /[\p{Extended_Pictographic}‍️]/gu;

const MAX_RAW_LENGTH = 3000;
const MAX_ELEMENTS = 40;
const MAX_DEPTH = 6;
const MAX_TEXT_LENGTH = 160;
const MAX_STYLE_LENGTH = 600;
const MAX_VALUE_LENGTH = 200;
const MAX_PX = 600;
const MAX_EM = 40;
const MAX_FONT_PX = 72;

const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'br', 'hr',
  'b', 'strong', 'i', 'em', 'small', 'u', 's', 'sub', 'sup',
]);
const VOID_TAGS = new Set(['br', 'hr']);
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
  'template', 'noscript', 'textarea', 'title', 'head',
]);

// ---------------- 样式声明 ----------------

const ALLOWED_PROPERTIES = new Set([
  'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat',
  'color', 'opacity',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-width', 'border-style', 'border-color', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'box-shadow', 'text-shadow', 'filter', 'backdrop-filter',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration', 'text-indent',
  'writing-mode',
  'transform', 'transform-origin',
  'display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'position', 'top', 'right', 'bottom', 'left', 'z-index', 'overflow',
  'clip-path',
  'animation', 'animation-delay',
]);

// 值里允许出现的函数名。url()、image-set()、expression()、attr() 等都不在里面。
const ALLOWED_FUNCTIONS = new Set([
  'rgb', 'rgba', 'hsl', 'hsla',
  'linear-gradient', 'radial-gradient', 'conic-gradient',
  'repeating-linear-gradient', 'repeating-radial-gradient',
  'color-mix', 'var', 'calc', 'min', 'max', 'clamp',
  'translate', 'translatex', 'translatey', 'rotate', 'scale', 'scalex', 'scaley',
  'skew', 'skewx', 'skewy',
  'blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'hue-rotate', 'drop-shadow',
  'polygon', 'circle', 'ellipse', 'inset',
]);

const ALLOWED_VARS = new Set([
  '--area-bg', '--area-card', '--area-text', '--area-sub', '--area-accent', '--area-radius',
]);

// 值只能由这些字符组成：没有引号、分号、花括号、反斜杠、尖括号、@、! 、&。
const SAFE_VALUE_CHARS = /^[a-zA-Z0-9\s#%.,()/+*-]+$/;
const VIEWPORT_UNIT = /\d(?:vw|vh|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw)\b/i;

const SPECIFIC_VALUE_RULES = {
  position: /^(?:relative|absolute)$/i,
  'z-index': /^-?[0-5]$/,
  display: /^(?:block|flex|inline-block|inline|grid|inline-flex)$/i,
  overflow: /^(?:hidden|visible)$/i,
  'writing-mode': /^(?:vertical-rl|vertical-lr|horizontal-tb)$/i,
  'text-align': /^(?:left|center|right|justify)$/i,
  'font-weight': /^(?:normal|bold|[1-9]00)$/i,
  'font-style': /^(?:normal|italic)$/i,
  opacity: /^(?:0|1|0?\.\d+)$/,
  animation: new RegExp(
    `^(?:${COVER_ANIMATION_NAMES.join('|')})\\s+\\d+(?:\\.\\d+)?s(?:\\s+(?:ease|ease-in|ease-out|ease-in-out|linear))?(?:\\s+(?:infinite|\\d{1,2}))?$`,
    'i'
  ),
  'animation-delay': /^\d(?:\.\d+)?s$|^10s$/,
};

const hasOnlyAllowedFunctions = (value) => {
  const functionPattern = /([a-zA-Z-]+)\s*\(/g;
  let match = functionPattern.exec(value);

  while (match) {
    if (!ALLOWED_FUNCTIONS.has(match[1].toLowerCase())) return false;
    match = functionPattern.exec(value);
  }

  return true;
};

const hasOnlyAllowedVars = (value) => {
  const varPattern = /var\(\s*(--[a-zA-Z0-9-]+)/gi;
  let match = varPattern.exec(value);

  while (match) {
    if (!ALLOWED_VARS.has(match[1].toLowerCase())) return false;
    match = varPattern.exec(value);
  }

  return true;
};

const withinNumberLimits = (value) => {
  const pxPattern = /(-?\d+(?:\.\d+)?)px/gi;
  let match = pxPattern.exec(value);
  while (match) {
    if (Math.abs(Number(match[1])) > MAX_PX) return false;
    match = pxPattern.exec(value);
  }

  const emPattern = /(-?\d+(?:\.\d+)?)r?em\b/gi;
  match = emPattern.exec(value);
  while (match) {
    if (Math.abs(Number(match[1])) > MAX_EM) return false;
    match = emPattern.exec(value);
  }

  return true;
};

const isFontSizeOk = (value) => {
  const match = value.match(/^(\d+(?:\.\d+)?)(px|rem|em|%)$/i);
  if (!match) return false;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 'px') return amount <= MAX_FONT_PX;
  if (unit === '%') return amount <= 400;
  return amount <= MAX_FONT_PX / 16;
};

const isValueOk = (property, value) => {
  if (!value || value.length > MAX_VALUE_LENGTH) return false;
  if (!SAFE_VALUE_CHARS.test(value)) return false;
  if (VIEWPORT_UNIT.test(value)) return false;
  if (!hasOnlyAllowedFunctions(value)) return false;
  if (!hasOnlyAllowedVars(value)) return false;
  if (!withinNumberLimits(value)) return false;

  if (property === 'font-size') return isFontSizeOk(value);

  const rule = SPECIFIC_VALUE_RULES[property];
  return rule ? rule.test(value) : true;
};

const sanitizeStyleAttribute = (rawStyle) => {
  const declarations = [];

  String(rawStyle || '')
    .slice(0, MAX_STYLE_LENGTH)
    .split(';')
    .forEach((rawDeclaration) => {
      const declaration = rawDeclaration.trim();
      if (!declaration) return;

      const colonIndex = declaration.indexOf(':');
      if (colonIndex <= 0) return;

      const property = declaration.slice(0, colonIndex).trim().toLowerCase();
      const value = declaration.slice(colonIndex + 1).replace(/!important/gi, '').trim();

      if (!ALLOWED_PROPERTIES.has(property)) return;
      if (!isValueOk(property, value)) return;

      declarations.push(`${property}: ${value}`);
    });

  return declarations.join('; ');
};

const extractStyleAttribute = (attributeText) => {
  const match = String(attributeText || '').match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if (!match) return '';
  return sanitizeStyleAttribute(match[1] !== undefined ? match[1] : match[2]);
};

// ---------------- 文字 ----------------

const decodeBasicEntities = (text) =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');

const escapeText = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const stripCodeFence = (text) =>
  text
    .replace(/^\s*```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');

const failure = (reason) => ({ ok: false, html: '', text: '', reason });

// ---------------- 主函数 ----------------

export const sanitizeCoverHtml = (rawHtml) => {
  const raw = stripCodeFence(String(rawHtml || '').trim());

  if (!raw) return failure('empty');
  if (raw.length > MAX_RAW_LENGTH) return failure('too-long');

  const source = raw.replace(/<!--[\s\S]*?-->/g, '');
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

  const output = [];
  const stack = [];
  let elementCount = 0;
  let visibleText = '';
  let cursor = 0;

  const pushText = (segment) => {
    const cleaned = decodeBasicEntities(segment)
      .replace(EMOJI_RE, '')
      .replace(/\s+/g, ' ');

    if (!cleaned.trim()) return;

    const room = MAX_TEXT_LENGTH - visibleText.length;
    if (room <= 0) return;

    const piece = cleaned.slice(0, room);
    visibleText += piece;
    output.push(escapeText(piece));
  };

  let match = tagPattern.exec(source);

  while (match) {
    pushText(source.slice(cursor, match.index));
    cursor = tagPattern.lastIndex;

    const isClosing = match[1] === '/';
    const name = match[2].toLowerCase();

    if (DROP_WITH_CONTENT.has(name) && !isClosing) {
      const closePattern = new RegExp(`</${name}\\s*>`, 'i');
      const rest = source.slice(cursor);
      const closeMatch = closePattern.exec(rest);

      cursor = closeMatch ? cursor + closeMatch.index + closeMatch[0].length : source.length;
      tagPattern.lastIndex = cursor;
    } else if (ALLOWED_TAGS.has(name)) {
      if (isClosing) {
        const openIndex = stack.lastIndexOf(name);

        if (openIndex !== -1) {
          while (stack.length > openIndex) output.push(`</${stack.pop()}>`);
        }
      } else if (
        elementCount < MAX_ELEMENTS &&
        (VOID_TAGS.has(name) || stack.length < MAX_DEPTH)
      ) {
        elementCount += 1;

        const style = extractStyleAttribute(match[3]);
        output.push(`<${name}${style ? ` style="${style}"` : ''}>`);

        if (!VOID_TAGS.has(name)) stack.push(name);
      }
    }

    match = tagPattern.exec(source);
  }

  pushText(source.slice(cursor));

  while (stack.length > 0) output.push(`</${stack.pop()}>`);

  if (elementCount === 0) return failure('no-elements');

  return { ok: true, html: output.join(''), text: visibleText.trim(), reason: '' };
};

// 页面渲染用：从区域那一行取出可以渲染的封面。
// 返回 { html, showsName }：html 为空表示没有封面；showsName 表示封面文字里
// 已经写出了区域名称（这时页面可以不再显示默认的标题卡片）。
export const resolveAreaCover = (area) => {
  if (!area?.coverHtml) return { html: '', showsName: false };

  const result = sanitizeCoverHtml(area.coverHtml);
  if (!result.ok) return { html: '', showsName: false };

  return {
    html: result.html,
    showsName: Boolean(area.name) && result.text.includes(area.name),
  };
};
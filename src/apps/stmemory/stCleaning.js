// src/apps/stmemory/stCleaning.js
//
// 导入前的正则清洗（纯函数，不碰数据库）。
// 规则有两种：
//   tag    按标签名清掉整段，例如写 <is></is> 就把所有 <is>...</is> 包着的内容连标签一起删掉。
//   regex  自己写正则：findRegex / flags / replaceString（格式沿用 RP 预设里的正则脚本）。
// 每条规则可以单独开关。清洗是对"每一条消息"单独做的，不会跨消息匹配。

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 从用户输入里取出标签名。
 * 支持 "<is></is>"、"<is>"、"is"、"think, 思考" 这几种写法，一次可以写多个。
 */
export const parseTagNames = (input) => {
  const text = String(input || '').trim();
  if (!text) return [];

  const found = new Set();
  const tagPattern = /<\/?([^\s<>/=,]+)/g;
  let match = tagPattern.exec(text);
  while (match) {
    found.add(match[1]);
    match = tagPattern.exec(text);
  }

  if (found.size === 0) {
    text.split(/[\s,，、]+/).filter(Boolean).forEach((name) => found.add(name));
  }

  return [...found];
};

export const makeTagRule = (tag) => ({
  id: `tag:${tag}`,
  kind: 'tag',
  tag,
  enabled: true,
  label: `<${tag}> ... </${tag}>`,
});

const ensureGlobalFlag = (flags) => {
  const clean = String(flags || '').replace(/[^dgimsuvy]/g, '');
  return clean.includes('g') ? clean : `${clean}g`;
};

/** 检查一条正则能不能用；能用返回 null，不能用返回错误说明。 */
export const validateRegex = (findRegex, flags) => {
  if (!String(findRegex || '').length) return '正则不能为空';
  try {
    // eslint-disable-next-line no-new
    new RegExp(findRegex, ensureGlobalFlag(flags));
    return null;
  } catch (error) {
    return error?.message || '正则写法有误';
  }
};

export const makeRegexRule = ({ findRegex, flags = 'gi', replaceString = '' }) => {
  const finalFlags = ensureGlobalFlag(flags);
  return {
    id: `regex:${findRegex}/${finalFlags}`,
    kind: 'regex',
    findRegex,
    flags: finalFlags,
    replaceString,
    enabled: true,
    label: `正则 ${findRegex}`,
  };
};

/** 一键配方。注意：这些只是常见写法的猜测，要拿你真实的聊天记录核对、再调。 */
export const CLEANING_RECIPES = [
  {
    id: 'thinking',
    label: '思维链标签',
    hint: 'think / thinking / thought / reasoning / 思考 / 思维链',
    build: () => ['think', 'thinking', 'thought', 'reasoning', '思考', '思维链'].map(makeTagRule),
  },
  {
    id: 'ooc',
    label: 'OOC 括号',
    hint: '(OOC: ...) 和 [OOC: ...]',
    build: () => [makeRegexRule({
      findRegex: '[\\(（\\[]\\s*OOC\\s*[:：][^\\)）\\]]*[\\)）\\]]',
      flags: 'gi',
    })],
  },
  {
    id: 'comment',
    label: 'HTML 注释',
    hint: '<!-- ... -->',
    build: () => [makeRegexRule({ findRegex: '<!--[\\s\\S]*?-->', flags: 'g' })],
  },
  {
    id: 'status',
    label: '状态栏（常见写法）',
    hint: 'status / statusbar / StatusBlock / 状态栏 标签',
    build: () => ['status', 'statusbar', 'status_bar', 'StatusBlock', '状态栏'].map(makeTagRule),
  },
];

/** 把规则列表编译成可以反复使用的 [{ re, replacement }]；写错的正则会被跳过。 */
export const compileRules = (rules) => (
  (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.enabled)
    .map((rule) => {
      try {
        if (rule.kind === 'tag') {
          const name = escapeRegex(String(rule.tag || ''));
          if (!name) return null;
          return {
            re: new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}\\s*>`, 'gi'),
            replacement: '',
          };
        }
        if (rule.kind === 'regex') {
          if (!rule.findRegex) return null;
          return {
            re: new RegExp(rule.findRegex, ensureGlobalFlag(rule.flags)),
            replacement: String(rule.replaceString || ''),
          };
        }
      } catch (error) {
        return null;
      }
      return null;
    })
    .filter(Boolean)
);

/** 对一条消息文本依次套用规则，再整理多余的空行。 */
export const cleanMessageText = (text, compiled) => {
  let output = text;
  compiled.forEach((item) => {
    output = output.replace(item.re, item.replacement);
  });
  return output
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

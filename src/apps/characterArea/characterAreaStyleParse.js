// src/apps/characterArea/characterAreaStyleParse.js
//
// 角色专属区域——"设计外观"那次AI调用的输出解析（切片 F1）。纯函数，不碰数据库。
//
// AI输出：
//   [STYLE]
//   背景：#f4efe6
//   卡片：#fffaf0
//   正文：#3b2f2f
//   次要文字：#7a6a5c
//   强调色：#b5483a
//   字体：serif
//   圆角：soft
//   边框：dashed
//   封面：
//   <div style="...">...</div>
//   [/STYLE]
//
// 解析尽量宽松（标签缺了、冒号全角半角、字体写中文名、封面外面包了代码围栏
// 都行），但"背景"和"正文"两个色值必须拿到，否则返回 invalid，不拿编造的
// 主题兜底。封面是可选的：封面没写或者没通过过滤，主题照样保存，coverStatus
// 告诉调用方封面这次的情况。
import { normalizeTheme } from './characterAreaTheme';
import { sanitizeCoverHtml } from './characterAreaCoverSanitizer';

const FONT_ALIASES = [
  ['sans', /sans|无衬线|黑体|系统/],
  ['serif', /serif|衬线|宋体|明朝/],
  ['kai', /kai|楷/],
  ['mono', /mono|等宽|打字机/],
  ['round', /round|圆体|圆润/],
  ['hand', /hand|手写|行楷|草/],
];

const RADIUS_ALIASES = [
  ['sharp', /sharp|直角|方/],
  ['soft', /soft|柔和|微圆/],
  ['round', /round|圆润|很圆|大圆/],
];

const BORDER_ALIASES = [
  ['solid', /solid|实线/],
  ['dashed', /dashed|虚线/],
  ['dotted', /dotted|点线|点点/],
];

const readLine = (text, labelPattern) => {
  const match = text.match(new RegExp(`(?:${labelPattern})\\s*[:：]\\s*([^\\n]*)`));
  return match ? match[1].trim() : '';
};

const matchAlias = (value, aliases) => {
  const lowered = String(value || '').toLowerCase();
  const hit = aliases.find(([, pattern]) => pattern.test(lowered));
  return hit ? hit[0] : '';
};

// 返回：
//   { kind: 'invalid' }
//   { kind: 'style', theme, coverHtml, coverStatus }
// coverStatus：'ok' 封面可用 / 'missing' AI没写封面 / 'rejected' 写了但没通过过滤
export const parseStyleOutput = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) return { kind: 'invalid' };

  const afterOpen = /\[STYLE\]/i.test(text) ? text.split(/\[STYLE\]/i).slice(1).join('\n') : text;
  const body = afterOpen.split(/\[\/STYLE\]/i)[0];

  const coverMarker = body.match(/封面\s*[:：]?/);
  const fieldsPart = coverMarker ? body.slice(0, coverMarker.index) : body;
  const coverPart = coverMarker ? body.slice(coverMarker.index + coverMarker[0].length) : '';

  const theme = normalizeTheme({
    bg: readLine(fieldsPart, '背景色?'),
    card: readLine(fieldsPart, '卡片色?'),
    text: readLine(fieldsPart, '正文色?|正文颜色'),
    textSub: readLine(fieldsPart, '次要文字色?|次要文字颜色'),
    accent: readLine(fieldsPart, '强调色?'),
    font: matchAlias(readLine(fieldsPart, '字体'), FONT_ALIASES),
    radius: matchAlias(readLine(fieldsPart, '圆角'), RADIUS_ALIASES),
    border: matchAlias(readLine(fieldsPart, '边框'), BORDER_ALIASES),
  });

  if (!theme) return { kind: 'invalid' };

  if (!coverPart.trim()) return { kind: 'style', theme, coverHtml: '', coverStatus: 'missing' };

  const cover = sanitizeCoverHtml(coverPart);

  if (!cover.ok) return { kind: 'style', theme, coverHtml: '', coverStatus: 'rejected' };

  return { kind: 'style', theme, coverHtml: cover.html, coverStatus: 'ok' };
};
// src/apps/messages/toys/toySandbox.js
//
// 小玩具的沙箱：角色写的 HTML/CSS/JS 放进一个隔离的 iframe 里运行。
// 做法和贺卡自由创作模式（src/apps/greeting/greetingSandbox.js）一致。
//
// 安全模型（两层，缺一不可）：
//   1. iframe 只开 sandbox="allow-scripts"，不给 allow-same-origin——页面里的脚本跑在
//      不透明的独立 origin 里，读不到本 app 的 IndexedDB / localStorage / API Key / 聊天数据，
//      也不能操作父页面。
//   2. 文档里加 CSP：default-src 'none'，只放行内联脚本 / 样式和 data: / blob: 资源，
//      connect-src 'none'，所以脚本发不出网络请求，也加载不了外部资源。
// prepareToyHtml 里的清洗和检查只是纵深防御（顺便让角色重写写坏的代码），
// 真正的安全边界是上面两层，不是这些正则。

import { TOY_LIMITS } from './toyConstants';

const EMOJI_RE = /[\p{Extended_Pictographic}‍️]/gu;

export const stripEmoji = (value) => String(value || '').replace(EMOJI_RE, '');

export const TOY_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

// 明显越界的写法：沙箱本来就挡得住，这里发现了就让角色改，而不是带着它们去运行。
const FORBIDDEN = [
  [/\bfetch\s*\(/, 'fetch（沙箱里没有网络）'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest（沙箱里没有网络）'],
  [/\bWebSocket\b/, 'WebSocket（沙箱里没有网络）'],
  [/\bEventSource\b/, 'EventSource（沙箱里没有网络）'],
  [/\bnavigator\s*\.\s*sendBeacon\b/, 'sendBeacon（沙箱里没有网络）'],
  [/\bimportScripts\b|\bnew\s+Worker\b|\bSharedWorker\b/, 'Worker（不可用）'],
  [/\bimport\s*\(|^\s*import\s[^\n]*from\s/m, 'import（不要用模块）'],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, 'eval / new Function（不可用）'],
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bdocument\s*\.\s*cookie\b/, '本地存储（不可用）'],
  [
    /\bwindow\s*\.\s*(?:top|parent|opener)\b|\b(?:parent|top|opener)\s*\.\s*(?:postMessage|location|document)\b/,
    'window.top / window.parent / opener（不能操作外面的页面）',
  ],
  [
    /\bwindow\s*\.\s*open\b|\b(?:window|document|self)\s*\.\s*location\b|\blocation\s*\.\s*(?:href|assign|replace)\b/,
    '打开窗口或跳转页面（不可用）',
  ],
  [/\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/, '死循环 while(true) / for(;;)（动画请用 requestAnimationFrame 或 setInterval）'],
];

// 把角色给的内容整理成"只剩 body 内部内容"的字符串，并检查能不能用。
// 返回 { html, problem }：problem 非空表示这份不能用，原因可以直接喂回给角色让它重写。
export const prepareToyHtml = (raw) => {
  let html = stripEmoji(raw).trim();
  if (!html) return { html: '', problem: '代码是空的。' };

  // 模型有时会把代码包在 ``` 围栏里。
  html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // 去掉文档级标签，只保留里面的内容（外壳由 buildToyDocument 统一提供）。
  html = html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '');

  // 成对出现的、不该出现的元素：整段删掉。
  html = html.replace(/<(iframe|object|embed|form|frameset)\b[\s\S]*?<\/\1\s*>/gi, '');

  // 单个出现的标签：meta/link/base/frame 会改变文档行为或试图加载外部资源。
  html = html.replace(/<(?:meta|link|base|frame)\b[^>]*>/gi, '');

  // 带 src 的外部脚本。
  html = html.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script\s*>/gi, '');

  html = html.trim();

  if (!html) return { html: '', problem: '代码清洗后是空的。' };
  if (html.length > TOY_LIMITS.htmlChars) {
    return { html: '', problem: `代码太长了（超过 ${TOY_LIMITS.htmlChars} 个字符），请做得更精简。` };
  }
  if (!/<script\b/i.test(html)) {
    return { html: '', problem: '没有找到 <script>：小玩具需要内联的 JavaScript 才能玩。' };
  }

  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(html)) return { html: '', problem: `代码里出现了不允许的写法：${label}。` };
  }

  // 外部地址一律不要（SVG 命名空间 w3.org 是正常写法，先排除）。
  if (/https?:\/\//i.test(html.replace(/https?:\/\/www\.w3\.org\/[^\s"'<>]*/gi, ''))) {
    return { html: '', problem: '代码里引用了外部地址：沙箱里没有网络，所有东西都要写在这一份代码里。' };
  }

  return { html, problem: '' };
};

const BASE_CSS = [
  'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}',
  '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
  // 兜底底色和文字色，优先级最低；角色自己写的样式会覆盖它。
  'html{background:#f6f3ec;color:#2b2623;font-family:system-ui,-apple-system,"PingFang SC","Noto Sans SC",sans-serif}',
  'body{user-select:none;-webkit-user-select:none;touch-action:manipulation}',
].join('');

// 阻止页面里的链接把 iframe 自己导航走。
const GUARD_JS =
  "document.addEventListener('click',function(e){var t=e.target;" +
  "while(t&&t.nodeType===1){if(t.tagName==='A'){e.preventDefault();return;}t=t.parentNode;}},true);";

// 试跑用：把页面里的报错告诉外面。这段是我们自己的代码，放在角色的代码之前。
const PROBE_JS =
  "(function(){function s(m){try{parent.postMessage({toyProbe:true,error:String(m)},'*');}catch(x){}}" +
  "window.addEventListener('error',function(e){s(e&&e.message?e.message:'脚本报错');});" +
  "window.addEventListener('unhandledrejection',function(e){s(e&&e.reason?e.reason:'未处理的 Promise 错误');});})();";

// 拼出 iframe 的 srcDoc。注意 CSP 的 <meta> 必须放在 <head> 最前面。
export const buildToyDocument = (fragment, { probe = false } = {}) =>
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
  `<meta http-equiv="Content-Security-Policy" content="${TOY_CSP}">` +
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
  `<style>${BASE_CSS}</style>` +
  (probe ? `<script>${PROBE_JS}</script>` : '') +
  `</head><body>${fragment}<script>${GUARD_JS}</script></body></html>`;

// 在一个看不见的沙箱里把玩具跑一小会儿：运行时有报错就返回错误原因，让角色改。
// 只能抓到"一加载就出错"的问题（语法错误、变量没定义等），等点了才触发的 bug 抓不到。
export const dryRunToy = (fragment, timeoutMs = TOY_LIMITS.dryRunMs) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ ok: true, error: '' });
      return;
    }

    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:360px;height:640px;border:0;opacity:0;pointer-events:none;';

    let finished = false;
    let timer = null;

    const finish = (result) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      frame.remove();
      resolve(result);
    };

    function onMessage(event) {
      if (event.source !== frame.contentWindow) return;
      if (!event.data || event.data.toyProbe !== true) return;
      finish({ ok: false, error: String(event.data.error || '脚本报错').slice(0, 200) });
    }

    window.addEventListener('message', onMessage);
    timer = window.setTimeout(() => finish({ ok: true, error: '' }), timeoutMs);

    frame.srcdoc = buildToyDocument(fragment, { probe: true });
    document.body.appendChild(frame);
  });

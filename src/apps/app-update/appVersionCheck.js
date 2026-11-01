// src/apps/app-update/appVersionCheck.js
//
// 检测线上有没有比当前正在跑的更新的版本。
//
// 为什么需要：service worker 打开页面时是"缓存优先 + 后台更新"，手机 PWA 又常常只是
// 切后台再切回来，不会重新打开页面；而原有的更新提示只在 sw.js 文件本身变了的时候才弹。
// 所以发布新版本时如果没改 CACHE_NAME，手机会一直停在旧版本，也没有提示。
//
// 做法：去拉线上最新的 index.html（带 __vc 标记，sw.js 里对这类请求直接走网络，并顺手把
// 新页面写进缓存），把里面引用的脚本文件名（带内容哈希）和当前页面正在用的比较。
// 不一样就说明有新版本。只比较 <script src>，不比较样式和预加载链接，因为 Vite 运行时会
// 动态往页面里插入懒加载模块的预加载链接，比较它们会误判。
//
// 开发环境（没有哈希文件名）、离线、拿到的不是应用页面时一律返回 null，不当成有新版本。

export const VERSION_CHECK_PARAM = '__vc';

const MIN_GAP_MS = 30 * 1000; // 两次检测之间至少隔 30 秒，回前台频繁切换时不连环请求
const SCRIPT_SRC_PATTERN = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

let lastCheckAt = 0;
let checking = false;

const toAssetPath = (raw) => {
  try {
    const { pathname } = new URL(raw, window.location.href);
    return pathname.includes('/assets/') ? pathname : null;
  } catch {
    return null;
  }
};

const toSignature = (paths) => Array.from(new Set(paths.filter(Boolean))).sort().join('|');

/** 当前页面正在用的脚本签名；开发环境或读不到时返回空串。 */
export const getRunningSignature = () => {
  const paths = Array.from(document.querySelectorAll('script[src]')).map((el) =>
    toAssetPath(el.getAttribute('src'))
  );
  return toSignature(paths);
};

/** 从 index.html 文本里取出脚本签名；读不到时返回空串。 */
export const getSignatureFromHtml = (html) => {
  const paths = [];
  const text = String(html || '');
  let match = SCRIPT_SRC_PATTERN.exec(text);
  while (match) {
    paths.push(toAssetPath(match[1]));
    match = SCRIPT_SRC_PATTERN.exec(text);
  }
  SCRIPT_SRC_PATTERN.lastIndex = 0;
  return toSignature(paths);
};

const fetchLatestIndexHtml = async () => {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL('index.html', base);
  url.searchParams.set(VERSION_CHECK_PARAM, String(Date.now()));
  const response = await fetch(url.href, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.text();
};

/**
 * 返回 true（线上有新版本）、false（已经是最新）、null（这次没能判断）。
 * force 为 true 时忽略 30 秒间隔（手动点"检查更新"用）。
 */
export const checkForNewVersion = async ({ force = false } = {}) => {
  if (import.meta.env.DEV || typeof window === 'undefined') return null;
  if (checking) return null;
  if (!force && Date.now() - lastCheckAt < MIN_GAP_MS) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  const running = getRunningSignature();
  if (!running) return null;

  checking = true;
  lastCheckAt = Date.now();
  try {
    const html = await fetchLatestIndexHtml();
    if (!html) return null;
    const latest = getSignatureFromHtml(html);
    if (!latest) return null;
    return latest !== running;
  } catch (error) {
    console.warn('[VersionCheck] 检测线上版本失败：', error);
    return null;
  } finally {
    checking = false;
  }
};
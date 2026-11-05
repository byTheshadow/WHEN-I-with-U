// src/apps/messages/secretCode/secretCodeScramble.js
//
// "破译"文字动画：每个字符有自己的锁定时间，锁定前每 50ms 换一个乱码字符。
// 中文和全角字符配中文乱码，其余配符号乱码，宽度基本不跳。
// scramble(el, text, opts) 直接往元素里写 innerHTML，所以那个元素不要再给 React 子节点。
//
// opts:
//   delay     开始前等多久（ms）
//   dur       总时长（ms）
//   html      破译完成后显示的 HTML（比如带搜索高亮）；默认是转义后的原文
//   reverse   反过来：从明文变成密文（"加密"）
//   instant   不播动画，直接到终点
//   progress  (0..1) => void
//   done      () => void
// 系统开了"减少动态效果"时一律直接到终点。

const NOISE_WIDE = '暗密锁钥星雾影信封潮汐霓虹回声谜符匣棱镜潜伏';
const NOISE_NARROW = '#%&@$§¤†‡∆∑Ω≈∴※◇▓▒░<>/=+01';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ESC_MAP[c]);

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isWide = (ch) => /[⺀-鿿豈-﫿＀-｠　-〿‘-”]/.test(ch);

const noiseOf = (ch) => {
  const pool = isWide(ch) ? NOISE_WIDE : NOISE_NARROW;
  return pool.charAt(Math.floor(Math.random() * pool.length));
};

const cipherChar = (ch) =>
  /\s/.test(ch)
    ? ch
    : `<i class="sw-cx${isWide(ch) ? '' : ' sw-cx--n'}">${escapeHtml(noiseOf(ch))}</i>`;

/** 把一段文字整个变成乱码 HTML。 */
export const cipherHTML = (text) => Array.from(String(text)).map(cipherChar).join('');

// 每个元素同一时间只跑一个动画；开新的就把旧的作废
const runs = new WeakMap();

export const cancelScramble = (el) => {
  if (el) runs.delete(el);
};

export const scramble = (el, text, opts = {}) => {
  if (!el) return;
  const chars = Array.from(String(text));
  const finalHtml = opts.html != null ? opts.html : escapeHtml(text);
  const token = {};
  runs.set(el, token);

  const finish = () => {
    el.innerHTML = opts.reverse ? cipherHTML(text) : finalHtml;
    runs.delete(el);
    if (opts.progress) opts.progress(1);
    if (opts.done) opts.done();
  };

  if (prefersReducedMotion() || opts.instant || !chars.length) {
    finish();
    return;
  }

  const dur = opts.dur || Math.min(1500, 420 + chars.length * 75);
  const delay = opts.delay || 0;
  const lockAt = chars.map(
    (_, i) => 120 + (i / chars.length) * dur * 0.72 + Math.random() * dur * 0.2
  );
  const current = chars.map(cipherChar);
  let t0 = null;
  let lastSwap = -1e9;

  const frame = (ts) => {
    if (runs.get(el) !== token) return;
    if (t0 === null) t0 = ts + delay;
    const t = ts - t0;
    const swap = ts - lastSwap > 50;
    if (swap) lastSwap = ts;

    let html = '';
    for (let i = 0; i < chars.length; i += 1) {
      let plain = t >= lockAt[i];
      if (opts.reverse) plain = !plain;
      if (plain) {
        html += escapeHtml(chars[i]);
      } else {
        if (swap) current[i] = cipherChar(chars[i]);
        html += current[i];
      }
    }
    el.innerHTML = html;
    if (opts.progress) opts.progress(Math.max(0, Math.min(1, t / (dur + 120))));

    if (t >= dur + 140) {
      finish();
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};
// src/apps/focus/focusGrowthIcons.js
//
// 专注页的三种成长图标：单株植物、瓶中小景、月相星辰，每种 5 个阶段，另有枯萎版本。
// 全部是返回 SVG 字符串的纯函数，不依赖 DOM，颜色全部来自主题变量
// （--accent-color、--text-muted、--control-soft-bg、--star-color，以及专注页自己定义的 --aura-1/2/3），
// 所以五套主题和夜间氛围下都能自洽。
//
// 用法：renderGrowthSvg('plant', 3, false) 返回完整 <svg>…</svg> 字符串，
// 在组件里用 dangerouslySetInnerHTML 放进去（字符串全部来自本文件，不含用户输入）。

/* ============ 成长图标：全部用主题变量上色 ============ */
var A = 'var(--accent-color)', M = 'var(--text-muted)', SOFT = 'var(--control-soft-bg)', STAR = 'var(--star-color)';
/* 叶色、花色、沙色：用主题光色和强调色混出来，五套主题和夜间氛围下都自洽 */
var LEAFC = 'color-mix(in srgb,var(--aura-3) 38%,var(--accent-color))';
var PETC = 'color-mix(in srgb,var(--aura-2) 55%,var(--accent-color))';
var SANDC = 'color-mix(in srgb,var(--aura-1) 28%,var(--control-soft-bg))';
/* 每个图标实例都有自己的一组渐变，渐变颜色会跟着所在位置的主题变量走（夜间氛围、灵动岛里都对） */
var G = '', uid = 0;
function U(n) { return 'url(#' + G + n + ')'; }
function f(v) { return (+v).toFixed(2); }
var JAR = 'M25 12.5 V16.6 Q15 20.2 15 32 V51 Q15 58.6 22.6 58.6 H41.4 Q49 58.6 49 51 V32 Q49 20.2 39 16.6 V12.5Z';
function stopTag(o, c, op) { return '<stop offset="' + o + '" style="stop-color:' + c + ';stop-opacity:' + op + '"/>'; }
function lg(id, x1, y1, x2, y2, st) {
  var s = '<linearGradient id="' + G + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">';
  for (var i = 0; i < st.length; i++) s += stopTag(st[i][0], st[i][1], st[i][2]);
  return s + '</linearGradient>';
}
function defs() {
  return '<defs>' +
    lg('leaf', 0, 0, 1, 1, [[0, LEAFC, .62], [1, LEAFC, .14]]) +
    lg('leafd', 0, 0, 1, 1, [[0, A, .4], [1, A, .08]]) +
    lg('petal', 0, 1, 0, 0, [[0, A, .55], [.55, PETC, .5], [1, 'var(--aura-2, var(--accent-color))', .3]]) +
    lg('pot', 0, 0, 1, 0, [[0, SOFT, 1], [.42, 'var(--card-bg)', 1], [1, 'color-mix(in srgb,var(--accent-color) 10%,var(--control-soft-bg))', 1]]) +
    lg('soil', 0, 0, 0, 1, [[0, A, .5], [1, A, .22]]) +
    lg('moss', 0, 0, 0, 1, [[0, LEAFC, .62], [1, LEAFC, .2]]) +
    lg('sand', 0, 0, 0, 1, [[0, SANDC, 1], [1, SOFT, 1]]) +
    lg('glass', 0, 0, 1, 1, [[0, 'var(--aura-1, var(--control-soft-bg))', .36], [.5, 'var(--card-bg)', .06], [1, 'var(--aura-2, var(--control-soft-bg))', .3]]) +
    lg('ray', 0, 0, 0, 1, [[0, '#fff', .3], [1, '#fff', 0]]) +
    '<radialGradient id="' + G + 'glow">' + stopTag(0, 'var(--aura-1, var(--star-color))', .95) + stopTag(1, 'var(--aura-1, var(--star-color))', 0) + '</radialGradient>' +
    '<radialGradient id="' + G + 'cap" cx=".38" cy=".3" r=".8">' + stopTag(0, PETC, .85) + stopTag(1, A, .75) + '</radialGradient>' +
    '<clipPath id="' + G + 'jc"><path d="' + JAR + '"/></clipPath>' +
    '</defs>';
}
/* 茎：主线加一道细高光，看起来是圆的 */
function stem(d, col, dry) {
  return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round"/>' +
    (dry ? '' : '<path d="' + d + '" transform="translate(-.45 0)" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".55" stroke-linecap="round"/>');
}
/* 叶子：不对称叶形、下半边一层暗面、主脉加两条侧脉、上缘一道高光；dash 为枯萎，back 为靠后的深色叶 */
function leaf2(x, y, ang, len, w, col, dash, back) {
  var L = len;
  var p = 'M0 0 C' + f(L * .18) + ' ' + f(-w * 1.05) + ' ' + f(L * .64) + ' ' + f(-w * 1.08) + ' ' + L + ' 0 C' + f(L * .66) + ' ' + f(w * .7) + ' ' + f(L * .22) + ' ' + f(w * .82) + ' 0 0Z';
  var g = '<g transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')">';
  if (dash) return g + '<path d="' + p + '" fill="' + col + '" fill-opacity=".12" stroke="' + col + '" stroke-width="1.1" stroke-linejoin="round" stroke-dasharray="2 1.8"/></g>';
  return g + '<path d="' + p + '" fill="' + U(back ? 'leafd' : 'leaf') + '" stroke="' + col + '" stroke-width="1.05" stroke-linejoin="round"/>' +
    '<path d="M.6 0 Q' + f(L * .5) + ' ' + f(-w * .14) + ' ' + L + ' 0 C' + f(L * .66) + ' ' + f(w * .7) + ' ' + f(L * .22) + ' ' + f(w * .82) + ' .6 0Z" fill="' + col + '" fill-opacity=".13"/>' +
    '<path d="M.6 0 Q' + f(L * .5) + ' ' + f(-w * .14) + ' ' + f(L * .92) + ' -.05" fill="none" stroke="' + col + '" stroke-opacity=".55" stroke-width=".65" stroke-linecap="round"/>' +
    '<path d="M' + f(L * .34) + ' ' + f(-w * .08) + ' L' + f(L * .48) + ' ' + f(-w * .6) + ' M' + f(L * .6) + ' ' + f(-w * .1) + ' L' + f(L * .74) + ' ' + f(-w * .5) + '" stroke="' + col + '" stroke-opacity=".3" stroke-width=".5" stroke-linecap="round"/>' +
    '<path d="M' + f(L * .22) + ' ' + f(-w * .62) + ' Q' + f(L * .42) + ' ' + f(-w * .92) + ' ' + f(L * .6) + ' ' + f(-w * .86) + '" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".6" stroke-linecap="round"/></g>';
}
/* 花瓣：尖端带一个小缺口，像樱花 */
var PETAL = 'M0 0 C-3.6 -1.6 -5.6 -6.8 -3.4 -9.8 C-2.2 -11.4 -.8 -10.8 0 -9.6 C.8 -10.8 2.2 -11.4 3.4 -9.8 C5.6 -6.8 3.6 -1.6 0 0Z';
function petal(cx, cy, a, sc, op) {
  return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + a + ') scale(' + sc + ')">' +
    '<path d="' + PETAL + '" fill="' + U('petal') + '" fill-opacity="' + op + '" stroke="' + A + '" stroke-opacity=".85" stroke-width="' + f(0.9 / sc) + '" stroke-linejoin="round"/>' +
    '<path d="M0 -1.4 V-6.6" stroke="' + A + '" stroke-opacity=".3" stroke-width="' + f(0.55 / sc) + '" stroke-linecap="round"/></g>';
}
function fallen(x, y, a, sc) {
  return '<path transform="translate(' + x + ' ' + y + ') rotate(' + a + ') scale(' + sc + ')" d="' + PETAL + '" fill="' + M + '" fill-opacity=".18" stroke="' + M + '" stroke-width="' + f(0.9 / sc) + '" stroke-dasharray="' + (2 / sc).toFixed(1) + ' ' + (1.8 / sc).toFixed(1) + '"/>';
}
/* 陶瓷小花盆：托盘、盆沿下的阴影、一圈波浪釉纹、两道高光、土面 */
function pot2(col, w) {
  var d = w ? ' stroke-dasharray="2.4 2"' : '';
  return '<ellipse cx="32" cy="61.3" rx="14.5" ry="1.4" fill="' + col + '" fill-opacity=".13"/>' +
    '<path d="M19.4 58.5 H44.6 Q44.1 60.6 41.6 60.6 H22.4 Q19.9 60.6 19.4 58.5Z" fill="' + U('pot') + '" stroke="' + col + '" stroke-width="1.1" stroke-linejoin="round"' + d + '/>' +
    '<path d="M21 45.4 H43 L41 55.8 Q40.5 58.6 37.6 58.6 H26.4 Q23.5 58.6 23 55.8 Z" fill="' + U('pot') + '" stroke="' + col + '" stroke-width="1.3" stroke-linejoin="round"' + d + '/>' +
    '<path d="M21.2 45.6 H42.8 L42.45 47.4 Q32 48.7 21.55 47.4Z" fill="' + col + '" fill-opacity=".12"/>' +
    '<path d="M22.6 51.8 Q24.9 50.4 27.2 51.8 T31.8 51.8 T36.4 51.8 T41.2 51.6" fill="none" stroke="' + col + '" stroke-opacity="' + (w ? .22 : .45) + '" stroke-width=".85" stroke-linecap="round"/>' +
    (w ? '' : '<circle cx="29.6" cy="54.7" r=".7" fill="' + col + '" fill-opacity=".4"/><circle cx="34.4" cy="54.7" r=".7" fill="' + col + '" fill-opacity=".4"/>') +
    '<rect x="18.6" y="41.2" width="26.8" height="4.6" rx="2.3" fill="' + U('pot') + '" stroke="' + col + '" stroke-width="1.3"' + d + '/>' +
    '<path d="M21 42.5 H30.5" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/>' +
    '<ellipse cx="32" cy="41.6" rx="11.4" ry="1.3" fill="' + (w ? M + '" fill-opacity=".3' : U('soil')) + '"/>' +
    '<path d="M23.9 47.9 Q24.2 52.6 25.3 56.1" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M39.7 48.4 Q39.4 51 39 52.8" fill="none" stroke="' + col + '" stroke-opacity=".16" stroke-width="1.1" stroke-linecap="round"/>';
}
function plantGlow(n) {
  if (n === 1) return '<circle cx="32" cy="37.5" r="9" fill="' + U('glow') + '"/>';
  if (n === 4) return '<circle cx="32" cy="14" r="10" fill="' + U('glow') + '"/>';
  if (n === 5) return '<circle cx="32" cy="13" r="17" fill="' + U('glow') + '"/>';
  return '';
}
function plantParts(n) {
  var s = '', a;
  var four = leaf2(32, 38.6, -18, 11, 4.8, A, 0, 1) + leaf2(32, 36.8, -162, 10.4, 4.6, A, 0, 1) + leaf2(32.4, 30.4, -36, 9.2, 4.2, A) + leaf2(31.8, 28.8, -144, 8.6, 4, A);
  if (n === 1) {
    s += '<path d="M23.4 42 Q32 35.6 40.6 42Z" fill="' + U('soil') + '" stroke="' + A + '" stroke-width="1.1" stroke-linejoin="round"/>';
    s += '<circle cx="26.8" cy="40.8" r=".5" fill="' + A + '" fill-opacity=".5"/><circle cx="37.6" cy="40.9" r=".45" fill="' + A + '" fill-opacity=".5"/>';
    s += '<ellipse cx="31.6" cy="38.8" rx="2.7" ry="3.4" transform="rotate(-18 31.6 38.8)" fill="' + A + '"/>';
    s += '<ellipse cx="30.6" cy="37.7" rx=".7" ry="1.1" transform="rotate(-18 30.6 37.7)" fill="#fff" fill-opacity=".5"/>';
    s += '<path d="M31.6 36.8 Q32.6 38.2 31.9 40.2" fill="none" stroke="var(--card-bg)" stroke-opacity=".75" stroke-width=".6" stroke-linecap="round"/>';
    s += '<path d="M32.6 36 Q33.2 33 35.8 32.4" fill="none" stroke="' + A + '" stroke-width="1.1" stroke-linecap="round"/>';
    s += leaf2(35.6, 32.5, -24, 4.4, 2, A);
    s += sparkle(23.5, 32, 1.6) + sparkle(42, 29, 1.2) + sparkle(38.5, 24.5, .8);
  }
  if (n === 2) {
    s += stem('M32 42 C32 38.8 31.3 36.4 32.1 33.6', A);
    s += leaf2(32.1, 34, -30, 9.4, 5, A) + leaf2(32.1, 34.3, -150, 8.8, 4.8, A);
    s += '<circle cx="32.1" cy="33.1" r="1.1" fill="' + U('leaf') + '" stroke="' + A + '" stroke-width=".8"/>';
    s += '<ellipse cx="37.2" cy="30.3" rx=".85" ry="1" fill="#fff" fill-opacity=".85" stroke="' + A + '" stroke-opacity=".45" stroke-width=".5"/>';
  }
  if (n === 3) {
    s += stem('M32 42 C30.6 35 33.4 28.6 32 21.8', A) + four;
    s += '<path d="M32 22 C33.2 18.6 37 17.8 36.8 20.8 C36.2 22.9 33.8 23.2 32 22Z" fill="' + U('leaf') + '" stroke="' + A + '" stroke-width="1.05" stroke-linejoin="round"/>';
    s += '<path d="M32.4 21.8 Q34.4 20.4 36.2 20.4" fill="none" stroke="' + A + '" stroke-opacity=".5" stroke-width=".6"/>';
    s += '<path d="M32 22 Q29.8 19.8 30.8 17.8 Q32.2 16.8 32.3 18.4 Q32.2 19.2 31.4 19" fill="none" stroke="' + A + '" stroke-width=".9" stroke-linecap="round"/>';
  }
  if (n === 4) {
    s += stem('M32 42 C30.6 34 33.4 27 32 19.8', A) + four;
    s += '<path d="M32 21 C27.2 18 28.2 11.4 32 7.4 C35.8 11.4 36.8 18 32 21Z" fill="' + U('petal') + '" stroke="' + A + '" stroke-width="1.15" stroke-linejoin="round"/>';
    s += '<path d="M31.8 20.6 C29.8 17 30.2 12 32.6 8.4" fill="none" stroke="' + A + '" stroke-opacity=".5" stroke-width=".8" stroke-linecap="round"/>';
    s += '<path d="M32.6 20.4 C34.4 16.8 34.4 13 33.4 10.6" fill="none" stroke="' + A + '" stroke-opacity=".3" stroke-width=".7" stroke-linecap="round"/>';
    s += '<path d="M30.2 17.6 Q29.8 13.6 31.4 10.6" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/>';
    s += leaf2(32, 20.8, -58, 5.6, 2.3, A) + leaf2(32, 20.8, -122, 5.6, 2.3, A);
    s += sparkle(41, 9, 1.2);
  }
  if (n === 5) {
    s += stem('M32 42 C30.6 34 33.4 26 32 18', A) + four;
    s += leaf2(32, 18.4, -40, 4.6, 2, A) + leaf2(32, 18.4, -140, 4.6, 2, A);
    for (a = 36; a < 396; a += 72) s += petal(32, 13, a, 1.04, .38);
    for (a = 0; a < 360; a += 72) s += petal(32, 13, a, .8, .72);
    s += '<circle cx="32" cy="13" r="2.7" fill="' + A + '"/><circle cx="32" cy="13" r="1.3" fill="' + STAR + '"/><circle cx="31.3" cy="12.3" r=".55" fill="#fff" fill-opacity=".7"/>';
    for (a = 0; a < 360; a += 45) { var r = a * Math.PI / 180; s += '<circle cx="' + f(32 + 3.9 * Math.sin(r)) + '" cy="' + f(13 - 3.9 * Math.cos(r)) + '" r=".5" fill="' + STAR + '"/>'; }
    s += '<g transform="translate(48.6 28) rotate(64) scale(.42)" opacity=".8"><path d="' + PETAL + '" fill="' + U('petal') + '" stroke="' + A + '" stroke-width="2.2"/></g>';
    s += sparkle(14.5, 15, 2.2) + sparkle(51.5, 18.5, 1.6) + sparkle(46.5, 5, 1.2);
  }
  return s;
}
function plantWitherParts(inJar) {
  var c = M, s = '';
  s += stem('M32 42 C31.6 35 32.6 29.5 36 26.6 C39 24.1 42.6 25 43.4 28.6', c, true);
  s += leaf2(32, 37.4, 32, 8.6, 3.2, c, 1) + leaf2(32, 35.2, 148, 8, 3, c, 1);
  s += '<path d="M43.4 28.6 C40.4 31 40.8 35.6 43.8 37.4 C46.6 35.4 46.6 31 43.4 28.6Z" fill="' + c + '" fill-opacity=".16" stroke="' + c + '" stroke-width="1.1" stroke-dasharray="2 1.8" stroke-linejoin="round"/>';
  s += '<path d="M43.2 29.6 Q42.6 33.4 43.8 36.4" fill="none" stroke="' + c + '" stroke-opacity=".5" stroke-width=".7"/>';
  if (!inJar) s += fallen(14.6, 59.6, -72, .5) + fallen(49.8, 59.8, 78, .46);
  return s;
}
function iconPlant(n, w) {
  if (w) return '<g opacity=".95">' + pot2(M, true) + plantWitherParts(false) + '</g>';
  return plantGlow(n) + pot2(A, false) + plantParts(n);
}
/* 瓶里的小蘑菇：渐变伞盖、白点、菌褶 */
function shroom(x, y, r) {
  return '<path d="M' + f(x - .55) + ' ' + y + ' Q' + f(x - .8) + ' ' + f(y - r * .9) + ' ' + f(x - .25) + ' ' + f(y - r * 1.5) + ' H' + f(x + .55) + ' Q' + f(x + .85) + ' ' + f(y - r * .8) + ' ' + f(x + .7) + ' ' + y + 'Z" fill="var(--card-bg)" stroke="' + A + '" stroke-width=".7" stroke-linejoin="round"/>' +
    '<path d="M' + f(x - r) + ' ' + f(y - r * 1.35) + ' Q' + f(x - r * .95) + ' ' + f(y - r * 2.9) + ' ' + x + ' ' + f(y - r * 2.95) + ' Q' + f(x + r * .95) + ' ' + f(y - r * 2.9) + ' ' + f(x + r) + ' ' + f(y - r * 1.35) + ' Q' + x + ' ' + f(y - r * 1.05) + ' ' + f(x - r) + ' ' + f(y - r * 1.35) + 'Z" fill="' + U('cap') + '" stroke="' + A + '" stroke-width=".8" stroke-linejoin="round"/>' +
    '<circle cx="' + f(x - r * .42) + '" cy="' + f(y - r * 2.2) + '" r="' + f(r * .19) + '" fill="#fff" fill-opacity=".85"/>' +
    '<circle cx="' + f(x + r * .32) + '" cy="' + f(y - r * 2.5) + '" r="' + f(r * .13) + '" fill="#fff" fill-opacity=".85"/>' +
    '<circle cx="' + f(x + r * .58) + '" cy="' + f(y - r * 1.8) + '" r="' + f(r * .12) + '" fill="#fff" fill-opacity=".75"/>';
}
/* 瓶中小景：卵石沙层、炭线、土、起伏的苔藓、小石头和草；软木塞、两圈麻绳加蝴蝶结、带小叶子的吊牌；双层玻璃壁、斜光、水汽 */
function iconJar(n, w) {
  var col = w ? M : A, d = w ? ' stroke-dasharray="3 2.4"' : '', s = '', i;
  s += '<ellipse cx="32" cy="60.8" rx="17" ry="1.6" fill="' + col + '" fill-opacity=".13"/>';
  if (!w && n === 5) s += '<circle cx="32" cy="36" r="25" fill="' + U('glow') + '" opacity=".75"/>';
  s += '<path d="' + JAR + '" fill="' + (w ? SOFT + '" fill-opacity=".5' : U('glass')) + '"/>';
  s += '<g clip-path="' + U('jc') + '">';
  if (!w && n >= 2) s += '<ellipse cx="32" cy="31" rx="14" ry="12" fill="' + U('glow') + '" opacity="' + (n >= 4 ? .45 : .25) + '"/>';
  if (!w && n >= 3) s += '<path d="M19.5 12 H25 L40 60 H33Z" fill="' + U('ray') + '"/><path d="M27.2 12 H29.2 L44.6 60 H41.8Z" fill="' + U('ray') + '"/>';
  /* 沙和卵石 */
  s += '<rect x="14" y="51.5" width="36" height="8.5" fill="' + (w ? M + '" fill-opacity=".12' : U('sand')) + '"/>';
  var peb = [[18.6, 55, 1.9, 1.4], [23.4, 57, 1.5, 1.1], [28.2, 54.6, 2.1, 1.5], [33.8, 56.8, 1.6, 1.15], [39.2, 54.8, 2, 1.4], [44.6, 56.6, 1.6, 1.2], [30.8, 57.9, 1.1, .8], [41.8, 57.9, 1, .75]];
  for (i = 0; i < peb.length; i++) {
    var p = peb[i];
    s += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + p[2] + '" ry="' + p[3] + '" fill="' + SOFT + '" stroke="' + col + '" stroke-width=".65" stroke-opacity=".45"/>';
    if (!w) s += '<ellipse cx="' + f(p[0] - p[2] * .32) + '" cy="' + f(p[1] - p[3] * .38) + '" rx="' + f(p[2] * .34) + '" ry="' + f(p[3] * .24) + '" fill="#fff" fill-opacity=".6"/>';
  }
  s += '<path d="M14 52.3 Q20 51.5 26 52.1 T38 52.1 T50 51.9" fill="none" stroke="' + col + '" stroke-opacity=".4" stroke-width=".9" stroke-dasharray=".8 1.2" stroke-linecap="round"/>';
  /* 土 */
  s += '<path d="M14 51.9 Q24 50.8 32 51.6 Q41 50.6 50 51.8 V45 H14Z" fill="' + (w ? M + '" fill-opacity=".22' : U('soil')) + '"/>';
  if (!w) s += '<circle cx="20" cy="49.8" r=".4" fill="' + A + '" fill-opacity=".35"/><circle cx="27.4" cy="50.2" r=".35" fill="' + A + '" fill-opacity=".35"/><circle cx="36.8" cy="49.9" r=".4" fill="' + A + '" fill-opacity=".35"/><circle cx="44.2" cy="50.3" r=".35" fill="' + A + '" fill-opacity=".35"/>';
  /* 苔藓：一串小鼓包 */
  s += '<path d="M14 47.6 Q16.5 44.6 19.5 45.6 Q21.5 43.4 24.5 44.8 Q27.5 42.6 31 44.4 Q34.5 42.4 37.8 44.2 Q41 42.6 44 44.8 Q47.4 43.8 50 46.4 V48.6 Q32 46.8 14 48.6Z" fill="' + (w ? M + '" fill-opacity=".18' : U('moss')) + '" stroke="' + col + '" stroke-width=".85" stroke-opacity=".6" stroke-linejoin="round"/>';
  if (!w) {
    var mo = [[18.2, 46.6], [22.6, 46], [28.4, 45.6], [35.6, 45.4], [40.6, 45.8], [46.2, 46.6], [25.4, 47], [43, 47.1]];
    for (i = 0; i < mo.length; i++) s += '<circle cx="' + mo[i][0] + '" cy="' + mo[i][1] + '" r=".42" fill="' + A + '" fill-opacity=".35"/>';
    s += '<path d="M16.6 47.2 Q16.2 44.8 15.4 43.6 M17.4 47.2 Q17.6 44.4 18.6 43.2 M18.2 47.2 Q18.8 45.6 20 45" fill="none" stroke="' + A + '" stroke-opacity=".75" stroke-width=".8" stroke-linecap="round"/>';
  }
  s += '<path d="M19.6 47 Q19.8 44.4 22.4 44.2 Q25 44.4 25.4 46.8Z" fill="' + SOFT + '" stroke="' + col + '" stroke-width=".8" stroke-opacity=".75" stroke-linejoin="round"/>';
  if (!w) s += '<path d="M20.8 45.6 Q21.5 44.8 22.6 44.8" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".6" stroke-linecap="round"/>';
  if (!w && n >= 3) s += shroom(41, 46.4, 2.6);
  if (!w && n >= 4) s += shroom(46.4, 47, 1.6);
  if (w) s += '<g transform="translate(32 46) scale(.74) translate(-32 -42)">' + plantWitherParts(true) + '</g>' +
    '<path transform="translate(28.4 46.4) rotate(-80) scale(.42)" d="' + PETAL + '" fill="' + M + '" fill-opacity=".2" stroke="' + M + '" stroke-width="2"/>';
  else s += '<g transform="translate(32 46) scale(.74) translate(-32 -42)">' + plantGlow(n) + plantParts(n) + '</g>';
  if (!w && n >= 4) {
    var ff = n === 5 ? [[21, 29], [43, 25.5], [40.5, 35], [24.5, 38.5]] : [[43, 26]];
    for (i = 0; i < ff.length; i++) s += '<circle cx="' + ff[i][0] + '" cy="' + ff[i][1] + '" r="3.2" fill="' + U('glow') + '"/><circle cx="' + ff[i][0] + '" cy="' + ff[i][1] + '" r=".95" fill="' + STAR + '"/>';
  }
  s += '</g>';
  /* 内壁：一条细线表示玻璃厚度 */
  if (!w) s += '<path d="M26.6 14 V17.6 Q16.8 21.2 16.8 32 V50.8 Q16.8 56.9 22.8 56.9 H41.2 Q47.2 56.9 47.2 50.8 V32 Q47.2 21.2 37.4 17.6 V14" fill="none" stroke="' + col + '" stroke-opacity=".18" stroke-width=".6"/>';
  /* 水汽 */
  if (!w && n >= 2) {
    var dr = [[44.8, 26.6, .8], [46.2, 30.8, .6], [44.2, 33.8, .5], [45.8, 37, .45]];
    for (i = 0; i < dr.length; i++) s += '<ellipse cx="' + dr[i][0] + '" cy="' + dr[i][1] + '" rx="' + dr[i][2] + '" ry="' + f(dr[i][2] * 1.25) + '" fill="#fff" fill-opacity=".35" stroke="' + col + '" stroke-opacity=".4" stroke-width=".45"/>';
  }
  s += '<path d="M25 12.5 V16.6 Q15 20.2 15 32 V51 Q15 58.6 22.6 58.6 H41.4 Q49 58.6 49 51 V32 Q49 20.2 39 16.6 V12.5" fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"' + d + '/>';
  /* 瓶口 */
  s += '<rect x="23" y="10.4" width="18" height="3.2" rx="1.6" fill="' + (w ? SOFT : U('glass')) + '" stroke="' + col + '" stroke-width="1.3"' + d + '/>';
  if (!w) s += '<path d="M25 11.4 H30.5" stroke="#fff" stroke-opacity=".7" stroke-width=".7" stroke-linecap="round"/>';
  /* 软木塞 */
  s += '<g' + (w ? ' transform="rotate(-16 25 9) translate(-1.5 -2.5)"' : '') + '>' +
    '<path d="M25.3 10.4 L25.9 4.6 Q26.1 3.4 27.3 3.4 H36.7 Q37.9 3.4 38.1 4.6 L38.7 10.4Z" fill="' + (w ? SOFT : U('sand')) + '" stroke="' + col + '" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M25.3 10.4 L25.9 4.6 Q26.1 3.4 27.3 3.4 H36.7 Q37.9 3.4 38.1 4.6 L38.7 10.4Z" fill="' + col + '" fill-opacity=".12"/>' +
    '<path d="M26.2 4.6 Q32 6.1 37.8 4.6" fill="none" stroke="' + col + '" stroke-opacity=".35" stroke-width=".6"/>' +
    '<circle cx="28.4" cy="7.2" r=".5" fill="' + col + '" fill-opacity=".5"/><circle cx="31.6" cy="8.9" r=".45" fill="' + col + '" fill-opacity=".5"/><circle cx="34.4" cy="6.8" r=".5" fill="' + col + '" fill-opacity=".5"/><circle cx="36.4" cy="9" r=".4" fill="' + col + '" fill-opacity=".45"/>' +
    '<path d="M27 5.4 V9.6" stroke="#fff" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round"/></g>';
  /* 麻绳、蝴蝶结、吊牌 */
  if (!w) {
    s += '<path d="M24.9 14.4 Q32 16 39.1 14.4 M24.9 15.8 Q32 17.4 39.1 15.8" fill="none" stroke="' + col + '" stroke-width=".8" stroke-linecap="round"/>';
    s += '<path d="M39.2 15.1 Q41.4 12.6 42.1 14.5 Q41.4 15.8 39.2 15.1Z" fill="' + col + '" fill-opacity=".15" stroke="' + col + '" stroke-width=".7" stroke-linejoin="round"/>';
    s += '<path d="M39.4 15.6 Q40.8 17.6 43.4 19.8" fill="none" stroke="' + col + '" stroke-width=".7" stroke-linecap="round"/>';
    s += '<g transform="rotate(20 45.4 21.6)"><path d="M42.6 19.6 H47.6 Q48.4 19.6 48.4 20.4 V23 Q48.4 23.8 47.6 23.8 H42.6 L41.6 21.7Z" fill="' + SOFT + '" stroke="' + col + '" stroke-width=".8" stroke-linejoin="round"/>' +
      '<circle cx="43" cy="21.7" r=".45" fill="none" stroke="' + col + '" stroke-width=".5"/>' +
      '<path d="M44.5 22.8 Q45.3 20.4 47.3 20.6 Q46.9 22.7 44.5 22.8Z" fill="' + col + '" fill-opacity=".55"/></g>';
  }
  /* 玻璃反光 */
  s += '<path d="M18.6 36 Q18.4 25.6 25.4 21" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.7" stroke-linecap="round"/>' +
    '<path d="M18.8 39.6 V42.8" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M45.8 44.4 V50.4" stroke="#fff" stroke-opacity=".35" stroke-width="1.1" stroke-linecap="round"/>' +
    '<path d="M26.4 14 V16.2" stroke="#fff" stroke-opacity=".5" stroke-width=".8" stroke-linecap="round"/>';
  if (w) s += '<path d="M42.5 21.5 L40 26 L42.2 28.6 L39 33.4" fill="none" stroke="' + M + '" stroke-width=".9" stroke-linejoin="round"/>';
  return s;
}
function sparkle(x, y, r) {
  var a = r * .27;
  return '<path d="M' + x + ' ' + (y - r) + ' L' + (x + a) + ' ' + (y - a) + ' L' + (x + r) + ' ' + y + ' L' + (x + a) + ' ' + (y + a) + ' L' + x + ' ' + (y + r) + ' L' + (x - a) + ' ' + (y + a) + ' L' + (x - r) + ' ' + y + ' L' + (x - a) + ' ' + (y - a) + 'Z" fill="' + STAR + '"/>';
}
/* ============ 月相星辰（第六版）：夜空徽章 ============
   一枚深色夜空圆章，托着一轮有球面明暗、环形山和柔和晨昏线的月亮。
   阶段越高：月越圆、光晕越大、星座被点亮的星越多并连成线；满月时整条星座完整亮起。
   夜空底色由主题的 --aura-1 / --aura-2 调出来，所以五套主题下各有各的夜色。 */
var MSTARS = [[14, 45], [12.5, 28], [22, 14.5], [38, 9.5], [51, 21]];
var MDOTS = [[46, 50, .75], [22, 53, .6], [52, 38, .65], [41, 17, .5], [10, 37, .5]];
function mstar(x, y, r, glow, delay) {
  var a = r * .24;
  return '<g class="mtw" style="animation-delay:' + delay + 's">' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + f(r * 2.6) + '" fill="' + U('mg') + '" opacity="' + glow + '"/>' +
    '<path d="M' + x + ' ' + f(y - r) + ' L' + f(x + a) + ' ' + f(y - a) + ' L' + f(x + r) + ' ' + y + ' L' + f(x + a) + ' ' + f(y + a) + ' L' + x + ' ' + f(y + r) + ' L' + f(x - a) + ' ' + f(y + a) + ' L' + f(x - r) + ' ' + y + ' L' + f(x - a) + ' ' + f(y - a) + 'Z" fill="#fff7de"/></g>';
}
function moonDefs() {
  return '<defs>' +
    '<radialGradient id="' + G + 'msky" cx=".38" cy=".3" r=".9">' +
      stopTag(0, 'color-mix(in srgb,var(--aura-1) 42%,#171b52)', 1) +
      stopTag(.55, 'color-mix(in srgb,var(--aura-1) 16%,#0d0f31)', 1) +
      stopTag(1, 'color-mix(in srgb,var(--aura-2) 14%,#07081d)', 1) + '</radialGradient>' +
    '<radialGradient id="' + G + 'mg">' + stopTag(0, '#ffe8b4', .6) + stopTag(.45, '#ffe0a0', .2) + stopTag(1, '#ffe0a0', 0) + '</radialGradient>' +
    '<radialGradient id="' + G + 'mlit" cx=".34" cy=".28" r=".95">' + stopTag(0, '#fffef6', 1) + stopTag(.55, '#f7e9c6', 1) + stopTag(1, '#dcc78c', 1) + '</radialGradient>' +
    '<radialGradient id="' + G + 'mdark" cx=".4" cy=".35" r=".85">' + stopTag(0, 'color-mix(in srgb,var(--aura-1) 30%,#1d2159)', 1) + stopTag(1, '#0b0d2b', 1) + '</radialGradient>' +
    '<radialGradient id="' + G + 'mshade" cx=".5" cy=".5" r=".5">' + stopTag(0, '#6b5a36', 0) + stopTag(.72, '#6b5a36', 0) + stopTag(1, '#6b5a36', .34) + '</radialGradient>' +
    '<filter id="' + G + 'msoft" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation=".75"/></filter>' +
    '</defs>';
}
function moonPhase(rx, sweep) { return 'M32 21 A13 13 0 0 1 32 47 A' + rx + ' 13 0 0 ' + sweep + ' 32 21Z'; }
function iconMoon(n, w) {
  var out = moonDefs(), i, s;
  if (w) {
    /* 枯萎：夜空褪成灰，月亮被云盖住，星星都灭了，下着细雨 */
    out += '<circle cx="32" cy="32" r="30" fill="color-mix(in srgb,var(--text-muted) 24%,var(--control-soft-bg))"/>';
    out += '<circle cx="32" cy="32" r="30" fill="none" stroke="' + M + '" stroke-width="1.3" stroke-dasharray="3 2.6"/>';
    out += '<circle cx="32" cy="34" r="13" fill="none" stroke="' + M + '" stroke-opacity=".55" stroke-width="1"/>';
    out += '<path d="M13 44 Q13 36.5 20.5 36.5 Q22.5 29.5 30.5 30.5 Q36.5 26 42 32 Q50.5 31 50.5 39.5 Q50.5 45.5 44 45.5 H19 Q13 45.5 13 44Z" fill="var(--card-bg)" stroke="' + M + '" stroke-width="1.5" stroke-linejoin="round"/>';
    out += '<path d="M22 51 L20.5 55 M31 51 L29.5 55 M40 51 L38.5 55" stroke="' + M + '" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1.6 2.2"/>';
    return out;
  }
  /* 夜空底 */
  out += '<circle cx="32" cy="32" r="30" fill="' + U('msky') + '"/>';
  /* 背景细星 */
  for (i = 0; i < MDOTS.length; i++) out += '<circle cx="' + MDOTS[i][0] + '" cy="' + MDOTS[i][1] + '" r="' + MDOTS[i][2] + '" fill="#fff4d6" fill-opacity="' + (n === 1 ? .35 : .65) + '"/>';
  /* 星座：阶段越高点亮越多，并用细线连起来 */
  var lit = [0, 2, 3, 4, 5][n - 1];
  if (lit > 1) {
    var d = 'M' + MSTARS[0][0] + ' ' + MSTARS[0][1];
    for (i = 1; i < lit; i++) d += ' L' + MSTARS[i][0] + ' ' + MSTARS[i][1];
    out += '<path d="' + d + '" fill="none" stroke="#ffeec2" stroke-opacity=".42" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  for (i = 0; i < lit; i++) out += mstar(MSTARS[i][0], MSTARS[i][1], i === 4 ? 3.4 : (i === 3 ? 2.5 : 2.1), i === 4 ? .9 : .6, (i * .7).toFixed(1));
  /* 月晕：越圆越亮越大 */
  var halo = [0, .38, .5, .72, 1][n - 1], hr = [0, 17, 19, 22, 28][n - 1];
  if (halo) out += '<circle cx="32" cy="34" r="' + hr + '" fill="' + U('mg') + '" opacity="' + halo + '"/>';
  if (n === 5) out += '<circle cx="32" cy="34" r="19.5" fill="none" stroke="#ffeec2" stroke-opacity=".28" stroke-width=".6"/>';
  /* 月亮本体：暗面 + 亮面（带球面明暗与环形山）。蛾眉、半月、盈凸整体微微倾斜 */
  var tilt = n >= 2 && n <= 4 ? ' transform="rotate(-20 32 34)"' : '';
  out += '<g' + tilt + '>';
  out += '<circle cx="32" cy="34" r="13" fill="' + U('mdark') + '"/><circle cx="32" cy="34" r="13" fill="#cfd8ff" fill-opacity=".06"/>';
  if (n >= 2) {
    var lp = n === 5 ? null : (n === 2 ? moonPhase(9.5, 0) : n === 3 ? moonPhase(0.01, 0) : moonPhase(9.5, 1));
    out += '<clipPath id="' + G + 'mclip">' + (lp ? '<path d="' + lp + '"/>' : '<circle cx="32" cy="34" r="13"/>') + '</clipPath>';
    out += lp ? '<path d="' + lp + '" fill="' + U('mlit') + '" filter="' + U('msoft') + '"/>' : '<circle cx="32" cy="34" r="13" fill="' + U('mlit') + '"/>';
    out += '<g clip-path="' + U('mclip') + '">' +
      '<ellipse cx="34.5" cy="36.5" rx="5.6" ry="3.8" fill="#b29a68" fill-opacity=".13" transform="rotate(-24 34.5 36.5)"/>' +
      '<circle cx="36.8" cy="30.2" r="2.7" fill="#a8935f" fill-opacity=".26"/><circle cx="36.3" cy="29.6" r="1.6" fill="#fff" fill-opacity=".28"/>' +
      '<circle cx="28.2" cy="38.6" r="2.1" fill="#a8935f" fill-opacity=".24"/><circle cx="27.8" cy="38.1" r="1.2" fill="#fff" fill-opacity=".25"/>' +
      '<circle cx="37.4" cy="40.2" r="1.45" fill="#a8935f" fill-opacity=".22"/>' +
      '<circle cx="28.8" cy="29.4" r="1.15" fill="#a8935f" fill-opacity=".2"/>' +
      '<circle cx="32.4" cy="44.2" r="1" fill="#a8935f" fill-opacity=".18"/>' +
      '<circle cx="32" cy="34" r="13" fill="' + U('mshade') + '"/></g>';
  }
  out += '<circle cx="32" cy="34" r="13" fill="none" stroke="#fff1cf" stroke-opacity="' + (n === 1 ? .5 : .32) + '" stroke-width=".6"/>';
  out += '</g>';
  /* 圆章边缘：一圈极细的亮边和左上高光 */
  out += '<circle cx="32" cy="32" r="30" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".8"/>';
  out += '<path d="M4.4 21.9 A29.4 29.4 0 0 1 19.6 5.4" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.1" stroke-linecap="round"/>';
  return out;
}
var DIRS = {
  plant: { name: '单株植物', f: iconPlant, stages: ['种子', '发芽', '抽枝', '含苞', '开花'] },
  jar:   { name: '瓶中小景', f: iconJar,   stages: ['埋下', '萌发', '长高', '结蕾', '盛开'] },
  moon:  { name: '月相星辰', f: iconMoon,  stages: ['新月', '蛾眉', '半月', '盈凸', '满月'] }
};
var dir = 'plant';
function svg(k, n, w) { G = 'g' + (uid++) + '_'; return '<svg class="gicon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' + defs() + DIRS[k].f(n, w) + '</svg>'; }
function stackHtml(k) { var h = ''; for (var i = 1; i <= 5; i++) h += svg(k, i, false); return h; }

export const GROWTH_STYLE_IDS = ['plant', 'jar', 'moon'];
export const DEFAULT_GROWTH_STYLE = 'plant';

export const GROWTH_STYLE_META = {
  plant: { name: '单株植物', stages: DIRS.plant.stages },
  jar: { name: '瓶中小景', stages: DIRS.jar.stages },
  moon: { name: '月相星辰', stages: DIRS.moon.stages },
};

export const normalizeGrowthStyle = (value) =>
  GROWTH_STYLE_IDS.includes(value) ? value : DEFAULT_GROWTH_STYLE;

// 进度 0..1 对应第几阶段（1..5）。进度满了就是最后一阶段。
export const growthStageFromProgress = (progress) => {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  return Math.min(5, Math.floor(p * 5) + 1);
};

export const renderGrowthSvg = (style, stage, withered = false) => {
  const key = normalizeGrowthStyle(style);
  const n = Math.max(1, Math.min(5, Math.round(Number(stage) || 1)));
  return svg(key, n, Boolean(withered));
};

// src/apps/messages/secretCode/gravityPhysics.js
//
// 暗号墙用的小型刚体物理（没有任何外部依赖）。
// 矩形刚体：SAT 碰撞 + 接触点裁剪 + 带热启动的顺序冲量，固定步长 1/120 秒。
// 单位是 px 和秒，y 轴向下。从视觉参考 v8 原样移植，只改成了 ES 模块导出。
//
// createWorld(callbacks) 返回一个世界：
//   make / add / remove     造刚体、放进世界、拿走
//   setBounds(w, h)         设置场地大小（左右墙 + 地板）；高度变化时已有的方块跟着地板移动
//   step()                  走一个固定步长
//   grab / moveGrab / release  拖动：抓点上的阻尼弹簧，力有上限，所以大卡更沉
//   resting()               全部静止了吗（静止后外面可以停掉动画循环）
// callbacks.land(body) 第一次落地；callbacks.impact(body, speed) 较重的撞击。
export function createWorld(cb) {
  cb = cb || {};
  var DT = 1 / 120, GRAVITY = 1900, ITER = 8, SLOP = 0.5, BETA = 0.2, MAX_BIAS = 240;
  var FRICTION = 0.55, BOUNCE = 0.17, BOUNCE_MIN = 150, MAX_V = 1500;
  var bodies = [], statics = [], arbiters = new Map(), uid = 1, W = 0, H = 0, floor = null, drag = null;

  function make(x, y, hw, hh, a, isStatic) {
    var m = isStatic ? 0 : (hw * hh * 4) / 6400;
    return {
      id: uid++, x: x, y: y, hw: hw, hh: hh, a: a || 0, vx: 0, vy: 0, w: 0, m: m,
      im: isStatic ? 0 : 1 / m, ii: isStatic ? 0 : 12 / (m * 4 * (hw * hw + hh * hh)),
      isStatic: !!isStatic, landed: false, ghost: false
    };
  }
  function setBounds(w, h) {
    var dy = h - H;
    if (H) bodies.forEach(function (b) { b.y += dy; });
    W = w; H = h;
    floor = make(W / 2, H + 200, W + 800, 200, 0, true);
    statics = [floor, make(-200, H / 2 - 1500, 200, 4000, 0, true), make(W + 200, H / 2 - 1500, 200, 4000, 0, true)];
    arbiters.clear();
  }

  var EXT = ['hw', 'hh', 'hw', 'hh'];
  function normalOf(b, i) {
    var c = Math.cos(b.a), s = Math.sin(b.a);
    return i === 0 ? [c, s] : i === 1 ? [-s, c] : i === 2 ? [-c, -s] : [s, -c];
  }
  function vert(b, lx, ly) {
    var c = Math.cos(b.a), s = Math.sin(b.a);
    return [b.x + c * lx - s * ly, b.y + s * lx + c * ly];
  }
  function verts(b) { return [vert(b, b.hw, -b.hh), vert(b, b.hw, b.hh), vert(b, -b.hw, b.hh), vert(b, -b.hw, -b.hh)]; }
  function maxSep(a, vb) {
    var best = -Infinity, face = 0;
    for (var i = 0; i < 4; i++) {
      var n = normalOf(a, i), e = a[EXT[i]], m = Infinity;
      for (var j = 0; j < 4; j++) {
        var d = (vb[j][0] - a.x) * n[0] + (vb[j][1] - a.y) * n[1] - e;
        if (d < m) m = d;
      }
      if (m > best) { best = m; face = i; }
    }
    return [best, face];
  }
  /* 返回 a 指向 b 的法线和最多两个接触点 */
  function collide(a, b) {
    var va = verts(a), vb = verts(b), sa = maxSep(a, vb);
    if (sa[0] > 0) return null;
    var sb = maxSep(b, va);
    if (sb[0] > 0) return null;
    var flip = sb[0] > sa[0] + 0.3, ref = flip ? b : a, inc = flip ? a : b, face = flip ? sb[1] : sa[1], vi = flip ? va : vb;
    var n = normalOf(ref, face), e = ref[EXT[face]], t = [-n[1], n[0]], et = ref[EXT[(face + 1) % 4]];
    var incFace = 0, low = Infinity;
    for (var i = 0; i < 4; i++) {
      var ni = normalOf(inc, i), d = ni[0] * n[0] + ni[1] * n[1];
      if (d < low) { low = d; incFace = i; }
    }
    var p1 = vi[incFace], p2 = vi[(incFace + 1) % 4];
    function side(p) { return (p[0] - ref.x) * t[0] + (p[1] - ref.y) * t[1]; }
    var d1 = side(p1), d2 = side(p2), pts = [];
    function clip(p, q, dp, dq) {
      if (Math.abs(dp) <= et) return p;
      if ((dp > et && dq > et) || (dp < -et && dq < -et)) return null;
      var lim = dp > et ? et : -et, k = (lim - dp) / (dq - dp);
      return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
    }
    var c1 = clip(p1, p2, d1, d2), c2 = clip(p2, p1, d2, d1);
    [c1, c2].forEach(function (p, idx) {
      if (!p) return;
      var sep = (p[0] - ref.x) * n[0] + (p[1] - ref.y) * n[1] - e;
      if (sep <= 0.4) pts.push({ x: p[0], y: p[1], sep: sep, key: (flip ? 100 : 0) + face * 20 + incFace * 4 + idx, pn: 0, pt: 0 });
    });
    if (!pts.length) return null;
    return { nx: flip ? -n[0] : n[0], ny: flip ? -n[1] : n[1], pts: pts };
  }

  function pair(a, b, next) {
    if (a.ghost || b.ghost) return;
    if (!a.isStatic && !b.isStatic) {
      var dx = a.x - b.x, dy = a.y - b.y, r = Math.hypot(a.hw, a.hh) + Math.hypot(b.hw, b.hh);
      if (dx * dx + dy * dy > r * r) return;
    }
    var m = collide(a, b);
    if (!m) return;
    var key = a.id + ':' + b.id, old = arbiters.get(key), arb = { a: a, b: b, nx: m.nx, ny: m.ny, pts: m.pts };
    if (old) m.pts.forEach(function (p) {
      for (var i = 0; i < old.pts.length; i++) if (old.pts[i].key === p.key) { p.pn = old.pts[i].pn; p.pt = old.pts[i].pt; }
    });
    next.set(key, arb);
    if (!a.isStatic && !b.isStatic ? (a.landed || b.landed) : (a === floor || b === floor)) {
      [a, b].forEach(function (x) { if (!x.isStatic && !x.landed) { x.landed = true; if (cb.land) cb.land(x); } });
    }
    var fresh = !old;
    arb.pts.forEach(function (p) {
      var rax = p.x - a.x, ray = p.y - a.y, rbx = p.x - b.x, rby = p.y - b.y;
      var rvx = b.vx - b.w * rby - a.vx + a.w * ray, rvy = b.vy + b.w * rbx - a.vy - a.w * rax;
      var vn = rvx * arb.nx + rvy * arb.ny;
      if (fresh && vn < -240 && cb.impact) {
        if (!a.isStatic) cb.impact(a, -vn);
        if (!b.isStatic) cb.impact(b, -vn);
      }
      p.rest = vn < -BOUNCE_MIN ? -vn * BOUNCE : 0;
    });
  }

  function step() {
    var i, j;
    for (i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      b.vy += GRAVITY * DT;
      b.vx *= 0.9995; b.vy *= 0.9995; b.w *= 0.996;
    }
    if (drag) applyDrag();
    var next = new Map();
    for (i = 0; i < bodies.length; i++) {
      for (j = i + 1; j < bodies.length; j++) pair(bodies[i], bodies[j], next);
      for (j = 0; j < statics.length; j++) pair(bodies[i], statics[j], next);
    }
    arbiters = next;
    next.forEach(function (arb) {
      var a = arb.a, b = arb.b, tx = -arb.ny, ty = arb.nx;
      arb.pts.forEach(function (p) {
        var rax = p.x - a.x, ray = p.y - a.y, rbx = p.x - b.x, rby = p.y - b.y;
        var rna = rax * arb.ny - ray * arb.nx, rnb = rbx * arb.ny - rby * arb.nx;
        var rta = rax * ty - ray * tx, rtb = rbx * ty - rby * tx;
        p.mn = 1 / (a.im + b.im + a.ii * rna * rna + b.ii * rnb * rnb);
        p.mt = 1 / (a.im + b.im + a.ii * rta * rta + b.ii * rtb * rtb);
        p.bias = Math.max(p.rest, Math.min(MAX_BIAS, (-BETA / DT) * Math.min(0, p.sep + SLOP)));
        p.rax = rax; p.ray = ray; p.rbx = rbx; p.rby = rby;
        var ix = p.pn * arb.nx + p.pt * tx, iy = p.pn * arb.ny + p.pt * ty;
        impulse(a, b, p, ix, iy);
      });
    });
    for (var it = 0; it < ITER; it++) {
      next.forEach(function (arb) {
        var a = arb.a, b = arb.b, tx = -arb.ny, ty = arb.nx;
        arb.pts.forEach(function (p) {
          var rvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray, rvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
          var dn = p.mn * (p.bias - (rvx * arb.nx + rvy * arb.ny));
          var pn0 = p.pn; p.pn = Math.max(pn0 + dn, 0); dn = p.pn - pn0;
          impulse(a, b, p, dn * arb.nx, dn * arb.ny);
          rvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray; rvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
          var dt = p.mt * -(rvx * tx + rvy * ty), lim = FRICTION * p.pn, pt0 = p.pt;
          p.pt = Math.max(-lim, Math.min(lim, pt0 + dt)); dt = p.pt - pt0;
          impulse(a, b, p, dt * tx, dt * ty);
        });
      });
    }
    for (i = 0; i < bodies.length; i++) {
      var q = bodies[i], sp = Math.hypot(q.vx, q.vy);
      if (sp > MAX_V) { q.vx *= MAX_V / sp; q.vy *= MAX_V / sp; }
      q.w = Math.max(-16, Math.min(16, q.w));
      q.x += q.vx * DT; q.y += q.vy * DT; q.a += q.w * DT;
      if (!q.ghost && (q.y > H + 300 || q.x < -300 || q.x > W + 300)) { q.x = W / 2; q.y = -q.hh - 10; q.vx = q.vy = q.w = 0; }
    }
  }
  function impulse(a, b, p, ix, iy) {
    a.vx -= a.im * ix; a.vy -= a.im * iy; a.w -= a.ii * (p.rax * iy - p.ray * ix);
    b.vx += b.im * ix; b.vy += b.im * iy; b.w += b.ii * (p.rbx * iy - p.rby * ix);
  }

  /* 拖动：抓点上的阻尼弹簧。力有上限，所以大卡明显更沉，也不会被一下拽穿别的卡。 */
  function applyDrag() {
    var b = drag.b, c = Math.cos(b.a), s = Math.sin(b.a), rx = c * drag.lx - s * drag.ly, ry = s * drag.lx + c * drag.ly;
    var vx = b.vx - b.w * ry, vy = b.vy + b.w * rx, om = 24, ze = 0.62;
    var ax = om * om * (drag.tx - b.x - rx) - 2 * ze * om * vx, ay = om * om * (drag.ty - b.y - ry) - 2 * ze * om * vy - GRAVITY;
    var la = Math.hypot(ax, ay), lim = 30000 / Math.sqrt(Math.max(1, b.m));
    if (la > lim) { ax *= lim / la; ay *= lim / la; }
    b.vx += ax * DT; b.vy += ay * DT;
    b.w += b.ii * b.m * (rx * ay - ry * ax) * DT * 0.7;
    b.w *= 0.975;
  }
  function grab(b, px, py) {
    var c = Math.cos(b.a), s = Math.sin(b.a), dx = px - b.x, dy = py - b.y;
    drag = { b: b, lx: c * dx + s * dy, ly: -s * dx + c * dy, tx: px, ty: py };
  }
  return {
    bodies: bodies, step: step, make: make, setBounds: setBounds,
    add: function (b) { bodies.push(b); return b; },
    remove: function (b) { var i = bodies.indexOf(b); if (i > -1) bodies.splice(i, 1); if (drag && drag.b === b) drag = null; },
    grab: grab,
    moveGrab: function (x, y) { if (drag) { drag.tx = x; drag.ty = y; } },
    release: function () { drag = null; },
    isDragging: function () { return !!drag; },
    resting: function () {
      if (drag) return false;
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.ghost || Math.hypot(b.vx, b.vy) > 14 || Math.abs(b.w) > 0.14) return false;
      }
      return true;
    },
    size: function () { return { w: W, h: H }; },
    dt: DT
  };
}
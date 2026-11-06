// src/components/planetWarpScene.js
//
// 常驻加载页 planet-warp（"行星代码 · 跃迁开场"）的画面逻辑。
// 由 PlanetWarpLoader.jsx 在挂载时调用 startPlanetWarpScene，返回清理函数。
//
// 内容：沉睡的代码场被唤醒，字符飞来拼成星门，星门点火后相机穿过星门进入
// 跃迁隧道（色散拖尾），最后减速抵达一颗由代码构成的行星，地平线上日出。
//
// 原稿自带的刊头、标题、诗句、HUD 读数、状态行 / 进度条、角标和"重新播放"
// 按钮全部去掉，统一用 Preloader 共用的标题 / 引言 / 状态文字。原稿的
// DOM 层（星云、暗角、颗粒、闪白）里，星云和闪白改成画在画布里，暗角和颗粒
// 不要了。
//
// 时长：原稿约 11 秒完全落定，这里 SPEED = 1.4，整段压缩到约 8 秒（星门穿越
// 发生在第 3.6 秒左右）。星门圆心跟着占位框（slot）走；行星地表从占位框
// 下沿附近升起，Preloader 的标题 / 引言就压在暗色地表上。

import {
  TAU,
  clamp,
  lerp,
  smooth,
  easeOut,
  mulberry32,
  prefersReducedMotion,
  G,
  pickGlyph,
  ROW_DORM_F,
  ROW_DORM_B,
  ROW_WHITE,
  createGlyphAtlas,
  createNebulaImage
} from './planetCodeCommon';

// 全局时间倍率：原稿是 1。调大会整体加快。
const SPEED = 1.4;
const TL = {
  wakeStart: 0.8, wakeEnd: 2.7,
  gateStart: 1.5, gateSpread: 1.2, gateDur: 1.3,
  gateLine: 2.4, gateLineEnd: 3.8,
  igniteStart: 3.3, igniteEnd: 4.4,
  pass: 5.0,
  arriveStart: 6.2, arriveEnd: 8.0
};
const ZG = 3.52; // 星门初始距离（以星门半径为 1）
const DZ = 22; // 代码场纵深（循环）
const HZ = 120;
const TMAX = 14;
const FINAL_T = 9.2; // 减少动态效果时直接停在这个时刻（已乘过 SPEED 的画面时间）
// 地表字符压暗一点，让压在上面的 Preloader 标题 / 引言保持可读。
const SURFACE_ALPHA = 0.6;

/* 相机轨迹：速度曲线积分成表，保证 TL.pass 时刻恰好穿过星门。只算一次。 */
function vRaw(t) {
  if (t < 1.5) return 0.2;
  if (t < 4.2) return lerp(0.2, 0.8, smooth(1.5, 4.2, t));
  if (t < 5.4) return 0.8 * Math.pow(30, (t - 4.2) / 1.2); // 起跳：0.8 -> 24
  if (t < 6.4) return 24; // 巡航
  if (t < 7.6) return 24 * Math.pow(0.25 / 24, (t - 6.4) / 1.2); // 减速
  return lerp(0.25, 0.12, smooth(7.6, 9.5, t));
}
const CAM_RAW = new Float32Array(TMAX * HZ + 1);
for (let i = 1; i < CAM_RAW.length; i += 1) {
  CAM_RAW[i] = CAM_RAW[i - 1] + vRaw((i - 0.5) / HZ) / HZ;
}
function camRawAt(t) {
  const f = t * HZ;
  const i = Math.floor(f);
  if (i >= CAM_RAW.length - 1) {
    return CAM_RAW[CAM_RAW.length - 1] + vRaw(TMAX) * (t - TMAX);
  }
  return lerp(CAM_RAW[i], CAM_RAW[i + 1], f - i);
}
const K = ZG / camRawAt(TL.pass);

const makeChains = () => [
  { R: 1.00, sc: 1.00, speed: 0.10, band: 1, dir: 1, ang: 0 },
  { R: 1.22, sc: 0.85, speed: -0.16, band: 2, dir: -1, ang: 0 },
  { R: 1.46, sc: 0.70, speed: 0.07, band: 3, dir: 1, ang: 0 }
];

export function startPlanetWarpScene({ canvas, slot }) {
  const ctx = canvas.getContext('2d');
  const reduced = prefersReducedMotion();
  const CHAINS = makeChains();
  const GATE_ANG = { b: 0, c: 0, d: 0 };

  let W = 0;
  let H = 0;
  let dpr = 1;
  let S = 600;
  let F = 570;
  let Wd = 400; // 用来缩放光晕 / 光芒的"场景宽度"（宽屏上不让它无限变大）
  let cx = 0;
  let cy = 0;
  let slotW = 0;
  let slotH = 0;
  let baseFont = 12;
  let Rp = 800;
  let atlas = null;
  let cell = 32;
  let unit = 1;
  let nebula = null;

  let field = [];
  let gateGlyphs = [];
  let bgStars = [];

  let T = 0;
  let camZ = 0;
  let vNow = 0;
  let camX = 0;
  let camY = 0;
  let wake = 0;
  let ign = 0;
  let warp = 0;
  let arr = 0;
  let flashV = 0;
  let gateVis = 0;
  let spin = 0;
  let ptrX = 0;
  let ptrY = 0;
  let ptrTX = 0;
  let ptrTY = 0;
  let last = 0;
  let raf = 0;
  let resizeTimer = 0;
  let stopped = false;

  const readSlot = () => {
    const r = slot.getBoundingClientRect();
    slotW = r.width;
    slotH = r.height;
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
  };

  function buildScene() {
    const rnd = mulberry32(20260611);
    ({ atlas, cell, unit } = createGlyphAtlas({
      baseFont,
      dpr,
      pxScale: 1.4,
      minPx: 12,
      dormantLightness: [40, 30]
    }));
    nebula = createNebulaImage(W, H);

    // 3D 代码场（绕轴线分布，中间留出通道）
    field = [];
    const nf = clamp(Math.round((W * H) / 520), 380, 900);
    const cols = ['#cfe2ff', '#d9d0ff', '#ffe0ee', '#c8f6ff'];
    const rgbs = ['180,225,255', '200,190,255', '255,200,225', '150,240,255'];
    for (let i = 0; i < nf; i += 1) {
      const r = 0.30 + Math.pow(rnd(), 0.75) * 4.2;
      const th = rnd() * TAU;
      const ci = (rnd() * 4) | 0;
      field.push({
        x: Math.cos(th) * r, y: Math.sin(th) * r, z0: rnd() * DZ,
        kind: rnd() < 0.52 ? 0 : 1, gi: pickGlyph(rnd), rn: rnd(),
        band: [0, 1, 2, 1, 3, 2][(rnd() * 6) | 0], wb: [1, 3, 2, 1][(rnd() * 4) | 0],
        thr: (r / 4.5) * 0.6 + rnd() * 0.4, col: cols[ci], rgb: rgbs[ci]
      });
    }

    // 星门字符：从四周飞来，在环上就位
    gateGlyphs = [];
    const r0S = F / ZG;
    CHAINS.forEach((c, ri) => {
      const n = Math.round((TAU * c.R * r0S) / (baseFont * 1.05));
      for (let j = 0; j < n; j += 1) {
        gateGlyphs.push({
          ri, th0: (j / n) * TAU, gi: pickGlyph(rnd), rn: rnd(), d: rnd(),
          ra: 2 + rnd() * 3.2, dz: (rnd() - 0.4) * 9, idx: gateGlyphs.length
        });
      }
    });

    // 远景静态星点
    bgStars = [];
    const ns = clamp(Math.round((W * H) / 3200), 90, 220);
    for (let i = 0; i < ns; i += 1) {
      bgStars.push({
        x: rnd() * W, y: rnd() * H, r: 0.6 + rnd() * rnd() * 1.4, a: 0.2 + rnd() * 0.5,
        ph: rnd() * 6.28, sp: 0.8 + rnd() * 2.2, par: 0.2 + rnd() * 0.6
      });
    }
  }

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readSlot();
    // 宽屏上封顶，否则星门会大到压住上面的刊头文字。
    S = Math.min(W, H, 520);
    F = 0.95 * S;
    Wd = Math.min(W, 600);
    baseFont = clamp(S / 58, 9, 15);
    Rp = Math.max(W * 1.3, H * 1.05);
    buildScene();
  }

  /* ----------------------------- 绘制 ----------------------------- */
  function sprite(g, row, sx, sy, size, alpha) {
    if (alpha <= 0.012 || size < 0.5) return;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.drawImage(atlas, g * cell, row * cell, cell, cell, sx - size / 2, sy - size / 2, size, size);
  }
  function spriteXY(g, row, sx, sy, w, h, alpha) {
    if (alpha <= 0.012 || w < 0.5) return;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.drawImage(atlas, g * cell, row * cell, cell, cell, sx - w / 2, sy - h / 2, w, h);
  }

  function drawNebula() {
    ctx.globalAlpha = clamp((0.22 + wake * 0.38 + warp * 0.4) * 0.85);
    ctx.drawImage(nebula, 0, 0, W, H);
  }

  /* ---- 远景星点 ---- */
  function drawBgStars() {
    const fade = smooth(0, 1.4, T) * (1 - warp);
    if (fade <= 0.01) return;
    ctx.fillStyle = '#cfe2ff';
    for (const s of bgStars) {
      const tw = 0.55 + 0.45 * Math.sin(T * s.sp + s.ph);
      ctx.globalAlpha = clamp(s.a * tw * fade);
      ctx.fillRect(s.x + ptrX * 5 * s.par, s.y + ptrY * 4 * s.par, s.r, s.r);
    }
  }

  /* ---- 开场光点 + 声呐波 ---- */
  function drawSpark() {
    const u = clamp((T - 0.3) / 1.5);
    if (u > 0 && u < 1) {
      const f = Math.sin(Math.PI * u);
      const r = 8 + S * 0.14 * easeOut(u);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(235,252,255,' + (0.95 * f).toFixed(3) + ')');
      g.addColorStop(0.3, 'rgba(130,225,255,' + (0.4 * f).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(90,80,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const L = S * 0.55 * (0.3 + 0.7 * easeOut(u));
      const lg = ctx.createLinearGradient(cx - L, 0, cx + L, 0);
      lg.addColorStop(0, 'rgba(120,200,255,0)');
      lg.addColorStop(0.5, 'rgba(225,246,255,' + (0.85 * Math.pow(f, 1.5)).toFixed(3) + ')');
      lg.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(cx - L, cy - 1, L * 2, 2);
    }
    // 声呐波
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    for (const t0 of [0.9, 1.45, 2.0]) {
      const v = (T - t0) / 1.9;
      if (v <= 0 || v >= 1) continue;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(150,225,255,' + (0.38 * Math.pow(1 - v, 1.5)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(cx, cy, S * (0.08 + 0.85 * easeOut(v)), 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  /* ---- 3D 代码场：醒来 -> 拖尾 -> 跃迁色散 ---- */
  function drawField() {
    const fade = smooth(0, 1.2, T);
    const Ls = vNow * 0.055;
    const streak = Ls > 0.03;
    const chroma = warp > 0.15;
    const wk = wake * 1.15;
    for (let n = 0; n < field.length; n += 1) {
      const p = field[n];
      const dz = ((((p.z0 - camZ) % DZ) + DZ) % DZ) + 0.25;
      const inv = F / dz;
      const sx = cx + (p.x - camX) * inv;
      const sy = cy + (p.y - camY) * inv;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
      const a = fade * smooth(0.25, 0.9, dz) * (1 - smooth(DZ * 0.78, DZ, dz));
      if (a < 0.01) continue;
      const t = wk - p.thr;
      const awake = t >= 0;
      const fl = awake ? clamp(1 - t / 0.2) : 0;
      const bd = 1 - clamp(dz / DZ);

      if (p.kind === 0) {
        let row;
        let g = p.gi;
        let al;
        if (!awake) {
          row = dz < DZ * 0.5 ? ROW_DORM_F : ROW_DORM_B;
          al = 0.2 * a;
        } else {
          if (t < 0.12) g = (p.gi + Math.floor(T * 18 + p.rn * 13) * 17) % G;
          const b = clamp(0.30 + 0.45 * bd + 0.8 * fl + 0.35 * warp);
          if (fl > 0.55) row = ROW_WHITE;
          else row = (warp > 0.4 ? p.wb : p.band) * 4 + (b > 0.8 ? 3 : b > 0.58 ? 2 : b > 0.36 ? 1 : 0);
          al = (0.35 + 0.65 * b) * a;
        }
        const sf = clamp((0.55 * ZG) / dz, 0.35, 3.2) * (1 + 0.5 * fl);
        const size = cell * unit * sf;
        sprite(g, row, sx, sy, size, al);
        if (streak && awake) {
          for (let i = 1; i <= 3; i += 1) {
            const dz2 = dz + (Ls * i) / 3;
            const inv2 = F / dz2;
            const tx = cx + (p.x - camX) * inv2;
            const ty = cy + (p.y - camY) * inv2;
            if ((tx - sx) * (tx - sx) + (ty - sy) * (ty - sy) < 16) break;
            sprite((g + i * 7) % G, p.wb * 4 + (i === 1 ? 2 : 1), tx, ty, (size * inv2) / inv, al * (0.62 - 0.17 * i));
          }
        }
      } else {
        const bs = clamp(0.7 + (0.5 * ZG) / dz, 0.7, 2.6);
        const al = awake
          ? (0.35 + 0.65 * clamp(0.3 + 0.5 * bd + 0.8 * fl + 0.4 * warp)) * a
          : 0.24 * a;
        if (streak) {
          const inv2 = F / (dz + Ls);
          const tx = cx + (p.x - camX) * inv2;
          const ty = cy + (p.y - camY) * inv2;
          const dx = tx - sx;
          const dy = ty - sy;
          if (dx * dx + dy * dy > 16) {
            ctx.globalAlpha = 1;
            ctx.lineWidth = bs * 0.9;
            if (chroma) {
              const ox = (sx - cx) * 0.014 * warp;
              const oy = (sy - cy) * 0.014 * warp;
              ctx.strokeStyle = 'rgba(255,120,200,' + (al * 0.8).toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(sx + ox, sy + oy); ctx.lineTo(tx + ox, ty + oy); ctx.stroke();
              ctx.strokeStyle = 'rgba(110,230,255,' + (al * 0.9).toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(sx - ox, sy - oy); ctx.lineTo(tx - ox, ty - oy); ctx.stroke();
            } else {
              ctx.strokeStyle = 'rgba(' + p.rgb + ',' + al.toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
            }
            continue;
          }
        }
        ctx.globalAlpha = clamp(al);
        ctx.fillStyle = p.col;
        ctx.fillRect(sx - bs / 2, sy - bs / 2, bs, bs);
      }
    }
  }

  /* ---- 跃迁隧道：迎面飞来的光环 + 中心光芯 ---- */
  function drawTunnel() {
    if (warp < 0.03) return;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.62);
    g.addColorStop(0, 'rgba(225,246,255,' + (0.55 * warp).toFixed(3) + ')');
    g.addColorStop(0.28, 'rgba(130,200,255,' + (0.22 * warp).toFixed(3) + ')');
    g.addColorStop(0.7, 'rgba(150,110,255,' + (0.08 * warp).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(cx - S * 0.62, cy - S * 0.62, S * 1.24, S * 1.24);

    const RT = 1.9;
    const SP = 1.9;
    const NR = 12;
    const span = NR * SP;
    for (let i = 0; i < NR; i += 1) {
      const d = ((((i * SP - camZ) % span) + span) % span) + 0.2;
      const inv = F / d;
      const rs = RT * inv;
      if (rs > 3 * S || rs < 3) continue;
      const a = warp * 0.5 * smooth(0.2, 0.7, d) * (1 - smooth(span * 0.6, span, d));
      if (a < 0.01) continue;
      const circ = TAU * rs;
      const seg = 14;
      ctx.setLineDash([(circ / seg) * 0.62, (circ / seg) * 0.38]);
      ctx.lineDashOffset = -(i * 0.9 + T * 0.5) * rs;
      ctx.lineWidth = Math.max(0.8, Math.min(3, 0.012 * inv));
      ctx.strokeStyle = (i % 2 ? 'rgba(165,139,255,' : 'rgba(124,240,255,') + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(cx - camX * inv, cy - camY * inv, rs, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  /* ---- 星门 ---- */
  function drawGate() {
    const dG = ZG - camZ;
    if (dG <= 0.07) return;
    const inv = F / dG;
    const gx = cx - camX * inv;
    const gy = cy - camY * inv;
    const big = 6 * S;

    // 字符环（飞入 + 就位闪光）
    for (let n = 0; n < gateGlyphs.length; n += 1) {
      const g = gateGlyphs[n];
      const c = CHAINS[g.ri];
      const e0 = (T - TL.gateStart - g.d * TL.gateSpread - g.ri * 0.15) / TL.gateDur;
      if (e0 <= 0) continue;
      const e = easeOut(clamp(e0));
      const iv = 1 - e;
      const th = g.th0 + c.ang + iv * c.dir * 2.2;
      const rr = lerp(g.ra, c.R, e);
      const z = lerp(ZG + g.dz, ZG, e);
      const d = z - camZ;
      if (d < 0.08) continue;
      const k = F / d;
      const sx = cx + (Math.cos(th) * rr - camX) * k;
      const sy = cy + (Math.sin(th) * rr - camY) * k;
      const fl = e0 >= 1 ? clamp(1 - (e0 - 1) * 2.5) : 0;
      const sf = clamp((c.sc * ZG) / d, 0.2, 5);
      let gi = g.gi;
      if (e0 < 1.05) gi = (g.gi + Math.floor(T * 18 + g.rn * 13) * 17) % G;
      const b = clamp(0.5 + 0.3 * ign + 0.8 * fl);
      const row = fl > 0.4 ? ROW_WHITE : c.band * 4 + (b > 0.8 ? 3 : b > 0.6 ? 2 : 1);
      const al = e * (0.55 + 0.4 * ign) * smooth(0.06, 0.5, d);
      sprite(gi, row, sx, sy, cell * unit * sf, al);
    }

    // 结构线条
    const vis = gateVis;
    if (vis > 0.001 && inv < big) {
      const A = vis * (0.5 + 0.4 * ign);
      const arc = (r, a0, frac, lw, col, alpha) => {
        if (alpha <= 0.004 || r < 1 || r > big) return;
        ctx.beginPath();
        ctx.arc(gx, gy, r, a0, a0 + TAU * frac);
        ctx.lineWidth = Math.max(0.5, lw);
        ctx.strokeStyle = 'rgba(' + col + ',' + alpha.toFixed(3) + ')';
        ctx.stroke();
      };
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      const draw = easeOut(vis);
      arc(0.96 * inv, -Math.PI / 2, draw, 1.2, '124,240,255', A);
      arc(1.04 * inv, -Math.PI / 2, draw, 1.2, '124,240,255', A);
      arc(1.00 * inv, -Math.PI / 2, draw, 0.1 * inv, '124,200,255', (0.05 + 0.10 * ign) * vis);

      // 刻度环
      const rt = 0.80 * inv;
      if (rt < big) {
        ctx.beginPath();
        for (let i = 0; i < 72; i += 1) {
          const a = GATE_ANG.b + (i * TAU) / 72;
          const l = (i % 6 === 0 ? 0.06 : 0.032) * inv;
          const cs = Math.cos(a);
          const sn = Math.sin(a);
          ctx.moveTo(gx + cs * rt, gy + sn * rt);
          ctx.lineTo(gx + cs * (rt + l), gy + sn * (rt + l));
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(170,205,255,' + (0.55 * A).toFixed(3) + ')';
        ctx.stroke();
      }
      // 分段虚线环
      const rc = 1.34 * inv;
      if (rc < big) {
        const circ = TAU * rc;
        ctx.setLineDash([(circ / 12) * 0.7, (circ / 12) * 0.3]);
        ctx.lineDashOffset = -GATE_ANG.c * rc;
        arc(rc, 0, draw, Math.max(1, 0.014 * inv), '165,139,255', A * 0.9);
        ctx.setLineDash([2, 7]);
        ctx.lineDashOffset = 0;
        arc(1.6 * inv, 0, draw, 1, '150,190,255', 0.3 * vis);
        ctx.setLineDash([]);
      }
      // 四根支架
      ctx.beginPath();
      for (let k = 0; k < 4; k += 1) {
        const a = GATE_ANG.c * 0.5 + Math.PI / 4 + (k * Math.PI) / 2;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const r1 = 1.0 * inv;
        const r2 = 1.62 * inv;
        const cap = 0.07 * inv;
        const ex = gx + cs * r2;
        const ey = gy + sn * r2;
        ctx.moveTo(gx + cs * r1, gy + sn * r1);
        ctx.lineTo(ex, ey);
        ctx.moveTo(ex - sn * cap, ey + cs * cap);
        ctx.lineTo(ex + sn * cap, ey - cs * cap);
      }
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(225,246,255,' + (0.7 * A).toFixed(3) + ')';
      ctx.stroke();

      // 内环 + 辐条
      arc(0.58 * inv, 0, 1, 1.5, '210,246,255', (0.25 + 0.6 * ign) * vis);
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = GATE_ANG.d + (i * TAU) / 12;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        ctx.moveTo(gx + cs * 0.58 * inv, gy + sn * 0.58 * inv);
        ctx.lineTo(gx + cs * 0.80 * inv, gy + sn * 0.80 * inv);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(150,215,255,' + (0.3 * A).toFixed(3) + ')';
      ctx.stroke();

      // 追逐光
      if (ign > 0.05) {
        for (let k = 0; k < 3; k += 1) {
          const a0 = T * 3.2 + (k * TAU) / 3;
          arc(1.0 * inv, a0, 0.1, 3, '255,255,255', 0.85 * ign * vis);
        }
      }
    }

    // 光门：点火后中心亮起
    if (ign > 0.003 && inv < big) {
      const pr = 0.60 * inv;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, pr);
      g.addColorStop(0, 'rgba(245,253,255,' + (0.95 * ign).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(130,225,255,' + (0.55 * ign).toFixed(3) + ')');
      g.addColorStop(0.8, 'rgba(120,100,255,' + (0.28 * ign).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(90,60,200,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, pr, 0, TAU);
      ctx.fill();
      // 光芒
      ctx.beginPath();
      for (let i = 0; i < 18; i += 1) {
        const a = T * 0.25 + (i * TAU) / 18;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const r2 = Math.min(2.6 * inv, S * 1.4);
        ctx.moveTo(gx + cs * pr * 0.9, gy + sn * pr * 0.9);
        ctx.lineTo(gx + cs * r2, gy + sn * r2);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(170,230,255,' + (0.07 * ign).toFixed(3) + ')';
      ctx.stroke();
    }
  }

  /* ---- 抵达：代码行星的地平线 + 日出 ---- */
  function limbY(x, cys) {
    const dx = x - cx;
    return cys - Math.sqrt(Math.max(0, Rp * Rp - dx * dx));
  }

  function drawArrival() {
    const e = easeOut(arr);
    // 地平线停在占位框下沿附近，Preloader 的标题 / 引言压在地表上。
    const yh = cy + slotH * 0.36 + (1 - e) * H * 0.55;
    const cys = yh + Rp;
    const cxp = cx + ptrX * 7;
    const sunRise = smooth(TL.arriveStart + 0.6, TL.arriveEnd + 0.8, T);
    const sunX = cx + Wd * 0.21 + ptrX * 7;
    const sunY = limbY(sunX, cys) - lerp(-34, 5, easeOut(sunRise));

    // 1) 太阳光晕（在行星之后，会被地平线遮住下半）
    let g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Wd * 0.62);
    g.addColorStop(0, 'rgba(255,248,235,' + (0.95 * sunRise).toFixed(3) + ')');
    g.addColorStop(0.05, 'rgba(255,214,170,' + (0.60 * sunRise).toFixed(3) + ')');
    g.addColorStop(0.22, 'rgba(255,140,170,' + (0.24 * sunRise).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(140,100,255,' + (0.10 * sunRise).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 2) 行星本体（不透明，遮住其后的星场）
    ctx.globalCompositeOperation = 'source-over';
    const dg = ctx.createLinearGradient(0, yh, 0, H);
    dg.addColorStop(0, 'rgba(26,28,68,0.99)');
    dg.addColorStop(0.5, 'rgba(8,10,28,1)');
    dg.addColorStop(1, 'rgba(2,3,9,1)');
    ctx.globalAlpha = smooth(TL.arriveStart, TL.arriveStart + 0.9, T);
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(cxp, cys, Rp, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;

    // 3) 地表：经纬网 + 代码行（以极点为轴的同心圈，越靠近地平线越被压扁）
    // 宽屏上放大字符间距，避免地表字符多到拖慢帧率（手机上等于原稿的 baseFont * 1.3）。
    const sp = Math.max(baseFont * 1.3, W / 90);
    const rhoMin = Math.max(Rp * 0.2, cys - H - 8);
    const rW = Math.max(0, T - TL.arriveStart - 0.5) * Wd * 0.62; // 唤醒波从太阳向外扩散
    const spinA = spin;
    let rho = Rp * 0.9995;
    let k = 0;
    const rows = [];
    while (rho > rhoMin && k < 90) {
      const cosA = Math.sqrt(Math.max(0, 1 - (rho / Rp) * (rho / Rp)));
      rows.push(rho, cosA);
      rho -= sp * (0.26 + 0.74 * cosA);
      k += 1;
    }
    // 纬线
    ctx.beginPath();
    for (let i = 0; i < rows.length; i += 2) {
      const r = rows[i];
      const half = Math.asin(Math.min(1, (W * 0.5 + sp * 2) / r));
      ctx.moveTo(cxp + r * Math.cos(-Math.PI / 2 - half), cys + r * Math.sin(-Math.PI / 2 - half));
      ctx.arc(cxp, cys, r, -Math.PI / 2 - half, -Math.PI / 2 + half);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(130,200,255,' + (0.07 * arr).toFixed(3) + ')';
    ctx.stroke();
    // 经线
    const rMin2 = rows.length ? rows[rows.length - 2] : Rp * 0.5;
    const win = Math.asin(Math.min(1, (W * 0.5 + 20) / Math.max(rMin2, 1)));
    ctx.beginPath();
    for (let m = 0; m < 60; m += 1) {
      let a = (spinA + (m * TAU) / 60) % TAU;
      if (a > Math.PI) a -= TAU;
      const da = Math.abs(a + Math.PI / 2 > Math.PI ? a - 1.5 * Math.PI : a + Math.PI / 2);
      if (da > win) continue;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      ctx.moveTo(cxp + cs * rMin2, cys + sn * rMin2);
      ctx.lineTo(cxp + cs * Rp, cys + sn * Rp);
    }
    ctx.strokeStyle = 'rgba(130,200,255,' + (0.05 * arr).toFixed(3) + ')';
    ctx.stroke();

    // 代码字符
    for (let i = 0, kk = 0; i < rows.length; i += 2, kk += 1) {
      const r = rows[i];
      const cosA = rows[i + 1];
      const dth = sp / r;
      const half = Math.asin(Math.min(1, (W * 0.5 + sp * 2) / r));
      const off = spinA + kk * 0.37;
      const jmin = Math.ceil((-Math.PI / 2 - half - off) / dth);
      const jmax = Math.floor((-Math.PI / 2 + half - off) / dth);
      const M = Math.max(1, Math.round(TAU / dth));
      const hf = clamp(cosA * 1.15, 0.1, 1);
      const rim = Math.pow(1 - cosA, 1.2);
      for (let j = jmin; j <= jmax; j += 1) {
        const th = off + j * dth;
        const sx = cxp + r * Math.cos(th);
        const sy = cys + r * Math.sin(th);
        if (sy < -10 || sy > H + 10) continue;
        const jj = ((j % M) + M) % M;
        const hsh = ((kk * 92821) ^ (jj * 689287)) >>> 0;
        let gi = hsh % G;
        const dsun = Math.hypot(sx - sunX, sy - sunY);
        const lit = Math.exp(-Math.pow(dsun / (Wd * 0.55), 2));
        const nz = ((hsh >>> 8) & 15) / 15;
        const d = rW - dsun + nz * Wd * 0.05;
        let row;
        let alpha;
        if (d < 0) {
          row = ROW_DORM_F;
          alpha = (0.07 + 0.22 * lit + 0.1 * rim) * arr;
        } else {
          const flash = clamp(1 - d / (Wd * 0.1));
          if (d < Wd * 0.05) gi = (gi + Math.floor(T * 18 + nz * 13) * 17) % G;
          const b = clamp(0.2 + 0.55 * lit + 0.35 * rim + 0.8 * flash);
          const q = clamp(0.2 + 0.75 * lit + 0.15 * rim, 0, 0.999);
          row = flash > 0.55 ? ROW_WHITE : ((q * 6) | 0) * 4 + (b > 0.78 ? 3 : b > 0.55 ? 2 : b > 0.33 ? 1 : 0);
          alpha = (0.3 + 0.7 * b) * arr;
        }
        const w = cell * unit;
        spriteXY(gi, row, sx, sy, w, w * hf, alpha * SURFACE_ALPHA);
      }
    }

    // 4) 大气层 + 太阳侧辉光
    ctx.globalAlpha = 1;
    const atm = ctx.createRadialGradient(cxp, cys, Rp * 0.99, cxp, cys, Rp * 1.045);
    atm.addColorStop(0, 'rgba(120,200,255,0)');
    atm.addColorStop(0.22, 'rgba(150,225,255,' + (0.6 * arr).toFixed(3) + ')');
    atm.addColorStop(0.55, 'rgba(120,130,255,' + (0.18 * arr).toFixed(3) + ')');
    atm.addColorStop(1, 'rgba(90,70,220,0)');
    ctx.fillStyle = atm;
    ctx.fillRect(0, 0, W, H);

    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Wd * 0.5);
    sg.addColorStop(0, 'rgba(255,232,196,' + (0.50 * sunRise).toFixed(3) + ')');
    sg.addColorStop(0.2, 'rgba(255,160,176,' + (0.22 * sunRise).toFixed(3) + ')');
    sg.addColorStop(0.5, 'rgba(150,110,255,' + (0.08 * sunRise).toFixed(3) + ')');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);

    // 5) 镜头光：横向光芒 + 鬼影 + 日核
    const pulse = 0.85 + 0.15 * Math.sin(T * 2.4);
    const L = Wd * 0.95;
    const fg = ctx.createLinearGradient(sunX - L, 0, sunX + L, 0);
    fg.addColorStop(0, 'rgba(120,200,255,0)');
    fg.addColorStop(0.35, 'rgba(160,215,255,' + (0.35 * sunRise).toFixed(3) + ')');
    fg.addColorStop(0.5, 'rgba(255,250,240,' + (0.95 * sunRise * pulse).toFixed(3) + ')');
    fg.addColorStop(0.65, 'rgba(255,170,190,' + (0.35 * sunRise).toFixed(3) + ')');
    fg.addColorStop(1, 'rgba(255,140,170,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(sunX - L, sunY - 1, L * 2, 2);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(sunX - L, sunY - 7, L * 2, 14);
    ctx.globalAlpha = 1;
    const core = S * 0.03 * (0.4 + 0.6 * sunRise);
    const cg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, core * 3);
    cg.addColorStop(0, 'rgba(255,255,255,' + sunRise.toFixed(3) + ')');
    cg.addColorStop(0.3, 'rgba(255,236,205,' + (0.8 * sunRise).toFixed(3) + ')');
    cg.addColorStop(1, 'rgba(255,170,150,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(sunX - core * 3, sunY - core * 3, core * 6, core * 6);

    const gdx = cx - sunX;
    const gdy = cy - sunY;
    const ghosts = [
      [0.55, 0.05, '130,220,255'],
      [1.1, 0.11, '255,170,200'],
      [1.65, 0.07, '170,150,255'],
      [2.2, 0.16, '255,210,160']
    ];
    ctx.lineWidth = 1;
    for (const gh of ghosts) {
      const gxp = sunX + gdx * gh[0];
      const gyp = sunY + gdy * gh[0];
      const gr = S * gh[1];
      const a = 0.10 * sunRise * arr;
      const gg = ctx.createRadialGradient(gxp, gyp, gr * 0.6, gxp, gyp, gr);
      gg.addColorStop(0, 'rgba(' + gh[2] + ',0)');
      gg.addColorStop(1, 'rgba(' + gh[2] + ',' + a.toFixed(3) + ')');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(gxp, gyp, gr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(' + gh[2] + ',' + (a * 1.8).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(gxp, gyp, gr, 0, TAU);
      ctx.stroke();
    }
  }

  // 穿过星门瞬间的闪白（原稿是一层 DOM，这里直接画在画布最上面）。
  function drawFlash() {
    if (flashV < 0.01) return;
    const r = Math.max(W, H) * 0.7;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.16, 'rgba(200,238,255,0.96)');
    g.addColorStop(0.52, 'rgba(140,160,255,0.72)');
    g.addColorStop(1, 'rgba(70,50,170,0.55)');
    ctx.globalAlpha = clamp(flashV * 0.95);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // 镜头抖动 / 翻滚（只在点火与跃迁时出现）
    const shakeAmt = 0.6 * smooth(3.6, 4.8, T) * (1 - smooth(5.6, 6.8, T)) + 0.5 * flashV;
    const amp = shakeAmt * S * 0.004;
    const shx = (Math.sin(T * 37.1) + Math.sin(T * 23.7 + 1)) * amp;
    const shy = (Math.sin(T * 29.3 + 2) + Math.sin(T * 41.9)) * amp;
    const roll = 0.05 * warp * Math.sin(T * 1.3);
    ctx.translate(cx + shx, cy + shy);
    ctx.rotate(roll);
    ctx.translate(-cx, -cy);

    ctx.globalCompositeOperation = 'lighter';
    drawNebula();
    drawBgStars();
    drawSpark();
    drawTunnel();
    drawField();
    drawGate();
    if (arr > 0.002) drawArrival();

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawFlash();
  }

  function update(dt) {
    camZ = K * camRawAt(T);
    vNow = K * vRaw(T);
    wake = smooth(TL.wakeStart, TL.wakeEnd, T);
    gateVis = smooth(TL.gateLine, TL.gateLineEnd, T);
    ign = smooth(TL.igniteStart, TL.igniteEnd, T);
    warp = smooth(4.3, 5.2, T) * (1 - smooth(6.5, 7.6, T));
    arr = smooth(TL.arriveStart, TL.arriveEnd, T);
    flashV = Math.exp(-Math.pow((T - (TL.pass + 0.05)) / 0.22, 2));

    ptrX += (ptrTX - ptrX) * Math.min(1, dt * 3);
    ptrY += (ptrTY - ptrY) * Math.min(1, dt * 3);
    camX = (ptrX * 0.16 + Math.sin(T * 0.35) * 0.04) * (1 - 0.8 * warp);
    camY = (ptrY * 0.10 + Math.cos(T * 0.29) * 0.03) * (1 - 0.8 * warp);

    const boost = 0.6 + 1.6 * ign + 2 * warp;
    CHAINS.forEach((c) => { c.ang += dt * c.speed * boost; });
    GATE_ANG.b -= dt * 0.18 * boost;
    GATE_ANG.c += dt * 0.22 * boost;
    GATE_ANG.d += dt * 0.5 * boost;
    spin += dt * (16 / Rp);
  }

  function frame(now) {
    if (stopped) return;
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) * SPEED;
    last = now;
    T += dt;
    readSlot();
    update(dt);
    render();
  }

  const onPointerMove = (e) => {
    ptrTX = (e.clientX / (W || 1) - 0.5) * 2;
    ptrTY = (e.clientY / (H || 1) - 0.5) * 2;
  };
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!stopped) layout();
    }, 120);
  };

  layout();
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', onResize);

  if (reduced) {
    // 减少动态效果：直接画出抵达后的静止画面，不跑动画循环。
    T = FINAL_T;
    update(0.016);
    render();
  } else {
    last = performance.now();
    raf = window.requestAnimationFrame(frame);
  }

  return () => {
    stopped = true;
    window.cancelAnimationFrame(raf);
    window.clearTimeout(resizeTimer);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', onResize);
  };
}
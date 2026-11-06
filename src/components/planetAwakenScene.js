// src/components/planetAwakenScene.js
//
// 常驻加载页 planet-awaken（"行星代码 · 开屏动画"）的画面逻辑。
// 由 PlanetAwakenLoader.jsx 在挂载时调用 startPlanetAwakenScene，返回清理函数。
//
// 内容：沉睡的代码字符从四面八方汇聚成一颗行星，扫描环自南极升向北极逐层
// 唤醒，四圈代码轨道随后依次点亮，代码流向行星汇入。
//
// 原稿自带的刊头、PLANET CODE 标题、诗句、HUD 读数、百分比进度条和
// "重新播放"按钮全部去掉，统一用 Preloader 共用的标题 / 引言 / 状态文字
// （跟 PlanetCodeLoader、WinterMirrorLoader 是同一个处理方式）。
// 画布铺满整个视口，行星的圆心跟着"占位框"（slot）走，这样光晕和星空
// 不会被卡片边缘裁成一块一块。

import {
  clamp,
  lerp,
  smooth,
  easeOut,
  easeIO,
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

// 时间单位：秒。
const TL = {
  asmStart: 0.9, asmSpread: 1.0, asmDur: 1.3,
  scanStart: 2.7, scanDur: 3.3,
  ringAsmStart: 1.6, ringAsmSpread: 0.9, ringAsmDur: 1.5,
  ringWakeStart: 3.5, ringWakeStep: 0.6, ringWakeDur: 1.7,
  streamsStart: 1.9, streamsEnd: 6.3,
  flareStart: 0.55, flareEnd: 2.9
};
const TILT = 0.40;
const ROLL = -0.32;
const SCAN_END = TL.scanStart + TL.scanDur;
const FINAL_T = 8.4; // 减少动态效果时直接停在这个时刻

const LIGHT = (() => {
  const v = [-0.62, -0.42, 0.66];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((a) => a / l);
})();

const makeRingDefs = () => [
  { k: 1.30, dt: 0.00, dr: 0.00, speed: 0.55, sc: 0.80, band: 1, rgb: '124,240,255' },
  { k: 1.50, dt: 0.03, dr: 0.02, speed: -0.34, sc: 0.76, band: 2, rgb: '165,139,255' },
  { k: 1.70, dt: -0.02, dr: -0.015, speed: 0.21, sc: 0.88, band: 3, rgb: '255,156,200' },
  { k: 1.88, dt: 0.05, dr: 0.03, speed: -0.13, sc: 0.68, band: 0, rgb: '110,160,255', sparse: true }
].map((d) => ({ ...d, dir: d.speed < 0 ? -1 : 1, ang: 0, wake: 0 }));

const RIPPLES = [
  { t: TL.scanStart - 0.05, amp: 0.55, life: 1.7 },
  { t: SCAN_END - 0.05, amp: 1.0, life: 2.3 },
  { t: SCAN_END + 0.30, amp: 0.70, life: 2.3 }
];

export function startPlanetAwakenScene({ canvas, slot }) {
  const ctx = canvas.getContext('2d');
  const reduced = prefersReducedMotion();
  const RING_DEFS = makeRingDefs();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let slotW = 0;
  let slotH = 0;
  let R = 100;
  let baseFont = 12;
  let atlas = null;
  let cell = 32;
  let unit = 1;
  let nebula = null;

  let planet = [];
  let rings = [];
  let dust = [];
  let stars = [];
  let streams = [];

  let T = 0;
  let yaw = 0.8;
  let sMapped = -0.08;
  let aw = 0;
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
    const spacing = clamp(R * 0.1, 10, 16);
    const N = Math.min(1700, Math.round((4 * Math.PI * R * R) / (spacing * spacing)));
    const realSp = R * Math.sqrt((4 * Math.PI) / N);
    baseFont = clamp(realSp * 0.86, 8, 19);
    ({ atlas, cell, unit } = createGlyphAtlas({
      baseFont,
      dpr,
      pxScale: 1,
      minPx: 10,
      dormantLightness: [38, 28]
    }));
    nebula = createNebulaImage(W, H);

    // 行星：斐波那契球面分布
    planet = [];
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i += 1) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const ph = i * GA;
      planet.push({
        i, x: Math.cos(ph) * r, y, z: Math.sin(ph) * r,
        rn: rnd(), gi: pickGlyph(rnd),
        thr: ((1 - y) / 2) * 0.9 + rnd() * 0.1, // 南极先醒，北极后醒
        d: rnd(), far: 0.7 + rnd() * 2.3, swirl: (rnd() - 0.5) * 3.2,
        sx: 0, sy: 0, nx: 0, ny: 0, nz: 0, pf: 1, e: 0, vis: false
      });
    }

    // 轨道环
    rings = [];
    let idx = 0;
    RING_DEFS.forEach((def, ri) => {
      let n = Math.round((2 * Math.PI * def.k * R) / (realSp * 1.05));
      if (def.sparse) n = Math.round(n * 0.55);
      for (let j = 0; j < n; j += 1) {
        rings.push({
          idx: idx++, ri, a01: j / n,
          th0: (j / n) * Math.PI * 2 + (rnd() - 0.5) * 0.05,
          yj: (rnd() - 0.5) * 0.035, gi: pickGlyph(rnd), rn: rnd(), d: rnd(),
          sx: 0, sy: 0, z: 0, pf: 1, e: 0, vis: false
        });
      }
    });

    // 远景漂浮字符
    dust = [];
    const nd = clamp(Math.round((W * H) / 9000), 50, 140);
    for (let i = 0; i < nd; i += 1) {
      dust.push({
        x: rnd() * W, y: rnd() * H, vy: -(4 + rnd() * 11),
        sc: 0.42 + rnd() * 0.38, a: 0.07 + rnd() * 0.17,
        ph: rnd() * 6.28, sp: 0.6 + rnd() * 1.6, gi: pickGlyph(rnd),
        wk: rnd(), band: Math.floor(rnd() * 3), par: 0.3 + rnd() * 0.8
      });
    }

    // 星点
    stars = [];
    const ns = clamp(Math.round((W * H) / 2600), 120, 320);
    const sc = ['#cfe2ff', '#ffe6d6', '#d9d0ff'];
    for (let i = 0; i < ns; i += 1) {
      stars.push({
        x: rnd() * W, y: rnd() * H, r: 0.6 + rnd() * rnd() * 1.6, a: 0.25 + rnd() * 0.6,
        ph: rnd() * 6.28, sp: 0.8 + rnd() * 2.4, drift: 1 + rnd() * 3,
        par: 0.2 + rnd() * 0.7, c: sc[(rnd() * 3) | 0]
      });
    }

    // 汇入行星的代码流
    streams = [];
    for (let i = 0; i < 7; i += 1) {
      streams.push({
        a0: rnd() * 6.28, dir: rnd() < 0.5 ? -1 : 1, per: 2.6 + rnd() * 1.4, off: rnd() * 4,
        k0: 2.5 + rnd() * 0.6, fy: 0.5 + rnd() * 0.28, n: 11,
        gi: Math.floor(rnd() * G), band: 1 + (i % 3)
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
    // 最外圈轨道半径是 1.88R，要整个落在占位框宽度内。
    R = clamp(Math.min(slotW * 0.26, slotH * 0.30), 40, 150);
    buildScene();
  }

  /* ----------------------------- 绘制 ----------------------------- */
  function sprite(g, row, sx, sy, size, alpha) {
    if (alpha <= 0.012) return;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.drawImage(atlas, g * cell, row * cell, cell, cell, sx - size / 2, sy - size / 2, size, size);
  }

  function drawNebula() {
    const k = 0.32 + aw * 0.68;
    ctx.globalAlpha = clamp(k * 0.85);
    ctx.drawImage(nebula, 0, 0, W, H);
  }

  function drawStars(ox, oy) {
    const fade = smooth(0, 1.4, T);
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(T * s.sp + s.ph);
      ctx.globalAlpha = clamp(s.a * tw * fade);
      ctx.fillStyle = s.c;
      const x = s.x + ox * s.par * 0.5;
      const y = (((s.y - T * s.drift + oy * s.par * 0.5) % H) + H) % H;
      ctx.fillRect(x, y, s.r, s.r);
    }
  }

  function drawDust(ox) {
    const fade = smooth(0.6, 2.2, T);
    for (const d of dust) {
      const awake = sMapped > d.wk * 0.9;
      const tw = 0.6 + 0.4 * Math.sin(T * d.sp + d.ph);
      const g = (d.gi + Math.floor(T * 1.1 + d.ph * 3)) % G;
      const row = awake ? d.band * 4 + (tw > 0.85 ? 2 : 1) : ROW_DORM_B;
      sprite(g, row, d.x + ox * d.par, d.y, cell * unit * d.sc, d.a * tw * fade * (awake ? 1.5 : 1));
    }
  }

  function drawHalo(px, py) {
    const form = smooth(TL.asmStart, TL.asmStart + 2.4, T);
    const k = 0.25 * form + 0.75 * aw;
    if (k <= 0.002) return;
    ctx.globalAlpha = 1;
    let g = ctx.createRadialGradient(px, py, R * 0.6, px, py, R * 3.4);
    g.addColorStop(0, 'rgba(110,140,255,' + (0.20 * k).toFixed(3) + ')');
    g.addColorStop(0.35, 'rgba(120,90,230,' + (0.10 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - R * 3.4, py - R * 3.4, R * 6.8, R * 6.8);

    g = ctx.createRadialGradient(px, py, R * 0.8, px, py, R * 1.75);
    g.addColorStop(0, 'rgba(130,210,255,0)');
    g.addColorStop(0.17, 'rgba(130,215,255,' + (0.36 * k).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(165,130,255,' + (0.14 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - R * 1.8, py - R * 1.8, R * 3.6, R * 3.6);
  }

  function drawSpark(px, py) {
    const u = clamp((T - TL.flareStart) / (TL.flareEnd - TL.flareStart));
    if (u <= 0 || u >= 1) return;
    const f = Math.sin(Math.PI * u);
    const r = 10 + R * 0.55 * easeOut(u);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(235,252,255,' + (0.95 * f).toFixed(3) + ')');
    g.addColorStop(0.25, 'rgba(130,225,255,' + (0.45 * f).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(90,80,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  function drawFlare(px, py) {
    const u = clamp((T - TL.flareStart) / (TL.flareEnd - TL.flareStart));
    if (u <= 0 || u >= 1) return;
    const f = Math.pow(Math.sin(Math.PI * u), 1.5);
    const L = Math.min(W * 0.5, R * 3.4) * (0.3 + 0.7 * easeOut(u));
    const g = ctx.createLinearGradient(px - L, 0, px + L, 0);
    g.addColorStop(0, 'rgba(120,200,255,0)');
    g.addColorStop(0.5, 'rgba(225,246,255,' + (0.9 * f).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 1;
    ctx.fillRect(px - L, py - 1, L * 2, 2);
    ctx.globalAlpha = 0.28;
    ctx.fillRect(px - L, py - 5, L * 2, 10);
  }

  function drawRingGuides(px, py, front) {
    const fade = smooth(TL.ringAsmStart + 0.6, TL.ringAsmStart + 2.4, T);
    if (fade <= 0) return;
    ctx.lineWidth = 1;
    for (const def of RING_DEFS) {
      const rx = def.k * R;
      const ry = rx * Math.sin(def.tilt);
      const a = (0.06 + 0.12 * def.wake) * fade;
      ctx.strokeStyle = 'rgba(' + def.rgb + ',' + a.toFixed(3) + ')';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      if (front) ctx.ellipse(px, py, rx, ry, def.roll, 0, Math.PI);
      else ctx.ellipse(px, py, rx, ry, def.roll, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }

  function computePlanet(px, py) {
    const cY = Math.cos(yaw);
    const sY = Math.sin(yaw);
    const cA = Math.cos(TILT);
    const sA = Math.sin(TILT);
    const cR = Math.cos(ROLL);
    const sR = Math.sin(ROLL);
    const D = R * 6;
    for (let n = 0; n < planet.length; n += 1) {
      const p = planet[n];
      const e0 = (T - TL.asmStart - p.d * TL.asmSpread) / TL.asmDur;
      if (e0 <= 0) { p.vis = false; continue; }
      const e = easeOut(clamp(e0));
      const inv = 1 - e;
      let c = cY;
      let s = sY;
      if (inv > 0.002) {
        const a = yaw + inv * p.swirl;
        c = Math.cos(a);
        s = Math.sin(a);
      }
      const x1 = p.x * c + p.z * s;
      const z1 = -p.x * s + p.z * c;
      const y1 = p.y;
      const y2 = y1 * cA + z1 * sA;
      const z2 = -y1 * sA + z1 * cA;
      const x3 = x1 * cR - y2 * sR;
      const y3 = x1 * sR + y2 * cR;
      const m = R * (1 + inv * p.far);
      const pf = D / (D - z2 * m);
      p.sx = px + x3 * m * pf;
      p.sy = py + y3 * m * pf;
      p.nx = x3; p.ny = y3; p.nz = z2; p.pf = pf; p.e = e; p.vis = true;
    }
  }

  function drawPlanetPass(front) {
    const L = LIGHT;
    for (let n = 0; n < planet.length; n += 1) {
      const p = planet[n];
      if (!p.vis || (p.nz >= 0) !== front) continue;
      const lam = p.nx * L[0] + p.ny * L[1] + p.nz * L[2];
      const L1 = clamp(lam * 0.5 + 0.5);
      const L2 = L1 * L1;
      const d = sMapped - p.thr;
      const facing = clamp(front ? p.nz : 0);
      let row;
      let alpha;
      let g = p.gi;
      let sf;
      if (d < 0) {
        row = front ? ROW_DORM_F : ROW_DORM_B;
        alpha = front ? 0.15 + 0.30 * L2 : 0.05 + 0.07 * L2;
        alpha *= 0.85 + 0.15 * Math.sin(T * 1.7 + p.rn * 40);
        sf = (0.62 + 0.38 * facing) * p.pf * 0.9;
      } else {
        const flash = clamp(1 - d / 0.22);
        let spark = 0;
        if (d < 0.13) {
          g = (p.gi + Math.floor(T * 18 + p.rn * 13) * 17) % G;
        } else {
          const kk = Math.floor(T * 2.2 + p.rn * 60);
          const h = (((kk * 73856093) ^ (p.i * 19349663)) >>> 0) % 173;
          if (h === 0) {
            spark = 0.9 * (1 - (T * 2.2 + p.rn * 60 - kk));
            g = (p.gi + kk * 5) % G;
          }
        }
        const rim = front ? Math.pow(1 - facing, 2.6) : 0;
        let b = clamp(0.20 + 0.80 * L2 + 0.45 * rim + 0.75 * flash + spark);
        if (!front) b *= 0.7;
        if (flash > 0.55 || spark > 0.5) {
          row = ROW_WHITE;
        } else {
          const u = 0.5 + 0.5 * Math.sin(p.y * 2.2 + p.x * 1.3 + T * 0.35);
          const q = clamp(0.52 * L2 + 0.33 * u + 0.15 * rim, 0, 0.999);
          const tier = b > 0.78 ? 3 : b > 0.55 ? 2 : b > 0.33 ? 1 : 0;
          row = ((q * 6) | 0) * 4 + tier;
        }
        alpha = front ? 0.30 + 0.70 * b : 0.07 + 0.22 * b;
        sf = (0.62 + 0.38 * facing) * p.pf * (0.92 + 0.5 * flash);
        if (!front) sf = 0.7 * p.pf;
      }
      sprite(g, row, p.sx, p.sy, cell * unit * sf, alpha * p.e);
    }
  }

  function drawDisc(px, py) {
    const a = smooth(TL.asmStart + 0.5, TL.asmStart + 2.4, T);
    if (a <= 0) return;
    const rr = R * 0.99;
    const g = ctx.createRadialGradient(px - R * 0.38, py - R * 0.4, R * 0.05, px, py, rr);
    g.addColorStop(0, 'rgba(22,32,78,0.92)');
    g.addColorStop(0.55, 'rgba(9,13,38,0.94)');
    g.addColorStop(1, 'rgba(3,5,16,0.96)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRim(px, py) {
    const form = smooth(TL.asmStart + 0.8, TL.asmStart + 2.6, T);
    const k = 0.3 * form + 0.7 * aw;
    if (k < 0.01) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, R * 0.99, 0, Math.PI * 2);
    ctx.clip();
    let g = ctx.createRadialGradient(px - R * 0.5, py - R * 0.45, 0, px - R * 0.5, py - R * 0.45, R * 1.3);
    g.addColorStop(0, 'rgba(255,160,200,' + (0.22 * aw).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(170,120,255,' + (0.08 * aw).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(px - R, py - R, R * 2, R * 2);
    ctx.restore();

    g = ctx.createRadialGradient(px, py, R * 0.78, px, py, R * 1.08);
    g.addColorStop(0, 'rgba(120,230,255,0)');
    g.addColorStop(0.68, 'rgba(140,225,255,' + (0.42 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(px - R * 1.1, py - R * 1.1, R * 2.2, R * 2.2);
    ctx.strokeStyle = 'rgba(190,235,255,' + (0.28 * k).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawScan(px, py) {
    const sRaw = clamp((T - TL.scanStart) / TL.scanDur);
    if (sRaw <= 0 || sRaw >= 1) return;
    const yy = clamp(1 - 2 * sMapped, -1, 1);
    const rr = R * Math.sqrt(Math.max(0, 1 - yy * yy));
    if (rr < 1) return;
    const env = smooth(0, 0.05, sRaw) * (1 - smooth(0.95, 1, sRaw));
    const cA = Math.cos(TILT);
    const sA = Math.sin(TILT);
    const cR = Math.cos(ROLL);
    const sR = Math.sin(ROLL);
    const y2 = yy * cA;
    const ex = px + -y2 * sR * R;
    const ey = py + y2 * cR * R;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(ex, ey, rr, rr * sA, ROLL, 0, Math.PI);
    ctx.strokeStyle = 'rgba(120,220,255,' + (0.16 * env).toFixed(3) + ')';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,246,255,' + (0.92 * env).toFixed(3) + ')';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function drawRipples(px, py, front) {
    const sT = Math.sin(TILT);
    ctx.globalAlpha = 1;
    for (const r of RIPPLES) {
      const u = (T - r.t) / r.life;
      if (u <= 0 || u >= 1) continue;
      const a = Math.pow(1 - u, 1.7) * r.amp;
      const rx = R * (1.04 + 2.5 * easeOut(u));
      const ry = rx * sT;
      ctx.beginPath();
      if (front) ctx.ellipse(px, py, rx, ry, ROLL, 0, Math.PI);
      else ctx.ellipse(px, py, rx, ry, ROLL, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(130,225,255,' + (0.22 * a).toFixed(3) + ')';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(225,248,255,' + (0.70 * a).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (front) {
      const u = (T - (SCAN_END - 0.1)) / 1.3;
      if (u > 0 && u < 1) {
        const a = Math.pow(1 - u, 2) * 0.32;
        const g = ctx.createRadialGradient(px, py, 0, px, py, R * 2.3);
        g.addColorStop(0, 'rgba(210,244,255,' + a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(120,160,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - R * 2.3, py - R * 2.3, R * 4.6, R * 4.6);
      }
    }
  }

  function computeRings(px, py) {
    const D = R * 6;
    RING_DEFS.forEach((def, i) => {
      def.tilt = TILT + def.dt;
      def.roll = ROLL + def.dr;
      def.cA = Math.cos(def.tilt);
      def.sA = Math.sin(def.tilt);
      def.cR = Math.cos(def.roll);
      def.sR = Math.sin(def.roll);
      def.wake = clamp((T - (TL.ringWakeStart + i * TL.ringWakeStep)) / TL.ringWakeDur);
    });
    for (const q of rings) {
      const def = RING_DEFS[q.ri];
      const e0 = (T - TL.ringAsmStart - q.d * TL.ringAsmSpread - q.ri * 0.12) / TL.ringAsmDur;
      if (e0 <= 0) { q.vis = false; continue; }
      const e = easeOut(clamp(e0));
      const inv = 1 - e;
      const th = q.th0 + def.ang + inv * def.dir * 2.6;
      const rr = def.k * R * (1 + inv * 1.5);
      const lx = Math.cos(th) * rr;
      const lz = Math.sin(th) * rr;
      const ly = q.yj * R;
      const y2 = ly * def.cA + lz * def.sA;
      const z2 = -ly * def.sA + lz * def.cA;
      const x3 = lx * def.cR - y2 * def.sR;
      const y3 = lx * def.sR + y2 * def.cR;
      const pf = D / (D - z2);
      q.sx = px + x3 * pf;
      q.sy = py + y3 * pf;
      q.z = z2 / (def.k * R);
      q.pf = pf; q.e = e; q.vis = true;
    }
  }

  function drawRingPass(front) {
    for (const q of rings) {
      if (!q.vis || (q.z >= 0) !== front) continue;
      const def = RING_DEFS[q.ri];
      const dd = def.wake * 1.18 - q.a01;
      const depth = q.z * 0.5 + 0.5;
      let row;
      let alpha;
      let g = q.gi;
      let flash = 0;
      if (dd < 0) {
        row = front ? ROW_DORM_F : ROW_DORM_B;
        alpha = front ? 0.22 : 0.08;
      } else {
        flash = clamp(1 - dd / 0.28);
        let spark = 0;
        if (dd < 0.12) {
          g = (q.gi + Math.floor(T * 18 + q.rn * 13) * 17) % G;
        } else {
          const kk = Math.floor(T * 1.8 + q.rn * 60);
          const h = (((kk * 83492791) ^ (q.idx * 2654435)) >>> 0) % 131;
          if (h === 0) {
            spark = 0.9 * (1 - (T * 1.8 + q.rn * 60 - kk));
            g = (q.gi + kk * 3) % G;
          }
        }
        const b = clamp(0.26 + 0.36 * depth + 0.7 * flash + spark);
        if (flash > 0.6 || spark > 0.5) {
          row = ROW_WHITE;
        } else {
          const band = spark > 0.2 ? 5 : def.band;
          row = band * 4 + (b > 0.8 ? 3 : b > 0.58 ? 2 : b > 0.36 ? 1 : 0);
        }
        alpha = front ? 0.35 + 0.65 * b : 0.10 + 0.25 * b;
      }
      const size = cell * unit * def.sc * (0.82 + 0.3 * depth) * q.pf * (1 + 0.55 * flash);
      sprite(g, row, q.sx, q.sy, size, alpha * q.e);
    }
  }

  function drawStreams(px, py) {
    const env =
      smooth(TL.streamsStart, TL.streamsStart + 1, T) *
      (1 - 0.7 * smooth(TL.streamsEnd, TL.streamsEnd + 1, T));
    if (env < 0.01) return;
    const cR = Math.cos(ROLL);
    const sR = Math.sin(ROLL);
    for (const s of streams) {
      const span = 1 + s.n * 0.03;
      const head = (((T + s.off) / s.per) % 1) * span;
      for (let j = 0; j < s.n; j += 1) {
        const u = head - j * 0.03;
        if (u <= 0 || u >= 1) continue;
        const ang = s.a0 + u * 1.9 * s.dir;
        const rad = R * (s.k0 + (1.06 - s.k0) * Math.pow(u, 1.6));
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad * s.fy;
        const xr = x * cR - y * sR;
        const yr = x * sR + y * cR;
        const a = env * Math.pow(Math.sin(Math.PI * u), 0.9) * (1 - j / s.n) * 0.85;
        if (a < 0.02) continue;
        const g = (s.gi + j * 5 + Math.floor(T * 10 + j * 3)) % G;
        const row = j === 0 ? ROW_WHITE : s.band * 4 + (j < 3 ? 3 : j < 6 ? 2 : 1);
        sprite(g, row, px + xr, py + yr, cell * unit * (0.62 + 0.35 * (1 - u)) * (j === 0 ? 1.25 : 1), a);
      }
    }
  }

  function render() {
    const ox = ptrX * 9;
    const oy = ptrY * 6;
    const px = cx + ox;
    const py = cy + oy;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    drawNebula();
    drawStars(ox, oy);
    drawDust(ox);
    drawHalo(px, py);
    drawSpark(px, py);
    computePlanet(px, py);
    computeRings(px, py);
    drawRingGuides(px, py, false);
    drawRipples(px, py, false);
    drawStreams(px, py);
    drawPlanetPass(false);
    drawRingPass(false);

    ctx.globalCompositeOperation = 'source-over';
    drawDisc(px, py);
    ctx.globalCompositeOperation = 'lighter';

    drawPlanetPass(true);
    drawRim(px, py);
    drawScan(px, py);
    drawRingGuides(px, py, true);
    drawRingPass(true);
    drawFlare(px, py);
    drawRipples(px, py, true);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function update(dt) {
    const sRaw = clamp((T - TL.scanStart) / TL.scanDur);
    sMapped = lerp(-0.08, 1.08, easeIO(sRaw));
    aw = clamp(sMapped);

    yaw += dt * (0.12 + 0.20 * aw);
    RING_DEFS.forEach((d) => { d.ang += dt * d.speed * (0.5 + 0.9 * aw); });
    ptrX += (ptrTX - ptrX) * Math.min(1, dt * 3);
    ptrY += (ptrTY - ptrY) * Math.min(1, dt * 3);
    for (const d of dust) {
      d.y += d.vy * dt;
      if (d.y < -20) { d.y = H + 20; d.x = Math.random() * W; }
    }
  }

  function frame(now) {
    if (stopped) return;
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
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
    // 减少动态效果：直接画出最终静止画面，不跑动画循环。
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
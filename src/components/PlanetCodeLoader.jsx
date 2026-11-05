// src/components/PlanetCodeLoader.jsx
//
// 常驻加载页选项（Planet Code）：满天星，代码字符从四周飞入，在卡片中央
// 汇聚成一颗由字符组成的星球，两圈轨道画出来再锁定，伴一次扩散的 ping。
// 固定的深空配色，外层深色背景由 Preloader.jsx 的 LOADER_MAP 提供。
//
// 原稿自带的刊头、PLANET CODE 大标题、副标题、左右两条滚动代码、坐标读数、
// 百分比进度条和"重新播放"按钮全部去掉了，统一用 Preloader 共用的标题 /
// 引言 / 状态文字，避免重复——跟 WinterMirrorLoader / WinterWindowLoader /
// FirstSnowLoader 是同一个处理方式。原稿里"字符从代码行飞向球面"的起点
// 改成了从卡片四边随机飞入（不再依赖被去掉的代码面板的 DOM 位置）。
// 跟常驻其它加载页不同，这一款单独延长了淡出时间（fadeMs / finishMs），
// 跟十一月限定的几款一样约 8 秒，才能看完整段动画。

import React, { useEffect, useRef } from 'react';
import './planet-code-loader.css';

const TAU = Math.PI * 2;
const GLYPHS = '01<>/{}[]=+*#$%&;:ABCDEFabcdef';
const SPHERE_POINT_COUNT = 420;
const BG_STAR_COUNT = 90;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOut = (k) => 1 - (1 - k) ** 3;

export const PlanetCodeLoader = () => {
  const starCanvasRef = useRef(null);
  const sceneCanvasRef = useRef(null);
  const bootRef = useRef(null);

  // 远景星空：铺满整个视口，跟卡片内的星球场景是两个独立的 canvas。
  useEffect(() => {
    const canvas = starCanvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let stars = [];
    let frameId = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: BG_STAR_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        s: Math.random() < 0.92 ? 0.7 : 1.4,
        a: 0.15 + Math.random() * 0.6,
        phase: Math.random() * TAU,
        speed: 0.0008 + Math.random() * 0.002,
      }));
    };

    const draw = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, width, height);
      const fadeIn = clamp(t / 1600);
      ctx.fillStyle = '#E6EBFF';
      for (const star of stars) {
        ctx.globalAlpha = fadeIn * star.a * (0.55 + 0.45 * Math.sin(t * star.speed + star.phase));
        ctx.fillRect(star.x, star.y, star.s, star.s);
      }
      ctx.globalAlpha = 1;
      if (!prefersReduced) frameId = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 星球场景：卡片里的那颗字符球 + 两圈轨道 + 一次 ping，所有坐标都按卡片
  // 自己的宽高算，不依赖整个窗口。
  useEffect(() => {
    const canvas = sceneCanvasRef.current;
    const bootEl = bootRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let radius = 0;
    let frameId = 0;

    const points = [];
    for (let i = 0; i < SPHERE_POINT_COUNT; i += 1) {
      const y = 1 - (2 * (i + 0.5)) / SPHERE_POINT_COUNT;
      const r = Math.sqrt(1 - y * y);
      const theta = i * 2.399963;
      points.push({
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        ch: GLYPHS[i % GLYPHS.length],
        t0: Infinity,
        dur: 1,
        sx: 0,
        sy: 0,
        curve: 0,
      });
    }

    const rings = [
      { rx: 1.75, ry: 0.4, rot: -0.32, w: 1, col: '127,227,255', a: 0.6, start: 1900, dur: 1300, a0: -0.6 },
      { rx: 2.25, ry: 0.62, rot: 0.28, w: 0.8, col: '138,124,255', a: 0.45, start: 2150, dur: 1500, a0: 2.2, dash: true },
    ];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height / 2;
      radius = Math.min(width, height) * 0.3;
    };

    // 字符原本从飞入起点开始，没有代码面板之后改成从卡片四边随机飞入。
    const prepareLaunch = () => {
      for (const point of points) {
        const edge = Math.floor(Math.random() * 4);
        let startX;
        let startY;
        if (edge === 0) { startX = Math.random() * width; startY = -20; }
        else if (edge === 1) { startX = width + 20; startY = Math.random() * height; }
        else if (edge === 2) { startX = Math.random() * width; startY = height + 20; }
        else { startX = -20; startY = Math.random() * height; }

        point.sx = startX;
        point.sy = startY;
        point.t0 = 400 + Math.random() * 1200;
        point.dur = 1150 + Math.random() * 650;
        point.curve = (Math.random() - 0.5) * 0.7;
      }
    };

    const project = (point, rotation) => {
      const cr = Math.cos(rotation);
      const sr = Math.sin(rotation);
      const x1 = point.x * cr + point.z * sr;
      const z1 = -point.x * sr + point.z * cr;
      const tilt = 0.38;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const y2 = point.y * ct - z1 * st;
      const z2 = point.y * st + z1 * ct;
      return [cx + x1 * radius, cy + y2 * radius, z2];
    };

    const ringPoint = (ring, angle) => {
      const c = Math.cos(ring.rot);
      const s = Math.sin(ring.rot);
      const x = ring.rx * radius * Math.cos(angle);
      const y = ring.ry * radius * Math.sin(angle);
      return [cx + x * c - y * s, cy + x * s + y * c];
    };

    const drawRings = (t, pass) => {
      rings.forEach((ring, idx) => {
        const dp = easeInOut(clamp((t - ring.start) / ring.dur));
        if (dp <= 0) return;
        const steps = 120;
        const sweep = TAU * dp;
        ctx.lineWidth = ring.w;
        ctx.strokeStyle = `rgba(${ring.col},${pass === 'back' ? ring.a * 0.4 : ring.a})`;
        ctx.setLineDash(ring.dash ? [2, 6] : []);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= steps; i += 1) {
          const angle = ring.a0 + (sweep * i) / steps;
          const back = Math.sin(angle) < 0;
          if (back !== (pass === 'back')) { started = false; continue; }
          const [x, y] = ringPoint(ring, angle);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        let angle;
        let glow;
        if (dp < 1) { angle = ring.a0 + sweep; glow = 1; }
        else { angle = ring.a0 + (t - ring.start - ring.dur) * (idx ? -0.00045 : 0.0008); glow = 0.9; }
        if ((Math.sin(angle) < 0) === (pass === 'back')) {
          const [x, y] = ringPoint(ring, angle);
          ctx.save();
          ctx.globalAlpha = pass === 'back' ? 0.35 : glow;
          ctx.fillStyle = idx ? '#C9C2FF' : '#DFF8FF';
          ctx.shadowColor = idx ? '#8A7CFF' : '#7FE3FF';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(x, y, idx ? 1.8 : 2.4, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      });
    };

    const drawPlanetBody = (t) => {
      const pf = easeOut(clamp((t - 900) / 1800));
      if (pf <= 0) return 0;
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 2);
      gradient.addColorStop(0, `rgba(127,227,255,${0.2 * pf})`);
      gradient.addColorStop(0.35, `rgba(138,124,255,${0.09 * pf})`);
      gradient.addColorStop(1, 'rgba(138,124,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2, 0, TAU);
      ctx.fill();
      return pf;
    };

    const drawCore = (pf) => {
      if (!pf) return;
      const gradient = ctx.createRadialGradient(
        cx - radius * 0.38, cy - radius * 0.4, radius * 0.08, cx, cy, radius,
      );
      gradient.addColorStop(0, `rgba(44,66,140,${0.9 * pf})`);
      gradient.addColorStop(0.6, `rgba(14,20,54,${0.92 * pf})`);
      gradient.addColorStop(1, `rgba(5,8,22,${0.95 * pf})`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.985, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(127,227,255,${0.55 * pf})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI * 1.02, Math.PI * 1.62);
      ctx.stroke();
      ctx.strokeStyle = `rgba(243,217,164,${0.3 * pf})`;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI * 0.1, Math.PI * 0.42);
      ctx.stroke();
    };

    const drawGlyphs = (t) => {
      const rotation = t * 0.00022;
      const back = [];
      const front = [];
      const flying = [];

      for (const point of points) {
        if (t < point.t0) continue;
        const [px, py, pz] = project(point, rotation);
        const k = clamp((t - point.t0) / point.dur);
        if (k < 1) {
          const e = easeInOut(k);
          const mx = (point.sx + px) / 2 - (py - point.sy) * point.curve;
          const my = (point.sy + py) / 2 + (px - point.sx) * point.curve;
          const at = (u) => [
            (1 - u) * (1 - u) * point.sx + 2 * (1 - u) * u * mx + u * u * px,
            (1 - u) * (1 - u) * point.sy + 2 * (1 - u) * u * my + u * u * py,
          ];
          flying.push([at(e), at(Math.max(0, e - 0.07)), point.ch, k]);
        } else {
          if (Math.random() < 0.002) point.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          (pz > 0 ? front : back).push([px, py, pz, point.ch]);
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = `400 ${Math.max(7, radius * 0.1)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#8A7CFF';
      for (const g of back) { ctx.globalAlpha = 0.1 + 0.25 * (g[2] + 1); ctx.fillText(g[3], g[0], g[1]); }

      ctx.font = `500 ${Math.max(8, radius * 0.13)}px "JetBrains Mono", monospace`;
      for (const g of front) {
        const lit = clamp(0.35 + 0.65 * g[2]);
        ctx.globalAlpha = lit * 0.85;
        ctx.fillStyle = '#7FE3FF';
        ctx.fillText(g[3], g[0], g[1]);
      }

      ctx.lineWidth = 1;
      for (const f of flying) {
        const [[x, y], [x0, y0], ch, k] = f;
        ctx.globalAlpha = 0.45 * Math.sin(k * Math.PI) + 0.1;
        ctx.strokeStyle = '#7FE3FF';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#DFF8FF';
        ctx.fillText(ch, x, y);
      }
      ctx.restore();
    };

    const drawPing = (t) => {
      const k = clamp((t - 3800) / 1300);
      if (k <= 0 || k >= 1) return;
      ctx.strokeStyle = `rgba(243,217,164,${(1 - k) * 0.55})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (1.1 + easeOut(k) * 1.5), 0, TAU);
      ctx.stroke();
    };

    resize();
    window.addEventListener('resize', resize);
    prepareLaunch();

    if (bootEl && !prefersReduced) {
      bootEl.classList.add('planet-code__boot--on');
    }

    const start = performance.now();
    const frame = (now) => {
      const t = prefersReduced ? 9000 : now - start;
      ctx.clearRect(0, 0, width, height);
      const pf = drawPlanetBody(t);
      drawRings(t, 'back');
      drawCore(pf);
      drawGlyphs(t);
      drawRings(t, 'front');
      drawPing(t);
      if (!prefersReduced) frameId = window.requestAnimationFrame(frame);
    };

    if (prefersReduced) {
      frame(0);
    } else {
      frameId = window.requestAnimationFrame(frame);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section
      className="planet-code"
      role="img"
      aria-label="字符从四周飞入，在卡片中央汇聚成一颗由代码组成的星球，轨道锁定"
    >
      <canvas ref={starCanvasRef} className="planet-code__stars" aria-hidden="true" />

      <div className="planet-code__stage" aria-hidden="true">
        <div className="planet-code__frame">
          <div ref={bootRef} className="planet-code__boot" />
          <canvas ref={sceneCanvasRef} className="planet-code__scene" />
        </div>
      </div>
    </section>
  );
};

export default PlanetCodeLoader;
// src/components/FirstSnowLoader.jsx
//
// 十一月限定加载页（初雪/First Snow）：雪山、松林、一条脚印通向亮灯的小木屋，
// 月晕挂在天边，两层雪花（近/远）飘满全屏。固定的深冬夜配色，外层深色背景由
// Preloader.jsx 的 LOADER_MAP 提供。
//
// 原稿自带的标题（FIRST SNOW / with U.）、刊头、日期行、签名和底部"轻点重播"
// 提示都去掉了，统一用 Preloader 共用的标题 / 引言 / 状态文字，避免重复——
// 跟 WinterMirrorLoader / WinterWindowLoader 是同一个处理方式。
// 整段动画约 8 秒，Preloader 对这一款单独延长了淡出时间（fadeMs / finishMs）。

import React, { useEffect, useMemo, useRef } from 'react';
import './first-snow-loader.css';

const BACK_FLAKE_COUNT = 70;
const FRONT_FLAKE_COUNT = 22;

// 8 棵松树的位置和大小（原稿里的固定数组，不是随机生成）。
const PINE_SPOTS = [
  [18, 190, 1],
  [36, 186, 0.8],
  [96, 180, 1.1],
  [118, 184, 0.75],
  [205, 190, 0.9],
  [226, 186, 1.15],
  [350, 174, 1],
  [372, 178, 0.8],
];

function buildPineLayer() {
  return PINE_SPOTS.map(([x, y, s], index) => {
    const h = 34 * s;
    const w = 11 * s;
    const trunk = `M${x} ${y - h} L${x - w * 0.6} ${y - h * 0.55} L${x - w * 0.3} ${
      y - h * 0.55
    } L${x - w} ${y} L${x + w} ${y} L${x + w * 0.3} ${y - h * 0.55} L${
      x + w * 0.6
    } ${y - h * 0.55} Z`;
    const cap = `M${x} ${y - h} L${x - w * 0.4} ${y - h * 0.7} L${x} ${
      y - h * 0.76
    } L${x + w * 0.4} ${y - h * 0.7} Z`;

    return { key: `pine-${index}`, trunk, cap };
  });
}

// 通往小屋的一串脚印：沿一条二次贝塞尔曲线，从近到远越踩越小。纯参数计算，
// 不含随机数，跟 WinterWindowLoader 的星星生成（随机）不是一回事。
function buildFootprints() {
  const P0 = { x: 70, y: 368 };
  const P1 = { x: 150, y: 270 };
  const P2 = { x: 294, y: 236 };
  const N = 18;
  const prints = [];

  for (let i = 0; i < N; i += 1) {
    const t = 0.04 + (i / (N - 1)) * 0.9;
    const x = (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x;
    const y = (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * P1.y + t * t * P2.y;
    const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
    const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const scale = 1.25 - t * 0.85;
    const side = i % 2 ? 1 : -1;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const cx = x + nx * 4.5 * scale * side;
    const cy = y + ny * 4.5 * scale * side;

    prints.push({
      key: `print-${i}`,
      cx: cx.toFixed(1),
      cy: cy.toFixed(1),
      rx: (2.3 * scale).toFixed(2),
      ry: (3.8 * scale).toFixed(2),
      angle: angle.toFixed(1),
      delay: `${(2.6 + i * 0.2).toFixed(2)}s`,
    });
  }

  return prints;
}

// 一层飘雪：半径范围、下落速度、不透明度各自不同，用来做前后两层的景深。
function createSnowLayer(canvas, count, rMin, rMax, speed, alpha) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let flakes = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const makeFlake = (initial) => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : -10,
    r: rMin + Math.random() * (rMax - rMin),
    v: speed * (0.6 + Math.random() * 0.8),
    phase: Math.random() * Math.PI * 2,
    sway: 0.3 + Math.random() * 0.7,
  });

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();
  flakes = Array.from({ length: count }, () => makeFlake(true));
  window.addEventListener('resize', resize);

  let fade = 0;

  return {
    tick(time) {
      fade = Math.min(1, fade + 0.006);
      ctx.clearRect(0, 0, width, height);
      const wind = Math.sin(time / 4000) * 0.25;

      for (const flake of flakes) {
        flake.y += flake.v;
        flake.x += Math.sin(time / 1400 + flake.phase) * flake.sway * 0.35 + wind;
        if (flake.y > height + 10) Object.assign(flake, makeFlake(false));
        if (flake.x > width + 10) flake.x = -10;
        if (flake.x < -10) flake.x = width + 10;

        const gradient = ctx.createRadialGradient(
          flake.x, flake.y, 0, flake.x, flake.y, flake.r * 2,
        );
        gradient.addColorStop(0, `rgba(246,248,255,${alpha * fade})`);
        gradient.addColorStop(1, 'rgba(246,248,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    destroy() {
      window.removeEventListener('resize', resize);
    },
  };
}

export const FirstSnowLoader = () => {
  const snowBackRef = useRef(null);
  const snowFrontRef = useRef(null);

  const pines = useMemo(buildPineLayer, []);
  const footprints = useMemo(buildFootprints, []);

  useEffect(() => {
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) return undefined;

    const backCanvas = snowBackRef.current;
    const frontCanvas = snowFrontRef.current;
    if (!backCanvas || !frontCanvas) return undefined;

    const back = createSnowLayer(backCanvas, 70, 0.6, 1.4, 0.35, 0.7);
    const front = createSnowLayer(frontCanvas, FRONT_FLAKE_COUNT, 1.6, 3.2, 0.9, 0.85);

    let frameId = 0;
    const loop = (time) => {
      back.tick(time);
      front.tick(time);
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frameId);
      back.destroy();
      front.destroy();
    };
  }, []);

  return (
    <section
      className="first-snow"
      role="img"
      aria-label="雪山间一串脚印，通向一间亮灯的小木屋"
    >
      <div className="first-snow__backdrop" aria-hidden="true" />
      <div className="first-snow__moon" aria-hidden="true" />

      <canvas ref={snowBackRef} className="first-snow__snow first-snow__snow--back" aria-hidden="true" />

      <div className="first-snow__stage" aria-hidden="true">
        <div className="first-snow__frame">
          <svg
            className="first-snow__scene"
            viewBox="0 0 390 360"
            preserveAspectRatio="xMidYMax slice"
          >
            <defs>
              <linearGradient id="fsFar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8a98c2" />
                <stop offset="1" stopColor="#5a6893" />
              </linearGradient>
              <linearGradient id="fsMid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4d5b86" />
                <stop offset="1" stopColor="#3a4770" />
              </linearGradient>
              <linearGradient id="fsGround" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#dfe5f3" />
                <stop offset=".55" stopColor="#b8c3df" />
                <stop offset="1" stopColor="#8f9cc4" />
              </linearGradient>
              <radialGradient id="fsGlow">
                <stop offset="0" stopColor="#f6cf8e" stopOpacity=".75" />
                <stop offset=".4" stopColor="#f2c27c" stopOpacity=".22" />
                <stop offset="1" stopColor="#f2c27c" stopOpacity="0" />
              </radialGradient>
              <filter id="fsSoft">
                <feGaussianBlur stdDeviation="2.4" />
              </filter>
            </defs>

            {/* 远山 */}
            <g className="first-snow__far">
              <path
                d="M0 150 L48 104 L82 128 L134 70 L176 112 L214 90 L262 132 L312 84 L356 118 L390 100 L390 230 L0 230Z"
                fill="url(#fsFar)"
                opacity=".75"
              />
              <path
                d="M134 70 L120 86 L130 84 L138 92 L146 82 L152 88Z M312 84 L298 100 L308 98 L316 104 L324 96Z"
                fill="#e8edf8"
                opacity=".8"
              />
            </g>

            {/* 近山与松林 */}
            <g className="first-snow__mid">
              <path
                d="M0 196 C60 168 110 176 160 186 C220 198 270 160 330 168 C360 172 380 180 390 184 L390 260 L0 260Z"
                fill="url(#fsMid)"
              />
              <g fill="#2f3b61">
                {pines.map((pine) => (
                  <path key={pine.key} d={pine.trunk} />
                ))}
              </g>
            </g>

            {/* 雪地 */}
            <path
              d="M0 236 C80 214 170 210 240 222 C300 232 350 226 390 218 L390 360 L0 360Z"
              fill="url(#fsGround)"
            />
            <path
              d="M0 236 C80 214 170 210 240 222 C300 232 350 226 390 218"
              fill="none"
              stroke="#f5f7fc"
              strokeWidth="1.2"
              opacity=".7"
            />

            {/* 小屋 */}
            <g transform="translate(262 186)">
              <circle className="first-snow__glow" cx="22" cy="26" r="62" fill="url(#fsGlow)" />
              <rect x="0" y="16" width="46" height="32" fill="#2a3459" />
              <path d="M-6 18 L23 -4 L52 18 Z" fill="#2a3459" />
              <path d="M-8 19 L23 -6 L54 19 L50 21 L23 0 L-4 21Z" fill="#eef2fa" />
              <rect x="31" y="-2" width="7" height="12" fill="#2a3459" />
              <rect x="30" y="-4" width="9" height="3" fill="#eef2fa" />
              <rect x="6" y="24" width="12" height="10" fill="#1d2647" />
              <rect className="first-snow__window" x="6" y="24" width="12" height="10" fill="#f4c983" />
              <path d="M12 24 V34 M6 29 H18" stroke="#2a3459" strokeWidth="1" />
              <rect x="27" y="28" width="10" height="20" fill="#1d2647" />
              <rect className="first-snow__window" x="27" y="28" width="10" height="20" fill="#e9b56c" opacity=".9" />
              <g className="first-snow__smoke" filter="url(#fsSoft)">
                <circle cx="34" cy="-8" r="3" fill="#dfe5f3" style={{ '--d': '5.2s' }} />
                <circle cx="34" cy="-8" r="3" fill="#dfe5f3" style={{ '--d': '6.9s' }} />
                <circle cx="34" cy="-8" r="3" fill="#dfe5f3" style={{ '--d': '8.6s' }} />
              </g>
            </g>

            {/* 一路脚印 */}
            <g fill="#6f7ea8">
              {footprints.map((print) => (
                <ellipse
                  key={print.key}
                  className="first-snow__print"
                  cx={print.cx}
                  cy={print.cy}
                  rx={print.rx}
                  ry={print.ry}
                  transform={`rotate(${print.angle} ${print.cx} ${print.cy})`}
                  style={{ '--d': print.delay }}
                />
              ))}
            </g>
          </svg>
        </div>
      </div>

      <canvas ref={snowFrontRef} className="first-snow__snow first-snow__snow--front" aria-hidden="true" />
    </section>
  );
};

export default FirstSnowLoader;
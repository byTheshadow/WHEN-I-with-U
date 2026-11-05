// src/components/WinterWindowLoader.jsx
//
// 十一月限定加载页（拱形窗里的亮灯小屋）。冬夜里一扇拱形窗，窗里层层升起远山、
// 雪坡和小木屋，灯先闪一下再亮起来；窗角长出窗花，下面一圈进度环走满，
// 整个屏幕飘着雪。固定的深蓝冬夜配色，外层背景由 Preloader.jsx 的 LOADER_MAP 提供。
//
// 原稿自带的标题（WHEN I / with U.）、小标题和"轻点重播"提示都去掉了，
// 统一用 Preloader 共用的标题 / 引言 / 状态文字，避免重复。
// 整段动画约 8 秒，Preloader 对这一款单独延长了淡出时间（fadeMs / finishMs）。

import React, { useEffect, useMemo, useRef } from 'react';
import './winter-window-loader.css';

const BG_STAR_COUNT = 46;
const SCENE_STAR_COUNT = 26;
const MAX_FLAKES = 140;

// 窗花：左边一组，右边镜像一组。每条 [延迟秒数, 路径]。
const FROST_LEFT = [
  ['1.2s', 'M3 398 C16 366 32 342 62 318'],
  ['1.8s', 'M16 372 L2 366'],
  ['1.9s', 'M26 354 L10 352'],
  ['2.0s', 'M26 354 L20 338'],
  ['2.1s', 'M44 334 L28 336'],
  ['2.2s', 'M44 334 L42 318'],
  ['2.3s', 'M3 398 C28 392 52 386 78 372'],
  ['2.5s', 'M40 390 L38 376'],
  ['2.6s', 'M58 382 L58 368'],
];

const FROST_RIGHT = [
  ['1.5s', 'M3 398 C16 366 32 342 62 318'],
  ['2.1s', 'M16 372 L2 366'],
  ['2.2s', 'M26 354 L10 352'],
  ['2.3s', 'M26 354 L20 338'],
  ['2.4s', 'M44 334 L28 336'],
  ['2.5s', 'M3 398 C28 392 52 386 78 372'],
  ['2.8s', 'M40 390 L38 376'],
];

const SMOKE_DELAYS = ['3.2s', '4.6s', '6.0s'];

const PineSymbolPaths = () => (
  <>
    <path
      d="M20 0 L33 28 H27 L38 52 H29 L40 76 H0 L11 52 H2 L13 28 H7 Z"
      fill="currentColor"
    />
    <path
      d="M20 0 L26 13 Q20 16 14 13 Z M20 28 L24 36 Q20 38 16 36 Z"
      fill="#e8f0ff"
      opacity=".75"
    />
    <rect x="17" y="76" width="6" height="4" fill="currentColor" />
  </>
);

export const WinterWindowLoader = () => {
  const snowRef = useRef(null);

  // 星星位置只随机一次，重渲染不会跳。
  const bgStars = useMemo(
    () =>
      Array.from({ length: BG_STAR_COUNT }, () => {
        const size = Math.random() * 2 + 0.8;
        return {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 55}%`,
          width: `${size}px`,
          height: `${size}px`,
          '--o': (Math.random() * 0.6 + 0.3).toFixed(2),
          '--t': `${(Math.random() * 3 + 2.5).toFixed(1)}s`,
          '--d': `${(Math.random() * 3).toFixed(1)}s`,
        };
      }),
    []
  );

  const sceneStars = useMemo(
    () =>
      Array.from({ length: SCENE_STAR_COUNT }, () => ({
        cx: (Math.random() * 300).toFixed(1),
        cy: (Math.random() * 170).toFixed(1),
        r: (Math.random() * 0.9 + 0.4).toFixed(2),
        opacity: (Math.random() * 0.6 + 0.3).toFixed(2),
      })),
    []
  );

  // 整个屏幕的飘雪。减少动态效果时不画。
  useEffect(() => {
    const canvas = snowRef.current;
    if (!canvas) return undefined;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let flakes = [];
    let frameId = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(Math.round((width * height) / 5200), MAX_FLAKES);
      flakes = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.7 + depth * depth * 3.2,
          vy: 0.22 + depth * 0.9,
          phase: Math.random() * 6.28,
          sway: 0.3 + Math.random() * 0.9,
          alpha: 0.35 + depth * 0.55,
        };
      });
    };

    const tick = (time) => {
      ctx.clearRect(0, 0, width, height);
      for (const flake of flakes) {
        flake.y += flake.vy;
        flake.x += Math.sin(time * 0.0006 + flake.phase) * flake.sway * 0.5 + 0.12;
        if (flake.y > height + 6) {
          flake.y = -6;
          flake.x = Math.random() * width;
        }
        if (flake.x > width + 6) flake.x = -6;

        ctx.beginPath();
        ctx.fillStyle = `rgba(236,244,255,${flake.alpha})`;
        ctx.shadowColor = 'rgba(200,220,255,.9)';
        ctx.shadowBlur = flake.r > 2 ? 8 : 0;
        ctx.arc(flake.x, flake.y, flake.r, 0, 6.283);
        ctx.fill();
      }
      frameId = window.requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section
      className="winter-window"
      role="img"
      aria-label="冬夜雪中的小木屋亮起了灯"
    >
      <div className="winter-window__backdrop" aria-hidden="true" />

      <div className="winter-window__aurora" aria-hidden="true">
        <i />
        <i />
      </div>

      <div className="winter-window__stars" aria-hidden="true">
        {bgStars.map((style, index) => (
          <b key={index} style={style} />
        ))}
      </div>

      <div className="winter-window__stage" aria-hidden="true">
        <div className="winter-window__arch">
          <svg
            className="winter-window__scene"
            viewBox="0 0 300 400"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="wwSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#070d28" />
                <stop offset=".55" stopColor="#25357a" />
                <stop offset="1" stopColor="#5a6fb0" />
              </linearGradient>
              <linearGradient id="wwSnow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#eef4ff" />
                <stop offset="1" stopColor="#8fa6da" />
              </linearGradient>
              <radialGradient id="wwMoon">
                <stop offset="0" stopColor="#fff6d8" stopOpacity=".9" />
                <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="wwLamp">
                <stop offset="0" stopColor="#ffcf7a" stopOpacity=".95" />
                <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
              </radialGradient>
              <filter id="wwSoft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.2" />
              </filter>
              <mask id="wwCrescent">
                <rect width="300" height="400" fill="#000" />
                <circle cx="214" cy="92" r="20" fill="#fff" />
                <circle cx="223" cy="86" r="18" fill="#000" />
              </mask>
              <symbol id="wwPine" viewBox="0 0 40 80" overflow="visible">
                <PineSymbolPaths />
              </symbol>
            </defs>

            <rect width="300" height="400" fill="url(#wwSky)" />

            <g>
              {sceneStars.map((star, index) => (
                <circle
                  key={index}
                  cx={star.cx}
                  cy={star.cy}
                  r={star.r}
                  fill="#fff"
                  opacity={star.opacity}
                />
              ))}
            </g>

            {/* 月牙 */}
            <circle
              className="winter-window__moon"
              cx="214"
              cy="92"
              r="52"
              fill="url(#wwMoon)"
            />
            <g mask="url(#wwCrescent)" className="winter-window__moon">
              <circle cx="214" cy="92" r="20" fill="#fff6d8" />
            </g>

            {/* 流星 */}
            <g className="winter-window__shoot">
              <line
                x1="250"
                y1="40"
                x2="274"
                y2="26"
                stroke="#fff"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity=".9"
              />
              <circle cx="250" cy="40" r="1.6" fill="#fff" />
            </g>

            {/* 远山 */}
            <g className="winter-window__layer" style={{ '--d': '.9s' }}>
              <path
                d="M0 250 L45 190 L80 225 L130 160 L185 235 L230 185 L300 250 V400 H0Z"
                fill="#2a3c74"
              />
              <path
                d="M130 160 L116 181 L128 176 L134 184 L144 174Z M45 190 L36 203 L46 199 L54 205Z M230 185 L220 199 L231 195 L240 201Z"
                fill="#c9d8ff"
                opacity=".7"
              />
            </g>

            {/* 中景 */}
            <g className="winter-window__layer" style={{ '--d': '1.3s' }}>
              <path
                d="M0 292 C60 252 120 262 170 282 C220 300 260 272 300 264 V400 H0Z"
                fill="#17234f"
              />
              <use href="#wwPine" x="14" y="238" width="24" height="52" color="#0f1a40" />
              <use href="#wwPine" x="38" y="248" width="18" height="40" color="#0f1a40" />
              <use href="#wwPine" x="250" y="232" width="26" height="56" color="#0f1a40" />
              <use href="#wwPine" x="228" y="246" width="18" height="40" color="#0f1a40" />
            </g>

            {/* 近景雪坡 + 小屋 */}
            <g className="winter-window__layer" style={{ '--d': '1.7s' }}>
              <path
                d="M0 336 C70 300 130 312 180 322 C230 330 270 310 300 300 V400 H0Z"
                fill="url(#wwSnow)"
              />

              {/* 屋后树 */}
              <use href="#wwPine" x="62" y="262" width="30" height="62" color="#0b1436" />
              <use href="#wwPine" x="205" y="272" width="26" height="54" color="#0b1436" />
              <use href="#wwPine" x="30" y="288" width="20" height="40" color="#0b1436" />
              <use href="#wwPine" x="238" y="280" width="22" height="46" color="#0b1436" />

              {/* 小屋 */}
              <rect x="120" y="294" width="64" height="30" fill="#33284a" />
              <rect x="170" y="268" width="9" height="18" fill="#2a2140" />
              <rect x="168" y="265" width="13" height="4" rx="1.5" fill="#f1f6ff" />
              <polygon points="112,296 152,270 192,296" fill="#2a2140" />
              <path
                d="M108 299 L152 266 L196 299 L187 299 L152 275 L117 299Z"
                fill="#f1f6ff"
              />
              <rect x="164" y="306" width="12" height="18" rx="1" fill="#3a2a2a" />

              {/* 窗灯 */}
              <ellipse
                className="winter-window__halo"
                cx="146"
                cy="326"
                rx="46"
                ry="12"
                fill="url(#wwLamp)"
                filter="url(#wwSoft)"
              />
              <g className="winter-window__lamp">
                <circle cx="144" cy="310" r="22" fill="url(#wwLamp)" />
                <rect x="135" y="303" width="18" height="14" rx="1.5" fill="#ffd98f" />
                <path d="M144 303V317M135 310H153" stroke="#33284a" strokeWidth="1.3" />
              </g>

              {/* 前景雪 */}
              <path
                d="M0 376 C80 350 200 362 300 346 V400 H0Z"
                fill="#f3f7ff"
                opacity=".96"
              />
            </g>

            {/* 炊烟 */}
            <g className="winter-window__smoke" filter="url(#wwSoft)">
              {SMOKE_DELAYS.map((delay) => (
                <circle key={delay} cx="175" cy="262" r="5" style={{ '--d': delay }} />
              ))}
            </g>
          </svg>

          <div className="winter-window__gloss" />

          {/* 窗花 */}
          <svg className="winter-window__frost" viewBox="0 0 300 400" aria-hidden="true">
            <g>
              {FROST_LEFT.map(([delay, d]) => (
                <path key={`l-${delay}-${d}`} pathLength="1" style={{ '--d': delay }} d={d} />
              ))}
            </g>
            <g transform="translate(300 0) scale(-1 1)">
              {FROST_RIGHT.map(([delay, d]) => (
                <path key={`r-${delay}-${d}`} pathLength="1" style={{ '--d': delay }} d={d} />
              ))}
            </g>
          </svg>
        </div>

        {/* 雪花封印 / 进度 */}
        <div className="winter-window__seal">
          <svg viewBox="0 0 52 52">
            <circle className="winter-window__track" cx="26" cy="26" r="21" />
            <circle className="winter-window__prog" cx="26" cy="26" r="21" />
          </svg>
          <svg className="winter-window__flake" viewBox="-13 -13 26 26">
            <g>
              <path d="M0 -11V11M-9.5 -5.5L9.5 5.5M-9.5 5.5L9.5 -5.5" />
              <path d="M-2.6 -8.2L0 -6L2.6 -8.2M-2.6 8.2L0 6L2.6 8.2" />
              <path d="M-9.1 -1.6L-6.4 -2.4L-6.7 -5.6M9.1 1.6L6.4 2.4L6.7 5.6M-9.1 1.6L-6.4 2.4L-6.7 5.6M9.1 -1.6L6.4 -2.4L6.7 -5.6" />
            </g>
          </svg>
        </div>
      </div>

      <canvas ref={snowRef} className="winter-window__snow" aria-hidden="true" />
    </section>
  );
};

export default WinterWindowLoader;
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { HARP_NOTES, HARP_STRING_COUNT } from './harpNotes';
import { readHarpPalette, mixColor, rgbaString } from './harpTheme';
import { ensureHarpAudio, playHarpNote } from './harpAudio';

// ============================================================
// 星光小竖琴 —— 竖琴本体（一块 <canvas>）。
//
// 画一把三角形的小竖琴：左边琴柱、上面弯弯的琴颈、下面斜着的琴箱，十根弦
// 夹在琴颈和琴箱之间，左长右短。点一根弦弹一个音；手指/鼠标从弦上划过去
// 会按划过的顺序依次弹出一串。被拨到的弦会颤动、发光，再飘起几点光尘，
// 琴弦下面的简谱数字也会跟着亮一下。
//
// 颜色全部来自 themes.css 的主题变量（见 harpTheme.js），切换主题时通过
// MutationObserver 监听 <html data-theme> 重新取色，不写死任何颜色。
//
// 对外：
//   onPluck(index, frac)  用户自己拨弦时回调（页面据此记录弹奏）
//   disabled              为 true 时忽略用户的触摸（重听旋律期间）
//   ref.strum(index, frac)  走"用户拨弦"的完整路径（发声+动画+onPluck），键盘用
//   ref.pluck(index, frac, by, timbre, pitch)  只发声+动画，不触发 onPluck，by 为
//                               'user' 或 'ta'（'ta' 用另一种光晕，给之后角色弹奏用）；
//                               pitch 可选，是发声的音符编号（4、7 没有对应的弦，
//                               画面点亮 index 这根弦，声音按 pitch 发）
// ============================================================

const NECK_POINTS = 240;
const NECK_CURVE = [
  [0.1, 0.09],
  [0.28, 0.0],
  [0.78, 0.04],
  [0.93, 0.5],
];

const HarpCanvas = forwardRef(function HarpCanvas({ onPluck, disabled = false }, ref) {
  const canvasRef = useRef(null);
  const apiRef = useRef({});
  const onPluckRef = useRef(onPluck);
  const disabledRef = useRef(disabled);

  onPluckRef.current = onPluck;
  disabledRef.current = disabled;

  useImperativeHandle(
    ref,
    () => ({
      pluck: (index, frac, by, timbre, pitch, tune) =>
        apiRef.current.pluck?.(index, frac, by, timbre, pitch, tune),
      strum: (index, frac) => apiRef.current.strum?.(index, frac),
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let pal = readHarpPalette();
    let neck = [];
    let strs = [];
    let motes = [];
    let rings = [];
    let cursor = null;
    let glint = null;
    let nextGlint = 0;
    let lastT = 0;
    let rafId = 0;
    let rafOn = false;
    let disposed = false;
    let spriteCache = {};

    // ---------- 几何：琴颈曲线、弦的上下端点 ----------
    const bezier = (t) => {
      const a = 1 - t;
      const [p0, p1, p2, p3] = NECK_CURVE;
      return {
        x: (a * a * a * p0[0] + 3 * a * a * t * p1[0] + 3 * a * t * t * p2[0] + t * t * t * p3[0]) * W,
        y: (a * a * a * p0[1] + 3 * a * a * t * p1[1] + 3 * a * t * t * p2[1] + t * t * t * p3[1]) * H,
      };
    };
    const neckY = (x) => {
      for (let k = 1; k < neck.length; k += 1) {
        if (neck[k].x >= x) {
          const a = neck[k - 1];
          const b = neck[k];
          return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x || 1));
        }
      }
      return neck[neck.length - 1].y;
    };
    const boxTopY = (x) => (0.89 - ((x / W - 0.1) / 0.83) * 0.39) * H;
    const boxThick = (x) => 0.06 * H * (1 - (x / W - 0.1) / 0.83);

    // 光尘的颜色：深色主题直接用这根弦的发光色；浅色主题往背景色里掺一些，
    // 不然一团团深色光尘看起来像污渍。
    const moteColor = (index, isTa) => {
      if (isTa) return pal.taGlow;
      return pal.dark ? pal.tints[index] : mixColor(pal.tints[index], pal.bg, 0.45);
    };

    // ---------- 光点贴图（按颜色缓存） ----------
    const sprite = (rgb) => {
      const key = rgb.join(',');
      if (spriteCache[key]) return spriteCache[key];
      const el = document.createElement('canvas');
      el.width = 64;
      el.height = 64;
      const c = el.getContext('2d');
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, rgbaString(rgb, 1));
      g.addColorStop(0.3, rgbaString(rgb, 0.45));
      g.addColorStop(1, rgbaString(rgb, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      spriteCache[key] = el;
      return el;
    };

    // ---------- 弦：位置、渐变、拨动状态 ----------
    const buildStrings = () => {
      const previous = strs;
      strs = [];
      const x0 = 0.19 * W;
      const x1 = 0.83 * W;
      for (let i = 0; i < HARP_STRING_COUNT; i += 1) {
        const x = x0 + ((x1 - x0) * i) / (HARP_STRING_COUNT - 1);
        const top = neckY(x);
        const bottom = boxTopY(x);
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, rgbaString(pal.string, 0.35));
        grad.addColorStop(0.5, rgbaString(pal.string, 0.85));
        grad.addColorStop(1, rgbaString(pal.string, 0.55));
        strs.push({
          x,
          top,
          bottom,
          grad,
          t0: previous[i] ? previous[i].t0 : -1e9,
          p: previous[i] ? previous[i].p : 0.5,
          by: previous[i] ? previous[i].by : 'user',
          cooldown: 0,
        });
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      neck = [];
      for (let k = 0; k <= NECK_POINTS; k += 1) neck.push(bezier(k / NECK_POINTS));
      buildStrings();
      drawHarp(performance.now());
    };

    // ---------- 绘制 ----------
    const drawHarp = (now) => {
      if (!W || !H) return;
      const dt = Math.min(50, now - (lastT || now));
      lastT = now;
      ctx.clearRect(0, 0, W, H);

      const xa = 0.1 * W;
      const xb = 0.93 * W;

      // 背后的柔光和脚下的光。两层光都在画布边缘之前就衰减到全透明，
      // 否则会在画布边界露出一道硬边。
      let g = ctx.createRadialGradient(0.5 * W, 0.46 * H, 0, 0.5 * W, 0.46 * H, 0.5 * W);
      g.addColorStop(0, rgbaString(pal.blob1, pal.dark ? 0.5 : 0.7));
      g.addColorStop(0.55, rgbaString(pal.blob2, pal.dark ? 0.18 : 0.35));
      g.addColorStop(1, rgbaString(pal.blob2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(0.5 * W, 0.9 * H);
      ctx.scale(1, 0.2);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.5 * W);
      g.addColorStop(0, rgbaString(pal.blob1, 0.45));
      g.addColorStop(1, rgbaString(pal.blob1, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-0.5 * W, -0.5 * W, W, W);
      ctx.restore();

      const frame = ctx.createLinearGradient(0, 0, W, H);
      frame.addColorStop(0, rgbaString(pal.frameA, 1));
      frame.addColorStop(0.5, rgbaString(pal.frameB, 1));
      frame.addColorStop(1, rgbaString(pal.frameA, 1));

      // 琴箱
      ctx.beginPath();
      for (let k = 0; k <= 40; k += 1) {
        const x = xa + ((xb - xa) * k) / 40;
        if (k) ctx.lineTo(x, boxTopY(x));
        else ctx.moveTo(x, boxTopY(x));
      }
      for (let k = 40; k >= 0; k -= 1) {
        const x = xa + ((xb - xa) * k) / 40;
        ctx.lineTo(x, boxTopY(x) + boxThick(x));
      }
      ctx.closePath();
      const boxFill = ctx.createLinearGradient(xa, 0, xb, 0);
      boxFill.addColorStop(0, rgbaString(pal.card, 0.7));
      boxFill.addColorStop(1, rgbaString(pal.card, 0.25));
      ctx.fillStyle = boxFill;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgbaString(pal.frameA, 0.65);
      ctx.stroke();
      [0.16, 0.32, 0.48, 0.64].forEach((u) => {
        const hx = xa + (xb - xa) * u;
        ctx.beginPath();
        ctx.arc(hx, boxTopY(hx) + boxThick(hx) * 0.5, 2.2, 0, 6.283);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgbaString(pal.frameA, 0.7);
        ctx.stroke();
      });

      // 琴柱、顶饰、底座
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xa, 0.09 * H);
      ctx.lineTo(xa, 0.925 * H);
      ctx.lineWidth = 7;
      ctx.strokeStyle = frame;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xa - 1.4, 0.1 * H);
      ctx.lineTo(xa - 1.4, 0.915 * H);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgbaString(pal.frameHighlight, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(xa, 0.5 * H, 6, 0, 6.283);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = rgbaString(pal.frameHighlight, 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(xa, 0.07 * H, 5.5, 0, 6.283);
      ctx.fillStyle = frame;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(xa, 0.07 * H, 1.8, 0, 6.283);
      ctx.fillStyle = rgbaString(pal.frameHighlight, 0.95);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(xa, 0.94 * H, 0.065 * W, 0.016 * H, 0, 0, 6.283);
      ctx.fillStyle = frame;
      ctx.fill();

      // 琴颈
      ctx.beginPath();
      neck.forEach((point, k) => {
        if (k) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
      });
      ctx.lineWidth = 8;
      ctx.strokeStyle = frame;
      ctx.stroke();
      ctx.beginPath();
      neck.forEach((point, k) => {
        if (k) ctx.lineTo(point.x, point.y - 1.6);
        else ctx.moveTo(point.x, point.y - 1.6);
      });
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgbaString(pal.frameHighlight, 0.6);
      ctx.stroke();

      // 弦钉
      strs.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.top, 2.6, 0, 6.283);
        ctx.fillStyle = frame;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s.x, s.bottom, 2.2, 0, 6.283);
        ctx.fillStyle = frame;
        ctx.fill();
      });

      // 弦
      strs.forEach((s, i) => {
        const age = (now - s.t0) / 1000;
        const lit = age > 6 ? 0 : Math.exp(-age / 0.9);
        const amp = reduceMotion ? 0 : Math.exp(-age / 0.5) * 5.5 * (W / 380);
        const isTa = s.by === 'ta';
        const tint = isTa ? pal.taGlow : pal.tints[i];

        ctx.beginPath();
        if (amp > 0.15) {
          for (let k = 0; k <= 24; k += 1) {
            const sf = k / 24;
            const yy = s.top + (s.bottom - s.top) * sf;
            const tri = sf < s.p ? sf / s.p : (1 - sf) / (1 - s.p);
            const xx = s.x + amp * Math.sin(age * 88) * Math.sin((Math.PI / 2) * tri);
            if (k) ctx.lineTo(xx, yy);
            else ctx.moveTo(xx, yy);
          }
        } else {
          ctx.moveTo(s.x, s.top);
          ctx.lineTo(s.x, s.bottom);
        }

        if (lit > 0.03) {
          ctx.lineWidth = (isTa ? 7 : 5) + (isTa ? 11 : 9) * lit;
          ctx.strokeStyle = rgbaString(tint, (pal.dark ? 0.22 : 0.3) * lit);
          ctx.stroke();
        }
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = s.grad;
        ctx.stroke();
        if (lit > 0.03) {
          const core = mixColor(pal.string, pal.litCore, Math.min(1, lit * 0.9));
          ctx.lineWidth = 1.6 + 1.4 * lit;
          ctx.strokeStyle = rgbaString(core, Math.min(1, lit * 1.3));
          ctx.stroke();
        }
      });

      // 琴箱下面的简谱数字
      const fontSize = Math.round((13 * W) / 380);
      ctx.font = `600 ${fontSize}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      strs.forEach((s, i) => {
        const age = (now - s.t0) / 1000;
        const lit = age > 6 ? 0 : Math.exp(-age / 0.9);
        const ly = boxTopY(s.x) + boxThick(s.x) + fontSize * 1.3;
        const color = lit > 0.1 ? pal.textMain : pal.textMuted;
        ctx.fillStyle = rgbaString(color, 0.7 + 0.3 * lit);
        ctx.fillText(HARP_NOTES[i].label, s.x, ly);
        if (HARP_NOTES[i].high) {
          ctx.beginPath();
          ctx.arc(s.x, ly - fontSize * 0.78, 1.3, 0, 6.283);
          ctx.fill();
        }
      });

      // 空闲时沿着某根弦往上滑的一点微光
      if (!reduceMotion && strs.length) {
        if (now > nextGlint) {
          glint = { i: Math.floor(Math.random() * strs.length), t0: now };
          nextGlint = now + 2200 + Math.random() * 2600;
        }
        if (glint) {
          const progress = (now - glint.t0) / 1700;
          if (progress >= 1) {
            glint = null;
          } else {
            const gs = strs[glint.i];
            const gy = gs.bottom - (gs.bottom - gs.top) * progress;
            ctx.globalAlpha = Math.sin(Math.PI * progress) * 0.8;
            ctx.drawImage(sprite(pal.glint), gs.x - 9, gy - 9, 18, 18);
            ctx.globalAlpha = 1;
          }
        }
      }

      // 涟漪、光尘、角色的引导光点
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i];
        const age = now - ring.t0;
        if (age > 750) {
          rings.splice(i, 1);
        } else {
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, 4 + (age / 750) * 34, 0, 6.283);
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = rgbaString(ring.color, (1 - age / 750) * 0.65);
          ctx.stroke();
        }
      }
      for (let i = motes.length - 1; i >= 0; i -= 1) {
        const m = motes[i];
        m.age += dt;
        if (m.age >= m.life) {
          motes.splice(i, 1);
        } else {
          m.x += (m.vx * dt) / 16 + Math.sin(m.age * 0.003 + m.phase) * 0.15;
          m.y += (m.vy * dt) / 16;
          const k = 1 - m.age / m.life;
          ctx.globalAlpha = Math.pow(k, 1.4) * (pal.dark ? 0.9 : 0.6);
          const size = m.r * (0.55 + 0.45 * k);
          ctx.drawImage(sprite(m.color), m.x - size, m.y - size, size * 2, size * 2);
        }
      }
      ctx.globalAlpha = 1;
      if (cursor) {
        const age = (now - cursor.t0) / 1000;
        if (age > 1) {
          cursor = null;
        } else {
          ctx.globalAlpha = 1 - age;
          ctx.drawImage(sprite(pal.taGlow), cursor.x - 20, cursor.y - 20, 40, 40);
          ctx.globalAlpha = 1;
        }
      }
    };

    // ---------- 动画循环：没有动静又开了"减少动态效果"时不空转 ----------
    const isActive = (now) => {
      if (motes.length || rings.length) return true;
      if (cursor && now - cursor.t0 < 1000) return true;
      return strs.some((s) => now - s.t0 < 5000);
    };
    const loop = () => {
      rafOn = false;
      if (disposed) return;
      const now = performance.now();
      drawHarp(now);
      if (!reduceMotion || isActive(now)) {
        rafOn = true;
        rafId = requestAnimationFrame(loop);
      }
    };
    const kick = () => {
      if (!rafOn && !disposed) {
        rafOn = true;
        rafId = requestAnimationFrame(loop);
      }
    };

    // ---------- 拨弦 ----------
       // timbre：可选，重听旧旋律时指定它当时的音色；不传就用当前音色
    // pitch：可选，发声用的音符编号（10-13 是 4、7，没有对应的弦）；不传就是 index 本身
    const pluck = (index, frac, by, timbre, pitch, tune) => {
      const s = strs[index];
      if (!s) return;
      const now = performance.now();
      const fraction = Math.max(0.1, Math.min(0.9, typeof frac === 'number' ? frac : 0.5));
      const isTa = by === 'ta';
      s.t0 = now;
      s.p = fraction;
      s.by = isTa ? 'ta' : 'user';
      playHarpNote(typeof pitch === 'number' ? pitch : index, timbre, tune);

      const y = s.top + (s.bottom - s.top) * fraction;
      const color = isTa ? pal.taGlow : pal.tints[index];
      const dustColor = moteColor(index, isTa);
      if (!reduceMotion) {
        rings.push({ x: s.x, y, t0: now, color });
        for (let k = 0; k < 9; k += 1) {
          motes.push({
            x: s.x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * (s.bottom - s.top) * 0.5,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -(Math.random() * 0.45 + 0.2),
            r: Math.random() * 8 + 5,
            age: 0,
            life: Math.random() * 900 + 1300,
            phase: Math.random() * 6,
            color: dustColor,
          });
        }
      }
      if (isTa) cursor = { x: s.x, y, t0: now };
      kick();
    };

    const strum = (index, frac) => {
      const s = strs[index];
      if (!s || disabledRef.current) return;
      const now = performance.now();
      if (now - s.cooldown < 45) return;
      s.cooldown = now;
      ensureHarpAudio();
      const fraction = Math.max(0.1, Math.min(0.9, typeof frac === 'number' ? frac : 0.5));
      pluck(index, fraction, 'user');
      if (onPluckRef.current) onPluckRef.current(index, fraction);
    };

    apiRef.current = { pluck, strum };

    // ---------- 指针：点按和划过 ----------
    let pointerDown = false;
    let lastX = 0;
    const position = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (W / (rect.width || 1)),
        y: (event.clientY - rect.top) * (H / (rect.height || 1)),
      };
    };
    const withinHeight = (s, y) => y >= s.top - 8 && y <= s.bottom + 8;
    const fractionAt = (s, y) => (y - s.top) / (s.bottom - s.top || 1);

    const onPointerDown = (event) => {
      if (!strs.length) return;
      const p = position(event);
      pointerDown = true;
      lastX = p.x;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        /* 部分浏览器不支持，忽略 */
      }
      const spacing = (strs[strs.length - 1].x - strs[0].x) / (strs.length - 1);
      const i = Math.round((p.x - strs[0].x) / spacing);
      if (i >= 0 && i < strs.length && Math.abs(p.x - strs[i].x) <= spacing * 0.6 && withinHeight(strs[i], p.y)) {
        strum(i, fractionAt(strs[i], p.y));
      }
    };
    const onPointerMove = (event) => {
      if (!pointerDown) return;
      const p = position(event);
      const order = strs.map((_, k) => k);
      if (p.x < lastX) order.reverse();
      order.forEach((i) => {
        const sx = strs[i].x;
        const crossed = (lastX < sx && p.x >= sx) || (lastX > sx && p.x <= sx);
        if (crossed && withinHeight(strs[i], p.y)) strum(i, fractionAt(strs[i], p.y));
      });
      lastX = p.x;
    };
    const onPointerEnd = () => {
      pointerDown = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    canvas.addEventListener('pointerleave', onPointerEnd);

    // ---------- 尺寸变化、主题切换 ----------
    let resizeObserver = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    const themeObserver = new MutationObserver(() => {
      pal = readHarpPalette();
      spriteCache = {};
      buildStrings();
      drawHarp(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    resize();
    if (!reduceMotion) kick();

    return () => {
      disposed = true;
      apiRef.current = {};
      if (rafId) cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('pointerleave', onPointerEnd);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hp-canvas"
      role="application"
      aria-label="十根弦的竖琴，点按或从弦上划过即可弹奏，键盘数字 1 到 0 也可以"
    />
  );
});

export default HarpCanvas;
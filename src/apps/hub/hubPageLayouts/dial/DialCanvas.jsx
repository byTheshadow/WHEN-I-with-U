// src/apps/hub/hubPageLayouts/dial/DialCanvas.jsx
//
// 转盘本体：一块 canvas 加一套自己的物理（拖动、惯性、弹簧吸附到最近一格）。
// 照参考稿的转盘移植，改动只有这几处，其余行为保持一致：
//   - 颜色不再写死，从 App 的主题变量（--text-main 等）读取，切主题后自动更新；
//   - 动画循环只在转盘可见、且有东西在动时才跑，停下来或滚出视野就完全停掉；
//   - 选中格变化通过 onSelect 通知外面（外面用 React 状态画标题和按钮），
//     canvas 本身不触发任何 React 渲染。
//
// props：
//   slots       槽位数组（见 dialData.js），长度决定一圈有几格
//   tints       每章的色调（十六进制字符串数组），按 slot.ch 取
//   motionOn    false 时转盘静态绘制，只在被操作时重画
//   soundOn     true 时每过一格有一声轻响（需要先调用 enableSound，在点击里）
//   onSelect    (index) => void，选中格变化时调用
//   onActivate  (slot) => void，在应用格上确认（点击、回车）时调用
//   onInteract  () => void，第一次被操作时调用（用来收起提示语）
//   children    叠在转盘上的按钮（中心的 Messages、骰子、提示语），按钮类名要带 dl-hub / dl-dice
//
// ref 暴露：spin()、goTo(index)、activate()、enableSound()。

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mod = (a, n) => ((a % n) + n) % n;
const norm = (angle) => {
  let value = angle;
  while (value > Math.PI) value -= TAU;
  while (value < -Math.PI) value += TAU;
  return value;
};
const mixColor = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = (c, alpha) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;

const hexToRgb = (hex) => {
  const text = String(hex || '').trim().replace('#', '');
  return [
    parseInt(text.slice(0, 2), 16) || 0,
    parseInt(text.slice(2, 4), 16) || 0,
    parseInt(text.slice(4, 6), 16) || 0,
  ];
};

// 浏览器算好的颜色可能是 rgb()/rgba()，也可能是 color(srgb ...)，都转成 [r, g, b]。
const parseCssRgb = (value) => {
  const text = String(value || '');
  let match = text.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  match = text.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (match) return [Number(match[1]) * 255, Number(match[2]) * 255, Number(match[3]) * 255];
  return null;
};

const FALLBACK_RGB = [128, 128, 128];

export const DialCanvas = forwardRef(function DialCanvas(
  { slots, tints, motionOn, soundOn, onSelect, onActivate, onInteract, children },
  ref
) {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const apiRef = useRef(null);

  // 外面传进来的值和回调放进 ref，引擎在 effect 里读最新的，不需要因为它们变化重建。
  const propsRef = useRef({});
  propsRef.current = { slots, tints, motionOn, soundOn, onSelect, onActivate, onInteract };

  useImperativeHandle(
    ref,
    () => ({
      spin: () => apiRef.current?.spin(),
      goTo: (index) => apiRef.current?.goTo(index),
      activate: () => apiRef.current?.activate(),
      enableSound: () => apiRef.current?.enableSound(),
    }),
    []
  );

  // 动效开关变化后让引擎醒一下（可能正好停在「不需要重画」的状态）。
  useEffect(() => {
    apiRef.current?.wake();
  }, [motionOn]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const allSlots = propsRef.current.slots;
    const N = allSlots.length;
    if (N === 0) return undefined;
    const step = TAU / N;

    let disposed = false;
    let running = false;
    let visible = true;
    let rafId = 0;
    let last = performance.now();
    let idleFrames = 0;

    let pos = 0;
    let vel = 0;
    let target = 0;
    let springK = 9;
    let drag = null;
    let lastSel = -1;
    let introDone = false;
    let interacted = false;

    let R = 300;
    let cx = 0;
    let cy = 0;
    let Hc = 0;
    let W = 0;
    let dpr = 1;

    let colors = {
      ink: FALLBACK_RGB,
      sub: FALLBACK_RGB,
      muted: FALLBACK_RGB,
      line: FALLBACK_RGB,
      paper: FALLBACK_RGB,
      accent: FALLBACK_RGB,
    };
    let tickColors = [];
    let tintCurrent = hexToRgb(propsRef.current.tints[0]);
    let tintTarget = tintCurrent;

    let audio = null;
    let lastTick = 0;

    // ---- 颜色：用一个看不见的探针元素让浏览器把 CSS 变量算成具体颜色 ----
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;';
    box.appendChild(probe);

    const readVar = (name) => {
      probe.style.color = '';
      probe.style.color = `var(${name})`;
      return parseCssRgb(getComputedStyle(probe).color) || FALLBACK_RGB;
    };

    const buildTickColors = () => {
      tickColors = propsRef.current.tints.map((tint) => mixColor(hexToRgb(tint), colors.ink, 0.3));
    };

    const readColors = () => {
      colors = {
        ink: readVar('--text-main'),
        sub: readVar('--text-sub'),
        muted: readVar('--text-muted'),
        line: readVar('--divider'),
        paper: readVar('--card-bg'),
        accent: readVar('--accent-color'),
      };
      buildTickColors();
    };

    // ---- 布局 ----
    const layout = () => {
      W = box.clientWidth || 360;
      const vh = window.innerHeight || 700;
      R = clamp(Math.min(vh * 0.36, W * 0.62), 190, 430);
      cy = 44 + R;
      cx = W / 2;
      Hc = Math.round(cy + R * 0.42);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      box.style.height = `${Hc}px`;
      box.style.setProperty('--dl-cy', `${cy}px`);
      box.style.setProperty('--dl-hub', `${Math.round(R * 0.5)}px`);
      box.style.setProperty('--dl-hint-top', `${cy + R * 0.25 + 22}px`);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(Hc * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${Hc}px`;
    };

    // ---- 音效 / 触感 ----
    const enableSound = () => {
      if (!audio) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audio = AudioContextClass ? new AudioContextClass() : null;
        } catch {
          audio = null;
        }
      }
      if (audio && audio.state === 'suspended') {
        audio.resume().catch(() => {});
      }
    };

    const tick = (isChapter) => {
      const now = performance.now();
      if (now - lastTick < 35) return;
      lastTick = now;

      if (introDone && propsRef.current.motionOn && navigator.vibrate) {
        try {
          navigator.vibrate(isChapter ? 12 : 5);
        } catch {
          // 不支持震动的设备直接忽略。
        }
      }

      if (!propsRef.current.soundOn || !audio) return;
      try {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = audio.currentTime;
        osc.type = 'sine';
        osc.frequency.value = isChapter ? 196 : 420 + (lastSel % 8) * 52;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(audio.destination);
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (isChapter ? 0.18 : 0.09));
        osc.start(t);
        osc.stop(t + 0.2);
      } catch {
        // 音频出错不影响转盘本身。
      }
    };

    // ---- 绘制 ----
    const draw = (now) => {
      const { motionOn: motion } = propsRef.current;
      const tt = motion ? now / 1000 : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hc);
      ctx.save();
      ctx.translate(cx, cy);
      const speed = Math.min(Math.abs(vel), 30);

      // 盘面
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.fillStyle = rgba(colors.paper, 0.42);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(colors.line, 1);
      ctx.stroke();

      const labelStart = R - 30;
      const labelMax = R * 0.3;
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, labelStart - labelMax - 12, 0, TAU);
      ctx.strokeStyle = rgba(colors.line, 0.9);
      ctx.stroke();
      ctx.setLineDash([]);

      // 声波环：围着中心呼吸，转得越快幅度越大
      const idle = motion ? 3.2 : 1.5;
      for (let j = 0; j < 4; j += 1) {
        const base = R * (0.33 + 0.055 * j);
        const amp = idle + j * 0.7 + speed * (0.55 + 0.1 * j);
        ctx.beginPath();
        for (let k = 0; k <= 180; k += 1) {
          const th = (k / 180) * TAU;
          const rr =
            base +
            amp * Math.sin(th * (5 + 2 * j) + tt * (j % 2 ? -1.1 : 1.3) + j) +
            amp * 0.4 * Math.sin(th * (11 + j) + tt * 2.1);
          const x = Math.cos(th) * rr;
          const y = Math.sin(th) * rr;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.closePath();
        if (j === 0) {
          ctx.fillStyle = rgba(tintCurrent, 0.14);
          ctx.fill();
        }
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = rgba(tintCurrent, 0.85 - j * 0.15);
        ctx.shadowColor = rgba(tintCurrent, 0.7);
        ctx.shadowBlur = j === 0 ? 14 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 指针处的高亮窗口
      ctx.beginPath();
      ctx.arc(0, 0, R - 16, -Math.PI / 2 - step * 0.55, -Math.PI / 2 + step * 0.55);
      ctx.lineWidth = 34;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = rgba(tintCurrent, 0.32);
      ctx.stroke();

      // 刻度与标签
      const fontSize = clamp(R * 0.056, 12, 18);
      for (let i = 0; i < N; i += 1) {
        const d = mod(i - pos + N / 2, N) - N / 2;
        const a = -Math.PI / 2 + d * step;
        const slot = allSlots[i];
        const isChapter = slot.type === 'chapter';
        const near = Math.max(0, 1 - Math.abs(d) / 5.5);
        const tickColor = tickColors[slot.ch % tickColors.length] || colors.ink;
        const len = isChapter ? 24 : 13;
        const ca = Math.cos(a);
        const sa = Math.sin(a);

        ctx.beginPath();
        ctx.moveTo(ca * (R - 2), sa * (R - 2));
        ctx.lineTo(ca * (R - 2 - len), sa * (R - 2 - len));
        ctx.lineWidth = isChapter ? 3 : 1.6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(tickColor, 0.5 + 0.5 * near);
        ctx.stroke();

        for (let m = 1; m < 4; m += 1) {
          const am = a + (m * step) / 4;
          const cm = Math.cos(am);
          const sm = Math.sin(am);
          ctx.beginPath();
          ctx.moveTo(cm * (R - 2), sm * (R - 2));
          ctx.lineTo(cm * (R - 8), sm * (R - 8));
          ctx.lineWidth = 1;
          ctx.strokeStyle = rgba(colors.muted, 0.3);
          ctx.stroke();
        }

        const selected = Math.abs(d) < 0.5;
        const alpha = selected ? 1 : 0.3 + 0.55 * near;
        ctx.save();
        ctx.rotate(a);
        const flip = ca < -0.0001;
        if (flip) ctx.rotate(Math.PI);
        ctx.textBaseline = 'middle';
        const rx = flip ? -labelStart : labelStart;
        ctx.textAlign = flip ? 'left' : 'right';

        if (isChapter) {
          ctx.font = `italic ${Math.round(fontSize * 1.7)}px "Instrument Serif", Georgia, serif`;
          ctx.fillStyle = rgba(selected ? colors.accent : colors.ink, Math.max(alpha, 0.55));
          ctx.fillText(slot.num, rx, 0);
        } else {
          ctx.font = `${fontSize}px "Instrument Serif", Georgia, serif`;
          let text = slot.en;
          while (ctx.measureText(text).width > labelMax && text.length > 4) {
            text = text.slice(0, -2);
          }
          if (text !== slot.en) text += '…';
          ctx.fillStyle = rgba(selected ? colors.accent : colors.ink, alpha);
          ctx.fillText(text, rx, 0);
        }
        ctx.restore();
      }

      // 指针
      ctx.beginPath();
      ctx.moveTo(0, -R - 20);
      ctx.lineTo(0, -R + 36);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(colors.accent, 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -R - 20, 4, 0, TAU);
      ctx.fillStyle = rgba(colors.accent, 1);
      ctx.fill();
      ctx.restore();
    };

    // ---- 主循环：只在可见且有东西在动时运行 ----
    const schedule = () => {
      running = true;
      rafId = requestAnimationFrame(frame);
    };

    const wake = () => {
      idleFrames = 0;
      if (running || disposed || !visible || document.hidden) return;
      last = performance.now();
      schedule();
    };

    function frame(now) {
      rafId = 0;
      if (disposed) return;
      if (!visible || document.hidden) {
        running = false;
        return;
      }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (dt <= 0) {
        schedule();
        return;
      }

      // 物理：拖动时由指针直接改 pos；松手后先惯性滑行，再弹簧吸附到最近一格。
      if (!drag) {
        if (target === null) {
          if (Math.abs(vel) > 1.0) {
            pos += vel * dt;
            vel *= Math.exp(-3.0 * dt);
          } else {
            target = Math.round(pos);
          }
        }
        if (target !== null) {
          const nextPos = pos + (target - pos) * (1 - Math.exp(-springK * dt));
          vel = (nextPos - pos) / dt;
          pos = nextPos;
          if (Math.abs(target - pos) < 0.0006) {
            pos = target;
            vel = 0;
          }
        }
      }

      const selected = mod(Math.round(pos), N);
      if (selected !== lastSel) {
        lastSel = selected;
        const slot = allSlots[selected];
        tintTarget = hexToRgb(propsRef.current.tints[slot.ch % propsRef.current.tints.length]);
        box.setAttribute('aria-valuenow', String(selected + 1));
        box.setAttribute('aria-valuetext', slot.type === 'chapter' ? `${slot.en}，${slot.zh}` : slot.en);
        propsRef.current.onSelect?.(selected);
        tick(slot.type === 'chapter');
      }

      const blend = 1 - Math.exp(-3.5 * dt);
      tintCurrent = mixColor(tintCurrent, tintTarget, blend);
      const tintMoving =
        Math.abs(tintCurrent[0] - tintTarget[0]) +
          Math.abs(tintCurrent[1] - tintTarget[1]) +
          Math.abs(tintCurrent[2] - tintTarget[2]) >
        2;

      const moving =
        Boolean(drag) ||
        Math.abs(vel) > 0.005 ||
        target === null ||
        Math.abs((target || 0) - pos) > 0.001 ||
        tintMoving;
      const motion = propsRef.current.motionOn;

      if (motion || moving || idleFrames < 3) {
        draw(now);
        idleFrames = moving ? 0 : idleFrames + 1;
        schedule();
      } else {
        running = false;
      }
    }

    // ---- 操作 ----
    const markInteracted = () => {
      if (interacted) return;
      interacted = true;
      propsRef.current.onInteract?.();
    };

    const goTo = (index) => {
      const base = Math.round(pos);
      const delta = mod(index - base + N / 2, N) - N / 2;
      target = base + delta;
      vel = 0;
      springK = 9;
      wake();
    };

    const activate = () => {
      const slot = allSlots[mod(Math.round(pos), N)];
      if (slot.type === 'chapter') goTo(mod(Math.round(pos) + 1, N));
      else propsRef.current.onActivate?.(slot);
    };

    const spin = () => {
      const distance = 14 + Math.random() * 40;
      const sign = Math.random() < 0.5 ? -1 : 1;
      target = null;
      vel = sign * distance * 3.0;
      springK = 9;
      markInteracted();
      wake();
    };

    apiRef.current = { spin, goTo, activate, enableSound, wake };

    const localXY = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event) => {
      if (event.target.closest('.dl-hub,.dl-dice')) return;
      const p = localXY(event);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < R * 0.28 || dist > R + 26) return;
      drag = {
        id: event.pointerId,
        last: Math.atan2(dy, dx),
        lastT: performance.now(),
        sx: event.clientX,
        sy: event.clientY,
        moved: 0,
        px: p.x,
        py: p.y,
      };
      try {
        box.setPointerCapture(event.pointerId);
      } catch {
        // 某些浏览器不支持捕获，不影响拖动。
      }
      target = null;
      vel = 0;
      box.classList.add('dragging');
      markInteracted();
      wake();
    };

    const onPointerMove = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const p = localXY(event);
      const angle = Math.atan2(p.y - cy, p.x - cx);
      const delta = norm(angle - drag.last);
      drag.last = angle;
      const dpos = -delta / step;
      const now = performance.now();
      const dt = Math.max((now - drag.lastT) / 1000, 0.004);
      pos += dpos;
      vel = vel * 0.55 + (dpos / dt) * 0.45;
      drag.lastT = now;
      drag.moved = Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy);
      wake();
    };

    const endDrag = (event, cancelled) => {
      if (!drag || event.pointerId !== drag.id) return;
      const finished = drag;
      drag = null;
      box.classList.remove('dragging');

      if (!cancelled && finished.moved < 6) {
        const angle = Math.atan2(finished.py - cy, finished.px - cx);
        const offset = norm(angle + Math.PI / 2) / step;
        const index = mod(Math.round(pos + offset), N);
        if (index === mod(Math.round(pos), N)) activate();
        else goTo(index);
        return;
      }

      if (performance.now() - finished.lastT > 90) vel = 0;
      target = null;
      springK = 9;
      wake();
    };

    const onPointerUp = (event) => endDrag(event, false);
    const onPointerCancel = (event) => endDrag(event, true);

    const onWheel = (event) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        target = null;
        springK = 9;
        vel += event.deltaX * 0.05;
        markInteracted();
        wake();
      }
    };

    const onKeyDown = (event) => {
      const key = event.key;
      const base = Math.round(pos);
      const move = (nextTarget) => {
        event.preventDefault();
        target = nextTarget;
        vel = 0;
        springK = 9;
        markInteracted();
        wake();
      };
      if (key === 'ArrowRight' || key === 'ArrowDown') move(base + 1);
      else if (key === 'ArrowLeft' || key === 'ArrowUp') move(base - 1);
      else if (key === 'PageDown') move(base + 7);
      else if (key === 'PageUp') move(base - 7);
      else if (key === 'Home') {
        event.preventDefault();
        goTo(0);
      } else if (key === 'End') {
        event.preventDefault();
        goTo(N - 1);
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        activate();
      }
    };

    box.addEventListener('pointerdown', onPointerDown);
    box.addEventListener('pointermove', onPointerMove);
    box.addEventListener('pointerup', onPointerUp);
    box.addEventListener('pointercancel', onPointerCancel);
    box.addEventListener('wheel', onWheel, { passive: false });
    box.addEventListener('keydown', onKeyDown);

    // ---- 观察：尺寸、主题、是否可见、页面是否在前台 ----
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            layout();
            wake();
          })
        : null;
    if (resizeObserver) resizeObserver.observe(box);

    const themeObserver = new MutationObserver(() => {
      readColors();
      wake();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) wake();
          })
        : null;
    if (intersectionObserver) intersectionObserver.observe(box);

    const onVisibility = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (document.fonts && document.fonts.load) {
      document.fonts
        .load('italic 16px "Instrument Serif"')
        .then(() => document.fonts.load('16px "Instrument Serif"'))
        .then(() => wake())
        .catch(() => {});
    }

    // ---- 启动：转盘从远处转进来，只此一次 ----
    readColors();
    layout();
    if (propsRef.current.motionOn) {
      pos = -11;
      target = 0;
      springK = 2.2;
    } else {
      pos = 0;
      target = 0;
      springK = 9;
    }
    const introTimer = window.setTimeout(() => {
      springK = 9;
      introDone = true;
    }, 2000);
    wake();

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(rafId);
      window.clearTimeout(introTimer);
      box.removeEventListener('pointerdown', onPointerDown);
      box.removeEventListener('pointermove', onPointerMove);
      box.removeEventListener('pointerup', onPointerUp);
      box.removeEventListener('pointercancel', onPointerCancel);
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      if (resizeObserver) resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
      themeObserver.disconnect();
      if (audio && audio.close) audio.close().catch(() => {});
      audio = null;
      apiRef.current = null;
      probe.remove();
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className="dl-dialbox"
      tabIndex={0}
      role="slider"
      aria-label="应用转盘：左右拖动或用方向键调频，回车打开"
      aria-valuemin={1}
      aria-valuemax={slots.length}
      aria-valuenow={1}
    >
      <canvas ref={canvasRef} className="dl-dial-canvas" aria-hidden="true" />
      {children}
    </div>
  );
});

export default DialCanvas;

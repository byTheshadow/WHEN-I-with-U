// src/apps/layoutstudio/LayoutCanvas.jsx
//
// 主画布：把 (photos, spec) 画出来。
//   - playKey 变化（且大于 0）时播放"元素依次弹出"的出图动画；
//   - 其余情况（比如用户改了一个字）直接画最终画面，不放动画；
//   - 通过 ref.getCanvas() 把真实的 canvas 交给外面（保存、截图用）。

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { CANVAS_H, CANVAS_W } from './layoutConstants';
import { renderLayout } from './layoutRenderer';

const PLAY_MS = 1500;

const LayoutCanvas = forwardRef(function LayoutCanvas(
  { photos, spec, playKey, onPlayEnd },
  ref
) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const playedKeyRef = useRef(0);
  const playingRef = useRef(false);
  const onEndRef = useRef(onPlayEnd);
  onEndRef.current = onPlayEnd;

  useImperativeHandle(ref, () => ({ getCanvas: () => canvasRef.current }), []);

  const draw = useCallback(
    (t) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      if (spec && photos.length > 0) renderLayout(ctx, photos, spec, t);
    },
    [photos, spec]
  );

  useEffect(() => {
    cancelAnimationFrame(frameRef.current);

    if (playKey && playKey !== playedKeyRef.current) {
      const start = performance.now();
      playingRef.current = true;
      const step = (now) => {
        const t = Math.min(1, (now - start) / PLAY_MS);
        draw(t);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          // 只有真正播完才记下这次的 playKey；中途被打断（比如开发环境
          // 的 StrictMode 重复执行副作用）下一次会重新播。
          playedKeyRef.current = playKey;
          playingRef.current = false;
          if (onEndRef.current) onEndRef.current();
        }
      };
      frameRef.current = requestAnimationFrame(step);
    } else {
      draw(1);
    }

    return () => {
      cancelAnimationFrame(frameRef.current);
      // 动画被打断时也要通知外面，否则外面的 busy 会一直卡住。
      if (playingRef.current) {
        playingRef.current = false;
        if (onEndRef.current) onEndRef.current();
      }
    };
  }, [draw, playKey]);

  return (
    <canvas
      ref={canvasRef}
      className="ls-canvas"
      width={CANVAS_W}
      height={CANVAS_H}
    />
  );
});

export default LayoutCanvas;

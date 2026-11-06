// src/components/PlanetAwakenLoader.jsx
//
// 常驻加载页选项（Planet Awaken）：沉睡的代码字符汇聚成一颗行星，扫描环
// 自南极升向北极逐层唤醒，四圈代码轨道依次点亮。固定的深空配色，外层深色
// 背景由 Preloader.jsx 的 LOADER_MAP 提供。
//
// 画面逻辑在 planetAwakenScene.js；这里只负责挂载画布和占位框，并在卸载时
// 停止动画。动画比较长，LOADER_MAP 里单独设置了 fadeMs / finishMs。

import React, { useEffect, useRef } from 'react';
import { startPlanetAwakenScene } from './planetAwakenScene';
import './planet-scene-loader.css';

export const PlanetAwakenLoader = () => {
  const canvasRef = useRef(null);
  const slotRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !slotRef.current) return undefined;
    return startPlanetAwakenScene({
      canvas: canvasRef.current,
      slot: slotRef.current
    });
  }, []);

  return (
    <section
      className="planet-scene"
      role="img"
      aria-label="沉睡的代码汇聚成一颗行星，随后被逐层唤醒"
    >
      <canvas ref={canvasRef} className="planet-scene__canvas" aria-hidden="true" />
      <div ref={slotRef} className="planet-scene__slot" aria-hidden="true" />
    </section>
  );
};

export default PlanetAwakenLoader;
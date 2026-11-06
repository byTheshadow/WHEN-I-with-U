// src/components/PlanetWarpLoader.jsx
//
// 常驻加载页选项（Planet Warp）：沉睡的代码场被唤醒，字符拼成星门，点火后
// 穿过星门进入跃迁隧道，最后抵达一颗由代码构成的行星，地平线日出。固定的
// 深空配色，外层深色背景由 Preloader.jsx 的 LOADER_MAP 提供。
//
// 画面逻辑在 planetWarpScene.js（整段已压缩到约 8 秒）；这里只负责挂载画布
// 和占位框，并在卸载时停止动画。

import React, { useEffect, useRef } from 'react';
import { startPlanetWarpScene } from './planetWarpScene';
import './planet-scene-loader.css';

export const PlanetWarpLoader = () => {
  const canvasRef = useRef(null);
  const slotRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !slotRef.current) return undefined;
    return startPlanetWarpScene({
      canvas: canvasRef.current,
      slot: slotRef.current
    });
  }, []);

  return (
    <section
      className="planet-scene"
      role="img"
      aria-label="沉睡的代码拼成星门，穿越跃迁隧道，抵达一颗由代码构成的行星"
    >
      <canvas ref={canvasRef} className="planet-scene__canvas" aria-hidden="true" />
      <div ref={slotRef} className="planet-scene__slot" aria-hidden="true" />
    </section>
  );
};

export default PlanetWarpLoader;
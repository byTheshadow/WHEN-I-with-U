// src/apps/layoutstudio/LayoutMiniPreview.jsx
//
// 模板选择面板里的小预览：用真实的渲染器把默认版面画成一张缩略图。

import React, { useEffect, useRef } from 'react';

import { CANVAS_H, CANVAS_W } from './layoutConstants';
import { renderLayout } from './layoutRenderer';

const PREVIEW_WIDTH = 160;

const LayoutMiniPreview = ({ photos, spec, active = true }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas || !spec || photos.length === 0) return;
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / CANVAS_W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    renderLayout(ctx, photos, spec, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [photos, spec, active]);

  return (
    <canvas
      ref={canvasRef}
      className="ls-mini"
      width={PREVIEW_WIDTH}
      height={Math.round((PREVIEW_WIDTH * CANVAS_H) / CANVAS_W)}
    />
  );
};

export default LayoutMiniPreview;

// src/apps/layoutstudio/LayoutMainPreview.jsx
//
// 取景框里的主图预览：把主图的画布按 4:5 居中裁切画进一块小画布。
// 照片对象里只有 240px 的缩略图，直接放大会糊，所以用 photo.el（1600px）来画。

import React, { useEffect, useRef } from 'react';

const PREVIEW_W = 720;
const PREVIEW_H = 900;

const LayoutMainPreview = ({ photo }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo?.el) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    const scale = Math.max(PREVIEW_W / photo.width, PREVIEW_H / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo.el, (PREVIEW_W - dw) / 2, (PREVIEW_H - dh) / 2, dw, dh);
  }, [photo]);

  return <canvas ref={canvasRef} className="ls-mainprev" width={PREVIEW_W} height={PREVIEW_H} />;
};

export default LayoutMainPreview;

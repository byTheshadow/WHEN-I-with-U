// src/apps/layoutstudio/layoutPhotoService.js
//
// 把用户选的图片文件读成修图室用的"照片对象"：
//   { id, el, width, height, thumb }
//   el     画布里直接 drawImage 用的 canvas（已按最长边 1600 缩小，省内存）
//   thumb  小缩略图的 data URL，给界面里的照片格子用
// 照片只存在内存里，不写数据库。

import { MAX_PHOTOS } from './layoutConstants';

const MAX_SIDE = 1600;
const THUMB_SIDE = 240;

let photoSeq = 0;

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解析失败'));
    img.src = url;
  });

export const fileToPhoto = async (file) => {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('请选择有效的图片文件');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const thumbScale = THUMB_SIDE / Math.max(canvas.width, canvas.height);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.max(1, Math.round(canvas.width * thumbScale));
    thumbCanvas.height = Math.max(1, Math.round(canvas.height * thumbScale));
    thumbCanvas
      .getContext('2d')
      .drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

    photoSeq += 1;
    return {
      id: `p${photoSeq}`,
      el: canvas,
      width: canvas.width,
      height: canvas.height,
      thumb: thumbCanvas.toDataURL('image/jpeg', 0.72),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * 一次读多个文件，最多读 room 张；读不出来的跳过并计数。
 * 返回 { photos, failed }。
 */
export const filesToPhotos = async (files, room = MAX_PHOTOS) => {
  const photos = [];
  let failed = 0;
  for (const file of Array.from(files).slice(0, Math.max(0, room))) {
    try {
      photos.push(await fileToPhoto(file));
    } catch (error) {
      failed += 1;
    }
  }
  return { photos, failed };
};

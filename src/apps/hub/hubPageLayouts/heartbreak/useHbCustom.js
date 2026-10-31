// src/apps/hub/hubPageLayouts/heartbreak/useHbCustom.js
//
// 心碎先生版式里「装饰」的自定义内容：用户可以改掉飘字、标签、感叹号牌的
// 文字，也可以把人物抠图、播放器封面换成自己的图片。全部存在 db.settings
// 的一条记录里（键 hubHeartbreakCustom），结构：
//   { texts: { [id]: string }, images: { [id]: dataURL } }
// 没改过的项目不会出现在里面，界面上就显示默认的占位。图片只存在这台设备的
// IndexedDB 里，不会上传。新增设置键不需要升 DB 版本。
//
// 写法对照 useHubPageLayout.js：用 Dexie liveQuery 订阅，改完首页自动刷新。

import { createContext, useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../../../db';

export const HB_CUSTOM_SETTING_KEY = 'hubHeartbreakCustom';

const EMPTY = { texts: {}, images: {} };

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalize = (value) => ({
  texts: isPlainObject(value?.texts) ? value.texts : {},
  images: isPlainObject(value?.images) ? value.images : {},
});

export const useHbCustom = () => {
  const [custom, setCustom] = useState(EMPTY);

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.settings.get(HB_CUSTOM_SETTING_KEY)
    ).subscribe({
      next: (setting) => {
        setCustom(normalize(setting?.value));
      },
      error: (error) => {
        console.warn('[HbCustom] 读取自定义装饰失败：', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return custom;
};

// 读出当前值、让调用方改一份拷贝、再整条写回。成功返回 true。
const updateCustom = async (mutate) => {
  try {
    const row = await db.settings.get(HB_CUSTOM_SETTING_KEY);
    const current = normalize(row?.value);
    const next = mutate({
      texts: { ...current.texts },
      images: { ...current.images },
    });
    await db.settings.put({ key: HB_CUSTOM_SETTING_KEY, value: next });
    return true;
  } catch (error) {
    console.warn('[HbCustom] 保存自定义装饰失败：', error);
    return false;
  }
};

// value 为空串或 null：删掉自定义，回到默认文字。
export const setHbCustomText = (id, value) =>
  updateCustom((draft) => {
    if (value) draft.texts[id] = value;
    else delete draft.texts[id];
    return draft;
  });

// dataUrl 为空：删掉自定义，回到占位剪影。
export const setHbCustomImage = (id, dataUrl) =>
  updateCustom((draft) => {
    if (dataUrl) draft.images[id] = dataUrl;
    else delete draft.images[id];
    return draft;
  });

export const resetHbCustom = () => updateCustom(() => ({ texts: {}, images: {} }));

// ---------- 图片：缩小后转成 data URL ----------

const MAX_SIDE = 720;
const MAX_DATA_URL_LENGTH = 800000;
const MIN_SIDE = 360;

const loadImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // 个别格式不支持，退回 <img> 解码。
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('读不了这张图片'));
    };
    image.src = url;
  });
};

// 长边缩到 720 以内；带透明通道的格式保留透明（抠图最好用透明 PNG），
// 其余转 JPEG。结果仍然偏大时继续缩小，避免把设置记录撑得太大。
export const fileToHbImage = async (file, maxSide = MAX_SIDE) => {
  if (!file || !String(file.type).startsWith('image/')) {
    throw new Error('请选择图片文件');
  }

  const source = await loadImage(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) throw new Error('读不了这张图片');

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();

  const keepAlpha = /png|webp|gif|avif/i.test(file.type);
  const dataUrl = canvas.toDataURL(keepAlpha ? 'image/webp' : 'image/jpeg', 0.86);

  if (dataUrl.length > MAX_DATA_URL_LENGTH && maxSide > MIN_SIDE) {
    return fileToHbImage(file, Math.round(maxSide * 0.7));
  }
  return dataUrl;
};

// 给版式里的可编辑组件用：当前自定义内容、是否处于编辑模式、请求编辑。
export const HbCustomContext = createContext({
  editing: false,
  texts: {},
  images: {},
  requestEdit: () => {},
});
// src/apps/hub/useStartupAnimationChoice.js
//
// 首页骰子用的「加载页」选择：读出当前选中的开机动画，并能随机换成另一款
// 当前可用的。读取和保存的方式与 PreloaderSelector.jsx 完全一致——
// 先看 localStorage，没有再看 db.settings 的 preloaderConfig；保存时两处
// 都写（localStorage 是启动时同步读取用的，Dexie 是持久备份）。
//
// 只会在「当前可用」的动画里挑（万圣节限定的只在 10 月可选），并且一定
// 和现在这一款不同；只有一款可用时返回 null，什么也不改。

import { useCallback, useEffect, useRef, useState } from 'react';
import db from '../../db';
import {
  DEFAULT_STARTUP_ANIMATION_ID,
  getStartupAnimationById,
  isAvailableStartupAnimation,
  STARTUP_ANIMATIONS,
  STARTUP_ANIMATION_SETTING_KEY,
  STARTUP_ANIMATION_STORAGE_KEY,
} from '../../config/startupAnimations';

const readStoredId = () => {
  try {
    return window.localStorage.getItem(STARTUP_ANIMATION_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredId = (id) => {
  try {
    window.localStorage.setItem(STARTUP_ANIMATION_STORAGE_KEY, id);
  } catch {
    // localStorage 不可用时，仍会尝试写入 Dexie。
  }
};

export const useStartupAnimationChoice = () => {
  const [selectedId, setSelectedId] = useState(DEFAULT_STARTUP_ANIMATION_ID);
  const selectedRef = useRef(selectedId);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const stored = readStoredId();
      if (stored && isAvailableStartupAnimation(stored)) {
        if (mounted) setSelectedId(stored);
        return;
      }

      try {
        const setting = await db.settings.get(STARTUP_ANIMATION_SETTING_KEY);
        const fromDb = setting?.value?.type;
        if (!isAvailableStartupAnimation(fromDb)) return;
        writeStoredId(fromDb);
        if (mounted) setSelectedId(fromDb);
      } catch (error) {
        console.warn('[StartupAnimation] 读取加载页设置失败：', error);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  // 返回换到的新动画；没得换或保存失败返回 null。
  const roll = useCallback(async () => {
    const pool = STARTUP_ANIMATIONS.filter(
      (animation) => animation.isAvailable && animation.id !== selectedRef.current
    );
    if (pool.length === 0) return null;

    const next = pool[Math.floor(Math.random() * pool.length)];
    writeStoredId(next.id);

    try {
      await db.settings.put({
        key: STARTUP_ANIMATION_SETTING_KEY,
        value: { type: next.id, updatedAt: Date.now() },
      });
    } catch (error) {
      console.warn('[StartupAnimation] 保存加载页设置失败：', error);
      return null;
    }

    selectedRef.current = next.id;
    setSelectedId(next.id);
    return next;
  }, []);

  return { animation: getStartupAnimationById(selectedId), roll };
};

export default useStartupAnimationChoice;
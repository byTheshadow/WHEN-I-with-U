// src/apps/fiction/useFictionReadingPrefs.js
//
// 游玩页的阅读设置：读写 db.settings 里的 fictionReadingPrefs（全局一份），
// 并把字号、行距、阅读主题的变量写到 .fic-root 上。
//
// 变量写在 .fic-root 上而不是某个子元素上，是为了让故事线、回看、总结这些
// 盖在游玩页上面的页面也跟着同一套颜色。离开游玩页（组件卸载）时全部撤掉，
// 书架页和新建向导不受影响。
//
// 滑动字号滑块时会连续触发更新，写库做了 350ms 的防抖，卸载时会补写一次，
// 不会丢最后一次改动。

import { useCallback, useEffect, useRef, useState } from 'react';

import db from '../../db';
import {
  DEFAULT_READING_PREFS,
  READING_PREFS_KEY,
  READING_VAR_NAMES,
  buildReadingVars,
  normalizeReadingPrefs,
} from './fictionReadingThemes';

const SAVE_DELAY_MS = 350;

const useFictionReadingPrefs = () => {
  const [prefs, setPrefs] = useState(DEFAULT_READING_PREFS);
  const [ready, setReady] = useState(false);

  const prefsRef = useRef(DEFAULT_READING_PREFS);
  const timerRef = useRef(null);
  const dirtyRef = useRef(false);

  const persist = useCallback(async () => {
    timerRef.current = null;

    if (!dirtyRef.current) return;

    dirtyRef.current = false;

    try {
      await db.settings.put({ key: READING_PREFS_KEY, value: prefsRef.current });
    } catch (error) {
      console.warn('[Fiction] 保存阅读设置失败：', error);
    }
  }, []);

  // 读取已保存的设置。读完之前不往 .fic-root 上写变量，避免先闪一下默认样式。
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const row = await db.settings.get(READING_PREFS_KEY);

        if (alive && row?.value && !dirtyRef.current) {
          const next = normalizeReadingPrefs(row.value);

          prefsRef.current = next;
          setPrefs(next);
        }
      } catch (error) {
        console.warn('[Fiction] 读取阅读设置失败：', error);
      } finally {
        if (alive) setReady(true);
      }
    };

    void load();

    return () => {
      alive = false;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void persist();
      }
    };
  }, [persist]);

  // 把当前设置写到 .fic-root 上。
  useEffect(() => {
    if (!ready) return;

    const root = document.querySelector('.fic-root');

    if (!root) return;

    READING_VAR_NAMES.forEach((name) => root.style.removeProperty(name));

    Object.entries(buildReadingVars(prefs)).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    root.dataset.ficRead = 'on';
    root.dataset.ficReadTheme = prefs.themeId;
  }, [prefs, ready]);

  // 离开游玩页时撤掉所有变量。
  useEffect(() => () => {
    const root = document.querySelector('.fic-root');

    if (!root) return;

    READING_VAR_NAMES.forEach((name) => root.style.removeProperty(name));
    delete root.dataset.ficRead;
    delete root.dataset.ficReadTheme;
  }, []);

  const update = useCallback((patch) => {
    const next = normalizeReadingPrefs({ ...prefsRef.current, ...patch });

    prefsRef.current = next;
    dirtyRef.current = true;
    setPrefs(next);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(persist, SAVE_DELAY_MS);
  }, [persist]);

  return { prefs, update };
};

export default useFictionReadingPrefs;
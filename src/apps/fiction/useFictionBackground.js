// src/apps/fiction/useFictionBackground.js
//
// 当前存档的上传背景图：进入游玩页时读一行，提供选图、调压暗/模糊、移除。
//
// - 图从 Blob 变成 object URL 给 CSS 用，换图、移除、离开时都会 revoke，不泄漏内存。
// - 选图时在本地压缩（compressImageFile），原图不会存进数据库。
// - 压暗和模糊的滑块会连续触发，写库做了 350ms 防抖，离开时补写一次。
//
// 返回：
//   background  null 或 { url, dim, blur }，给 FictionReadingBg 渲染
//   busy        正在压缩 / 保存
//   error       最近一次选图失败的提示，空字符串表示没有
//   pickImage(file)  选一张图（压缩后保存）
//   update({ dim, blur })  调压暗 / 模糊
//   remove()    移除背景图

import { useCallback, useEffect, useRef, useState } from 'react';

import { compressImageFile } from '../../utils/imageHelper';
import {
  BG_COMPRESS_OPTIONS,
  deleteBackground,
  getBackground,
  normalizeBgLook,
  saveBackgroundImage,
  updateBackgroundLook,
} from './fictionBackground';

const SAVE_DELAY_MS = 350;

const useFictionBackground = (saveId) => {
  const [background, setBackground] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saveIdRef = useRef(saveId);
  const urlRef = useRef('');
  const lookRef = useRef(null);
  const timerRef = useRef(null);
  const dirtyRef = useRef(false);

  saveIdRef.current = saveId;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const revokeUrl = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    }
  };

  // 把数据库里读到的一行（或 null）变成界面上的状态。
  const applyRow = useCallback((row) => {
    revokeUrl();

    if (!row) {
      lookRef.current = null;
      setBackground(null);

      return;
    }

    urlRef.current = URL.createObjectURL(row.blob);
    lookRef.current = normalizeBgLook(row);
    setBackground({ url: urlRef.current, ...lookRef.current });
  }, []);

  // 读取这个存档的背景图；换存档或离开时补写还没落库的压暗/模糊，并释放 URL。
  useEffect(() => {
    let alive = true;

    dirtyRef.current = false;
    lookRef.current = null;
    setBackground(null);
    setError('');

    if (saveId == null) return undefined;

    const load = async () => {
      try {
        const row = await getBackground(saveId);

        if (alive && !dirtyRef.current) applyRow(row);
      } catch (loadError) {
        console.warn('[Fiction] 读取背景图失败：', loadError);
      }
    };

    void load();

    return () => {
      alive = false;
      clearTimer();

      if (dirtyRef.current && lookRef.current) {
        dirtyRef.current = false;
        updateBackgroundLook(saveId, lookRef.current).catch((saveError) => {
          console.warn('[Fiction] 保存背景图设置失败：', saveError);
        });
      }

      revokeUrl();
      lookRef.current = null;
    };
  }, [saveId, applyRow]);

  const persistLook = useCallback(async () => {
    timerRef.current = null;

    if (!dirtyRef.current || !lookRef.current) return;

    dirtyRef.current = false;

    try {
      await updateBackgroundLook(saveIdRef.current, lookRef.current);
    } catch (saveError) {
      console.warn('[Fiction] 保存背景图设置失败：', saveError);
    }
  }, []);

  const update = useCallback((patch) => {
    if (!lookRef.current) return;

    const next = normalizeBgLook({ ...lookRef.current, ...patch });

    lookRef.current = next;
    dirtyRef.current = true;
    setBackground((prev) => (prev ? { ...prev, ...next } : prev));

    clearTimer();
    timerRef.current = setTimeout(persistLook, SAVE_DELAY_MS);
  }, [persistLook]);

  const pickImage = useCallback(async (file) => {
    if (!file || busy) return;

    setBusy(true);
    setError('');

    try {
      const blob = await compressImageFile(file, BG_COMPRESS_OPTIONS);
      const id = saveIdRef.current;

      // 换图时压暗/模糊的待写改动已经包含在这次保存里（saveBackgroundImage 保留原值），
      // 先取消待写的防抖，免得它晚一步把旧值写回去。
      if (dirtyRef.current && lookRef.current) {
        await updateBackgroundLook(id, lookRef.current);
      }

      clearTimer();
      dirtyRef.current = false;

      await saveBackgroundImage(id, blob);
      applyRow(await getBackground(id));
    } catch (pickError) {
      setError(pickError?.message || '背景图设置失败，请换一张图试试。');
    } finally {
      setBusy(false);
    }
  }, [applyRow, busy]);

  const remove = useCallback(async () => {
    clearTimer();
    dirtyRef.current = false;
    setError('');

    try {
      await deleteBackground(saveIdRef.current);
      applyRow(null);
    } catch (removeError) {
      setError(removeError?.message || '移除背景图失败。');
    }
  }, [applyRow]);

  return { background, busy, error, pickImage, update, remove };
};

export default useFictionBackground;
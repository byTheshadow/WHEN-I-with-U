// src/apps/fiction/useFictionLazyImages.js
//
// 游玩页读配图（按需加载版，用来替换 useFictionNodeImages.js）。
// 返回 { imagesByNode, imagesById, ensureUrl }：
//   imagesByNode  Map<节点id, 图[]>，每段里按生成顺序排
//   imagesById    Map<图id, 图>
//   ensureUrl(图id)  读这张图的原图并生成 object URL，返回地址；读不到返回空字符串
//   releaseUrl(图id) 释放这张图已读出的 object URL（滚得很远时由 FictionLazyImage 调用），
//                    这张图回到「idle」，用缩略图占位，滚回来时会重新读
//   pinUrl / unpinUrl(图id)  大图打开期间钉住这张图，钉住的图不会被释放
//
// 和旧版的区别：
//   1. 只查当前剧情路径上那些段落的图记录，不再把整个存档的图记录都读出来。
//   2. 原图 Blob 不在进页面时全读，而是图快滚到屏幕时（FictionLazyImage）才调 ensureUrl，
//      或者点开大图前调一次。没读的时候用生成时存的小缩略图占位。
//
// 每张图是 fictionImages 的一行再加：
//   url       原图地址：已读出的 object URL，或只拿到外链时的外链；没读出时为空字符串
//   urlState  'ready'（url 可用）| 'idle'（有原图但还没读）| 'missing'（原图找不到了）|
//             ''（图还在生成或失败，没有原图）
//
// 图的状态一变（生成中、完成、失败、删除），fictionImageService 会在 window 上发事件，
// 这里收到就重新读记录；已经读出的 object URL 按图 id 缓存，图被删、滚得很远或离开页面时释放。
// 进入游玩页时先把上次被打断、还停在「生成中」的图改成失败（recoverInterruptedImages）。

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';

import db from '../../db';
import {
  FICTION_IMAGE_CHANGED_EVENT,
  FICTION_IMAGE_STATUS,
  getImageBlob,
  recoverInterruptedImages,
} from './fictionImageService';

export const IMAGE_URL_STATE = {
  READY: 'ready',
  IDLE: 'idle',
  MISSING: 'missing',
  NONE: '',
};

// 释放时先让页面换成缩略图，隔一会儿再 revoke，免得图片元素还在用的时候地址就失效。
const REVOKE_DELAY_MS = 1000;

const EMPTY = { imagesByNode: new Map(), imagesById: new Map() };

const useFictionLazyImages = (saveId, path) => {
  const [rows, setRows] = useState([]);
  const [version, setVersion] = useState(0);
  const urlsRef = useRef(new Map());
  const missingRef = useRef(new Set());
  const loadingRef = useRef(new Map());
  const wantedRef = useRef(new Set());
  const pinnedRef = useRef(new Set());
  const tokenRef = useRef(0);
  const aliveRef = useRef(true);
  const nodeIdsRef = useRef([]);

  nodeIdsRef.current = (path || []).map((node) => node.id);

  const nodeKey = nodeIdsRef.current.join(',');

  const releaseAll = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    missingRef.current.clear();
  };

  const refresh = useCallback(async () => {
    if (!saveId) return;

    tokenRef.current += 1;

    const token = tokenRef.current;
    const nodeIds = nodeIdsRef.current;
    let found = [];

    try {
      found = nodeIds.length > 0
        ? await db.fictionImages.where('nodeId').anyOf(nodeIds).toArray()
        : [];
    } catch (error) {
      console.warn('[Fiction] 读取配图失败：', error);
      return;
    }

    if (!aliveRef.current) return;

    // 有更新的一次读取在跑，这一次作废。
    if (token !== tokenRef.current) return;

    const next = found
      .filter((row) => row.saveId === saveId)
      .sort((a, b) => a.id - b.id);

    const keep = new Set(next.map((row) => row.id));

    wantedRef.current = keep;

    urlsRef.current.forEach((url, id) => {
      if (!keep.has(id)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(id);
      }
    });

    missingRef.current.forEach((id) => {
      if (!keep.has(id)) missingRef.current.delete(id);
    });

    setRows(next);
  }, [saveId]);

  // 滚得很远的图：释放已读出的原图地址，图回到「idle」，用缩略图占位。
  const releaseUrl = useCallback((imageId) => {
    if (pinnedRef.current.has(imageId)) return;

    const url = urlsRef.current.get(imageId);

    if (!url) return;

    urlsRef.current.delete(imageId);
    setVersion((value) => value + 1);
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }, []);

  const pinUrl = useCallback((imageId) => {
    pinnedRef.current.add(imageId);
  }, []);

  const unpinUrl = useCallback((imageId) => {
    pinnedRef.current.delete(imageId);
  }, []);

  const ensureUrl = useCallback(async (imageId) => {
    const existing = urlsRef.current.get(imageId);

    if (existing) return existing;
    if (missingRef.current.has(imageId)) return '';

    const running = loadingRef.current.get(imageId);

    if (running) return running;

    const job = (async () => {
      const blob = await getImageBlob(imageId);

      if (!aliveRef.current) return '';

      if (!blob) {
        missingRef.current.add(imageId);
        setVersion((value) => value + 1);

        return '';
      }

      // 读的过程中这张图可能已经被删了，别再给它建地址。
      if (!wantedRef.current.has(imageId)) return '';

      const url = URL.createObjectURL(blob);

      urlsRef.current.set(imageId, url);
      setVersion((value) => value + 1);

      return url;
    })()
      .catch((error) => {
        console.warn('[Fiction] 读取配图原图失败：', error);

        return '';
      })
      .finally(() => loadingRef.current.delete(imageId));

    loadingRef.current.set(imageId, job);

    return job;
  }, []);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      releaseAll();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    recoverInterruptedImages(saveId)
      .catch((error) => console.warn('[Fiction] 处理被中断的配图失败：', error))
      .finally(() => {
        if (!cancelled) void refresh();
      });

    return () => {
      cancelled = true;
    };
  }, [saveId, refresh]);

  useEffect(() => {
    void refresh();
  }, [nodeKey, refresh]);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.saveId === saveId) void refresh();
    };

    window.addEventListener(FICTION_IMAGE_CHANGED_EVENT, handler);

    return () => window.removeEventListener(FICTION_IMAGE_CHANGED_EVENT, handler);
  }, [saveId, refresh]);

  const state = useMemo(() => {
    if (rows.length === 0) return EMPTY;

    const imagesByNode = new Map();
    const imagesById = new Map();

    rows.forEach((row) => {
      let url = '';
      let urlState = IMAGE_URL_STATE.NONE;

      if (row.status === FICTION_IMAGE_STATUS.DONE) {
        if (row.fileId != null) {
          url = urlsRef.current.get(row.id) || '';

          if (url) urlState = IMAGE_URL_STATE.READY;
          else if (missingRef.current.has(row.id)) urlState = IMAGE_URL_STATE.MISSING;
          else urlState = IMAGE_URL_STATE.IDLE;
        } else {
          url = row.remoteUrl || '';
          urlState = url ? IMAGE_URL_STATE.READY : IMAGE_URL_STATE.MISSING;
        }
      }

      const item = { ...row, url, urlState };

      imagesById.set(item.id, item);

      if (!imagesByNode.has(item.nodeId)) imagesByNode.set(item.nodeId, []);

      imagesByNode.get(item.nodeId).push(item);
    });

    return { imagesByNode, imagesById };
    // version 变了说明 urlsRef / missingRef 有变化，需要重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, version]);

  return {
    ...state, ensureUrl, releaseUrl, pinUrl, unpinUrl,
  };
};

export default useFictionLazyImages;
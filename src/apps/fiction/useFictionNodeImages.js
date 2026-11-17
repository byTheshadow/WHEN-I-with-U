// src/apps/fiction/useFictionNodeImages.js
//
// 游玩页读配图：给定存档和当前路径，返回路径上每一段的图。
//   imagesByNode  Map<节点id, 图[]>，每段里按生成顺序排
//   imagesById    Map<图id, 图>，查单张用
// 每张图是 fictionImages 的一行再加一个 url：done 的图是原图的 object URL
// （只拿到外链时是外链；原图丢了就是空字符串），其他状态为空字符串。
//
// 图的状态一变（生成中、完成、失败、删除），fictionImageService 会在 window 上发事件，
// 这里收到就重新读一遍。object URL 按图 id 缓存，重读时不会反复读 Blob，
// 图被删掉或离开页面时释放。
//
// 进入游玩页时先把上次被打断、还停在「生成中」的图改成失败（recoverInterruptedImages）。

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  FICTION_IMAGE_CHANGED_EVENT,
  FICTION_IMAGE_STATUS,
  getImageBlob,
  listImagesBySave,
  recoverInterruptedImages,
} from './fictionImageService';

const EMPTY = { imagesByNode: new Map(), imagesById: new Map() };

const useFictionNodeImages = (saveId, path) => {
  const [state, setState] = useState(EMPTY);
  const urlsRef = useRef(new Map());
  const tokenRef = useRef(0);
  const aliveRef = useRef(true);
  const nodeIdsRef = useRef(new Set());

  nodeIdsRef.current = new Set((path || []).map((node) => node.id));

  const nodeKey = (path || []).map((node) => node.id).join(',');

  const releaseAll = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  };

  const refresh = useCallback(async () => {
    if (!saveId) return;

    tokenRef.current += 1;

    const token = tokenRef.current;
    let rows = [];

    try {
      rows = await listImagesBySave(saveId);
    } catch (error) {
      console.warn('[Fiction] 读取配图失败：', error);
      return;
    }

    const wanted = rows
      .filter((row) => nodeIdsRef.current.has(row.nodeId))
      .sort((a, b) => a.id - b.id);

    const items = [];

    for (const row of wanted) {
      let url = '';

      if (row.status === FICTION_IMAGE_STATUS.DONE) {
        if (row.fileId != null) {
          url = urlsRef.current.get(row.id) || '';

          if (!url) {
            const blob = await getImageBlob(row.id);

            if (blob) {
              url = URL.createObjectURL(blob);
              urlsRef.current.set(row.id, url);
            }
          }
        } else {
          url = row.remoteUrl || '';
        }
      }

      items.push({ ...row, url });
    }

    if (!aliveRef.current) {
      releaseAll();
      return;
    }

    // 有更新的一次读取在跑，这一次作废。
    if (token !== tokenRef.current) return;

    const keep = new Set(items.map((item) => item.id));

    urlsRef.current.forEach((url, id) => {
      if (!keep.has(id)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(id);
      }
    });

    const imagesByNode = new Map();
    const imagesById = new Map();

    items.forEach((item) => {
      imagesById.set(item.id, item);

      if (!imagesByNode.has(item.nodeId)) imagesByNode.set(item.nodeId, []);

      imagesByNode.get(item.nodeId).push(item);
    });

    setState({ imagesByNode, imagesById });
  }, [saveId]);

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

  return state;
};

export default useFictionNodeImages;
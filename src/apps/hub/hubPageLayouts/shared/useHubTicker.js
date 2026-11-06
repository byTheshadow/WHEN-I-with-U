// src/apps/hub/hubPageLayouts/shared/useHubTicker.js
//
// 「新鲜事」跑马灯用的数据：db.backgroundUpdates 里的后台自动更新提醒
// （心情日历、日记、潮汐贝壳、徽章、和好券）。只读订阅，点跑马灯上的条目
// 不会删除任何东西，只有调用 takeAll（对应「全部收下」按钮）才会清空，
// 清空用的是 newThingsService 里已有的 takeAllBackgroundUpdates。

import { useCallback, useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  getBackgroundUpdates,
  takeAllBackgroundUpdates,
} from '../../newThingsService';

export const TICKER_SOURCE_LABEL = {
  mood: '心情日历',
  diary: '小伙伴日记',
  cdiary: '角色日记',
  shell: '潮汐贝壳',
  badge: '徽章',
  coupon: '和好券',
};

export const useHubTicker = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const subscription = liveQuery(() => getBackgroundUpdates()).subscribe({
      next: (list) => setItems(Array.isArray(list) ? list : []),
      error: (error) => {
        console.warn('[HubTicker] 读取新鲜事失败：', error);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const takeAll = useCallback(async () => {
    await takeAllBackgroundUpdates();
  }, []);

  return { items, takeAll };
};

export default useHubTicker;

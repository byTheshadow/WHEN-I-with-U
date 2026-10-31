// src/apps/hub/useHubHomeWidgets.js
//
// 首页小组件实例（db.homeWidgets）的订阅：心碎先生版式用它在「小组件」区
// 显示用户已经贴上的小组件。读写都复用 widgets/homeWidgetsStore.js
// （listHomeWidgets / addHomeWidget / removeHomeWidget / updateHomeWidgetConfig），
// 和经典首页是同一批数据，在任一版式里加的小组件，切换版式后仍然在。
// 用 liveQuery 订阅，增删改之后列表自动刷新。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { listHomeWidgets } from './widgets/homeWidgetsStore';

export const useHubHomeWidgets = () => {
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    const subscription = liveQuery(() => listHomeWidgets()).subscribe({
      next: (list) => setWidgets(list || []),
      error: (error) => {
        console.warn('[HubWidgets] 读取首页小组件失败：', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return widgets;
};

export default useHubHomeWidgets;
// src/apps/hub/useHubPageLayout.js
//
// 读取「整页版式」设置：决定首页整体用哪一种版式渲染。
// 通过 Dexie liveQuery 订阅 db.settings 里的 hubPageLayout 字段，
// 这样在设置页保存之后，首页会自动刷新，不需要额外的状态转发。
// 写法完全对照 useHubHeaderLayout.js。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';
import {
  HUB_PAGE_LAYOUT_CLASSIC,
  isKnownHubPageLayout,
} from './hubPageLayouts/pageLayoutRegistry';

export const HUB_PAGE_LAYOUT_SETTING_KEY = 'hubPageLayout';

export const useHubPageLayout = () => {
  const [layout, setLayout] = useState(HUB_PAGE_LAYOUT_CLASSIC);

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.settings.get(HUB_PAGE_LAYOUT_SETTING_KEY)
    ).subscribe({
      next: (setting) => {
        setLayout(
          isKnownHubPageLayout(setting?.value)
            ? setting.value
            : HUB_PAGE_LAYOUT_CLASSIC
        );
      },
      error: (error) => {
        console.warn('[HubPage] 读取整页版式设置失败：', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return layout;
};

export default useHubPageLayout;
// src/apps/hub/hubPageLayouts/shared/hubLookSettings.js
//
// 整页版式里「应用名称显示」切换用到的选项和写入函数。读取走已有的
// useAppNameDisplayMode（liveQuery 订阅），所以这里写入之后首页会自动刷新。
// 主题故意不在这里：切主题需要 App.jsx 的 setActiveTheme，仍然只在设置页改。

import db from '../../../../db';
import {
  APP_NAME_DISPLAY_SETTING_KEY,
  APP_NAME_DISPLAY_EN,
  APP_NAME_DISPLAY_BILINGUAL,
  APP_NAME_DISPLAY_KOREAN,
} from '../../useAppNameDisplayMode';

export const NAME_MODE_OPTIONS = [
  { id: APP_NAME_DISPLAY_EN, label: 'EN' },
  { id: APP_NAME_DISPLAY_BILINGUAL, label: 'EN + 中' },
  { id: APP_NAME_DISPLAY_KOREAN, label: 'EN + 한' },
];

export const setAppNameDisplayMode = async (mode) => {
  if (!NAME_MODE_OPTIONS.some((option) => option.id === mode)) return;
  try {
    await db.settings.put({ key: APP_NAME_DISPLAY_SETTING_KEY, value: mode });
  } catch (error) {
    console.warn('[HubLayout] 保存应用名称显示模式失败：', error);
  }
};

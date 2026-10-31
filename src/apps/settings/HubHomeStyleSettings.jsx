// src/apps/settings/HubHomeStyleSettings.jsx
//
// 设置页里的「首页整体风格」区块：选整页版式 + 低功耗开关。
// 和头部版式那几个选择器不同，这个组件点了立即保存（直接写
// db.settings），不走设置页底部的「保存」草稿流程，所以接线时
// 只需要在设置页里放一行 <HubHomeStyleSettings />，不用加草稿状态。
// 首页通过 liveQuery 订阅，返回首页就是新样子。

import React, { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';
import HubPageLayoutSettings from './HubPageLayoutSettings';
import {
  HUB_PAGE_LAYOUT_CLASSIC,
  isKnownHubPageLayout,
} from '../hub/hubPageLayouts/pageLayoutRegistry';
import { HUB_PAGE_LAYOUT_SETTING_KEY } from '../hub/useHubPageLayout';
import { useHubLowPower, setHubLowPower } from '../hub/useHubLowPower';

export const HubHomeStyleSettings = () => {
  const [layout, setLayout] = useState(HUB_PAGE_LAYOUT_CLASSIC);
  const lowPower = useHubLowPower();

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
        console.warn('[HubHomeStyle] 读取整页版式失败：', error);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLayoutChange = async (nextLayout) => {
    setLayout(nextLayout);
    try {
      await db.settings.put({
        key: HUB_PAGE_LAYOUT_SETTING_KEY,
        value: nextLayout,
      });
    } catch (error) {
      console.warn('[HubHomeStyle] 保存整页版式失败：', error);
    }
  };

  return (
    <div className="space-y-4">
      <HubPageLayoutSettings value={layout} onChange={handleLayoutChange} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">低功耗模式 (Low Power)</p>
          <p className="mt-1 text-[10px] leading-relaxed opacity-50">
            关闭首页的视差、入场和旋转动画，只保留静态画面。手机发热、卡顿或想省电时打开。
            只影响新版式，经典首页不受影响。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={lowPower}
          onClick={() => setHubLowPower(!lowPower)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            lowPower ? 'bg-black dark:bg-white' : 'bg-black/15 dark:bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all dark:bg-black ${
              lowPower ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default HubHomeStyleSettings;
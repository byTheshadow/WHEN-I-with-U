// src/apps/hub/useHubLowPower.js
//
// 读取「首页低功耗模式」设置：打开后，新版式（心碎先生等）会关掉所有
// 装饰性动效——光晕呼吸、滚动视差、入场动画、发光阴影，只保留静态画面，
// 以减少耗电和发热。默认关闭。
// 通过 Dexie liveQuery 订阅 db.settings 里的 hubLowPowerMode 字段，
// 写法对照 useHubPageLayout.js。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';

export const HUB_LOW_POWER_SETTING_KEY = 'hubLowPowerMode';

export const setHubLowPower = async (enabled) => {
  try {
    await db.settings.put({
      key: HUB_LOW_POWER_SETTING_KEY,
      value: Boolean(enabled),
    });
  } catch (error) {
    console.warn('[HubLowPower] 保存低功耗模式失败：', error);
  }
};

export const useHubLowPower = () => {
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.settings.get(HUB_LOW_POWER_SETTING_KEY)
    ).subscribe({
      next: (setting) => {
        setLowPower(setting?.value === true);
      },
      error: (error) => {
        console.warn('[HubLowPower] 读取低功耗模式失败：', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return lowPower;
};

export default useHubLowPower;
// src/apps/hub/hubPageLayouts/heartbreak/HbElapsed.jsx
//
// 播放器里的「已放了多久」：单独一个小组件自己每秒更新，这样整张版式
// 不会因为计时每秒重新渲染。只在正在放、并且页面在前台时才走表；
// 暂停后显示 0:00。

import React, { useEffect, useState } from 'react';

const format = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const HbElapsed = ({ since }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!since) {
      setSeconds(0);
      return undefined;
    }

    const tick = () => {
      if (document.visibilityState === 'visible') {
        setSeconds(Math.max(0, Math.floor((Date.now() - since) / 1000)));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [since]);

  return <span>{format(seconds)}</span>;
};

export default HbElapsed;
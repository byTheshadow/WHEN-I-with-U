// src/apps/hub/hubPageLayouts/shared/useHubMotion.js
//
// 整页版式用的「动效是否开启」判断：首页低功耗模式（db.settings 的
// hubLowPowerMode）和系统「减少动画」偏好，任意一个打开就关掉装饰性动效。
// 返回：
//   lowPower   首页低功耗模式是否打开
//   reduced    系统「减少动画」偏好
//   motionOn   最终是否允许动效（两者都没开才为 true）

import { useEffect, useState } from 'react';
import { useHubLowPower } from '../../useHubLowPower';

const readReduced = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export const useHubMotion = () => {
  const lowPower = useHubLowPower();
  const [reduced, setReduced] = useState(readReduced);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event) => setReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return { lowPower, reduced, motionOn: !lowPower && !reduced };
};

export default useHubMotion;

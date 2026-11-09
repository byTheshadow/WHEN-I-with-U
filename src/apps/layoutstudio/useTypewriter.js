// src/apps/layoutstudio/useTypewriter.js
//
// 打字机效果：active 为 true 时逐字吐出 text。
//   - text 变了会从头来；
//   - active 变 false 不会清掉已经打出来的字（翻面再翻回来不用重打）；
//   - 系统开了"减少动态效果"时直接一次性显示。

import { useEffect, useMemo, useState } from 'react';

const prefersReducedMotion = () => {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (error) {
    return false;
  }
};

const useTypewriter = (text, { speed = 30, active = true } = {}) => {
  const full = String(text || '');
  const chars = useMemo(() => [...full], [full]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
  }, [full]);

  useEffect(() => {
    if (!active || count >= chars.length) return undefined;
    if (prefersReducedMotion()) {
      setCount(chars.length);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setCount((c) => Math.min(chars.length, c + 1));
    }, speed);
    return () => window.clearTimeout(timer);
  }, [active, count, chars.length, speed]);

  return {
    shown: chars.slice(0, count).join(''),
    typing: active && count < chars.length,
    done: count >= chars.length,
  };
};

export default useTypewriter;

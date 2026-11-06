// src/apps/hub/hubPageLayouts/shared/useHubFonts.js
//
// 整页版式按需加载自己的网络字体：只在版式挂载时往 <head> 里加一个
// <link>，离开版式时移除；离线时字体加载失败，会自动回退到系统字体。
// 写法对照 HeartbreakPageLayout.jsx 里的字体加载。

import { useEffect } from 'react';

export const useHubFonts = (linkId, href) => {
  useEffect(() => {
    if (document.getElementById(linkId)) return undefined;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [linkId, href]);
};

export default useHubFonts;

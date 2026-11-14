// src/apps/fiction/useFictionViewportHeight.js
//
// 手机上弹出键盘时，浏览器不一定会缩小页面的 100dvh（iOS Safari、部分安卓都是），
// 但可视区域其实只剩键盘上面那一截。互动文游整个界面是 overflow: hidden 的，
// 底部抽屉和底栏又是贴着 100dvh 的底边放的，键盘一弹出来，「完成」「保存」
// 就被键盘盖住，页面本身又滑不动，按钮就按不到了。
//
// 这个 hook 读 window.visualViewport，把真正可见的高度和顶部偏移写成两个 CSS 变量：
//   --fic-vh  可见区域高度
//   --fic-vt  可见区域相对布局视口顶部的偏移
// fiction.css 里的 .fic-root 用这两个变量定高，抽屉、底栏跟着缩到键盘上面。
// 浏览器不支持 visualViewport 时不写变量，样式自动退回 100dvh，行为和以前一样。
//
// 另外，聚焦输入框时浏览器会为了露出光标，去滚动祖先里 overflow: hidden 的容器，
// 用户又没法手动把它滚回来。这里在视口变化和失焦时把 .fic-root 的滚动位置复位。

import { useEffect } from 'react';

const VH_VAR = '--fic-vh';
const VT_VAR = '--fic-vt';

const resetRootScroll = () => {
  const root = document.querySelector('.fic-root');

  if (!root) return;

  if (root.scrollTop !== 0) root.scrollTop = 0;
  if (root.scrollLeft !== 0) root.scrollLeft = 0;
};

const useFictionViewportHeight = () => {
  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;

    if (!viewport) return undefined;

    const target = document.documentElement;

    const apply = () => {
      const height = Math.round(viewport.height);

      if (height > 0) {
        target.style.setProperty(VH_VAR, `${height}px`);
        target.style.setProperty(VT_VAR, `${Math.max(0, Math.round(viewport.offsetTop))}px`);
      }

      resetRootScroll();
    };

    apply();

    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    document.addEventListener('focusout', resetRootScroll);

    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
      document.removeEventListener('focusout', resetRootScroll);
      target.style.removeProperty(VH_VAR);
      target.style.removeProperty(VT_VAR);
    };
  }, []);
};

export default useFictionViewportHeight;
// src/apps/hub/hubPageLayouts/heartbreak/useHbMotion.js
//
// 心碎先生版式用到的两个动效 hook，都遵守同一条性能原则：
// 没有常驻的动画循环。视差只在用户真的在滚动时才计算（滚动事件触发，
// 用 requestAnimationFrame 合并成每帧至多一次），停下来就一帧都不再跑；
// 入场动画只在每一屏第一次进入视野时触发一次，之后断开观察。
// 动效关闭（低功耗模式或系统"减少动画"）时，两个 hook 都什么也不做，
// 画面保持静态。

import { useEffect, useState } from 'react';

// 系统「减少动画」偏好。
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event) => setReduced(event.matches);

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return reduced;
};

// 元素距文档顶部的距离，沿 offsetParent 链累加。不用 getBoundingClientRect，
// 因为那个会把视差已经施加的 transform 算进去，量出来的位置会漂。
const absoluteTop = (element) => {
  let top = 0;
  let node = element;

  while (node) {
    top += node.offsetTop;
    node = node.offsetParent;
  }

  return top;
};

// 滚动视差：给带 data-depth（上下偏移系数）和可选 data-slide（左右偏移
// 系数）的元素施加 translate3d，离视口太远的元素直接跳过。
export const useHbParallax = (rootRef, enabled) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return undefined;

    let items = [];
    let ticking = false;
    let rafId = 0;

    const measure = () => {
      items = [...root.querySelectorAll('[data-depth]')].map((element) => ({
        element,
        depth: Number(element.dataset.depth) || 0,
        slide: Number(element.dataset.slide) || 0,
        center: absoluteTop(element) + element.offsetHeight / 2,
        last: '',
      }));
    };

    const apply = () => {
      ticking = false;
      const scrollY = window.scrollY;
      const halfViewport = window.innerHeight / 2;

      for (const item of items) {
        const distance = item.center - scrollY - halfViewport;

        if (Math.abs(distance) > window.innerHeight * 1.5) continue;

        const x = distance * item.slide;
        const y = -distance * item.depth;
        const value = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;

        if (value !== item.last) {
          item.element.style.transform = value;
          item.last = value;
        }
      }
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = requestAnimationFrame(apply);
    };

    measure();
    apply();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', measure);

    // 窗口最小化、字体加载完成等会改变版面高度，重新量一次位置。
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        measure();
        apply();
      });
      resizeObserver.observe(root);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measure();
        apply();
      });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', measure);
      if (resizeObserver) resizeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);

      for (const item of items) {
        item.element.style.transform = '';
      }
    };
  }, [rootRef, enabled]);
};

// 入场动画：每一屏第一次进入视野时加上 hb-in 类，触发一次性的 CSS 动画，
// 然后立刻断开观察。动效关闭时直接把所有屏标成已进入，不播动画。
export const useHbReveal = (rootRef, enabled) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const spreads = [...root.querySelectorAll('.hb-spread')];

    if (!enabled || typeof IntersectionObserver === 'undefined') {
      spreads.forEach((spread) => spread.classList.add('hb-in'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('hb-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    spreads.forEach((spread) => {
      if (!spread.classList.contains('hb-in')) observer.observe(spread);
    });

    return () => observer.disconnect();
  }, [rootRef, enabled]);
};
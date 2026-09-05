import React, { useState, useEffect } from 'react';

// 入场动画的时长（毫秒），需要和 CSS 里 .animate-fade-in-up 的
// animation-duration 保持一致或略大一点，避免动画还没播完就切换
// backdrop-filter 导致视觉上的跳变。
const ENTRANCE_ANIMATION_DURATION_MS = 400;

export const GlassCard = ({
  children,
  className = '',
  onClick = null,
  delay = 0,
  tone = 'light',
}) => {
  const isInk = tone === 'ink';

  /*
   * 性能优化说明：
   *
   * backdrop-filter 本身开销很高，如果在元素做 opacity / transform
   * 动画的同时启用它，浏览器无法把模糊结果缓存成静态图层，必须每一
   * 帧都重新对下层内容做实时模糊采样。首页会同时挂载十几张 GlassCard
   * 并且各自带 animationDelay 错峰入场，这段时间内如果都开着
   * backdrop-filter，会在低端设备上造成明显卡顿。
   *
   * 做法：入场动画期间（delay + 动画时长这段时间内）不启用
   * backdrop-filter，动画结束、卡片静止下来之后再启用。视觉上最终
   * 效果完全不变，只是刚打开页面那一瞬间的过渡方式不同，用户几乎
   * 感知不到。
   */
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSettled(true);
    }, delay + ENTRANCE_ANIMATION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [delay]);

  const blurValue = 'blur(22px) saturate(120%)';

  return (
    <div
      onClick={onClick}
      style={{
        background: isInk ? 'var(--ink-card-bg)' : 'var(--card-bg-gradient)',
        borderColor: isInk
          ? 'var(--ink-card-border)'
          : 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        boxShadow: isInk ? 'var(--ink-card-shadow)' : 'var(--card-shadow)',
        color: isInk ? 'var(--text-on-ink)' : 'var(--text-main)',
        backdropFilter: isSettled ? blurValue : 'none',
        WebkitBackdropFilter: isSettled ? blurValue : 'none',
        animationDelay: `${delay}ms`,
        // 提示浏览器为该元素建立独立合成层，减少 backdrop-filter
        // 启用后与页面其他重绘/重排互相影响的范围。
        willChange: 'transform, opacity',
        transform: 'translateZ(0)',
      }}
      className={`animate-fade-in-up rounded-[2rem] p-5 opacity-0 transition-transform duration-300 ${
        onClick
          ? 'cursor-pointer active:scale-[0.985] sm:hover:-translate-y-0.5'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;

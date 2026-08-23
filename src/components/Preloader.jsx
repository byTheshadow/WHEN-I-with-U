// src/components/Preloader.jsx
import React, { useEffect, useState, useRef } from 'react';
import AstrologyDice from './AstrologyDice';
import { getRandomInspiration } from '../data/dailyInspirations';
import { Sparkles, Camera, Disc, Mail, Layers } from 'lucide-react';

// 1. 占星骰子 (已存的默认动画)
const AstrologyLoader = () => (
  <div className="preloader__dice-wrap flex w-full justify-center">
    <AstrologyDice />
  </div>
);

// 2. 拍立得显影 (占位)
const PolaroidLoader = () => (
  <div className="flex flex-col items-center justify-center p-6 space-y-4">
    <div className="relative flex h-24 w-20 items-center justify-center border-[6px] border-solid border-[var(--text-muted)] bg-[var(--control-soft-bg)] shadow-md rounded-sm animate-pulse">
      <Camera className="h-6 w-6 opacity-40 text-[var(--text-main)]" />
    </div>
    <span className="text-[11px] tracking-widest opacity-60">DEVELOPING MOMENT...</span>
  </div>
);

// 3. 黑胶唱片 (占位)
const VinylLoader = () => (
  <div className="flex flex-col items-center justify-center p-6 space-y-4">
    <div className="flex h-20 w-20 animate-spin items-center justify-center rounded-full border-2 border-dashed border-[var(--text-sub)] bg-[var(--control-soft-bg)]" style={{ animationDuration: '6s' }}>
      <Disc className="h-8 w-8 opacity-50 text-[var(--text-main)]" />
    </div>
    <span className="text-[11px] tracking-widest opacity-60">PLACING STYLUS...</span>
  </div>
);

// 4. 航空信笺 (占位)
const LetterLoader = () => (
  <div className="flex flex-col items-center justify-center p-6 space-y-4">
    <div className="flex h-16 w-24 items-center justify-center border border-[var(--text-muted)] bg-[var(--control-soft-bg)] rounded-md animate-bounce relative">
      <Mail className="h-6 w-6 opacity-40 text-[var(--text-main)]" />
      <div className="absolute right-2 top-2 h-4 w-4 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center text-[6px] text-red-500 opacity-60">POST</div>
    </div>
    <span className="text-[11px] tracking-widest opacity-60">STAMPING HERITAGE...</span>
  </div>
);

// 5. 企鹅小石 (占位)
const PebbleLoader = () => (
  <div className="flex flex-col items-center justify-center p-6 space-y-4">
    <div className="flex items-end gap-1.5 h-16">
      <div className="h-6 w-6 rounded-full bg-[var(--text-muted)] opacity-50 animate-bounce" style={{ animationDelay: '0.1s' }} />
      <div className="h-8 w-8 rounded-full bg-[var(--text-sub)] opacity-70 animate-bounce" style={{ animationDelay: '0.2s' }} />
      <div className="h-5 w-5 rounded-full bg-[var(--text-main)] opacity-90 animate-bounce" style={{ animationDelay: '0s' }} />
    </div>
    <span className="text-[11px] tracking-widest opacity-60">BALANCING PEBBLES...</span>
  </div>
);

// 动画组件路由表
const LOADER_MAP = {
  astrology: { component: AstrologyLoader, label: 'Aligning constellations' },
  polaroid: { component: PolaroidLoader, label: 'Exposing polaroid grain' },
  vinyl: { component: VinylLoader, label: 'Dropping vinyl stylus' },
  letter: { component: LetterLoader, label: 'Folding airmail stationery' },
  pebble: { component: PebbleLoader, label: 'Gathering nest pebbles' }
};

export const Preloader = ({ onFinish, isPreview = false, previewType = null }) => {
  const [quote, setQuote] = useState('');
  const [isFading, setIsFading] = useState(false);
  const [loaderType, setLoaderType] = useState('astrology');

  // 获取当前生效的动画类型
  useEffect(() => {
    if (isPreview && previewType) {
      setLoaderType(previewType);
    } else {
      const saved = localStorage.getItem('preloader_type') || 'astrology';
      setLoaderType(saved);
    }
  }, [isPreview, previewType]);

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    setQuote(getRandomInspiration());

    // 预览模式下时间缩短，方便快速查看
    const displayTime = isPreview ? 2200 : 3600;
    const fadeOutTime = isPreview ? 2700 : 4300;

    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, displayTime);

    const finishTimer = window.setTimeout(() => {
      onFinishRef.current?.();
    }, fadeOutTime);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [isPreview]);

  const ActiveLoader = LOADER_MAP[loaderType]?.component || AstrologyLoader;
  const statusLabel = LOADER_MAP[loaderType]?.label || 'Loading';

  return (
    <div
      onClick={() => onFinishRef.current?.()} // 支持点击跳过
      className={`preloader fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center transition-opacity duration-700 select-none ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-main)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        // 预览状态的层级稍低于完全初始启动，防止层级冲突
        zIndex: isPreview ? 9999 : 100000 
      }}
    >
      <div className="preloader__ambient-glow" aria-hidden="true" />

      <div className="preloader__content relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* 动态渲染用户选中的动画 */}
        <ActiveLoader />

        <div className="preloader__copy mt-6">
          <h2 className="preloader__title">
            WHEN I <span>with U.</span>
          </h2>
          <p className="preloader__quote">“{quote}”</p>
        </div>

        <p className="preloader__status flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 animate-pulse opacity-70" />
          {statusLabel}
        </p>

        {isPreview && (
          <div className="mt-8 text-[10px] uppercase tracking-widest opacity-40 px-3 py-1 border border-dashed border-[var(--text-muted)] rounded-full">
            Preview Mode · Click to Exit
          </div>
        )}
      </div>
    </div>
  );
};

export default Preloader;

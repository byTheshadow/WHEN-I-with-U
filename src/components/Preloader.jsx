// src/components/Preloader.jsx
// src/components/Preloader.jsx

import React, { useEffect, useRef, useState } from 'react';
import AstrologyDice from './AstrologyDice';
import VinylLoader from './VinylLoader';
import PolaroidLoader from './PolaroidLoader';
import LetterLoader from './LetterLoader';
import PebbleLoader from './PebbleLoader';
import RoseLoader from './RoseLoader';
import HalloweenDiceLoader from './HalloweenDiceLoader';
import HalloweenRitualLoader from './HalloweenRitualLoader';
import WinterMirrorLoader from './WinterMirrorLoader';
import {
  getPreloaderQuote,
  getPreloaderQuoteSync,
} from '../services/preloaderQuoteService';

import {
  DEFAULT_STARTUP_ANIMATION_ID,
  isAvailableStartupAnimation,
  STARTUP_ANIMATION_STORAGE_KEY
} from '../config/startupAnimations';

const readStartupAnimationType = () => {
  try {
    const savedType = window.localStorage.getItem(
      STARTUP_ANIMATION_STORAGE_KEY
    );

    if (isAvailableStartupAnimation(savedType)) {
      return savedType;
    }
  } catch {
    // localStorage 不可用时回退到默认加载页。
  }

  return DEFAULT_STARTUP_ANIMATION_ID;
};

const LOADER_MAP = {
  astrology: {
    Component: AstrologyDice,
    status: 'Aligning constellations'
  },
  vinyl: {
    Component: VinylLoader,
    status: 'Headphones connected'
  },
  polaroid: {
    Component: PolaroidLoader,
    status: 'A moment is developing'
  },
  letter: {
    Component: LetterLoader,
    status: 'Opening a private frequency'
  },
  pebble: {
    Component: PebbleLoader,
    status: 'Stones settling into balance'
  },
  rose: {
    Component: RoseLoader,
    status: 'Tending a small rose'
  },
  'halloween-dice': {
    Component: HalloweenDiceLoader,
    status: 'Tumbling a cursed die',
    fullBleed: true
  },
  'halloween-ritual': {
    Component: HalloweenRitualLoader,
    status: 'Waiting out an eclipse',
    fullBleed: true
  },
  // 十一月限定：固定深冬夜背景（浅色主题下也不会变色）；整段动画约 8 秒，
  // 所以单独延长淡出/结束时间，其他加载页仍然是默认的 3600 / 4300。
  'winter-mirror': {
    Component: WinterMirrorLoader,
    status: 'Waiting for the first snow',
    fullBleed: true,
    background: '#0e1620',
    fadeMs: 8200,
    finishMs: 8900
  }
};
export const Preloader = ({ onFinish }) => {
  const [quote, setQuote] = useState(getPreloaderQuoteSync);
  const [isFading, setIsFading] = useState(false);

  /*
    使用 lazy initializer 在首次渲染时同步读取 localStorage。
    不必等待 Dexie，因此不会先显示占星骰子、再闪切成黑胶。
  */
  const [loaderType] = useState(readStartupAnimationType);

  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

useEffect(() => {
  let isMounted = true;

  getPreloaderQuote().then((nextQuote) => {
    if (isMounted && nextQuote) {
      setQuote(nextQuote);
    }
  });

  // 个别加载页（如 11 月限定）动画更长，可在 LOADER_MAP 里用 fadeMs / finishMs 单独延长。
  const timing = LOADER_MAP[loaderType] || LOADER_MAP.astrology;

  const fadeTimer = window.setTimeout(() => {
    setIsFading(true);
  }, timing.fadeMs ?? 3600);

  const finishTimer = window.setTimeout(() => {
    onFinishRef.current?.();
  }, timing.finishMs ?? 4300);

  return () => {
    isMounted = false;
    window.clearTimeout(fadeTimer);
    window.clearTimeout(finishTimer);
  };
}, []);


  const activeLoader = LOADER_MAP[loaderType] || LOADER_MAP.astrology;
  const ActiveLoader = activeLoader.Component;
  const isFullBleed = Boolean(activeLoader.fullBleed);

  return (
    <div
      onClick={() => onFinishRef.current?.()}
      className={`preloader fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center transition-opacity duration-700 select-none ${
        isFullBleed ? 'preloader--fullbleed' : ''
      } ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
               backgroundColor: isFullBleed
          ? (activeLoader.background || '#07030a')
          : 'var(--bg-main)',
        color: isFullBleed ? '#f3f1f4' : 'var(--text-main)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      {/* 全屏限定版加载页自带背景，不需要主题色弥散光斑，避免两层背景互相打架 */}
      {!isFullBleed && <div className="preloader__ambient-glow" aria-hidden="true" />}

      <div className="preloader__content relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="preloader__masthead">
          QUIET FREQUENCY <span>ARCHIVE</span>
        </div>

        <ActiveLoader />

        <div className="preloader__copy">
          <h2 className="preloader__title">
            WHEN I <span>with U.</span>
          </h2>

          <p className="preloader__quote">“{quote}”</p>
        </div>

        <p className="preloader__status">
          {activeLoader.status}
        </p>
      </div>

      {loaderType === 'vinyl' && (
        <div className="preloader__vinyl-edition" aria-hidden="true">
          <span>PRIVATE PRESSING No. 01</span>
          <span>33⅓ RPM</span>
        </div>
      )}
    </div>
  );
};

export default Preloader;

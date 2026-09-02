// src/components/Preloader.jsx
// src/components/Preloader.jsx

import React, { useEffect, useRef, useState } from 'react';
import AstrologyDice from './AstrologyDice';
import VinylLoader from './VinylLoader';
import PolaroidLoader from './PolaroidLoader';
import LetterLoader from './LetterLoader';

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

  const fadeTimer = window.setTimeout(() => {
    setIsFading(true);
  }, 3600);

  const finishTimer = window.setTimeout(() => {
    onFinishRef.current?.();
  }, 4300);

  return () => {
    isMounted = false;
    window.clearTimeout(fadeTimer);
    window.clearTimeout(finishTimer);
  };
}, []);


  const activeLoader = LOADER_MAP[loaderType] || LOADER_MAP.astrology;
  const ActiveLoader = activeLoader.Component;

  return (
    <div
      onClick={() => onFinishRef.current?.()}
      className={`preloader fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center transition-opacity duration-700 select-none ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-main)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="preloader__ambient-glow" aria-hidden="true" />

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

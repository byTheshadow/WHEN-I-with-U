import React, { useEffect, useState, useRef } from 'react';
import AstrologyDice from './AstrologyDice';
import { getRandomInspiration } from '../data/dailyInspirations';

export const Preloader = ({ onFinish }) => {
  const [quote, setQuote] = useState('');
  const [isFading, setIsFading] = useState(false);

  // 使用 ref 锁定 onFinish，防止 App 重渲染导致 useEffect 重置定时器
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    setQuote(getRandomInspiration());

    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, 3600);

    const finishTimer = window.setTimeout(() => {
      onFinishRef.current?.();
    }, 4300);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, []); // 空依赖数组，确保在手机端只运行一次计时

  return (
    <div
      onClick={() => onFinishRef.current?.()} // 支持手机端点击快速跳过
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
        <div className="preloader__dice-wrap flex w-full justify-center">
          <AstrologyDice />
        </div>

        <div className="preloader__copy">
          <h2 className="preloader__title">
            WHEN I <span>with U.</span>
          </h2>

          <p className="preloader__quote">“{quote}”</p>
        </div>

        <p className="preloader__status">Aligning constellations</p>
      </div>
    </div>
  );
};

export default Preloader;

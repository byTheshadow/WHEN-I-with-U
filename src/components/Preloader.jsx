import React, { useState, useEffect } from 'react';
import AstrologyDice from './AstrologyDice';
import { getRandomInspiration } from '../data/dailyInspirations';

export const Preloader = ({ onFinish }) => {
  const [quote, setQuote] = useState('');
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    setQuote(getRandomInspiration());
    // 3.6秒后开始淡出，4.2秒销毁
    const fadeTimer = setTimeout(() => setIsFading(true), 3600);
    const finishTimer = setTimeout(() => onFinish && onFinish(), 4300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-700 backdrop-blur-2xl ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-main)'
      }}
    >
      {/* 弥散柔光 */}
      <div
        className="absolute w-72 h-72 rounded-full blur-[100px] opacity-30"
        style={{ backgroundColor: 'var(--bg-blob-1)' }}
      />

      <div className="relative z-10 space-y-8 max-w-xs mx-auto">
        {/* 甩落翻滚骰子 */}
        <div className="flex justify-center py-4">
          <AstrologyDice />
        </div>

        {/* 治愈诗句与标题 */}
        <div className="space-y-3">
          <h2 className="font-serif text-3xl tracking-tighter font-semibold">
            WHEN I <span className="opacity-40 italic font-normal">with U.</span>
          </h2>
          <p className="text-xs font-serif italic opacity-75 leading-relaxed px-4">
            "{quote}"
          </p>
        </div>

        <div className="text-[10px] uppercase tracking-widest opacity-40 font-mono">
          Aligning constellations...
        </div>
      </div>
    </div>
  );
};

export default Preloader;


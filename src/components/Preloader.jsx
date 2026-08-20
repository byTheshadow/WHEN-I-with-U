import React, { useState, useEffect } from 'react';
import { getRandomQuote } from '../data/quotes';

export const Preloader = ({ onFinish }) => {
  const [quote] = useState(() => getRandomQuote());
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // 3.4 秒后开始淡出
    const fadeTimer = setTimeout(() => setIsFading(true), 3400);
    // 4.0 秒后销毁
    const finishTimer = setTimeout(() => onFinish && onFinish(), 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 transition-opacity duration-700 select-none ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      {/* 弥散光 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] opacity-60"
          style={{ backgroundColor: 'var(--bg-blob-1)' }}
        />
      </div>

      {/* 占星 3D 甩落骰子 (SVG 矢量刻面) */}
      <div className="relative z-10 animate-dice-roll mb-8">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl border backdrop-blur-md"
          style={{
            backgroundColor: 'var(--dice-bg)',
            borderColor: 'var(--dice-border)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.06)'
          }}
        >
          {/* 占星 12 芒星/骰子线框 SVG */}
          <svg className="w-10 h-10 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      </div>

      {/* 文字展示 */}
      <div className="relative z-10 text-center space-y-4 max-w-xs animate-fade-in-up">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          WHEN I with U
        </h1>
        <div className="w-8 h-[1px] mx-auto opacity-30 bg-current" />
        <p className="text-xs font-serif italic leading-relaxed opacity-75 px-2">
          "{quote}"
        </p>
      </div>
    </div>
  );
};

export default Preloader;


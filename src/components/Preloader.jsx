import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

export const Preloader = ({ onFinish }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // 翻牌动画触发
    const flipTimer = setTimeout(() => setIsFlipped(true), 400);
    // 开始淡出
    const fadeTimer = setTimeout(() => setIsFading(true), 2000);
    // 彻底销毁组件
    const finishTimer = setTimeout(() => onFinish && onFinish(), 2600);

    return () => {
      clearTimeout(flipTimer);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 bg-slate-950 text-white ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 3D 塔罗牌容器 */}
      <div className="w-56 h-80 perspective-1000 cursor-pointer">
        <div
          className={`w-full h-full relative transition-transform duration-1000 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* 牌背面 */}
          <div
            className="absolute inset-0 rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 shadow-2xl"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-16 h-24 border border-slate-700 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-slate-500 animate-pulse" />
            </div>
          </div>

          {/* 牌正面 */}
          <div
            className="absolute inset-0 rounded-3xl border border-rose-300/30 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-between p-6 shadow-2xl text-center"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="text-[10px] tracking-widest uppercase text-rose-300 font-mono">
              Tarot of the Day
            </div>
            
            <div className="space-y-2">
              <Sparkles className="w-8 h-8 text-rose-300 mx-auto" />
              <h2 className="text-xl font-serif tracking-tight text-slate-100">
                WHEN I with U
              </h2>
              <p className="text-xs text-slate-400 font-serif italic">
                "In your presence, time finds its softest rhythm."
              </p>
            </div>

            <div className="text-[9px] text-slate-500 uppercase tracking-widest">
              Tap to enter
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preloader;

import React, { useState, useEffect } from 'react';
import { SvgIcon } from './SvgIcon';

export const Preloader = ({ onFinish }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // 1. 发光并翻牌
    const flipTimer = setTimeout(() => setIsFlipped(true), 600);
    // 2. 渐隐解开
    const fadeTimer = setTimeout(() => setIsFading(true), 2400);
    // 3. 彻底卸载开屏
    const endTimer = setTimeout(() => onFinish && onFinish(), 3000);

    return () => {
      clearTimeout(flipTimer);
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0c] transition-opacity duration-700 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 3D 塔罗牌容器 */}
      <div className="w-56 h-88 [perspective:1000px] mb-8">
        <div
          className={`relative w-full h-full duration-1000 [transform-style:preserve-3d] transition-transform ${
            isFlipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* 卡牌背面 */}
          <div className="absolute inset-0 w-full h-full rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 to-slate-900 flex flex-col items-center justify-center [backface-visibility:hidden] shadow-[0_0_50px_rgba(139,92,246,0.3)]">
            <SvgIcon name="sparkles" className="w-12 h-12 text-purple-400 animate-pulse" />
            <div className="mt-4 text-xs tracking-widest text-purple-300 uppercase font-light">
              WHEN I WITH U
            </div>
          </div>

          {/* 卡牌正面 (星盘 / 启发) */}
          <div className="absolute inset-0 w-full h-full rounded-2xl border border-purple-400/40 bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-950 flex flex-col items-center justify-between p-6 [transform:rotateY(180deg)] [backface-visibility:hidden] shadow-[0_0_60px_rgba(168,85,247,0.4)]">
            <div className="w-full flex justify-between items-center text-[10px] text-purple-400 tracking-widest uppercase">
              <span>XVII</span>
              <span>THE STAR</span>
            </div>
            
            <div className="flex flex-col items-center my-auto text-center">
              <div className="w-16 h-16 rounded-full border border-purple-400/30 flex items-center justify-center mb-4 bg-purple-500/10">
                <SvgIcon name="sparkles" className="w-8 h-8 text-purple-300" />
              </div>
              <p className="text-xs text-purple-200 leading-relaxed font-light px-2">
                "每束穿透云层的光，都在记录我们此刻的交汇。"
              </p>
            </div>

            <div className="text-[10px] text-purple-400/60 tracking-wider">
              DIGITAL COMPANION
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-sm font-medium text-slate-300 tracking-widest uppercase mb-1">
          WHEN I with U
        </h2>
        <p className="text-xs text-slate-500">正在载入专属数字领地...</p>
      </div>
    </div>
  );
};

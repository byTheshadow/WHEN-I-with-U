import React from 'react';
import { Sparkles, Moon, Sun, Star, Compass } from 'lucide-react';

export const AstrologyDice = () => {
  return (
    <div className="w-24 h-24 relative flex items-center justify-center animate-dice-roll">
      {/* 3D 占星骰子实体 */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-slate-800 dark:via-slate-900 dark:to-black border border-white/60 dark:border-slate-700/60 shadow-2xl flex items-center justify-center relative overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-0 bg-white/20 dark:bg-white/5 backdrop-blur-sm" />
        {/* 骰子面的古老刻符与图标 */}
        <div className="relative z-10 flex flex-col items-center justify-center text-slate-800 dark:text-slate-200 space-y-1">
          <Moon className="w-5 h-5 opacity-90 stroke-[1.5]" />
          <div className="flex gap-1 text-[8px] font-mono tracking-widest opacity-60">
            <span>✦</span>
            <span>XII</span>
          </div>
        </div>
        {/* 边缘拟真边缘光泽 */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      </div>
    </div>
  );
};

export default AstrologyDice;

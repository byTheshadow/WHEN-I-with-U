import React, { useState, useEffect } from 'react';
import { Volume2, Play, Pause } from 'lucide-react';

export const VoiceCard = ({ content, metadata = {} }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayedText, setDisplayedText] = useState('');

  const fullText = content || '“这一刻的风，替我把心声带给你。”';

  // 播放时文字逐字渐显动画 (Fix Bug #8)
  useEffect(() => {
    let timer;
    if (isPlaying) {
      setDisplayedText('');
      let idx = 0;
      timer = setInterval(() => {
        if (idx <= fullText.length) {
          setDisplayedText(fullText.slice(0, idx));
          idx++;
        } else {
          clearInterval(timer);
        }
      }, 90);
    } else {
      setDisplayedText(fullText);
    }
    return () => clearInterval(timer);
  }, [isPlaying, fullText]);

  return (
    <div className="space-y-2 min-w-[180px]">
      <div 
        onClick={() => setIsPlaying(!isPlaying)}
        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-all active:scale-98"
        style={{
          background: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)'
        }}
      >
        <button type="button" className="p-1.5 rounded-full bg-black/10 dark:bg-white/10">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* 动态音波 */}
        <div className="flex items-center gap-1 flex-1">
          {[40, 70, 30, 90, 50, 80, 40].map((h, i) => (
            <span
              key={i}
              className={`w-0.5 rounded-full bg-current transition-all duration-300 ${
                isPlaying ? 'animate-pulse' : 'opacity-40'
              }`}
              style={{ height: isPlaying ? `${Math.max(15, (h * Math.random()).toFixed(0))}px` : `${h * 0.2}px` }}
            />
          ))}
        </div>

        <span className="text-[10px] font-mono opacity-60">{metadata.duration || "0'05\""}</span>
      </div>

      {/* 渐显文字 */}
      <p className="text-xs italic opacity-90 font-serif leading-relaxed px-1 transition-all">
        {displayedText}
      </p>
    </div>
  );
};

export default VoiceCard;

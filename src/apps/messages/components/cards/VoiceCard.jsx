import React, { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export const VoiceCard = ({ content, metadata = {} }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayedText, setDisplayedText] = useState('');

  const fullText = content || '这一刻的风，替我把心声带给你。';

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
      }, 100);
    } else {
      setDisplayedText('');
    }
    return () => clearInterval(timer);
  }, [isPlaying, fullText]);

  // 固定的音波柱高度数组，避免 Math.random 导致打字时跳动
  const staticHeights = [12, 22, 10, 26, 16, 24, 12];

  return (
    <div className="space-y-2 min-w-[170px]">
      <div 
        onClick={() => setIsPlaying(!isPlaying)}
        className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer border transition-all active:scale-95 shadow-sm"
        style={{
          background: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)'
        }}
      >
        <button type="button" className="p-2 rounded-full bg-black/10 dark:bg-white/10 shrink-0">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* 静态/播放音波柱 */}
        <div className="flex items-center gap-1 flex-1 h-6">
          {staticHeights.map((h, i) => (
            <span
              key={i}
              className={`w-0.5 rounded-full bg-current transition-all duration-300 ${
                isPlaying ? 'animate-pulse' : 'opacity-30'
              }`}
              style={{ 
                height: `${h}px`,
                animationDelay: isPlaying ? `${i * 0.15}s` : '0s'
              }}
            />
          ))}
        </div>

        <span className="text-[10px] font-mono opacity-60">{metadata.duration || "0'05\""}</span>
      </div>

      {/* 没播放时不占用空间，点击播放后渐显 */}
      {isPlaying && (
        <p className="text-xs italic opacity-90 font-serif leading-relaxed px-1 animate-fade-in-up">
          {displayedText}
        </p>
      )}
    </div>
  );
};

export default VoiceCard;

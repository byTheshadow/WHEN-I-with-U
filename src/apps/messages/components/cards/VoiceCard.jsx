import React, { useState, useEffect } from 'react';
import { Volume2, Play, Pause } from 'lucide-react';

export const VoiceCard = ({ content = '', metadata = {} }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const duration = metadata?.duration || 5;

  useEffect(() => {
    let timer;
    if (isPlaying) {
      setDisplayedText('');
      let index = 0;
      const stepTime = (duration * 1000) / Math.max(content.length, 1);
      
      timer = setInterval(() => {
        if (index < content.length) {
          setDisplayedText((prev) => prev + content[index]);
          index++;
        } else {
          setIsPlaying(false);
          clearInterval(timer);
        }
      }, Math.max(stepTime, 50));
    }
    return () => clearInterval(timer);
  }, [isPlaying, content, duration]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-2 min-w-[200px] max-w-[260px]">
      <div 
        onClick={togglePlay}
        className="flex items-center gap-3 p-3 rounded-2xl border border-white/20 bg-black/5 dark:bg-white/5 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
      >
        <button type="button" className="p-2 rounded-full bg-black/10 dark:bg-white/10">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        {/* 矢量波形线段 (无 Emoji) */}
        <div className="flex-1 flex items-center gap-1 h-5 overflow-hidden">
          {[40, 70, 30, 90, 50, 100, 60, 30, 80, 40, 60, 30].map((h, idx) => (
            <div
              key={idx}
              className={`w-0.5 rounded-full transition-all duration-300 ${
                isPlaying ? 'bg-black dark:bg-white animate-pulse' : 'bg-black/30 dark:bg-white/30'
              }`}
              style={{
                height: `${h}%`,
                animationDelay: isPlaying ? `${(idx % 4) * 0.15}s` : '0s'
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono opacity-50 shrink-0">
          <Volume2 className="w-3 h-3" />
          <span>{duration}"</span>
        </div>
      </div>

      {(isPlaying || displayedText) && (
        <div className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] leading-relaxed italic opacity-80 border border-white/10 animate-fade-in-up">
          {displayedText || content}
        </div>
      )}
    </div>
  );
};

export default VoiceCard;

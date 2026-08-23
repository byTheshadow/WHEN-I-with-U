import React from 'react';
import { Sparkles, Heart, Zap, Cat } from 'lucide-react';

/**
 * 可爱风格打字指示器组件 (ImaginariumCuteTypingIndicator)
 * 严格遵循 0 Emoji 规范，使用 lucide-react 矢量图标与 CSS 动效
 */
export const ImaginariumCuteTypingIndicator = ({ activeSpeakerName, activeSpeakerAvatar, styleMode = 'paw', onToggleStyle }) => {
  return (
    <div
      onClick={onToggleStyle}
      title="点击切换打字指示器美化风格"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl cursor-pointer select-none transition-all duration-300 shadow-sm border backdrop-blur-md animate-fade-in"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 border" style={{ borderColor: 'var(--card-border)' }}>
        {activeSpeakerAvatar ? (
          <img src={activeSpeakerAvatar} alt="Thinking" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-bold text-[9px]" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
            {activeSpeakerName?.[0] || 'AI'}
          </div>
        )}
      </div>

      <span className="text-[11px] font-medium opacity-80 truncate max-w-[90px]">
        {activeSpeakerName || '沙龙成员'} 正在打字
      </span>

      {/* 4 种动效呈现 */}
      <div className="flex items-center gap-1 pl-1">
        {styleMode === 'paw' && (
          <div className="flex items-center gap-1 text-[var(--accent-color)]">
            <Cat className="w-3.5 h-3.5 animate-bounce" />
            <span className="w-1 h-1 rounded-full bg-[var(--accent-color)] animate-ping" />
          </div>
        )}

        {styleMode === 'sparkle' && (
          <div className="flex items-center gap-1 text-amber-400">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          </div>
        )}

        {styleMode === 'jelly' && (
          <div className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce delay-75" />
          </div>
        )}

        {styleMode === 'gem' && (
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <div className="w-2 h-2 rotate-45 border border-[var(--accent-color)] animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImaginariumCuteTypingIndicator;

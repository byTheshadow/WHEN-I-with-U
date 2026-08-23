import React, { useState } from 'react';
import { Sparkles, Heart, Zap, Cat } from 'lucide-react';

/**
 * 可爱风格打字指示器组件 (ImaginariumCuteTypingIndicator)
 * 支持用户在线切换美化样式 (paw / gem / sparkle / jelly)
 */
export const ImaginariumCuteTypingIndicator = ({ activeSpeakerName, activeSpeakerAvatar }) => {
  // 可选样式: 'paw' (猫爪拍打), 'sparkle' (闪烁星光), 'gem' (晶石律动), 'jelly' (果冻波浪)
  const [styleMode, setStyleMode] = useState('paw');

  const modes = [
    { id: 'paw', label: '🐱 猫爪', icon: Cat },
    { id: 'sparkle', label: '✨ 星光', icon: Sparkles },
    { id: 'jelly', label: '💖 柔粉', icon: Heart },
    { id: 'gem', label: '⚡ 晶石', icon: Zap }
  ];

  const handleNextMode = (e) => {
    e.stopPropagation();
    const currentIndex = modes.findIndex((m) => m.id === styleMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setStyleMode(modes[nextIndex].id);
  };

  return (
    <div
      onClick={handleNextMode}
      title="点击切换打字指示器美化风格"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl cursor-pointer select-none transition-all duration-300 shadow-sm border backdrop-blur-md animate-fade-in"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      {/* 发言角色头像或默认指示图 */}
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
        {activeSpeakerName || '成员'} 正在打字
      </span>

      {/* 4 种可爱动效渲染 */}
      <div className="flex items-center gap-1 pl-1">
        {styleMode === 'paw' && (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="animate-bounce delay-0 opacity-90">🐾</span>
            <span className="animate-bounce delay-150 opacity-70">🐾</span>
            <span className="animate-bounce delay-300 opacity-50">🐾</span>
          </div>
        )}

        {styleMode === 'sparkle' && (
          <div className="flex items-center gap-1 text-amber-400">
            <Sparkles className="w-3 h-3 animate-spin" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          </div>
        )}

        {styleMode === 'jelly' && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce delay-75" />
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce delay-150" />
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce delay-300" />
          </div>
        )}

        {styleMode === 'gem' && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rotate-45 border border-[var(--accent-color)] animate-pulse" />
            <div className="w-2 h-2 rotate-45 bg-[var(--accent-color)] animate-ping" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImaginariumCuteTypingIndicator;

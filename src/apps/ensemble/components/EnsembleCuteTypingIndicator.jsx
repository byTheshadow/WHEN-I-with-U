import React from 'react';
import { Cat, Sparkles, Heart, Zap } from 'lucide-react';

export const EnsembleCuteTypingIndicator = ({ charName = 'AI 角色', styleType = 'paw' }) => {
  const renderIcon = () => {
    switch (styleType) {
      case 'sparkle':
        return <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />;
      case 'heart':
        return <Heart className="w-3.5 h-3.5 animate-bounce text-rose-400" />;
      case 'gem':
        return <Zap className="w-3.5 h-3.5 animate-pulse text-indigo-400" />;
      case 'paw':
      default:
        return <Cat className="w-3.5 h-3.5 animate-bounce text-emerald-400" />;
    }
  };

  return (
    <div className="flex items-center gap-2 my-2 px-1 animate-fade-in">
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border shadow-sm"
        style={{
          backgroundColor: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-sub)'
        }}
      >
        {renderIcon()}
        <span className="font-medium text-[11px]">{charName} 正在对答...</span>
        <div className="flex items-center gap-1 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping opacity-70" />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping opacity-70 delay-150" />
        </div>
      </div>
    </div>
  );
};

export default EnsembleCuteTypingIndicator;

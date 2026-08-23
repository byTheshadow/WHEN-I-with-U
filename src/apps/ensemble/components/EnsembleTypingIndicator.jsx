import React from 'react';
import { Sparkles, MessageSquare, Cat, Zap } from 'lucide-react';

export const EnsembleTypingIndicator = ({ characterName = '' }) => {
  return (
    <div className="flex items-center gap-2 my-2 px-3 py-1.5 rounded-full w-fit text-xs animate-pulse border shadow-sm"
      style={{
        backgroundColor: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-sub)'
      }}
    >
      <Cat className="w-3.5 h-3.5 animate-bounce" />
      <span className="font-medium text-[11px]">
        {characterName ? `${characterName} 正在执笔构思...` : 'AI 角色正在回应...'}
      </span>
      <Sparkles className="w-3 h-3 opacity-60" />
    </div>
  );
};

export default EnsembleTypingIndicator;

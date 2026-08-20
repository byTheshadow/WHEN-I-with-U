import React from 'react';
import { Sparkles } from 'lucide-react';

export const TypingIndicator = ({ customText = '正在提笔回复...' }) => {
  return (
    <div 
      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border w-fit text-xs opacity-80 animate-fade-in-up shadow-sm"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
      <span className="font-serif italic text-[11px] tracking-wide">{customText}</span>
      <div className="flex items-center gap-1 ml-1">
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" style={{ animationDelay: '0s' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" style={{ animationDelay: '0.2s' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
};

export default TypingIndicator;

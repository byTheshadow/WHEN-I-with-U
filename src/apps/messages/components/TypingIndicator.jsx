import React from 'react';
import { Loader2 } from 'lucide-react';

export const TypingIndicator = ({ customText = 'Elena is writing...' }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 w-fit text-xs opacity-70 animate-fade-in-up">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span className="font-mono text-[11px] tracking-wide">{customText}</span>
      <div className="flex items-center gap-0.5 ml-1">
        <span className="w-1 h-1 rounded-full bg-current animate-ping" style={{ animationDelay: '0s' }} />
        <span className="w-1 h-1 rounded-full bg-current animate-ping" style={{ animationDelay: '0.2s' }} />
        <span className="w-1 h-1 rounded-full bg-current animate-ping" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
};

export default TypingIndicator;

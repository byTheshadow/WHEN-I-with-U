import React from 'react';
import { Loader2 } from 'lucide-react';

export const TypingIndicator = ({ customText = '正在提笔回复...' }) => {
  return (
    <div
      className="w-fit max-w-[86%] px-3.5 py-2 rounded-[1.35rem] border shadow-sm animate-fade-in-up"
      style={{
        background: 'var(--card-bg-gradient)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Loader2
          className="w-3.5 h-3.5 shrink-0 animate-spin"
          style={{ color: 'var(--text-muted)' }}
        />
        <span className="text-[11px] leading-none tracking-wide truncate opacity-80 font-medium">
          {customText}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;


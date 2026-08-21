import React from 'react';
import { Sparkles } from 'lucide-react';

export const TypingIndicator = ({ customText = '正在提笔回复...' }) => {
  return (
    <div className="w-fit max-w-[88%]">
      <div
        className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
        style={{
          background: 'var(--card-bg-gradient)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-full blur-md opacity-50 animate-pulse"
              style={{ background: 'var(--accent-color)' }}
            />
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-full border"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--divider)'
              }}
            >
              <Sparkles
                className="w-4 h-4 animate-[pulse_1.8s_ease-in-out_infinite]"
                style={{ color: 'var(--accent-color)' }}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide opacity-90">
                {customText}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
                style={{
                  background: 'var(--accent-color)',
                  animationDelay: '0s'
                }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
                style={{
                  background: 'var(--accent-color)',
                  animationDelay: '0.18s'
                }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
                style={{
                  background: 'var(--accent-color)',
                  animationDelay: '0.36s'
                }}
              />
              <span
                className="ml-1 text-[10px] font-mono uppercase tracking-[0.22em] opacity-45"
                style={{ color: 'var(--text-muted)' }}
              >
                typing
              </span>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--accent-color) 50%, transparent 100%)'
          }}
        />
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          40% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;


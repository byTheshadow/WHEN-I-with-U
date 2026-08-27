import React from 'react';
import { Disc3 } from 'lucide-react';

export const KeepAliveIndicator = ({
  isVisible = false,
  onClick
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed right-4 z-50"
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-transform duration-200 active:scale-90"
        style={{
          color: 'var(--accent-foreground)',
          backgroundColor: 'var(--accent-color)',
          borderColor: 'var(--card-border)',
          boxShadow:
            '0 10px 28px color-mix(in srgb, var(--accent-color) 28%, transparent)'
        }}
        aria-label="后台音频保活正在运行，前往消息页面管理"
        title="后台音频保活正在运行"
      >
        <span
          className="absolute inset-1 rounded-full border opacity-30"
          style={{ borderColor: 'var(--accent-foreground)' }}
        />

        <Disc3
          className="h-5 w-5 animate-[spin_8s_linear_infinite]"
          strokeWidth={1.5}
        />

        <span
          className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--accent-color)'
          }}
        />
      </button>
    </div>
  );
};

export default KeepAliveIndicator;

import React from 'react';
import { Sparkles, PhoneCall, PenTool, Activity, Radio } from 'lucide-react';

// 1. 默认样式 (保持您原有的高审美 Sparkles + 律动三小点设计)
const DefaultTyping = ({ text }) => (
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
            {text}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent-color)', animationDelay: '0s' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent-color)', animationDelay: '0.18s' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-[typingDot_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent-color)', animationDelay: '0.36s' }}
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
);

// 2. 新增：模拟打电话 / 通话呼叫中 (Phone Call Indicator)
const PhoneCallTyping = ({ text }) => (
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
          className="absolute inset-0 rounded-full blur-md opacity-40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"
          style={{ background: 'var(--accent-color)' }}
        />
        <div
          className="relative flex h-8 w-8 items-center justify-center rounded-full border animate-[bounce_2s_infinite]"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--divider)'
          }}
        >
          <PhoneCall
            className="w-4 h-4"
            style={{ color: 'var(--accent-color)' }}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide opacity-90">
            {text || '正在拨通电话...'}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] opacity-60">
          <Radio className="w-3 h-3 animate-spin" style={{ color: 'var(--accent-color)' }} />
          <span className="tracking-widest">CALLING...</span>
        </div>
      </div>
    </div>
  </div>
);

// 3. 新增：诗意打字机 (Typewriter)
const TypewriterTyping = ({ text }) => (
  <div
    className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)'
    }}
  >
    <div className="relative flex items-center gap-3 px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
        style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
      >
        <PenTool className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent-color)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium opacity-90">{text || '正在斟酌字句...'}</span>
        <div className="mt-1 flex items-center gap-1">
          <span className="h-0.5 w-3 rounded-full animate-pulse" style={{ background: 'var(--accent-color)' }} />
          <span className="text-[9px] font-mono opacity-50 uppercase">Writing...</span>
        </div>
      </div>
    </div>
  </div>
);

// 4. 新增：柔和音波律动 (Wave Pulse)
const WavePulseTyping = ({ text }) => (
  <div
    className="relative overflow-hidden rounded-[1.6rem] border shadow-sm animate-fade-in-up"
    style={{
      background: 'var(--card-bg-gradient)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)'
    }}
  >
    <div className="relative flex items-center gap-3 px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
        style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
      >
        <Activity className="w-4 h-4 animate-pulse" style={{ color: 'var(--accent-color)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium opacity-90">{text}</span>
        <div className="mt-1.5 flex items-end gap-1 h-2">
          <span className="w-1 bg-[var(--accent-color)] rounded-full animate-[wave_1s_ease-in-out_infinite_0s] h-full" />
          <span className="w-1 bg-[var(--accent-color)] rounded-full animate-[wave_1s_ease-in-out_infinite_0.2s] h-2/3" />
          <span className="w-1 bg-[var(--accent-color)] rounded-full animate-[wave_1s_ease-in-out_infinite_0.4s] h-full" />
        </div>
      </div>
    </div>
  </div>
);

// 注册中心：方便后续您无限追加新的动画类型
const INDICATOR_REGISTRY = {
  default: DefaultTyping,
  phone_call: PhoneCallTyping,
  typewriter: TypewriterTyping,
  wave_pulse: WavePulseTyping
};

export const TypingIndicator = ({ customText = '正在提笔回复...', styleType = 'default' }) => {
  const Component = INDICATOR_REGISTRY[styleType] || INDICATOR_REGISTRY.default;

  return (
    <div className="w-fit max-w-[88%]">
      <Component text={customText} />

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
        @keyframes wave {
          0%, 100% { height: 30%; opacity: 0.4; }
          50% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;


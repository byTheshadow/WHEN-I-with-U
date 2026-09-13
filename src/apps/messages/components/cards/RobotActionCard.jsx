import React from 'react';

// 可爱软萌的小机器人简笔微标（纯 SVG，无 Emoji，透气圆润）
const CuteRobotIcon = ({ type }) => {
  if (type === 'touch') {
    // 互动心跳微波
    return (
      <div className="relative flex items-center justify-center w-8 h-8 rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-400">
        <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping opacity-60" />
        <svg className="w-4 h-4 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>
    );
  }

  if (type === 'audio' || type === 'audio_stop') {
    // 律动声波
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-2xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" />
          <path d="M8 8v8" />
          <path d="M16 6v12" />
          <path d="M4 11v2" />
          <path d="M20 10v4" />
        </svg>
      </div>
    );
  }

  // 默认动作联动：可爱机器人头像（两只圆圆眼睛眨呀眨）
  return (
    <div className="relative flex items-center justify-center w-8 h-8 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* 天线 */}
        <circle cx="12" cy="4" r="1" />
        <path d="M12 5v3" />
        {/* 软萌圆脸 */}
        <rect x="4" y="8" width="16" height="12" rx="4" />
        {/* 萌眼 */}
        <circle cx="9" cy="13" r="1" fill="currentColor" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
        {/* 微微一笑 */}
        <path d="M10 16c.8.6 1.6.6 2.4 0" strokeWidth="1.6" />
      </svg>
    </div>
  );
};

export default function RobotActionCard({ card }) {
  if (!card) return null;
  const { actionType, label, detail, status } = card;
  const isOffline = status === 'offline';

  return (
    <div className="relative my-2 overflow-hidden rounded-3xl p-3.5 select-none transition-all duration-300 w-fit max-w-[280px]">
      {/* 极弱环境漫反射柔光（无硬边缘、去卡片化） */}
      <div
        className={`pointer-events-none absolute -inset-2 blur-xl opacity-60 transition-opacity duration-500 ${
          isOffline
            ? 'bg-gradient-to-r from-zinc-400/15 via-zinc-300/10 to-transparent'
            : 'bg-gradient-to-r from-amber-400/15 via-pink-400/10 to-transparent'
        }`}
      />

      {/* 极轻微的毛玻璃浮层 */}
      <div className="relative z-10 flex items-center gap-3">
        <CuteRobotIcon type={actionType} />

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
              {label}
            </span>
            {/* 桌面同步小微标 */}
            {!isOffline && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>

          <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
            {detail}
          </span>
        </div>
      </div>
    </div>
  );
}

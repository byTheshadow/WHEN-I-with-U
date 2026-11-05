import React, { useEffect, useMemo, useState } from 'react';
import { Ghost, Heart } from 'lucide-react';

import GreetingScene, {
  GREETING_SCENE_DURATION_MS,
  GREETING_SCENE_EXIT_MS,
} from './GreetingScene';

// chatroom 里"今天有点不一样"的瞬时提示卡：早安/晚安问候、节日彩蛋。
// 播完自动消失，不写进聊天记录、不挡住聊天操作（pointer-events-none）。
// 早安/晚安这两种整张卡片本身就是 GreetingScene 演的那一幕唯美小剧场
// （不是卡片里嵌一个小舞台），进场/退场也是简单的淡入淡出+轻微位移，
// 没有回弹缩放。其余（节日彩蛋，比如万圣节）暂时还是图标+文字的
// 简单版本，进退场保留原来的轻回弹效果，以后要升级再照 GreetingScene
// 这个思路单独配一个动画组件。

const DEFAULT_DISPLAY_MS = 2600;
const DEFAULT_EXIT_MS = 420;

const GREETING_VARIANTS = {
  'greeting:morning': 'morning',
  'greeting:night': 'night',
};

function resolveTiming(kind) {
  if (kind && GREETING_VARIANTS[kind]) {
    return { displayMs: GREETING_SCENE_DURATION_MS, exitMs: GREETING_SCENE_EXIT_MS };
  }
  return { displayMs: DEFAULT_DISPLAY_MS, exitMs: DEFAULT_EXIT_MS };
}

// 图标+文字简单版卡片（节日彩蛋/谢谢彩蛋）按 kind 前缀挑图标，不在表里
// 的（目前就是万圣节 festival:halloween）保留原来的 Ghost，不影响。
const ICON_BY_KIND_PREFIX = [
  { prefix: 'thanks:', Icon: Heart },
];

function resolveIcon(kind) {
  const matched = ICON_BY_KIND_PREFIX.find(({ prefix }) => kind?.startsWith(prefix));
  return matched ? matched.Icon : Ghost;
}

// card: { kind, title, subtitle, accent } | null，由 useChatEntryCard 给出。
const ChatEntryCardOverlay = ({ card, onDone }) => {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    if (!card) return undefined;

    setPhase('enter');

    const { displayMs, exitMs } = resolveTiming(card.kind);
    const exitTimer = window.setTimeout(() => setPhase('exit'), displayMs);
    const doneTimer = window.setTimeout(() => {
      onDone?.();
    }, displayMs + exitMs);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.kind]);

  const greetingVariant = card?.kind ? GREETING_VARIANTS[card.kind] : null;

  if (!card) return null;

  const accent = card.accent || 'var(--accent-color)';
  const isExiting = phase === 'exit';
  const CardIcon = resolveIcon(card.kind);

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-6">
      {greetingVariant ? (
        <div
          className={`greeting-card-wrap overflow-hidden rounded-[1.5rem] shadow-2xl ${
            isExiting ? 'greeting-card-exit' : 'greeting-card-enter'
          }`}
          style={{ width: 'min(88vw, 21rem)' }}
        >
          <GreetingScene variant={greetingVariant} title={card.title} desc={card.subtitle} />
        </div>
      ) : (
        <div
          className={`entry-card-shell flex flex-col items-center gap-2.5 rounded-[1.75rem] px-6 py-5 text-center shadow-2xl ${
            isExiting ? 'entry-card-exit' : 'entry-card-enter'
          }`}
          style={{
            background: 'var(--card-bg-gradient)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-main)',
            minWidth: '13.5rem',
            maxWidth: '78vw',
          }}
        >
          <div
            className="entry-card-icon-glow flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: `color-mix(in srgb, ${accent} 22%, transparent)`,
              boxShadow: `0 0 22px 2px color-mix(in srgb, ${accent} 35%, transparent)`,
            }}
          >
            <CardIcon className="h-5 w-5" style={{ color: accent }} />
          </div>

          <div className="text-sm font-bold leading-tight">{card.title}</div>

          {card.subtitle && (
            <div className="text-[11px] leading-snug opacity-70">{card.subtitle}</div>
          )}
        </div>
      )}

      <style>{`
        /* 早安/晚安：单纯的淡入淡出+轻微位移，不做任何缩放回弹 */
        @keyframes greeting-card-fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes greeting-card-fade-out {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }

        .greeting-card-enter {
          animation: greeting-card-fade-in 0.9s ease-out forwards;
        }

        .greeting-card-exit {
          animation: greeting-card-fade-out ${GREETING_SCENE_EXIT_MS}ms ease-in forwards;
        }

        /* 节日彩蛋（图标+文字简单版）：保留原来的轻回弹进退场 */
        @keyframes entry-card-pop-in {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.86);
          }
          60% {
            opacity: 1;
            transform: translateY(0) scale(1.03);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes entry-card-pop-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px) scale(0.92);
          }
        }

        @keyframes entry-card-icon-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .entry-card-enter {
          animation: entry-card-pop-in 0.42s cubic-bezier(0.22, 0.7, 0.32, 1) forwards;
        }

        .entry-card-exit {
          animation: entry-card-pop-out ${DEFAULT_EXIT_MS}ms ease-in forwards;
        }

        .entry-card-icon-glow {
          animation: entry-card-icon-breathe 1.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .greeting-card-enter,
          .greeting-card-exit,
          .entry-card-enter,
          .entry-card-exit,
          .entry-card-icon-glow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatEntryCardOverlay;
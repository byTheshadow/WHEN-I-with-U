import React from 'react';
import { MessageSquare, BookOpen, Compass, Calendar, Camera } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer'; // 👈 引入新组件

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest opacity-40 px-2">
        Applications
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <GlassCard
          delay={delay}
          tone="ink"
          onClick={() => onOpenApp('messages')}
          className="col-span-2 flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-black/10 dark:bg-white/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 opacity-90 text-[var(--text-on-ink)]" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-sm text-[var(--text-on-ink)]">
                Messages
              </h4>
              <p className="mt-0.5 text-[11px] text-[var(--text-on-ink-muted)]">
                Continue the conversation
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Snapshots 拍立得 IG 动态朋友圈入口 */}
        <GlassCard
          delay={delay + 25}
          onClick={() => onOpenApp('snapshots')}
          className="col-span-2 flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
              <Camera className="w-5 h-5 opacity-90 text-[var(--text-main)]" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-sm">Snapshots</h4>
              <p className="mt-0.5 text-[10px] opacity-50 uppercase tracking-wider">
                Polaroid Moments Feed
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard
          delay={delay + 50}
          onClick={() => onOpenApp('diaries')}
          className="flex flex-col justify-between aspect-square text-left cursor-pointer"
        >
          <BookOpen className="w-6 h-6 opacity-80" />
          <div>
            <h4 className="font-bold text-sm">Diaries</h4>
            <p className="text-[10px] opacity-40 uppercase tracking-wider mt-0.5">
              Sync Memories
            </p>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-4">
          <GlassCard
            delay={delay + 100}
            onClick={() => onOpenApp('travel')}
            className="flex-1 flex items-center gap-3 p-4 text-left cursor-pointer"
          >
            <Compass className="w-5 h-5 opacity-80" />
            <h4 className="font-bold text-sm">Travel</h4>
          </GlassCard>

          <GlassCard
            delay={delay + 150}
            onClick={() => onOpenApp('planner')}
            className="flex-1 flex items-center gap-3 p-4 text-left cursor-pointer"
          >
            <Calendar className="w-5 h-5 opacity-80" />
            <h4 className="font-bold text-sm">Planner</h4>
          </GlassCard>
        </div>
      </div>

      {/* 👈 挂载在 Applications 下方的黑胶保活播放器 */}
      <KeepAlivePlayer delay={delay + 200} />
    </div>
  );
};

export default AppGrid;

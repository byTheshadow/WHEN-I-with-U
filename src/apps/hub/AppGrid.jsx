// src/apps/hub/AppGrid.jsx
import React from 'react';
import { MessageSquare, BookOpen, Compass, Calendar, Camera, Waves } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest opacity-40 px-2">
        Applications
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* 顶部 Hero 核心入口: Messages */}
        <GlassCard
          delay={delay}
          tone="ink"
          onClick={() => onOpenApp('messages')}
          className="col-span-2 flex items-center justify-between group cursor-pointer p-4"
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

        {/* 👈 重构：Snapshots 方形画廊卡 */}
        <GlassCard
          delay={delay + 25}
          onClick={() => onOpenApp('snapshots')}
          className="flex flex-col justify-between aspect-square text-left cursor-pointer p-4 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <Camera className="w-5 h-5 opacity-90 text-[var(--text-main)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Snapshots</h4>
            <p className="mt-0.5 text-[10px] opacity-50 uppercase tracking-wider">
              Polaroid Feed
            </p>
          </div>
        </GlassCard>

        {/* 👈 重构：Pebbling 企鹅小石 方形拟物卡 (与 Snapshots 优雅并排) */}
        <GlassCard
          delay={delay + 40}
          onClick={() => onOpenApp('pebbling')}
          className="flex flex-col justify-between aspect-square text-left cursor-pointer p-4 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <Waves className="w-5 h-5 opacity-90 text-[var(--text-main)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Pebbling</h4>
            <p className="mt-0.5 text-[10px] opacity-50 uppercase tracking-wider">
              Nest Exchange
            </p>
          </div>
        </GlassCard>

        {/* Diaries 日记 */}
        <GlassCard
          delay={delay + 60}
          onClick={() => onOpenApp('diaries')}
          className="flex flex-col justify-between aspect-square text-left cursor-pointer p-4"
        >
          <BookOpen className="w-6 h-6 opacity-80" />
          <div>
            <h4 className="font-bold text-sm">Diaries</h4>
            <p className="text-[10px] opacity-40 uppercase tracking-wider mt-0.5">
              Sync Memories
            </p>
          </div>
        </GlassCard>

        {/* 右侧垂直拼合：Travel & Planner */}
        <div className="flex flex-col gap-4">
          <GlassCard
            delay={delay + 80}
            onClick={() => onOpenApp('travel')}
            className="flex-1 flex items-center gap-3 p-4 text-left cursor-pointer"
          >
            <Compass className="w-5 h-5 opacity-80" />
            <h4 className="font-bold text-sm">Travel</h4>
          </GlassCard>

          <GlassCard
            delay={delay + 100}
            onClick={() => onOpenApp('planner')}
            className="flex-1 flex items-center gap-3 p-4 text-left cursor-pointer"
          >
            <Calendar className="w-5 h-5 opacity-80" />
            <h4 className="font-bold text-sm">Planner</h4>
          </GlassCard>
        </div>
      </div>

      {/* Applications 下方的黑胶保活播放器 */}
      <KeepAlivePlayer delay={delay + 120} />
    </div>
  );
};

export default AppGrid;

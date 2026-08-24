// src/apps/hub/AppGrid.jsx 
import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  BookOpen,
  Compass,
  Calendar,
  Camera,
  Waves,
  Sparkles,
  Users,
  Leaf,
  Ticket // 👈 引入票根图标
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';
import PreloaderSelector from './PreloaderSelector';
import db from '../../db';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  const [habitatCount, setHabitatCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadHabitatCount = async () => {
      try {
        const count = await db.habitats.count();
        if (isMounted) {
          setHabitatCount(count);
        }
      } catch (error) {
        console.error('读取生态瓶数量失败：', error);
      }
    };

    void loadHabitatCount();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="px-2 text-[11px] font-semibold uppercase tracking-widest opacity-40">
        Applications
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Row 1: Messages (col-span-2) */}
        <GlassCard
          delay={delay}
          tone="ink"
          onClick={() => onOpenApp('messages')}
          className="group col-span-2 flex cursor-pointer items-center justify-between p-4"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/10 dark:bg-white/10">
              <MessageSquare className="h-5 w-5 text-[var(--text-on-ink)] opacity-90" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-bold text-[var(--text-on-ink)]">
                Messages
              </h4>
              <p className="mt-0.5 text-[11px] text-[var(--text-on-ink-muted)]">
                Continue the conversation
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Row 2 */}
        <GlassCard
          delay={delay + 25}
          onClick={() => onOpenApp('snapshots')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
            <Camera className="h-5 w-5 text-[var(--text-main)] opacity-90" />
          </div>
          <div>
            <h4 className="text-sm font-bold">Snapshots</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Polaroid Feed
            </p>
          </div>
        </GlassCard>

        <GlassCard
          delay={delay + 40}
          onClick={() => onOpenApp('pebbling')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
            <Waves className="h-5 w-5 text-[var(--text-main)] opacity-90" />
          </div>
          <div>
            <h4 className="text-sm font-bold">Pebbling</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Nest Exchange
            </p>
          </div>
        </GlassCard>

        {/* Row 3 */}
        <GlassCard
          delay={delay + 50}
          onClick={() => onOpenApp('imaginarium')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Sparkles
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <h4 className="text-sm font-bold">Imaginarium</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Virtual Salon
            </p>
          </div>
        </GlassCard>

        <GlassCard
          delay={delay + 60}
          onClick={() => onOpenApp('ensemble')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Users
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <h4 className="text-sm font-bold">The Ensemble</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Bonded Group
            </p>
          </div>
        </GlassCard>

        {/* Row 4 */}
        <GlassCard
          delay={delay + 70}
          onClick={() => onOpenApp('habitat')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Leaf
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <h4 className="text-sm font-bold">Living Habitat</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              {habitatCount > 0
                ? `${habitatCount} lives breathing`
                : 'Adopt a new life'}
            </p>
          </div>
        </GlassCard>

        <GlassCard
          delay={delay + 75}
          onClick={() => onOpenApp('diaries')}
          className="flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <BookOpen className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
          </div>
          <div>
            <h4 className="text-sm font-bold">Diaries</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
              Sync Memories
            </p>
          </div>
        </GlassCard>

        {/* Row 5: Ephemera (Left) & Travel/Planner Column (Right) -> 完美闭合对称 */}
        <GlassCard
          delay={delay + 90}
          onClick={() => onOpenApp('ephemera')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Ticket
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <h4 className="text-sm font-bold">Ephemera</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Time Tickets
            </p>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-4">
          <GlassCard
            delay={delay + 80}
            onClick={() => onOpenApp('travel')}
            className="flex flex-1 cursor-pointer items-center gap-3 p-4 text-left"
          >
            <Compass className="h-5 w-5 opacity-80" />
            <h4 className="text-sm font-bold">Travel</h4>
          </GlassCard>

          <GlassCard
            delay={delay + 100}
            onClick={() => onOpenApp('planner')}
            className="flex flex-1 cursor-pointer items-center gap-3 p-4 text-left"
          >
            <Calendar className="h-5 w-5 opacity-80" />
            <h4 className="text-sm font-bold">Planner</h4>
          </GlassCard>
        </div>
      </div>

      {/* 黑胶播放器 */}
      <KeepAlivePlayer delay={delay + 120} />

      {/* 杂志风启动动画选择器 */}
      <PreloaderSelector delay={delay + 130} />
    </div>
  );
};

export default AppGrid;

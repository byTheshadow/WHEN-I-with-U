// src/apps/hub/AppGrid.jsx 
import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  BookOpen,
  Archive,
  Compass,
  Calendar,
  Camera,
  Waves,
  Sparkles,
  Users,
  Leaf,
  Ticket,
  MailOpen,
  Clock
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';
import PreloaderSelector from './PreloaderSelector';
import { Newspaper } from 'lucide-react';
import db from '../../db';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  const [habitatCount, setHabitatCount] = useState(0);
  const [askCount, setAskCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const hCount = await db.habitats.count();
        const unansweredCount = await db.askBoxQuestions
          .filter(q => {
            if (q.sender === 'user') {
              return !q.reply;
            } else {
              return !q.reply;
            }
          })
          .count();

        if (isMounted) {
          setHabitatCount(hCount);
          setAskCount(unansweredCount);
        }
      } catch (error) {
        console.error('读取提问箱与生态瓶数据失败：', error);
      }
    };

    void loadStats();
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
        {/* Row 1: Messages (不变) */}
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

        {/* Row 2: 两个标准方块 */}
        <GlassCard
          delay={delay + 20}
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
          delay={delay + 30}
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

        {/* Row 3: Living Habitat 变宽版 (打破网格节奏的杂志感) */}
        <GlassCard
          delay={delay + 40}
          onClick={() => onOpenApp('habitat')}
          className="group col-span-2 flex cursor-pointer items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Leaf
                className="h-5 w-5 opacity-90"
                style={{ color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <h4 className="text-sm font-bold">Living Habitat</h4>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider opacity-50">
                {habitatCount > 0
                  ? `${habitatCount} lives breathing`
                  : 'Adopt a new life'}
              </p>
            </div>
          </div>
          {/* 杂志感小装饰 */}
          <div className="font-mono text-[9px] uppercase tracking-widest opacity-30 pr-2 transition-opacity group-hover:opacity-60">
            Bio-Sync
          </div>
        </GlassCard>

        {/* Row 4: 两个标准方块 */}
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

        {/* Row 5: 两个标准方块 */}
        <GlassCard
          delay={delay + 70}
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
        
        <GlassCard
          delay={delay + 80}
          onClick={() => onOpenApp('memory')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Archive
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <h4 className="text-sm font-bold">Memory Room</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
              Private Archive
            </p>
          </div>
        </GlassCard>

        {/* Row 6: Ephemera + 假App占位 (营造留白) */}
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

       
<GlassCard
  delay={delay + 95}
  onClick={() => onOpenApp('newspaper')}
  className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
>
  <div
    className="flex h-10 w-10 items-center justify-center rounded-2xl"
    style={{ backgroundColor: 'var(--control-soft-bg)' }}
  >
    <Newspaper className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
  </div>
  <div>
    <h4 className="text-sm font-bold">Daily Post</h4>
    <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
      Morning Press
    </p>
  </div>
</GlassCard>


        {/* Row 7: Ask Box - 提问箱 (变宽版，解决原来右侧空的问题，稳住底部) */}
        <GlassCard
          delay={delay + 100}
          onClick={() => onOpenApp('askbox')}
          className="group col-span-2 flex cursor-pointer items-center justify-between p-4 text-left border-dashed"
          style={{ borderColor: 'var(--text-muted)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <MailOpen
                className="h-5 w-5 opacity-90"
                style={{ color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">Ask Box</h4>
                {askCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider opacity-50">
                {askCount > 0 ? `${askCount} letters waiting` : 'Anonymity Box'}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Row 8: 底部工具栏横排 */}
        <div className="col-span-2 flex gap-3">
          <GlassCard
            delay={delay + 110}
            onClick={() => onOpenApp('travel')}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 p-3 text-left"
          >
            <Compass className="h-4 w-4 opacity-80" />
            <h4 className="truncate text-sm font-bold">Travel</h4>
          </GlassCard>

          <GlassCard
            delay={delay + 120}
            onClick={() => onOpenApp('planner')}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 p-3 text-left"
          >
            <Calendar className="h-4 w-4 opacity-80" />
            <h4 className="truncate text-sm font-bold">Planner</h4>
          </GlassCard>

          <GlassCard
            delay={delay + 130}
            onClick={() => onOpenApp('rhythm')}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 p-3 text-left"
          >
            <Clock className="h-4 w-4 opacity-80" />
            <h4 className="truncate text-sm font-bold">Rhythm</h4>
          </GlassCard>
        </div>
      </div>

      {/* 黑胶播放器 */}
      <KeepAlivePlayer delay={delay + 140} />

      {/* 杂志风启动动画选择器 */}
      <PreloaderSelector delay={delay + 150} />
    </div>
  );
};

export default AppGrid;




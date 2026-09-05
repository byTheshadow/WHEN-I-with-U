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
  Clock,
  CalendarClock,
  Newspaper,
  Feather,
  ArrowUpRight
} from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';
import PreloaderSelector from './PreloaderSelector';
import db from '../../db';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  const [habitatCount, setHabitatCount] = useState(0);
  const [askCount, setAskCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const [hCount, unansweredCount] = await Promise.all([
          db.habitats.count(),
          db.askBoxQuestions
            .filter((question) => !question.reply)
            .count()
        ]);

        if (!isMounted) return;

        setHabitatCount(hCount);
        setAskCount(unansweredCount);
      } catch (error) {
        console.error('读取首页应用统计失败：', error);
      }
    };

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-40">
            Applications
          </h3>
          <p className="mt-1 text-[10px] opacity-35">
            Things kept close, and places to return to.
          </p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest opacity-30">
          Personal Index
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 主入口：Messages */}
        <GlassCard
          delay={delay}
          tone="ink"
          onClick={() => onOpenApp('messages')}
          className="group col-span-2 flex cursor-pointer items-center justify-between overflow-hidden p-4 text-left"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/10 dark:bg-white/10">
              <MessageSquare className="h-5 w-5 text-[var(--text-on-ink)] opacity-90" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-[var(--text-on-ink)]">
                Messages
              </h4>
              <p className="mt-0.5 text-[11px] text-[var(--text-on-ink-muted)]">
                Continue the conversation
              </p>
            </div>
          </div>

          <ArrowUpRight className="h-4 w-4 text-[var(--text-on-ink)] opacity-35 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </GlassCard>

        {/* 页边注：独立的重点书页入口 */}
        <GlassCard
          delay={delay + 15}
          onClick={() => onOpenApp('margin-notes')}
          className="group col-span-2 cursor-pointer overflow-hidden p-0 text-left"
        >
          <div className="relative flex min-h-[132px] items-stretch">
            {/* 左侧书脊 */}
            <div
              className="flex w-[54px] shrink-0 flex-col items-center justify-between border-r py-3"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <Feather
                className="h-4 w-4 opacity-60"
                style={{ color: 'var(--text-main)' }}
              />
              <span className="[writing-mode:vertical-rl] font-serif text-[10px] tracking-[0.22em] opacity-45">
                THE MARGIN NOTES
              </span>
            </div>

            {/* 书页正文 */}
            <div className="flex flex-1 flex-col justify-between px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.18em] opacity-40">
                    A shared reading room
                  </p>
                  <h4 className="mt-1 font-serif text-[17px] font-semibold tracking-wide">
                    页边注
                  </h4>
                  <p className="mt-0.5 font-serif text-[11px] italic opacity-55">
                    The Margin Notes
                  </p>
                </div>

                <BookOpen
                  className="h-4 w-4 shrink-0 opacity-35 transition-transform duration-300 group-hover:-rotate-6"
                  style={{ color: 'var(--text-main)' }}
                />
              </div>

              <div
                className="mt-3 border-t pt-2 text-[10px] leading-relaxed opacity-55"
                style={{ borderColor: 'var(--card-border)' }}
              >
                Find a passage, read beside someone,
                <br />
                and leave a thought in the margin.
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 生活影像与小物交换：一组小尺寸对象 */}
        <GlassCard
          delay={delay + 30}
          onClick={() => onOpenApp('snapshots')}
          className="group flex aspect-[0.96] cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
            <Camera className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
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
          className="group flex aspect-[0.96] cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Waves className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
          </div>

          <div>
            <h4 className="text-sm font-bold">Pebbling</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Nest Exchange
            </p>
          </div>
        </GlassCard>

        {/* 生态瓶：横幅大卡，打断两列节奏 */}
        <GlassCard
          delay={delay + 50}
          onClick={() => onOpenApp('habitat')}
          className="group col-span-2 flex cursor-pointer items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Leaf className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
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

          <span className="pr-1 font-mono text-[9px] uppercase tracking-[0.16em] opacity-30 transition-opacity group-hover:opacity-60">
            Bio-Sync
          </span>
        </GlassCard>

        {/* 想象空间与群像 */}
        <GlassCard
          delay={delay + 60}
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
          delay={delay + 70}
          onClick={() => onOpenApp('ensemble')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Users className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
          </div>

          <div>
            <h4 className="text-sm font-bold">The Ensemble</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Bonded Group
            </p>
          </div>
        </GlassCard>

        {/* 记忆类内容 */}
        <GlassCard
          delay={delay + 80}
          onClick={() => onOpenApp('diaries')}
          className="group flex cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <BookOpen className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
          </div>

          <div className="mt-10">
            <h4 className="text-sm font-bold">Diaries</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
              Sync Memories
            </p>
          </div>
        </GlassCard>

        <GlassCard
          delay={delay + 90}
          onClick={() => onOpenApp('memory')}
          className="group flex cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Archive className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
          </div>

          <div className="mt-10">
            <h4 className="text-sm font-bold">Memory Room</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
              Private Archive
            </p>
          </div>
        </GlassCard>

        {/* 时光碎片与晨报 */}
        <GlassCard
          delay={delay + 100}
          onClick={() => onOpenApp('ephemera')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Ticket className="h-5 w-5 opacity-90" style={{ color: 'var(--text-main)' }} />
          </div>

          <div>
            <h4 className="text-sm font-bold">Ephemera</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Time Tickets
            </p>
          </div>
        </GlassCard>

        <GlassCard
          delay={delay + 110}
          onClick={() => onOpenApp('newspaper')}
          className="group flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Newspaper
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <h4 className="text-sm font-bold">Daily Post</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
              Morning Press
            </p>
          </div>
        </GlassCard>

        {/* 提问箱：底部横向信封 */}
        <GlassCard
          delay={delay + 120}
          onClick={() => onOpenApp('askbox')}
          className="group col-span-2 flex cursor-pointer items-center justify-between border-dashed p-4 text-left"
          style={{ borderColor: 'var(--text-muted)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
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
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                )}
              </div>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider opacity-50">
                {askCount > 0
                  ? `${askCount} letters waiting`
                  : 'Anonymity Box'}
              </p>
            </div>
          </div>

          <ArrowUpRight className="h-4 w-4 opacity-30 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </GlassCard>

        {/* 底部轻工具栏 */}
        <div className="col-span-2 pt-1">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] opacity-35">
              Small arrangements
            </span>
            <span className="text-[9px] opacity-30">for everyday life</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <GlassCard
              delay={delay + 130}
              onClick={() => onOpenApp('travel')}
              className="flex min-w-[calc(50%-0.35rem)] flex-1 cursor-pointer items-center justify-center gap-1.5 p-3 text-left"
            >
              <Compass className="h-3.5 w-3.5 shrink-0 opacity-75" />
              <h4 className="truncate text-xs font-bold">Travel</h4>
            </GlassCard>

            <GlassCard
              delay={delay + 140}
              onClick={() => onOpenApp('planner')}
              className="flex min-w-[calc(50%-0.35rem)] flex-1 cursor-pointer items-center justify-center gap-1.5 p-3 text-left"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0 opacity-75" />
              <h4 className="truncate text-xs font-bold">Planner</h4>
            </GlassCard>

            <GlassCard
              delay={delay + 150}
              onClick={() => onOpenApp('rhythm')}
              className="flex min-w-[calc(50%-0.35rem)] flex-1 cursor-pointer items-center justify-center gap-1.5 p-3 text-left"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-75" />
              <h4 className="truncate text-xs font-bold">Rhythm</h4>
            </GlassCard>

            <GlassCard
              delay={delay + 160}
              onClick={() => onOpenApp('almanac')}
              className="group flex min-w-[calc(50%-0.35rem)] flex-1 cursor-pointer items-center justify-center gap-1.5 p-3 text-left"
            >
              <CalendarClock
                className="h-3.5 w-3.5 shrink-0 opacity-75"
                style={{ color: 'var(--text-main)' }}
              />

              <div className="min-w-0">
                <h4 className="truncate text-xs font-bold">
                  Almanac
                </h4>

                <p className="truncate text-[9px] uppercase tracking-wider opacity-45">
                  岁时纪
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      <KeepAlivePlayer delay={delay + 160} />
      <PreloaderSelector delay={delay + 170} />
    </div>
  );
};

export default AppGrid;






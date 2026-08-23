// src/apps/hub/AppGrid.jsx
import React from 'react';
import {
  MessageSquare,
  BookOpen,
  Compass,
  Calendar,
  Camera,
  Waves,
  Sparkles,
  Users
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import KeepAlivePlayer from './KeepAlivePlayer';
// 👈 导入新写的启动动画选择器
import PreloaderSelector from './PreloaderSelector'; 

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  return (
    <div className="space-y-3">
      <h3 className="px-2 text-[11px] font-semibold uppercase tracking-widest opacity-40">
        Applications
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* ... 保留现有的 Messages, Snapshots, Pebbling 等 GlassCard 网格内容不变 ... */}
        
        {/* 这里是 Diaries, Travel, Planner 等卡片 */}
        <GlassCard
          delay={delay + 70}
          onClick={() => onOpenApp('diaries')}
          className="flex aspect-square cursor-pointer flex-col justify-between p-4 text-left"
        >
          <BookOpen className="h-6 w-6 opacity-80" />
          <div>
            <h4 className="text-sm font-bold">Diaries</h4>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
              Sync Memories
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

      {/* 👈 紧跟在黑胶保活播放器下方的杂志风启动动画选择器 */}
      <PreloaderSelector delay={delay + 130} />
    </div>
  );
};

export default AppGrid;

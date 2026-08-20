import React from 'react';
import { MessageSquare, BookOpen, Compass, Calendar, Settings } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const AppGrid = ({ delay = 400, onOpenApp }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest opacity-50 px-2">
        Applications
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Messages 大卡片 */}
        <GlassCard
          delay={delay}
          onClick={() => onOpenApp('messages')}
          className="col-span-2 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-black/10 dark:bg-white/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-sm">Messages</h4>
              <p className="text-[11px] opacity-60 mt-0.5">Continue the conversation</p>
            </div>
          </div>
        </GlassCard>

        {/* Diaries */}
        <GlassCard
          delay={delay + 50}
          onClick={() => onOpenApp('diaries')}
          className="flex flex-col justify-between aspect-square text-left"
        >
          <BookOpen className="w-6 h-6 opacity-80" />
          <div>
            <h4 className="font-bold text-sm">Diaries</h4>
            <p className="text-[10px] opacity-50 uppercase tracking-wider mt-0.5">Sync Memories</p>
          </div>
        </GlassCard>

        {/* Travel & Planner 组合堆叠 */}
        <div className="flex flex-col gap-4">
          <GlassCard
            delay={delay + 100}
            onClick={() => onOpenApp('travel')}
            className="flex-1 flex items-center gap-3 p-4 text-left"
          >
            <Compass className="w-5 h-5 opacity-80" />
            <h4 className="font-bold text-sm">Travel</h4>
          </GlassCard>

          <GlassCard
            delay={delay + 150}
            onClick={() => onOpenApp('planner')}
            className="flex-1 flex items-center gap-3 p-4 text-left"
          >
            <Calendar className="w-5 h-5 opacity-80" />
            <h4 className="font-bold text-sm">Planner</h4>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AppGrid;

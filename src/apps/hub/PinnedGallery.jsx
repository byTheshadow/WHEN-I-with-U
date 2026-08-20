import React from 'react';
import { Pin, Image as ImageIcon } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const PinnedGallery = ({ delay = 200 }) => {
  return (
    <GlassCard delay={delay} className="space-y-4">
      {/* 头部标题（小 Pill 标签，无条条） */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold uppercase tracking-wider opacity-80">
          <Pin className="w-3.5 h-3.5" />
          <span>Pinned Moment</span>
        </div>
      </div>

      <p className="text-xs leading-relaxed opacity-90 font-serif italic">
        "A quiet afternoon in the city. Capturing the softest moments before dusk falls."
      </p>

      {/* 照片网格 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/5 dark:bg-white/5 aspect-[4/5] rounded-2xl flex items-center justify-center border border-white/10 cursor-pointer hover:opacity-80 transition-opacity">
          <ImageIcon className="w-5 h-5 opacity-40" />
        </div>
        <div className="bg-black/5 dark:bg-white/5 aspect-[4/5] rounded-2xl flex items-center justify-center border border-white/10 cursor-pointer hover:opacity-80 transition-opacity">
          <ImageIcon className="w-5 h-5 opacity-40" />
        </div>
      </div>
    </GlassCard>
  );
};

export default PinnedGallery;

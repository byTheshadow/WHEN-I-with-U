import React from 'react';
import { Mail } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const QuickBoard = ({ delay = 300, messages = [] }) => {
  // 默认预置文艺贴纸数据
  const defaultNotes = [
    {
      id: 1,
      characterName: "Aethel",
      content: "The wind is soft today. Remember to drink warm water and take a moment to breathe.",
      timestamp: "14:02 PM"
    },
    {
      id: 2,
      characterName: "Luna",
      content: "I walked past the bookstore we used to visit. The autumn leaves are starting to turn.",
      timestamp: "Yesterday"
    }
  ];

  const activeMessages = messages.length > 0 ? messages : defaultNotes;

  // 若设置无数据且配置为隐藏，可直接 return null (已预留折叠能力)
  if (activeMessages.length === 0) return null;

  return (
    <GlassCard delay={delay} className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 w-fit text-xs font-semibold uppercase tracking-wider opacity-80">
        <Mail className="w-3.5 h-3.5" />
        <span>Mailbox</span>
      </div>

      {/* 多贴纸卡片横向滑动容器 */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar py-1 snap-x snap-mandatory">
        {activeMessages.map((item) => (
          <div
            key={item.id}
            className="min-w-[85%] snap-center rounded-2xl p-4 bg-white/30 dark:bg-black/20 border border-white/30 space-y-2 shrink-0"
          >
            <p className="text-xs font-serif italic leading-relaxed opacity-90">
              "{item.content}"
            </p>
            <div className="text-[10px] opacity-50 uppercase font-medium tracking-wider text-right">
              — {item.characterName} / {item.timestamp}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default QuickBoard;

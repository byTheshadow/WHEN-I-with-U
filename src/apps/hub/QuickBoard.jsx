import React, { useState } from 'react';
import { Mail, ChevronDown, ChevronUp } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const QuickBoard = ({ delay = 300, messages = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);

  // 无角色数据时绝对折叠不出现
  if (!messages || messages.length === 0) return null;

  return (
    <GlassCard delay={delay} className="space-y-3">
      {/* 极简信箱卡片标头 */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold uppercase tracking-wider opacity-80">
          <Mail className="w-3.5 h-3.5" />
          <span>Mailbox ({messages.length})</span>
        </div>
        <button className="p-1 opacity-50">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 展开后的信箱卡片分页列表 */}
      {isExpanded && (
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 snap-x snap-mandatory">
          {messages.map((item) => {
            const isLong = item.content && item.content.length > 80;
            const isCardOpen = expandedCardId === item.id;

            return (
              <div
                key={item.id}
                className="w-full snap-center rounded-2xl p-4 bg-white/20 dark:bg-black/20 border border-white/20 space-y-2 shrink-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold">
                    {item.characterName ? item.characterName[0] : 'C'}
                  </div>
                  <span className="text-xs font-semibold opacity-90">{item.characterName}</span>
                  <span className="text-[10px] opacity-40 ml-auto">{item.timestamp}</span>
                </div>

                <p className="text-xs font-serif italic leading-relaxed opacity-85 break-words">
                  "{isLong && !isCardOpen ? `${item.content.slice(0, 80)}...` : item.content}"
                </p>

                {isLong && (
                  <button
                    onClick={() => setExpandedCardId(isCardOpen ? null : item.id)}
                    className="text-[10px] opacity-60 underline hover:opacity-100"
                  >
                    {isCardOpen ? 'Collapse' : 'Read Full Message'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};

export default QuickBoard;

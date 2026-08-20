import React, { useState } from 'react';
import { Mail, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const QuickBoard = ({ delay = 300, messages = [] }) => {
  // 无数据时完全折叠收起不渲染
  if (!messages || messages.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const currentMsg = messages[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % messages.length);
    setExpanded(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + messages.length) % messages.length);
    setExpanded(false);
  };

  return (
    <GlassCard delay={delay} className="space-y-4">
      {/* 头部信箱胶囊标签 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold uppercase tracking-wider opacity-80">
          <Mail className="w-3.5 h-3.5" />
          <span>Mailbox ({messages.length})</span>
        </div>

        {/* 分页切换 */}
        {messages.length > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={handlePrev} className="p-1 rounded-full bg-black/5 dark:bg-white/10">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] opacity-60 font-mono">
              {currentIndex + 1}/{messages.length}
            </span>
            <button onClick={handleNext} className="p-1 rounded-full bg-black/5 dark:bg-white/10">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 完整换行与长文折叠卡片 */}
      <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 space-y-3">
        <div className="space-y-2">
          <p className={`text-xs font-serif italic leading-relaxed whitespace-pre-wrap ${!expanded ? 'line-clamp-3' : ''}`}>
            "{currentMsg.content}"
          </p>

          {currentMsg.content && currentMsg.content.length > 90 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity"
            >
              {expanded ? (
                <><span>收起文案</span><ChevronUp className="w-3 h-3" /></>
              ) : (
                <><span>展开阅读全文</span><ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>

        <div className="text-[10px] opacity-50 uppercase font-medium tracking-wider text-right border-t border-black/5 dark:border-white/5 pt-2">
          — {currentMsg.characterName || "Companion"} / {currentMsg.timestamp || "Recently"}
        </div>
      </div>
    </GlassCard>
  );
};

export default QuickBoard;

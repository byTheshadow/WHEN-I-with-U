import React from 'react';
import { ArrowUpRight, CheckCircle2, RotateCcw, Clock } from 'lucide-react';

export const TransferCard = ({ content = '', metadata = {}, onStatusChange }) => {
  const amount = metadata?.amount || '520.00';
  const note = content || '礼金 / 赠送给你的惊喜';
  const status = metadata?.status || 'pending'; // pending | received | returned

  const handleAction = (newStatus) => {
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
  };

  return (
    <div className="w-[240px] rounded-2xl border border-white/20 bg-gradient-to-br from-black/10 to-black/5 dark:from-white/10 dark:to-white/5 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono tracking-widest uppercase opacity-40">TRANSFER CARD</span>
        <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
      </div>

      <div>
        <div className="text-2xl font-serif font-semibold tracking-tight">
          <span className="text-sm font-sans mr-1">¥</span>
          {amount}
        </div>
        <p className="text-[11px] opacity-70 mt-1 truncate">{note}</p>
      </div>

      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
        {status === 'pending' && (
          <div className="flex gap-1.5 w-full">
            <button
              type="button"
              onClick={() => handleAction('received')}
              className="flex-1 py-1.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-medium text-[10px] active:scale-95 transition-all"
            >
              领取
            </button>
            <button
              type="button"
              onClick={() => handleAction('returned')}
              className="px-2.5 py-1.5 rounded-lg bg-black/10 dark:bg-white/10 opacity-70 hover:opacity-100 text-[10px] active:scale-95 transition-all"
            >
              退回
            </button>
          </div>
        )}

        {status === 'received' && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>已领取</span>
          </div>
        )}

        {status === 'returned' && (
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[10px] font-medium">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>已退回</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferCard;

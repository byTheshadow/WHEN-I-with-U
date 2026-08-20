import React, { useState } from 'react';
import { DollarSign, CheckCircle2 } from 'lucide-react';

export const TransferCard = ({ content, metadata = {} }) => {
  const [isClaimed, setIsClaimed] = useState(false);

  const amount = metadata.amount || '520.00';
  const title = content || metadata.title || '心意转账';

  return (
    <div 
      className="w-52 p-3.5 rounded-2xl border space-y-3 transition-all shadow-sm"
      style={{
        background: isClaimed ? 'var(--control-soft-bg)' : 'var(--card-bg-gradient)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <div className="flex items-center justify-between text-[10px] font-mono opacity-60 border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> TRANSFER</span>
        <span>{isClaimed ? '已领取' : '待领取'}</span>
      </div>

      <div>
        <h4 className="text-lg font-serif font-bold tracking-tight font-mono">¥ {amount}</h4>
        <p className="text-xs opacity-80 mt-0.5 truncate">{title}</p>
      </div>

      <button
        type="button"
        disabled={isClaimed}
        onClick={() => setIsClaimed(true)}
        className="w-full py-1.5 rounded-xl font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-1"
        style={{
          background: isClaimed ? 'transparent' : 'var(--accent-color)',
          color: isClaimed ? 'var(--text-sub)' : 'var(--accent-foreground)',
          border: isClaimed ? '1px solid var(--divider)' : 'none'
        }}
      >
        {isClaimed ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>已入账</span>
          </>
        ) : (
          <span>领取心意</span>
        )}
      </button>
    </div>
  );
};

export default TransferCard;

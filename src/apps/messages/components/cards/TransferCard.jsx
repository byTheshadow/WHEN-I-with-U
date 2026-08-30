import React, { useState } from 'react';
import { DollarSign, CheckCircle2, Clock } from 'lucide-react';

export const TransferCard = ({ content, metadata = {}, sender = 'character' }) => {
  const [isClaimed, setIsClaimed] = useState(metadata.isClaimed || false);

  const isUserSender = sender === 'user';
  const amount = metadata.amount || '520.00';
  const title = content || metadata.title || (isUserSender ? '给伴侣的心意转账' : '给你的心意转账');

  const handleClaim = () => {
    if (isUserSender) return; // 自己发的不能领
    setIsClaimed(true);
  };

  return (
    <div 
      className="w-52 p-3.5 rounded-2xl border space-y-3 transition-all shadow-sm text-left"
      style={{
        background: isClaimed ? 'var(--control-soft-bg)' : 'var(--card-bg-gradient)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <div className="flex items-center justify-between text-[10px] font-mono opacity-60 border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-500" /> TRANSFER</span>
        <span>{isClaimed ? '已领取' : isUserSender ? '等待对方领取' : '待领取'}</span>
      </div>

      <div>
        <h4 className="text-lg font-serif font-bold tracking-tight font-mono">¥ {amount}</h4>
       <p className="text-xs opacity-80 mt-0.5 break-words whitespace-pre-wrap max-h-14 overflow-y-auto pr-1">
  {title}
</p>
      </div>

      {/* 区分自己发出的与对方发出的 */}
      {isUserSender ? (
        <div 
          className="w-full py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 opacity-70 border cursor-not-allowed"
          style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
        >
          <Clock className="w-3 h-3 text-amber-500" />
          <span>等待对方领取</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={isClaimed}
          onClick={handleClaim}
          className="w-full py-1.5 rounded-xl font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm"
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
      )}
    </div>
  );
};

export default TransferCard;


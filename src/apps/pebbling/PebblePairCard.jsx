// src/apps/pebbling/PebblePairCard.jsx
import React, { useState, useEffect } from 'react';
import { PEBBLE_TYPES } from './pebbleTypes';
import { Clock, Trash2, Waves, Sparkles } from 'lucide-react';

export default function PebblePairCard({ pebble, character, onDelete }) {
  const [timeLeft, setTimeLeft] = useState('');
  const userStone = PEBBLE_TYPES[pebble.stoneType] || PEBBLE_TYPES['stream-pebble'];
  const aiStone = pebble.aiResponse ? (PEBBLE_TYPES[pebble.aiResponse.giftStoneType] || PEBBLE_TYPES['stream-pebble']) : null;
  const isPending = pebble.status === 'pending';
  const isAiInitiated = pebble.sender === 'ai';

  // 倒计时刷新
  useEffect(() => {
    if (!isPending) return;
    const updateCountdown = () => {
      const diff = pebble.respondAt - Date.now();
      if (diff <= 0) {
        setTimeLeft('即将在海浪中抵达...');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}分 ${secs}秒后带来反响`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isPending, pebble.respondAt]);

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const UserIcon = userStone.icon;
  const AiIcon = aiStone ? aiStone.icon : Sparkles;

  return (
    <div 
      className="w-full mb-5 rounded-2xl border p-5 transition-all duration-300 relative overflow-hidden group"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
      }}
    >
      {/* 顶部元数据与卡片彻底删除按钮 */}
      <div className="flex items-center justify-between text-xs mb-3 opacity-70" style={{ color: 'var(--text-sub)' }}>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDate(pebble.createdAt)}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(pebble.id);
          }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-sub)' }}
          title="清理此项小石纪录"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 情况 1: AI 主动投石给 User */}
      {isAiInitiated ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* 极质感 AI 石头徽章 */}
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner flex-shrink-0"
              style={{
                backgroundColor: userStone.stoneColor,
                borderColor: userStone.borderColor,
                boxShadow: `0 0 12px ${userStone.glowColor}`
              }}
            >
              <UserIcon className="w-5 h-5" style={{ color: 'var(--text-main)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>
                  {character?.name || '共栖伙伴'} 衔来的【{userStone.name}】
                </span>
              </div>
              <p className="text-[11px] opacity-75" style={{ color: 'var(--text-sub)' }}>
                {userStone.desc}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border text-sm leading-relaxed" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
            {pebble.aiResponse?.content}
          </div>
        </div>
      ) : (
        /* 情况 2: User 主动投石 (等待回应或已收到回应) */
        <div className="flex flex-col gap-4">
          {/* User 投石区块 */}
          <div className="flex items-start gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5"
              style={{
                backgroundColor: userStone.stoneColor,
                borderColor: userStone.borderColor,
                boxShadow: `0 0 10px ${userStone.glowColor}`
              }}
            >
              <UserIcon className="w-4 h-4" style={{ color: 'var(--text-main)' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs opacity-80" style={{ color: 'var(--text-sub)' }}>你投掷了</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
                  {userStone.name}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-main)' }}>
                {pebble.userContent}
              </p>
            </div>
          </div>

          {/* 状态 A: 海浪延迟运输中 */}
          {isPending && (
            <div 
              className="p-3 rounded-xl border flex items-center justify-between text-xs animate-pulse"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-sub)'
              }}
            >
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 opacity-70 animate-spin" style={{ animationDuration: '6s' }} />
                <span>正在海浪中慢慢漂向 {character?.name}...</span>
              </div>
              <span className="font-mono text-[11px] opacity-80">{timeLeft}</span>
            </div>
          )}

          {/* 状态 B: AI 已回赠石头 */}
          {!isPending && pebble.aiResponse && (
            <div className="pl-4 border-l-2 relative ml-4" style={{ borderColor: aiStone?.borderColor || 'var(--card-border)' }}>
              <div className="flex items-start gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: aiStone.stoneColor,
                    borderColor: aiStone.borderColor,
                    boxShadow: `0 0 10px ${aiStone.glowColor}`
                  }}
                >
                  <AiIcon className="w-4 h-4" style={{ color: 'var(--text-main)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>
                      {character?.name || '伙伴'} 回赠了【{aiStone.name}】
                    </span>
                    <span className="text-[10px] opacity-60 font-mono" style={{ color: 'var(--text-sub)' }}>
                      {formatDate(pebble.aiResponse.repliedAt)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed p-3 rounded-xl border" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
                    {pebble.aiResponse.content}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

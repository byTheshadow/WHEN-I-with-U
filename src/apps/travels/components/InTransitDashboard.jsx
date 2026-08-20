import React, { useState } from 'react';
import { Plane, Mail, Clock, Sun, Sparkles, Gift, User, RefreshCw } from 'lucide-react';

export const InTransitDashboard = ({ travel, character, postcards = [], onOpenPostcard, onCheckNewPostcard }) => {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckClick = async () => {
    setIsChecking(true);
    try {
      if (onCheckNewPostcard) await onCheckNewPostcard();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 拟真旅途状态小卡片 (替换丑陋大标题) */}
      <div 
        className="p-5 rounded-3xl border shadow-sm relative overflow-hidden space-y-4"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-2xl border"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              <Plane className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-mono opacity-60">DUAL IN-TRANSIT STUB</div>
              <h2 className="text-lg font-serif font-bold">{travel.destination} 同游漫游中</h2>
            </div>
          </div>

          <button
            onClick={handleCheckClick}
            disabled={isChecking}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>看看有没有明信片？</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs opacity-80" style={{ color: 'var(--text-sub)' }}>
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 shrink-0" />
            <span>当地天气：晴朗 · 适合两人漫步</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 shrink-0" />
            <span>{character?.name} 微状态：正和你一起逛小书店</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <Clock className="w-4 h-4 shrink-0" />
            <span>漫游时长：{travel.durationHours || 12} 小时</span>
          </div>
        </div>
      </div>

      {/* 漫游明信片展厅 */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold font-serif flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <Mail className="w-4 h-4" />
          <span>双人旅途明信片与伴手礼 ({postcards.length})</span>
        </h3>

        {postcards.length === 0 ? (
          <div 
            className="p-10 rounded-3xl border border-dashed text-center space-y-2"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
          >
            <Mail className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
              还没有新的明信片
            </p>
            <p className="text-[11px] opacity-70" style={{ color: 'var(--text-sub)' }}>
              你与伴侣在漫游期间，会不定时记下特定景点的浪漫瞬间与带回的伴手礼…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {postcards.map((card) => (
              <div
                key={card.id}
                onClick={() => onOpenPostcard(card)}
                className="p-5 rounded-2xl border cursor-pointer hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2 text-xs font-bold">
                    <span className="font-serif">{card.spotName}</span>
                    <span className="text-[10px] font-mono opacity-60" style={{ color: 'var(--text-muted)' }}>
                      {new Date(card.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-2 leading-relaxed opacity-80 font-serif" style={{ color: 'var(--text-sub)' }}>
                    "{card.letterContent}"
                  </p>
                </div>

                {card.giftItem && (
                  <div className="pt-2 border-t flex items-center gap-1.5 text-[11px] font-medium" style={{ borderColor: 'var(--divider)', color: 'var(--text-main)' }}>
                    <Gift className="w-3.5 h-3.5" />
                    <span>收到伴手礼：{card.giftItem}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InTransitDashboard;


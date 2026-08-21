import React, { useState } from 'react';
import { Plane, Mail, Clock, Sun, Gift, User, RefreshCw, Sparkles } from 'lucide-react';

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
      {/* 拟真漫游手帐状态存根 */}
      <div 
        className="p-6 rounded-3xl border shadow-sm space-y-5"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-3.5">
            <div 
              className="p-3 rounded-2xl border shrink-0"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              <Plane className="w-6 h-6 animate-pulse" style={{ color: 'var(--text-main)' }} />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-wider opacity-60 uppercase" style={{ color: 'var(--text-sub)' }}>
                DUAL IN-TRANSIT BOARDING STUB
              </div>
              <h2 className="text-xl font-serif font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>
                {travel.destination} 双人漫游中
              </h2>
            </div>
          </div>

          <button
            onClick={handleCheckClick}
            disabled={isChecking}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all shrink-0"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>看看有没有明信片？</span>
          </button>
        </div>

        {/* 状态与小插曲胶囊 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div 
            className="p-3.5 rounded-2xl border flex items-center gap-2.5"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
          >
            <Sun className="w-4 h-4 shrink-0" style={{ color: 'var(--text-main)' }} />
            <span className="truncate">当地天气：晴朗 · 适合双人漫步</span>
          </div>

          <div 
            className="p-3.5 rounded-2xl border flex items-center gap-2.5"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
          >
            <User className="w-4 h-4 shrink-0" style={{ color: 'var(--text-main)' }} />
            <span className="truncate">{character?.name || '伴侣'} 微状态：正与你一起逛街角书店</span>
          </div>

          <div 
            className="p-3.5 rounded-2xl border flex items-center gap-2.5 font-mono"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
          >
            <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--text-main)' }} />
            <span>漫游时长：{travel.durationHours || 12} 小时</span>
          </div>
        </div>
      </div>

      {/* 漫游明信片展厅 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold font-serif flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
            <Mail className="w-4 h-4" />
            <span>双人漫游手帐明信片与伴手礼 ({postcards.length})</span>
          </h3>
        </div>

        {postcards.length === 0 ? (
          <div 
            className="py-16 px-6 rounded-3xl border border-dashed text-center space-y-3"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
          >
            <Sparkles className="w-8 h-8 mx-auto opacity-40" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs font-semibold font-serif" style={{ color: 'var(--text-main)' }}>
              还没有新的明信片
            </p>
            <p className="text-[11px] opacity-70 max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-sub)' }}>
              你与伴侣在漫游期间，AI 会根据实时地点与角色人设，为你记录特定景点的浪漫互动与伴手礼…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {postcards.map((card) => (
              <div
                key={card.id}
                onClick={() => onOpenPostcard(card)}
                className="p-5 rounded-2xl border cursor-pointer hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="font-serif text-sm" style={{ color: 'var(--text-main)' }}>{card.spotName}</span>
                    <span className="text-[10px] font-mono opacity-60" style={{ color: 'var(--text-muted)' }}>
                      {new Date(card.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-3 leading-relaxed opacity-85 font-serif tracking-wide" style={{ color: 'var(--text-sub)' }}>
                    "{card.letterContent}"
                  </p>
                </div>

                {card.giftItem && (
                  <div 
                    className="pt-3 border-t flex items-center gap-2 text-xs font-medium"
                    style={{ borderColor: 'var(--divider)', color: 'var(--text-main)' }}
                  >
                    <Gift className="w-4 h-4 shrink-0" />
                    <span className="truncate">伴手礼：{card.giftItem}</span>
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


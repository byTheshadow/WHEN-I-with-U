import React, { useState } from 'react';
import { Plane, Mail, Clock, Sun, Sparkles, Gift, User, MapPin } from 'lucide-react';

export const InTransitDashboard = ({ travel, character, postcards = [], onOpenPostcard, onGenerateNewPostcard }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleManualTrigger = async () => {
    setIsGenerating(true);
    try {
      if (onGenerateNewPostcard) await onGenerateNewPostcard(travel.id);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 拟真飞行仪表盘 Header */}
      <div 
        className="p-6 rounded-3xl border relative overflow-hidden shadow-sm"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Plane className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                <span>IN-TRANSIT · 托管漫游中</span>
                <span>·</span>
                <span>FLIGHT: {travel.flightNo}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight mt-0.5">{travel.destination}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualTrigger}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? '伴侣正在落笔写信...' : '催促伴侣寄回明信片'}</span>
            </button>
          </div>
        </div>

        {/* 动态行囊与伴侣微状态 */}
        <div className="mt-6 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 text-xs" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Sun className="w-4 h-4 text-amber-500" />
            <span>当地天气：晴朗 22°C · 适合漫步</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <User className="w-4 h-4 text-emerald-500" />
            <span>伴侣微状态：在街角杂货铺看伴手礼</span>
          </div>
          <div className="flex items-center gap-2 font-mono" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-4 h-4 text-rose-500" />
            <span>旅行时长：{travel.durationHours || 12} 小时</span>
          </div>
        </div>
      </div>

      {/* 寄回的明信片流展厅 */}
      <div>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <Mail className="w-4 h-4 text-amber-500" />
          <span>漫游收件箱 ({postcards.length})</span>
        </h3>

        {postcards.length === 0 ? (
          <div 
            className="p-12 rounded-3xl border border-dashed text-center space-y-2"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
          >
            <Mail className="w-8 h-8 mx-auto text-amber-500/50" />
            <p className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
              还没有收到寄回的明信片
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              伴侣会在漫游旅途中不定时从景点寄回带图文与伴手礼的信封…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {postcards.map((card) => (
              <div
                key={card.id}
                onClick={() => onOpenPostcard(card)}
                className="p-5 rounded-2xl border cursor-pointer hover:border-amber-500 transition-all flex flex-col justify-between"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{card.spotName}</span>
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {new Date(card.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>
                    {card.letterContent}
                  </p>
                </div>

                {card.giftItem && (
                  <div className="pt-2 border-t flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium" style={{ borderColor: 'var(--card-border)' }}>
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

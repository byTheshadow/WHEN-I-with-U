import React from 'react';
import { Plane, MapPin, Mail, Clock, CheckCircle2, Trash2 } from 'lucide-react';

export const TravelCard = ({ travel, character, postcardCount = 0, onClick, onDelete }) => {
  const isCompleted = travel.status === 'completed';
  const isInTransit = travel.status === 'in_transit';

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(travel.id);
  };

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-3xl p-5 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-md"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      {/* 卡片头部：伴侣徽章与状态印章 */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2.5">
          {character?.avatar ? (
            <img 
              src={character.avatar} 
              alt={character.name} 
              className="w-7 h-7 rounded-full object-cover border"
              style={{ borderColor: 'var(--card-border)' }}
            />
          ) : (
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-serif"
              style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
            >
              {character?.name?.[0] || 'C'}
            </div>
          )}
          <div>
            <span className="text-xs font-bold block leading-none" style={{ color: 'var(--text-main)' }}>
              {character?.name || '伴侣'}
            </span>
            <span className="text-[10px] opacity-60 font-mono" style={{ color: 'var(--text-muted)' }}>
              TOGETHER WITH USER
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInTransit && (
            <span 
              className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
            >
              <Plane className="w-3 h-3 animate-pulse" />
              漫游中
            </span>
          )}
          {isCompleted && (
            <span 
              className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium opacity-80"
              style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-muted)' }}
            >
              <CheckCircle2 className="w-3 h-3" />
              已归档
            </span>
          )}
          <button
            onClick={handleDelete}
            title="彻底销毁旅行记录"
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 hover:text-rose-500"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 卡片主体：目的地与票根信息 */}
      <div className="py-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs opacity-70" style={{ color: 'var(--text-muted)' }}>
          <MapPin className="w-3.5 h-3.5" />
          <span>双人目的地</span>
        </div>
        <h3 className="text-xl font-bold font-serif tracking-tight" style={{ color: 'var(--text-main)' }}>
          {travel.destination || '未命名旅途'}
        </h3>
        <div className="text-xs font-mono opacity-80 pt-1" style={{ color: 'var(--text-sub)' }}>
          {travel.flightNo || 'FLIGHT-W88'} · {travel.hotelName || '栖宿酒店'}
        </div>
      </div>

      {/* 底部存根：明信片数 */}
      <div className="pt-3 border-t border-dashed flex items-center justify-between text-xs" style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}>
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          <span>收件箱 ({postcardCount} 封明信片)</span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3" />
          <span>{travel.durationHours || 12}h 漫游</span>
        </div>
      </div>
    </div>
  );
};

export default TravelCard;

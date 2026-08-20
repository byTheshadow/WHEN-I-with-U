import React from 'react';
import { Plane, Calendar, MapPin, Mail, Clock, CheckCircle2, Trash2 } from 'lucide-react';

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
      className="group relative flex flex-col justify-between rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        color: 'var(--text-main)',
        minHeight: '260px'
      }}
    >
      {/* 顶部拟真纸质条形边框与状态徽章 */}
      <div 
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}
      >
        <div className="flex items-center gap-2">
          {character?.avatar ? (
            <img 
              src={character.avatar} 
              alt={character.name} 
              className="w-6 h-6 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-neutral-300 flex items-center justify-center text-xs">
              {character?.name?.[0] || 'C'}
            </div>
          )}
          <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-main)' }}>
            {character?.name || '伴侣'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isInTransit && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Plane className="w-3 h-3 animate-pulse" />
              托管中
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              已归档
            </span>
          )}
          <button
            onClick={handleDelete}
            title="删除旅行记录"
            className="p-1 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 主体：拍立得图景与目的地名称 */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            <span>目的地</span>
          </div>
          <h3 className="text-xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-main)' }}>
            {travel.destination || '未命名旅途'}
          </h3>
          <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="font-mono text-[11px]">FLIGHT: {travel.flightNo || 'W-8802'}</span>
            <span>·</span>
            <span>{travel.hotelName || '精选栖宿'}</span>
          </div>
        </div>

        {/* 拟真撕沿条与明信片收集进度 */}
        <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Mail className="w-3.5 h-3.5" />
            <span>已收到 {postcardCount} 封明信片</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-3 h-3" />
            <span>{travel.durationHours || 12}h 漫游</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelCard;

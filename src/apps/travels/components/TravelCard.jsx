import React from 'react';
import { Plane, MapPin, Mail, Clock, CheckCircle2, Trash2 } from 'lucide-react';

export const TravelCard = ({ travel, character, postcardCount = 0, onClick, onDelete }) => {
  const isCompleted = travel.status === 'completed';
  const isInTransit = travel.status === 'in_transit';

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(travel.id);
  };

  // 生成邮戳短代号 (如 PARIS -> PAR)
  const destCode = (travel.destination || 'TRIP').slice(0, 3).toUpperCase();
  const createdYear = new Date(travel.createdAt || Date.now()).getFullYear();

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-2xl p-6 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg overflow-hidden border"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      {/* 邮票锯齿/线痕顶纹饰 */}
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 opacity-40 border-b border-dashed"
        style={{ borderColor: 'var(--card-border)' }}
      />

      {/* 卡片头部：伴侣与 User 双徽章 + 右侧复古印章 */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-dashed" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-3 min-w-0">
          {character?.avatar ? (
            <img 
              src={character.avatar} 
              alt={character.name} 
              className="w-10 h-10 rounded-full object-cover border shrink-0 shadow-sm"
              style={{ borderColor: 'var(--card-border)' }}
            />
          ) : (
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif font-bold shrink-0 border"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            >
              {character?.name?.[0] || 'C'}
            </div>
          )}
          
          <div className="truncate space-y-0.5">
            <div className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--text-main)' }}>
              {character?.name || '伴侣'}
            </div>
            <div className="text-[11px] font-mono opacity-70 truncate" style={{ color: 'var(--text-sub)' }}>
              & {travel.userPassportName || 'User'} 同游
            </div>
          </div>
        </div>

        {/* 右上角：复古邮戳印章 & 状态 */}
        <div className="flex items-center gap-2 shrink-0">
          <div 
            className="w-11 h-11 rounded-full border border-dashed flex flex-col items-center justify-center leading-none text-center transform rotate-12 opacity-80"
            style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}
          >
            <span className="text-[9px] font-mono font-bold tracking-tighter" style={{ color: 'var(--text-muted)' }}>{destCode}</span>
            <span className="text-[8px] font-mono opacity-60" style={{ color: 'var(--text-muted)' }}>{createdYear}</span>
          </div>

          <button
            onClick={handleDelete}
            title="彻底销毁旅行记录"
            className="p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-opacity-20 hover:opacity-100"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 卡片主体：目的地与机票信息 (空间充裕) */}
      <div className="py-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs opacity-75 font-mono" style={{ color: 'var(--text-sub)' }}>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span>漫游目的地</span>
          </div>

          {isInTransit && (
            <span 
              className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-sans font-medium"
              style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
            >
              <Plane className="w-3 h-3 animate-pulse" />
              漫游中
            </span>
          )}
          {isCompleted && (
            <span 
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-sans font-medium opacity-80"
              style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-muted)' }}
            >
              <CheckCircle2 className="w-3 h-3" />
              已完成
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold font-serif tracking-tight leading-snug truncate" style={{ color: 'var(--text-main)' }}>
          {travel.destination || '未命名旅途'}
        </h3>

        <div className="text-xs font-mono opacity-70 flex items-center gap-2 pt-0.5 truncate" style={{ color: 'var(--text-sub)' }}>
          <span>{travel.flightNo || 'FLIGHT-W88'}</span>
          <span>·</span>
          <span className="truncate">{travel.hotelName || '栖宿酒店'}</span>
        </div>
      </div>

      {/* 底部存根：明信片数与时间 */}
      <div 
        className="pt-3 border-t border-dashed flex items-center justify-between text-xs font-medium"
        style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
      >
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span>{postcardCount} 封旅途明信片</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{travel.durationHours || 12}h 漫游</span>
        </div>
      </div>
    </div>
  );
};

export default TravelCard;

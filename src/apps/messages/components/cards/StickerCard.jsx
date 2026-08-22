import React from 'react';

export const StickerCard = ({ metadata, isUser = false }) => {
  const url = metadata?.url || '';
  const name = metadata?.name || '表情包';

  return (
    <div className="my-1 select-none flex flex-col items-start group">
      <div 
        className="relative overflow-hidden rounded-2xl p-1 transition-all duration-300 transform group-hover:scale-105 active:scale-95"
        style={{
          backgroundColor: 'transparent',
          maxWidth: '160px',
          maxHeight: '160px'
        }}
      >
        {url ? (
          <img
            src={url}
            alt={name}
            className="w-full h-full object-cover rounded-xl shadow-sm border"
            style={{ borderColor: 'var(--card-border, rgba(0,0,0,0.08))' }}
            loading="lazy"
          />
        ) : (
          <div 
            className="w-28 h-28 rounded-xl flex items-center justify-center text-xs opacity-60 border border-dashed"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
          >
            [{name}]
          </div>
        )}
      </div>
      <span className="text-[9px] opacity-40 px-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {name}
      </span>
    </div>
  );
};

export default StickerCard;

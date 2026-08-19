import React from 'react';
import { GlassCard } from '../../components/GlassCard';
import { SvgIcon } from '../../components/SvgIcon';

const samplePhotos = [
  {
    id: 1,
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    caption: '午后咖啡馆的阳光片段'
  },
  {
    id: 2,
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    caption: '旅行途中偶遇的安静海滩'
  }
];

export const PhotoGallery = () => {
  return (
    <GlassCard className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <SvgIcon name="sparkles" className="w-4 h-4 text-purple-400" />
          <span>置顶时刻 & 生活画报</span>
        </h3>
        <span className="text-xs text-muted">2 张照片</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {samplePhotos.map((photo) => (
          <div key={photo.id} className="group relative rounded-2xl overflow-hidden glass-panel aspect-[4/3]">
            <img
              src={photo.url}
              alt={photo.caption}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-90 p-4 flex items-end">
              <p className="text-xs text-white/90 font-light">{photo.caption}</p>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default PhotoGallery;

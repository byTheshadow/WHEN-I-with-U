import React, { useState } from 'react';
import { Image as ImageIcon, RotateCw } from 'lucide-react';

export const ImageCard = ({ content, metadata = {} }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="relative cursor-pointer select-none perspective-1000"
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ perspective: '1000px' }}
    >
      <div
        className={`w-48 h-36 rounded-2xl transition-transform duration-700 transform-style-3d relative ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* 正面：图片或者占位 */}
        <div 
          className="absolute inset-0 rounded-2xl border p-3 flex flex-col justify-between backface-hidden"
          style={{
            backfaceVisibility: 'hidden',
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-[10px] font-mono">
            <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> IMAGE CARD</span>
            <RotateCw className="w-3 h-3" />
          </div>
          <p className="text-xs italic truncate my-auto">{content || '点击翻转查看画卷细节'}</p>
          <span className="text-[9px] opacity-40 text-right">点击翻转 3D Card</span>
        </div>

        {/* 背面：图片细节描述 */}
        <div 
          className="absolute inset-0 rounded-2xl border p-3 flex flex-col justify-between rotate-y-180 backface-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
            borderColor: 'var(--card-border)'
          }}
        >
          <span className="text-[9px] font-mono opacity-60">DETAILS / 画面描写</span>
          <p className="text-xs leading-relaxed overflow-y-auto max-h-24">
            {metadata.description || content || '静谧的氛围漫过镜头，停留在此刻。'}
          </p>
          <span className="text-[8px] opacity-50 text-right">点击翻回正页</span>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;

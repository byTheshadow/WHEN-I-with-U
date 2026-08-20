import React, { useState } from 'react';
import { Image, Eye, EyeOff } from 'lucide-react';

export const ImageCard = ({ content = '', metadata = {} }) => {
  const [showDescription, setShowDescription] = useState(false);
  const altText = metadata?.alt || 'Visual Description';

  return (
    <div className="space-y-2.5 max-w-[260px]">
      <div 
        onClick={() => setShowDescription(!showDescription)}
        className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/5 dark:bg-white/5 p-4 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
      >
        <div className="flex flex-col items-center justify-center py-6 space-y-2 text-center">
          <div className="p-3 rounded-full bg-black/5 dark:bg-white/10 opacity-80">
            <Image className="w-6 h-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase opacity-40">Virtual Image Attachment</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] opacity-70">
          <span className="truncate pr-2 font-medium">{altText}</span>
          <button type="button" className="shrink-0">
            {showDescription ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showDescription && (
        <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10 text-[11px] leading-relaxed opacity-90 animate-fade-in-up">
          <span className="block font-mono text-[9px] uppercase tracking-wider opacity-40 mb-1">Image Description</span>
          {content}
        </div>
      )}
    </div>
  );
};

export default ImageCard;

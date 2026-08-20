import React, { useState } from 'react';
import { Pin, Image as ImageIcon, Edit3, Check } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import { convertFileToBase64 } from '../../db/storageUtils';

export const PinnedGallery = ({ delay = 200 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState({
    caption: "A quiet afternoon in the city. Capturing the softest moments before dusk falls.",
    img1: "",
    img2: ""
  });

  const handleUpload = async (e, slot) => {
    const file = e.target.files[0];
    if (!file) return;
    const base64 = await convertFileToBase64(file);
    setData(prev => ({ ...prev, [slot]: base64 }));
  };

  return (
    <GlassCard delay={delay} className="space-y-4">
      {/* 极简标签 (小圆角 Pill 形状，无长竖条边框) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold uppercase tracking-wider opacity-80">
          <Pin className="w-3.5 h-3.5" />
          <span>Pinned Moment</span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs"
        >
          {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-3 text-left">
          <textarea
            value={data.caption}
            onChange={(e) => setData({ ...data, caption: e.target.value })}
            className="w-full p-2 text-xs rounded-xl bg-black/5 dark:bg-white/10 outline-none"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <label className="block mb-1 opacity-60">图 1 URL / 本地</label>
              <input
                type="text"
                placeholder="URL"
                value={data.img1}
                onChange={(e) => setData({ ...data, img1: e.target.value })}
                className="w-full p-1 bg-black/5 dark:bg-white/10 rounded mb-1 outline-none"
              />
              <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'img1')} />
            </div>
            <div>
              <label className="block mb-1 opacity-60">图 2 URL / 本地</label>
              <input
                type="text"
                placeholder="URL"
                value={data.img2}
                onChange={(e) => setData({ ...data, img2: e.target.value })}
                className="w-full p-1 bg-black/5 dark:bg-white/10 rounded mb-1 outline-none"
              />
              <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'img2')} />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed opacity-90 font-serif italic">
          "{data.caption}"
        </p>
      )}

      {/* 双图极简无杂质展位 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/5 dark:bg-white/5 aspect-[4/5] rounded-2xl flex items-center justify-center overflow-hidden border border-white/10">
          {data.img1 ? (
            <img src={data.img1} alt="Moment 1" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 opacity-30" />
          )}
        </div>
        <div className="bg-black/5 dark:bg-white/5 aspect-[4/5] rounded-2xl flex items-center justify-center overflow-hidden border border-white/10">
          {data.img2 ? (
            <img src={data.img2} alt="Moment 2" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 opacity-30" />
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export default PinnedGallery;

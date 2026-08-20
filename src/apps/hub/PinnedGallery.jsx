import React, { useState } from 'react';
import { Pin, Image as ImageIcon, Plus, Trash2, Edit2, Check } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const PinnedGallery = ({ delay = 200 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [gallery, setGallery] = useState({
    title: "Pinned Moment",
    caption: "A quiet afternoon in the city. Capturing the softest moments before dusk falls.",
    photos: [
      { id: 1, url: "" },
      { id: 2, url: "" },
      { id: 3, url: "" }
    ]
  });

  const addPhoto = () => {
    setGallery((prev) => ({
      ...prev,
      photos: [...prev.photos, { id: Date.now(), url: "" }]
    }));
  };

  const removePhoto = (id) => {
    setGallery((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id)
    }));
  };

  const handlePhotoUpload = (e, id) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setGallery((prev) => ({
        ...prev,
        photos: prev.photos.map((p) => (p.id === id ? { ...p, url: reader.result } : p))
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <GlassCard delay={delay} className="space-y-4 relative group">
      {/* 头部标题区 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold uppercase tracking-wider opacity-80">
          <Pin className="w-3.5 h-3.5" />
          <span>{gallery.title}</span>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 opacity-30 hover:opacity-100 focus:opacity-100 transition-opacity active:scale-95"
        >
          {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isEditing ? (
        <textarea
          value={gallery.caption}
          onChange={(e) => setGallery({ ...gallery, caption: e.target.value })}
          className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 text-xs outline-none font-serif italic"
        />
      ) : (
        <p className="text-xs leading-relaxed opacity-85 font-serif italic">
          "{gallery.caption}"
        </p>
      )}

      {/* 动态网格图片墙 */}
      <div className="grid grid-cols-2 gap-3">
        {gallery.photos.map((photo) => (
          <div
            key={photo.id}
            className="bg-black/5 dark:bg-white/5 aspect-[4/5] rounded-2xl flex items-center justify-center border border-white/10 relative overflow-hidden group/item"
          >
            {photo.url ? (
              <img src={photo.url} alt="Pinned" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-5 h-5 opacity-40" />
            )}

            {isEditing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                <label className="p-1.5 bg-white/20 rounded-full cursor-pointer text-white">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e, photo.id)}
                  />
                </label>
                {gallery.photos.length > 1 && (
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="p-1.5 bg-rose-500/80 text-white rounded-full"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            onClick={addPhoto}
            className="aspect-[4/5] rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 flex items-center justify-center opacity-60 hover:opacity-100"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>
    </GlassCard>
  );
};

export default PinnedGallery;

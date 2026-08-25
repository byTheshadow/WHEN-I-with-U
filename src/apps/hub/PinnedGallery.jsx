import React, { useEffect, useState } from 'react';
import {
  Pin,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

const GALLERY_ID = 'main';

const DEFAULT_GALLERY = {
  id: GALLERY_ID,
  title: 'Pinned Moment',
  caption:
    'A quiet afternoon in the city. Capturing the softest moments before dusk falls.',
  photos: [
    { id: 1, url: '' },
    { id: 2, url: '' },
    { id: 3, url: '' }
  ]
};

export const PinnedGallery = ({ delay = 200 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [gallery, setGallery] = useState(DEFAULT_GALLERY);
  const [storageWarning, setStorageWarning] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadGallery = async () => {
      try {
        const savedGallery = await db.pinnedGallery.get(GALLERY_ID);

        if (isMounted && savedGallery) {
          setGallery({
            ...DEFAULT_GALLERY,
            ...savedGallery,
            id: GALLERY_ID,
            photos: Array.isArray(savedGallery.photos)
              ? savedGallery.photos
              : DEFAULT_GALLERY.photos
          });
        }
      } catch (error) {
        console.error('Failed to load pinned gallery:', error);

        if (isMounted) {
          setStorageWarning('图片墙读取失败，请稍后重试。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadGallery();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveGallery = async (nextGallery = gallery) => {
    try {
      await db.pinnedGallery.put({
        ...DEFAULT_GALLERY,
        ...nextGallery,
        id: GALLERY_ID
      });

      setStorageWarning('');
    } catch (error) {
      console.error('Failed to save pinned gallery:', error);
      setStorageWarning(
        '图片墙保存失败，可能是图片文件过大或浏览器存储空间不足。'
      );
    }
  };

  const addPhoto = () => {
    const nextGallery = {
      ...gallery,
      photos: [
        ...gallery.photos,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: ''
        }
      ]
    };

    setGallery(nextGallery);
    void saveGallery(nextGallery);
  };

  const removePhoto = (id) => {
    const nextGallery = {
      ...gallery,
      photos: gallery.photos.filter((photo) => photo.id !== id)
    };

    setGallery(nextGallery);
    void saveGallery(nextGallery);
  };

  const handlePhotoUpload = (event, id) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStorageWarning('请选择图片文件。');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStorageWarning(
        '图片超过 2MB，仍会尝试保存，但建议使用较小的图片以避免 IndexedDB 存储空间不足。'
      );
    } else {
      setStorageWarning('');
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const imageData = reader.result;

      if (typeof imageData !== 'string') {
        setStorageWarning('图片读取失败，请重新选择。');
        return;
      }

      const nextGallery = {
        ...gallery,
        photos: gallery.photos.map((photo) =>
          photo.id === id
            ? {
                ...photo,
                url: imageData
              }
            : photo
        )
      };

      setGallery(nextGallery);
      await saveGallery(nextGallery);
    };

    reader.onerror = () => {
      setStorageWarning('图片读取失败，请重新选择。');
    };

    reader.readAsDataURL(file);

    // 允许连续选择同一张图片
    event.target.value = '';
  };

  const handleEditingToggle = async () => {
    if (isEditing) {
      await saveGallery(gallery);
    }

    setIsEditing((value) => !value);
  };

  if (isLoading) {
    return (
      <GlassCard delay={delay} className="relative space-y-4">
        <div className="h-48 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={delay} className="relative space-y-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider opacity-80 dark:bg-white/10">
          <Pin className="h-3.5 w-3.5" />
          <span>{gallery.title}</span>
        </div>

        <button
          type="button"
          onClick={() => void handleEditingToggle()}
          className="rounded-full bg-black/5 p-1.5 opacity-30 transition-opacity hover:opacity-100 focus:opacity-100 active:scale-95 dark:bg-white/10"
          title={isEditing ? '保存图片墙' : '编辑图片墙'}
          aria-label={isEditing ? '保存图片墙' : '编辑图片墙'}
        >
          {isEditing ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Edit2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {storageWarning && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {isEditing ? (
        <textarea
          value={gallery.caption}
          onChange={(event) =>
            setGallery((prev) => ({
              ...prev,
              caption: event.target.value
            }))
          }
          className="w-full rounded-lg bg-black/5 p-2 font-serif text-xs italic outline-none dark:bg-white/10"
        />
      ) : (
        <p className="font-serif text-xs italic leading-relaxed opacity-85">
          "{gallery.caption}"
        </p>
      )}

      {/* 图片墙 */}
      <div className="grid grid-cols-2 gap-3">
        {gallery.photos.map((photo) => (
          <div
            key={photo.id}
            className="group/item relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/5 dark:bg-white/5"
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt="Pinned"
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-5 w-5 opacity-40" />
            )}

            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40">
                <label className="cursor-pointer rounded-full bg-white/20 p-1.5 text-white">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      handlePhotoUpload(event, photo.id)
                    }
                  />
                </label>

                {gallery.photos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="rounded-full bg-rose-500/80 p-1.5 text-white"
                    title="删除图片"
                    aria-label="删除图片"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            type="button"
            onClick={addPhoto}
            className="flex aspect-[4/5] items-center justify-center rounded-2xl border-2 border-dashed border-black/10 opacity-60 hover:opacity-100 dark:border-white/10"
            title="添加图片"
            aria-label="添加图片"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>
    </GlassCard>
  );
};

export default PinnedGallery;


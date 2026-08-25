import React, { useEffect, useState } from 'react';
import {
  Camera,
  MapPin,
  Calendar,
  Edit2,
  Check,
  AlertCircle
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

const PROFILE_ID = 'main';

const DEFAULT_PROFILE = {
  id: PROFILE_ID,
  name: 'User Name',
  handle: '@username',
  bio: 'We are all in the gutter, but some of us are looking at the stars.',
  location: 'City, Earth',
  joined: 'Aug 2026',
  avatar: '',
  banner: ''
};

export const ProfileHeader = ({ delay = 100 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [storageWarning, setStorageWarning] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const savedProfile = await db.profile.get(PROFILE_ID);

        if (isMounted && savedProfile) {
          setProfile({
            ...DEFAULT_PROFILE,
            ...savedProfile,
            id: PROFILE_ID
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);

        if (isMounted) {
          setStorageWarning('资料读取失败，请稍后重试。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveProfile = async (nextProfile = profile) => {
    try {
      await db.profile.put({
        ...DEFAULT_PROFILE,
        ...nextProfile,
        id: PROFILE_ID
      });

      setStorageWarning('');
    } catch (error) {
      console.error('Failed to save profile:', error);
      setStorageWarning('资料保存失败，可能是图片文件过大或浏览器存储空间不足。');
    }
  };

  const handleImageUpload = (event, field) => {
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

      const nextProfile = {
        ...profile,
        [field]: imageData
      };

      setProfile(nextProfile);
      await saveProfile(nextProfile);
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
      await saveProfile(profile);
    }

    setIsEditing((value) => !value);
  };

  if (isLoading) {
    return (
      <GlassCard delay={delay} className="relative overflow-hidden p-2">
        <div className="h-48 animate-pulse rounded-[1.5rem] bg-black/5 dark:bg-white/5" />
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={delay} className="relative overflow-hidden p-2">
      {/* Banner */}
      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/5 dark:bg-white/5">
        {profile.banner ? (
          <img
            src={profile.banner}
            alt="Banner"
            className="h-full w-full object-cover"
          />
        ) : (
          <Camera className="h-6 w-6 opacity-30" />
        )}

        {isEditing && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center gap-1 bg-black/30 text-xs font-medium text-white opacity-90 backdrop-blur-sm">
            <Camera className="h-4 w-4" />
            <span>Upload Banner</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImageUpload(event, 'banner')}
            />
          </label>
        )}
      </div>

      {/* Avatar */}
      <div className="relative z-10 -mt-10 ml-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white/80 bg-black/10 shadow-md backdrop-blur-md dark:border-slate-800">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <Camera className="h-5 w-5 opacity-40" />
        )}

        {isEditing && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImageUpload(event, 'avatar')}
            />
          </label>
        )}
      </div>

      {/* Edit / Save */}
      <button
        type="button"
        onClick={() => void handleEditingToggle()}
        className="absolute right-5 top-36 rounded-full bg-black/5 p-1.5 opacity-30 transition-opacity hover:opacity-100 focus:opacity-100 active:scale-95 dark:bg-white/10"
        title={isEditing ? '保存资料' : '编辑资料'}
        aria-label={isEditing ? '保存资料' : '编辑资料'}
      >
        {isEditing ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Edit2 className="h-3.5 w-3.5" />
        )}
      </button>

      {storageWarning && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* Profile content */}
      <div className="space-y-2 px-5 pb-4 pt-3">
        {isEditing ? (
          <div className="space-y-2 text-xs">
            <input
              type="text"
              placeholder="Name Placeholder"
              value={profile.name}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  name: event.target.value
                }))
              }
              className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 font-bold outline-none dark:bg-white/10"
            />

            <input
              type="text"
              placeholder="@handle"
              value={profile.handle}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  handle: event.target.value
                }))
              }
              className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 outline-none dark:bg-white/10"
            />

            <textarea
              placeholder="Write your bio..."
              value={profile.bio}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  bio: event.target.value
                }))
              }
              className="h-16 w-full resize-none rounded-lg bg-black/5 px-2.5 py-1.5 outline-none dark:bg-white/10"
            />
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold tracking-tight">
              {profile.name}
            </h2>

            <p className="text-xs font-medium opacity-50">
              {profile.handle}
            </p>

            <p className="mt-2 font-serif text-xs italic leading-relaxed opacity-85">
              "{profile.bio}"
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-medium uppercase tracking-wider opacity-50">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <span>{profile.location}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{profile.joined}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default ProfileHeader;

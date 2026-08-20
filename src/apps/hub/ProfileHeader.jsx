import React, { useState } from 'react';
import { Camera, MapPin, Calendar, Edit2, Check, AlertCircle } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const ProfileHeader = ({ delay = 100 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "User Name",
    handle: "@username",
    bio: "We are all in the gutter, but some of us are looking at the stars.",
    location: "City, Earth",
    joined: "Aug 2026",
    avatar: "",
    banner: ""
  });
  const [storageWarning, setStorageWarning] = useState("");

  // 本地图片转换与存储提示
  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStorageWarning("High-resolution file detected (>2MB). Consider using image URLs to save IndexedDB space.");
    } else {
      setStorageWarning("");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, [field]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <GlassCard delay={delay} className="p-2 relative overflow-hidden group">
      {/* Banner 图像区 */}
      <div className="h-32 rounded-[1.5rem] bg-black/5 dark:bg-white/5 overflow-hidden relative flex items-center justify-center border border-white/10">
        {profile.banner ? (
          <img src={profile.banner} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-6 h-6 opacity-30" />
        )}
        {isEditing && (
          <label className="absolute inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center cursor-pointer text-white text-xs font-medium gap-1 opacity-90">
            <Camera className="w-4 h-4" />
            <span>Upload Banner</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} />
          </label>
        )}
      </div>

      {/* 头像 */}
      <div className="w-20 h-20 rounded-full border-4 border-white/80 dark:border-slate-800 shadow-md -mt-10 ml-6 relative z-10 bg-black/10 backdrop-blur-md flex items-center justify-center overflow-hidden">
        {profile.avatar ? (
          <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-5 h-5 opacity-40" />
        )}
        {isEditing && (
          <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
            <Camera className="w-4 h-4" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'avatar')} />
          </label>
        )}
      </div>

      {/* 极轻微隐蔽的小铅笔编辑按钮 (触摸友好且低干扰) */}
      <button
        onClick={() => setIsEditing(!isEditing)}
        className="absolute top-36 right-5 p-1.5 rounded-full bg-black/5 dark:bg-white/10 opacity-30 hover:opacity-100 focus:opacity-100 transition-opacity active:scale-95"
        title="Edit Profile"
      >
        {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
      </button>

      {/* 内存警告提示 */}
      {storageWarning && (
        <div className="mx-5 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* 资料与编辑输入 */}
      <div className="px-5 pt-3 pb-4 space-y-2">
        {isEditing ? (
          <div className="space-y-2 text-xs">
            <input
              type="text"
              placeholder="Name Placeholder"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="font-bold bg-black/5 dark:bg-white/10 rounded-lg px-2.5 py-1.5 w-full outline-none"
            />
            <input
              type="text"
              placeholder="@handle"
              value={profile.handle}
              onChange={(e) => setProfile({ ...profile, handle: e.target.value })}
              className="bg-black/5 dark:bg-white/10 rounded-lg px-2.5 py-1.5 w-full outline-none"
            />
            <textarea
              placeholder="Write your bio..."
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="bg-black/5 dark:bg-white/10 rounded-lg px-2.5 py-1.5 w-full outline-none resize-none h-16"
            />
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
            <p className="text-xs opacity-50 font-medium">{profile.handle}</p>
            <p className="mt-2 text-xs leading-relaxed opacity-85 font-serif italic">
              "{profile.bio}"
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] opacity-50 font-medium uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{profile.location}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{profile.joined}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default ProfileHeader;

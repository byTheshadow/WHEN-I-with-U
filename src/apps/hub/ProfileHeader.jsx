import React, { useState } from 'react';
import { Camera, MapPin, Calendar, Edit3, Check, AlertCircle, Upload, Link } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import { convertFileToBase64 } from '../../db/storageUtils';

export const ProfileHeader = ({ delay = 100 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "User Name",
    handle: "@username",
    bio: "We are all in the gutter, but some of us are looking at the stars.",
    location: "City, Earth",
    joined: "Aug 2026",
    avatarUrl: "",
    bannerUrl: ""
  });

  const [inputBannerUrl, setInputBannerUrl] = useState('');
  const [inputAvatarUrl, setInputAvatarUrl] = useState('');

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("上传文件过大，请保持在 3MB 以内以节省空间。");
      return;
    }
    const base64 = await convertFileToBase64(file);
    if (type === 'banner') setProfile(prev => ({ ...prev, bannerUrl: base64 }));
    if (type === 'avatar') setProfile(prev => ({ ...prev, avatarUrl: base64 }));
  };

  return (
    <GlassCard delay={delay} className="p-2 relative overflow-hidden">
      {/* Banner 图像区 */}
      <div className="h-32 rounded-[1.5rem] bg-black/5 dark:bg-white/5 overflow-hidden relative flex items-center justify-center border border-white/20">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-6 h-6 opacity-30" />
        )}
      </div>

      {/* Avatar 图像区 */}
      <div className="w-20 h-20 rounded-full border-4 border-white/80 shadow-sm -mt-10 ml-6 relative z-10 bg-black/10 backdrop-blur-md flex items-center justify-center overflow-hidden">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-5 h-5 opacity-40" />
        )}
      </div>

      {/* 编辑开关 */}
      <button
        onClick={() => setIsEditing(!isEditing)}
        className="absolute top-36 right-5 p-2 rounded-full bg-black/5 dark:bg-white/10 text-xs transition-transform active:scale-95"
      >
        {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
      </button>

      {/* 内容区域 */}
      <div className="px-5 pt-3 pb-4">
        {isEditing ? (
          <div className="space-y-3 my-2 text-left">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>本地上传图片将占用浏览器 IndexedDB 大容量存储，建议优先使用图片 URL 或进行压缩。</span>
            </div>

            {/* 图像 URL 或 文件设置 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] opacity-60 mb-1">Banner 图链接/上传</label>
                <input
                  type="text"
                  placeholder="图片 URL"
                  value={profile.bannerUrl}
                  onChange={(e) => setProfile({ ...profile, bannerUrl: e.target.value })}
                  className="w-full p-1.5 rounded-lg bg-black/5 dark:bg-white/10 outline-none text-xs mb-1"
                />
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'banner')} className="text-[10px]" />
              </div>

              <div>
                <label className="block text-[10px] opacity-60 mb-1">头像 URL/上传</label>
                <input
                  type="text"
                  placeholder="头像 URL"
                  value={profile.avatarUrl}
                  onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                  className="w-full p-1.5 rounded-lg bg-black/5 dark:bg-white/10 outline-none text-xs mb-1"
                />
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} className="text-[10px]" />
              </div>
            </div>

            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="text-sm font-bold bg-black/5 dark:bg-white/10 rounded-lg p-2 w-full outline-none"
              placeholder="Nickname"
            />
            <input
              type="text"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="text-xs bg-black/5 dark:bg-white/10 rounded-lg p-2 w-full outline-none"
              placeholder="Bio"
            />
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
            <p className="text-xs opacity-50 font-medium">{profile.handle}</p>
            <p className="mt-3 text-xs leading-relaxed opacity-85 font-serif italic">
              "{profile.bio}"
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] opacity-50 font-medium uppercase tracking-wider">
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

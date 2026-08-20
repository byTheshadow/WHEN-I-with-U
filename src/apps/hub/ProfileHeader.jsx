import React, { useState } from 'react';
import { Camera, MapPin, Calendar, Edit3, Check } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const ProfileHeader = ({ delay = 100 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "User Name",
    handle: "@username",
    bio: "We are all in the gutter, but some of us are looking at the stars.",
    location: "City, Earth",
    joined: "Aug 2026"
  });

  return (
    <GlassCard delay={delay} className="p-2 relative overflow-hidden">
      {/* Banner 占位区 */}
      <div className="h-32 rounded-[1.5rem] bg-black/5 dark:bg-white/5 overflow-hidden relative flex items-center justify-center group cursor-pointer border border-white/20">
        <Camera className="w-6 h-6 opacity-40 group-hover:opacity-80 transition-opacity" />
      </div>

      {/* 头像 */}
      <div className="w-20 h-20 rounded-full border-4 border-white/80 shadow-sm -mt-10 ml-6 relative z-10 bg-black/10 backdrop-blur-md flex items-center justify-center overflow-hidden">
        <Camera className="w-5 h-5 opacity-50" />
      </div>

      {/* 编辑按钮 */}
      <button
        onClick={() => setIsEditing(!isEditing)}
        className="absolute top-36 right-5 p-2 rounded-full bg-black/5 dark:bg-white/10 text-xs transition-transform active:scale-95"
      >
        {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
      </button>

      {/* 信息区域 */}
      <div className="px-5 pt-3 pb-4">
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="text-lg font-bold bg-black/5 dark:bg-white/10 rounded-lg px-2 py-1 w-full outline-none"
            />
            <input
              type="text"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="text-xs bg-black/5 dark:bg-white/10 rounded-lg px-2 py-1 w-full outline-none"
            />
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
            <p className="text-xs opacity-60 font-medium">{profile.handle}</p>
            <p className="mt-3 text-xs leading-relaxed opacity-85 font-serif italic">
              "{profile.bio}"
            </p>
          </>
        )}

        {/* 元数据 */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] opacity-60 font-medium uppercase tracking-wider">
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

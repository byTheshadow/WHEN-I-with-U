import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  ShieldCheck,
  Play,
  Pause,
  Edit3,
  Check,
  Disc,
  Radio,
  Upload,
  Sparkles,
  Music,
  Activity,
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

export const KeepAlivePlayer = ({ delay = 450 }) => {
  // --- 状态定义 ---
  const [isActive, setIsActive] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // 自定义可编辑文本
  const [title, setTitle] = useState('You Make Me Sad');
  const [artist, setArtist] = useState('Lovely Bomb · Angel Kittens');
  const [quote, setQuote] = useState('有些歌不是一个人听完的。它们穿过夜色，把两个相隔很远的人放进同一段旋律。');

  // 自定义头像 (支持上传)
  const [userAvatar, setUserAvatar] = useState(null);
  const [companionAvatar, setCompanionAvatar] = useState(null);
  const [companionName, setCompanionName] = useState('伴侣');

  // 网站全局数据统计
  const [stats, setStats] = useState({
    diariesCount: 0,
    snapshotsCount: 0,
    travelsCount: 0,
    todosCount: 0,
  });

  // 音频与 Web Audio API 引用
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);
  const userInputRef = useRef(null);
  const companionInputRef = useRef(null);

  // 1秒 Base64 静音 WAV 备用源 (维持 iOS/Android Media Session)
  const silentWavData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  // --- 初始化读取数据库数据 ---
  useEffect(() => {
    loadPlayerData();
    loadSystemStats();
  }, []);

  const loadPlayerData = async () => {
    try {
      // 1. 读取保存的播放器自定义设置
      const savedConfig = await db.settings.get('player_config');
      if (savedConfig?.value) {
        if (savedConfig.value.title) setTitle(savedConfig.value.title);
        if (savedConfig.value.artist) setArtist(savedConfig.value.artist);
        if (savedConfig.value.quote) setQuote(savedConfig.value.quote);
        if (savedConfig.value.userAvatar) setUserAvatar(savedConfig.value.userAvatar);
        if (savedConfig.value.companionAvatar) setCompanionAvatar(savedConfig.value.companionAvatar);
        if (savedConfig.value.isActive !== undefined) setIsActive(savedConfig.value.isActive);
      }

      // 2. 如果未自定义头像，自动读取 DB 默认 Profile & Character 头像
      const profile = await db.profile.get('default_user');
      if (profile?.avatar && !savedConfig?.value?.userAvatar) {
        setUserAvatar(profile.avatar);
      }

      const activeChar = await db.characters.orderBy('id').first();
      if (activeChar) {
        setCompanionName(activeChar.name || '伴侣');
        if (activeChar.avatar && !savedConfig?.value?.companionAvatar) {
          setCompanionAvatar(activeChar.avatar);
        }
      }
    } catch (err) {
      console.warn('Load player config notice:', err);
    }
  };

  const loadSystemStats = async () => {
    try {
      const diariesCount = await db.diaries.count();
      const snapshotsCount = await db.snapshots.count();
      const travelsCount = await db.travels.count();
      const todosCount = await db.todos.count();

      setStats({
        diariesCount,
        snapshotsCount,
        travelsCount,
        todosCount,
      });
    } catch (err) {
      console.warn('Load stats notice:', err);
    }
  };

  // 持久化保存设置
  const savePlayerConfig = async (newFields) => {
    try {
      const existing = (await db.settings.get('player_config'))?.value || {};
      const updated = {
        ...existing,
        title,
        artist,
        quote,
        userAvatar,
        companionAvatar,
        isActive,
        ...newFields,
      };
      await db.settings.put({ key: 'player_config', value: updated });
    } catch (err) {
      console.error('Save player config error:', err);
    }
  };

  // --- 保活与音频播放控制 ---
  useEffect(() => {
    if (isActive) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }
    return () => stopKeepAlive();
  }, [isActive]);

  const startKeepAlive = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        // 极低频 1Hz 静音震荡
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1, audioContextRef.current.currentTime);
        gain.gain.setValueAtTime(0.0001, audioContextRef.current.currentTime);

        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);

        osc.start();
        oscillatorRef.current = osc;
        gainNodeRef.current = gain;
      }

      if (audioRef.current) {
        audioRef.current.play().catch((err) => {
          console.warn('Audio keep-alive notice:', err);
        });
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || 'WHEN I with U',
          artist: companionName ? `Together with ${companionName}` : 'Personal Companion Space',
          album: 'Background Keep-Alive Active',
        });
      }
    } catch (err) {
      console.error('KeepAlive start failed:', err);
    }
  };

  const stopKeepAlive = () => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } catch (err) {
      console.warn('KeepAlive stop notice:', err);
    }
  };

  const toggleActive = () => {
    const nextState = !isActive;
    setIsActive(nextState);
    savePlayerConfig({ isActive: nextState });
  };

  // --- 头像选择处理 ---
  const handleAvatarUpload = (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (target === 'user') {
        setUserAvatar(dataUrl);
        savePlayerConfig({ userAvatar: dataUrl });
      } else {
        setCompanionAvatar(dataUrl);
        savePlayerConfig({ companionAvatar: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  // 保存文本修改
  const handleSaveText = () => {
    setIsEditingText(false);
    savePlayerConfig({ title, artist, quote });
  };

  return (
    <GlassCard delay={delay} className="relative overflow-hidden space-y-4">
      {/* 隐藏的文件上传 input */}
      <input
        type="file"
        ref={userInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarUpload(e, 'user')}
      />
      <input
        type="file"
        ref={companionInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarUpload(e, 'companion')}
      />
      <audio ref={audioRef} src={silentWavData} loop hidden />

      {/* 顶部 Header：状态指示与切换按钮 */}
      <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isActive ? 'bg-emerald-500 animate-ping absolute inset-0 opacity-75' : 'bg-stone-400'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full relative ${
                isActive ? 'bg-emerald-500' : 'bg-stone-400'
              }`}
            />
          </div>
          <span className="text-[10px] font-semibold tracking-widest uppercase opacity-70">
            {isActive ? 'Live Syncing · 保活已启动' : 'Keep Alive · 静置中'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStats(!showStats)}
            className="p-1 rounded-lg transition-colors opacity-60 hover:opacity-100"
            title="查看全站状态"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => (isEditingText ? handleSaveText() : setIsEditingText(true))}
            className="p-1 rounded-lg transition-colors opacity-60 hover:opacity-100"
            title={isEditingText ? '完成编辑' : '编辑文字与信息'}
          >
            {isEditingText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Edit3 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 全站数据统计面板 (收纳展开) */}
      {showStats && (
        <div
          className="p-2.5 rounded-xl border text-[11px] grid grid-cols-4 gap-2 text-center animate-fade-in-up"
          style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
        >
          <div>
            <div className="font-bold text-xs">{stats.diariesCount}</div>
            <div className="text-[9px] opacity-60">手帐日记</div>
          </div>
          <div>
            <div className="font-bold text-xs">{stats.snapshotsCount}</div>
            <div className="text-[9px] opacity-60">拍立得</div>
          </div>
          <div>
            <div className="font-bold text-xs">{stats.travelsCount}</div>
            <div className="text-[9px] opacity-60">旅行集邮</div>
          </div>
          <div>
            <div className="font-bold text-xs">{stats.todosCount}</div>
            <div className="text-[9px] opacity-60">生活待办</div>
          </div>
        </div>
      )}

      {/* 核心黑胶唱片与手帐试听区 */}
      <div className="flex items-center gap-4">
        {/* 左侧旋转黑胶唱片 */}
        <div className="relative shrink-0 w-24 h-24 flex items-center justify-center">
          <div
            className="w-24 h-24 rounded-full border shadow-md flex items-center justify-center transition-all"
            style={{
              background: 'repeating-radial-gradient(circle, #202021 0px, #202021 2px, #151516 3px, #252526 4px)',
              borderColor: 'var(--card-border)',
              animation: isActive ? 'spin 16s linear infinite' : 'none',
            }}
          >
            {/* 唱片中央孔位与贴标 */}
            <div
              className="w-9 h-9 rounded-full border flex items-center justify-center overflow-hidden"
              style={{ borderColor: 'var(--divider)', background: 'var(--card-bg)' }}
            >
              <Disc className={`w-5 h-5 ${isActive ? 'animate-pulse text-emerald-500' : 'opacity-40'}`} />
            </div>
          </div>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>

        {/* 右侧曲目信息与文字编辑 */}
        <div className="flex-1 min-w-0 space-y-1">
          {isEditingText ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs font-bold px-2 py-1 rounded border bg-transparent"
                style={{ borderColor: 'var(--card-border)' }}
                placeholder="自定义曲目/主题名称"
              />
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full text-[10px] px-2 py-0.5 rounded border bg-transparent"
                style={{ borderColor: 'var(--card-border)' }}
                placeholder="自定义歌手/伴侣短语"
              />
            </div>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-wider opacity-50 flex items-center gap-1 font-mono">
                <Music className="w-3 h-3" />
                <span>Now Playing · KeepAlive</span>
              </div>
              <h4 className="font-serif font-bold text-base tracking-tight truncate">{title}</h4>
              <p className="text-[11px] opacity-70 truncate">{artist}</p>
            </>
          )}
        </div>
      </div>

      {/* 手帐文案寄语区 */}
      <div className="text-[11px] italic opacity-75 border-l-2 pl-2.5 py-0.5" style={{ borderColor: 'var(--card-border)' }}>
        {isEditingText ? (
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={2}
            className="w-full text-[11px] p-1 rounded border bg-transparent italic"
            style={{ borderColor: 'var(--card-border)' }}
            placeholder="自定义浪漫随笔/寄语..."
          />
        ) : (
          <p className="line-clamp-2">{quote}</p>
        )}
      </div>

      {/* 双人头像与同听状态（点击头像支持上传自定义图） */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-2">
            {/* 伴侣头像 */}
            <button
              type="button"
              onClick={() => companionInputRef.current?.click()}
              className="relative w-8 h-8 rounded-full border-2 overflow-hidden shadow-sm transition-transform active:scale-95 group"
              style={{ borderColor: 'var(--card-bg)', background: 'var(--control-soft-bg)' }}
              title="点击更换伴侣头像"
            >
              {companionAvatar ? (
                <img src={companionAvatar} alt="Companion" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                  {companionName[0] || 'C'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Upload className="w-3 h-3 text-white" />
              </div>
            </button>

            {/* 用户头像 */}
            <button
              type="button"
              onClick={() => userInputRef.current?.click()}
              className="relative w-8 h-8 rounded-full border-2 overflow-hidden shadow-sm transition-transform active:scale-95 group"
              style={{ borderColor: 'var(--card-bg)', background: 'var(--control-soft-bg)' }}
              title="点击更换你的头像"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="User" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">U</div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Upload className="w-3 h-3 text-white" />
              </div>
            </button>
          </div>

          <div className="text-[10px]">
            <div className="font-semibold">你 和 {companionName}</div>
            <div className="opacity-50">双通道音轨同听中</div>
          </div>
        </div>

        {/* 播放控制与保活开关按纽 */}
        <button
          type="button"
          onClick={toggleActive}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all active:scale-95"
          style={{
            backgroundColor: isActive ? 'var(--accent-color)' : 'var(--control-soft-bg)',
            color: isActive ? 'var(--accent-foreground)' : 'var(--text-main)',
            border: '1px solid var(--card-border)',
          }}
        >
          {isActive ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>暂停保活</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>开启保活</span>
            </>
          )}
        </button>
      </div>

      {/* 底部律动音轨 (Wave bars) */}
      <div className="flex items-center justify-between gap-1 h-5 pt-1">
        {Array.from({ length: 28 }).map((_, idx) => {
          const randomHeight = isActive
            ? 4 + Math.abs(Math.sin((idx + 1) * 0.7)) * 14
            : 3;
          return (
            <span
              key={idx}
              className="flex-1 rounded-full transition-all duration-300"
              style={{
                height: `${randomHeight}px`,
                backgroundColor: isActive ? 'var(--accent-color)' : 'var(--divider)',
                opacity: isActive ? 0.8 : 0.3,
              }}
            />
          );
        })}
      </div>
    </GlassCard>
  );
};

export default KeepAlivePlayer;

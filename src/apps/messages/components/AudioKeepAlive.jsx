import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export const AudioKeepAlive = ({ isActive, onToggle }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (isActive && audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.warn('Audio keep-alive playback blocked by browser:', err);
      });
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isActive]);

  // 静音 1 秒的 WAV 矢量 Base64
  const silentWavData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 text-xs">
      <div className="flex items-center gap-2">
        {isActive ? <Volume2 className="w-4 h-4 text-emerald-500 animate-pulse" /> : <VolumeX className="w-4 h-4 opacity-40" />}
        <div>
          <span className="font-medium block text-[11px]">后台保活静音音频</span>
          <span className="text-[9px] opacity-50">开启后防止移动端 PWA 休眠掉线</span>
        </div>
      </div>

      <input
        type="checkbox"
        checked={isActive}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 accent-black dark:accent-white"
      />

      <audio ref={audioRef} src={silentWavData} loop hidden />
    </div>
  );
};

export default AudioKeepAlive;

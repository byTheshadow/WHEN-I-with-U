import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX, ShieldCheck } from 'lucide-react';

export const AudioKeepAlive = ({ isActive, onToggle }) => {
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);

  // 10分钟/持续后台保活机制
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
      // 1. 启动 Web Audio API
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        // 创建近乎无声的微弱低频信号维持系统音频通道
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1, audioContextRef.current.currentTime); // 1Hz 极低频
        gain.gain.setValueAtTime(0.0001, audioContextRef.current.currentTime); // 近乎绝对静音

        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);

        osc.start();
        oscillatorRef.current = osc;
        gainNodeRef.current = gain;
      }

      // 2. 挂载 HTML5 Loop Audio 备用通道
      if (audioRef.current) {
        audioRef.current.play().catch((err) => {
          console.warn('Audio keep-alive auto-play Notice:', err);
        });
      }

      // 3. 注册 Media Session (告知 iOS / Android 保持后台进程，至少保活10分钟+)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'WHEN I with U',
          artist: 'Personal Companion Space',
          album: 'Background Keep-Alive Active'
        });
      }
    } catch (err) {
      console.error('KeepAlive startup failed:', err);
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

  // 1秒 Base64 静音 WAV 备用源
  const silentWavData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  return (
    <div 
      className="flex items-center justify-between p-3 rounded-2xl border text-xs transition-all shadow-sm"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <div className="flex items-center gap-2.5">
        {isActive ? (
          <Volume2 className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
        ) : (
          <VolumeX className="w-4 h-4 opacity-40 shrink-0" />
        )}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 font-medium text-[11px]">
            <span>后台保活 (Keep Alive)</span>
            {isActive && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
          </div>
          <p className="text-[9px] opacity-50">
            {isActive ? '双通道静音震荡运行中，支持后台挂起 10分钟+' : '开启后防止移动端 PWA / 浏览器切后台休眠'}
          </p>
        </div>
      </div>

      <input
        type="checkbox"
        checked={isActive}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 accent-black dark:accent-white cursor-pointer"
      />

      <audio ref={audioRef} src={silentWavData} loop hidden />
    </div>
  );
};

export default AudioKeepAlive;
import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  LoaderCircle,
  Pause,
  Play,
  RotateCw,
} from 'lucide-react';

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function RealVoiceCard({
  content,
  metadata,
}) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const status = metadata?.generationStatus || 'pending';
  const audioBlob = metadata?.audioBlob;

  useEffect(() => {
    if (!audioBlob) return undefined;

    const objectUrl = URL.createObjectURL(audioBlob);
    objectUrlRef.current = objectUrl;

    if (audioRef.current) {
      audioRef.current.src = objectUrl;
    }

    return () => {
      URL.revokeObjectURL(objectUrl);
      objectUrlRef.current = '';
    };
  }, [audioBlob]);

  const handleToggle = async () => {
    const audio = audioRef.current;

    if (!audio || status !== 'ready') return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.warn('[RealVoice] 浏览器阻止了播放：', error);
    }
  };

  if (status === 'pending') {
    return (
      <div className="w-[254px] rounded-[18px] border border-black/10 bg-black/[0.035] p-3 dark:border-white/10 dark:bg-white/[0.05]">
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin opacity-65" />
          <div>
            <p className="text-[11px] font-semibold">声音正在被写下</p>
            <p className="mt-0.5 text-[10px] opacity-55">
              这一段话正在变成可以保存的声音。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="w-[254px] rounded-[18px] border border-dashed border-red-400/40 bg-red-500/[0.04] p-3">
        <div className="flex items-start gap-2">
          <RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="text-[11px] font-semibold text-red-500">
              这段声音没有顺利抵达
            </p>
            <p className="mt-1 text-[10px] leading-relaxed opacity-65">
              {metadata?.errorMessage || '请检查该角色的 MiniMax 设置后再试。'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[254px] overflow-hidden rounded-[18px] border border-black/10 bg-black/[0.035] shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime || 0);
        }}
      />

      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={handleToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[var(--bg-color)] transition-transform active:scale-95 dark:border-white/15"
          aria-label={isPlaying ? '暂停声音留笺' : '播放声音留笺'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.12em] opacity-65">
              <AudioLines className="h-3 w-3" />
              声音留笺
            </span>
            <span className="font-mono text-[10px] opacity-50">
              {formatTime(isPlaying ? currentTime : duration)}
            </span>
          </div>

          <div className="mt-2 flex h-4 items-end gap-[3px] opacity-60">
            {[7, 12, 8, 15, 10, 14, 6, 13, 9, 16, 11, 7, 14, 8, 12].map(
              (height, index) => (
                <span
                  key={index}
                  className={`w-[2px] rounded-full bg-current ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                  style={{
                    height: `${height}px`,
                    animationDelay: `${index * 75}ms`,
                  }}
                />
              ),
            )}
          </div>
        </div>
      </div>

      {content && (
        <p className="border-t border-black/[0.07] px-3 py-2 text-[10px] leading-relaxed opacity-60 dark:border-white/[0.08]">
          {content}
        </p>
      )}
    </div>
  );
}

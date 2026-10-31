// src/apps/hub/useKeepAliveAudio.js
//
// 首页「静音保活」播放：让页面在后台时也不被系统挂起。做法和 KeepAlivePlayer.jsx
// 完全一致——一段循环的静音 wav，加一个几乎听不见的 1Hz 振荡器，再设置
// 系统媒体控制里显示的标题和歌手。这里抽成 hook，是为了让心碎先生版式里的
// 播放器（播放键、光盘、标签）能真正控制它，而不用把整张 KeepAlivePlayer
// 卡片搬过来。
//
// 和原来一致的行为：必须由用户点击才会开始（浏览器要求手势）；离开首页
// （组件卸载）时会停止。多出来的两点：只有 audio.play() 真的成功了才算
// 「正在放」；锁屏/通知栏的播放、暂停按钮也能控制它。
//
// 同时提供 useKeepAliveConfig：读取 KeepAlivePlayer 保存的 keep_alive_player_config
// （标题、歌手、陪伴者头像），只读，不会写它。

import { useCallback, useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../db';

export const KEEP_ALIVE_CONFIG_KEY = 'keep_alive_player_config';

const SILENT_WAV_DATA =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const DEFAULT_KEEP_ALIVE_TITLE = 'You make me sad';
export const DEFAULT_KEEP_ALIVE_ARTIST = 'Lovely Bomb · Angel Kittens';

export const useKeepAliveConfig = () => {
  const [config, setConfig] = useState({
    title: DEFAULT_KEEP_ALIVE_TITLE,
    artist: DEFAULT_KEEP_ALIVE_ARTIST,
    companionAvatar: null,
  });

  useEffect(() => {
    const subscription = liveQuery(() =>
      db.settings.get(KEEP_ALIVE_CONFIG_KEY)
    ).subscribe({
      next: (setting) => {
        const saved = setting?.value || {};
        setConfig({
          title: saved.title || DEFAULT_KEEP_ALIVE_TITLE,
          artist: saved.artist || DEFAULT_KEEP_ALIVE_ARTIST,
          companionAvatar:
            typeof saved.companionAvatar === 'string' ? saved.companionAvatar : null,
        });
      },
      error: (error) => {
        console.warn('[KeepAlive] 读取播放器配置失败：', error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return config;
};

// meta：{ title, artist }，系统媒体控制里显示的文字。
export const useKeepAliveAudio = (meta) => {
  const [startedAt, setStartedAt] = useState(null);

  const audioRef = useRef(null);
  const contextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const playingRef = useRef(false);
  const metaRef = useRef(meta);
  const busyRef = useRef(false);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const stop = useCallback(() => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      audioRef.current?.pause();

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      }
    } catch (error) {
      console.warn('[KeepAlive] 停止静音保活失败：', error);
    }
    playingRef.current = false;
    setStartedAt(null);
  }, []);

  const start = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        if (!contextRef.current) contextRef.current = new AudioContextClass();
        if (contextRef.current.state === 'suspended') {
          await contextRef.current.resume();
        }

        if (!oscillatorRef.current) {
          const context = contextRef.current;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(1, context.currentTime);
          gain.gain.setValueAtTime(0.0001, context.currentTime);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillatorRef.current = oscillator;
        }
      }

      if (!audioRef.current) {
        const audio = new Audio(SILENT_WAV_DATA);
        audio.loop = true;
        audioRef.current = audio;
      }
      await audioRef.current.play();

      if ('mediaSession' in navigator) {
        const current = metaRef.current || {};
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title || 'WHEN I with U',
          artist: current.artist || '',
          album: 'WHEN I with U / Quiet Frequency',
        });
        navigator.mediaSession.setActionHandler('pause', () => stop());
        navigator.mediaSession.setActionHandler('play', () => {
          void start();
        });
      }

      playingRef.current = true;
      setStartedAt(Date.now());
      return true;
    } catch (error) {
      console.warn('[KeepAlive] 静音保活需要用户点击后才能开始：', error);
      // 半途失败时把已经建好的振荡器收掉，避免留下一个没人管的声源。
      try {
        oscillatorRef.current?.stop();
        oscillatorRef.current?.disconnect();
      } catch {
        // 已经停掉了。
      }
      oscillatorRef.current = null;
      return false;
    }
  }, [stop]);

  const toggle = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (playingRef.current) stop();
      else await start();
    } finally {
      busyRef.current = false;
    }
  }, [start, stop]);

  // 离开首页：停掉声音并释放音频上下文（和原来的播放器一样，卸载即停止）。
  useEffect(
    () => () => {
      stop();
      contextRef.current?.close?.().catch(() => {});
      contextRef.current = null;
      audioRef.current = null;
    },
    [stop]
  );

  return { isPlaying: startedAt !== null, startedAt, toggle };
};

export default useKeepAliveAudio;
import React, { useEffect, useRef } from 'react';

// 全局单例 AudioContext，多窗口复用
let globalAudioContext = null;

export const AudioKeepAlive = ({ isActive = false }) => {
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    let hasActivated = false;

    const stopKeepAlive = async () => {
      try {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        }
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (globalAudioContext && globalAudioContext.state === 'running') {
          await globalAudioContext.suspend();
        }
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
        }
      } catch (e) {
        console.warn('[AudioKeepAlive] Clean up stop error:', e);
      }
    };

    const tryActivateAudio = async () => {
      if (hasActivated) return;
      
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!globalAudioContext) {
          globalAudioContext = new AudioContextClass();
        }

        if (globalAudioContext.state === 'suspended') {
          await globalAudioContext.resume();
        }

        // 初始化超低频无声振荡器
        if (!oscillatorRef.current) {
          const osc = globalAudioContext.createOscillator();
          const gain = globalAudioContext.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(20, globalAudioContext.currentTime);
          gain.gain.setValueAtTime(0.00001, globalAudioContext.currentTime);

          osc.connect(gain);
          gain.connect(globalAudioContext.destination);
          osc.start();

          oscillatorRef.current = osc;
          gainNodeRef.current = gain;
        }

        // 尝试播放无声音乐文件
        if (audioRef.current) {
          await audioRef.current.play();
        }

        // 写入手机锁屏媒体卡片
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'WHEN I with U',
            artist: 'Personal Companion Space',
            album: 'Keep Alive Active'
          });
          navigator.mediaSession.playbackState = 'playing';
        }

        hasActivated = true;
        console.log('[AudioKeepAlive] 用户交互触发，音频后台保活已成功激活。');

        // 成功激活后移除所有屏幕手势监听，零多余处理器消耗
        removeGestureListeners();
      } catch (err) {
        // 如果是因为尚未交互被拦截，此处捕获但不抛出异常，等待下一次手势触发
        console.log('[AudioKeepAlive] 等待用户点击或手势交互以允许音频自动播放。');
      }
    };

    // 绑定几种常见的用户交互手势
    const gestureEvents = ['touchstart', 'click', 'keydown', 'mousedown'];
    
    const addGestureListeners = () => {
      gestureEvents.forEach((evt) => {
        window.addEventListener(evt, tryActivateAudio, { passive: true });
      });
    };

    const removeGestureListeners = () => {
      gestureEvents.forEach((evt) => {
        window.removeEventListener(evt, tryActivateAudio);
      });
    };

    // 1. 先尝试静默触发（若浏览器权限已被用户之前授过，则能直接成功播放）
    tryActivateAudio();

    // 2. 若静默失败，监听用户后续在页面上的任意一次触摸/点击/打字，实现无感恢复
    if (!hasActivated) {
      addGestureListeners();
    }

    return () => {
      removeGestureListeners();
      void stopKeepAlive();
    };
  }, [isActive]);

  const silentWavData =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  return (
    <audio
      ref={audioRef}
      src={silentWavData}
      loop
      preload="auto"
      aria-hidden="true"
      style={{ display: 'none' }}
    />
  );
};

export default AudioKeepAlive;

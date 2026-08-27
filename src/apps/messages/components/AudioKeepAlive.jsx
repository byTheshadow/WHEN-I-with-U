import React, { useEffect, useRef } from 'react';

// 🌟 全局单例 AudioContext，防止在组件高频重新渲染或反复进出聊天室时重复创建音频实例
let globalAudioContext = null;

export const AudioKeepAlive = ({ isActive = false }) => {
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);
  
  // 记录上一次的 isActive 状态，防止相同状态重复执行 start/stop 耗费性能
  const prevActiveRef = useRef(null);

  useEffect(() => {
    // 如果状态没有发生实质变化，直接跳过，防止重新渲染造成的死循环和卡顿
    if (prevActiveRef.current === isActive) {
      return;
    }
    prevActiveRef.current = isActive;

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
          audioRef.current.currentTime = 0;
        }

        // 不释放 AudioContext，仅将其 suspend (挂起)，省去高昂的硬件通道重载开销
        if (globalAudioContext && globalAudioContext.state === 'running') {
          await globalAudioContext.suspend();
        }

        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
        }
      } catch (error) {
        console.warn('[AudioKeepAlive] Suspend stop notice:', error);
      }
    };

    const startKeepAlive = async () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (AudioContextClass) {
          // 懒加载全局单例
          if (!globalAudioContext) {
            globalAudioContext = new AudioContextClass();
          }

          // 仅在被挂起时恢复，不重复 resume 避免阻塞主线程
          if (globalAudioContext.state === 'suspended') {
            await globalAudioContext.resume();
          }

          if (!oscillatorRef.current) {
            const oscillator = globalAudioContext.createOscillator();
            const gainNode = globalAudioContext.createGain();

            oscillator.type = 'sine';
            // 超低频声波 (20Hz)，用户耳朵完全听不见，但对系统音频通道能起到保活作用
            oscillator.frequency.setValueAtTime(20, globalAudioContext.currentTime);
            // 极低音量，不干扰正常通话和背景音乐
            gainNode.gain.setValueAtTime(0.00001, globalAudioContext.currentTime);

            oscillator.connect(gainNode);
            gainNode.connect(globalAudioContext.destination);
            oscillator.start();

            oscillatorRef.current = oscillator;
            gainNodeRef.current = gainNode;
          }
        }

        if (audioRef.current && audioRef.current.paused) {
          try {
            await audioRef.current.play();
          } catch (error) {
            console.warn(
              '[AudioKeepAlive] Audio autoplay blocked. Direct user interaction required to trigger keep-alive.',
              error
            );
          }
        }

        if ('mediaSession' in navigator) {
          // 仅在 metadata 未设定时设定，防止高频重复写入导致 UI 卡顿
          if (!navigator.mediaSession.metadata) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'WHEN I with U',
              artist: 'Personal Companion Space',
              album: 'Keep Alive',
            });
          }
          navigator.mediaSession.playbackState = 'playing';
        }
      } catch (error) {
        console.warn('[AudioKeepAlive] Resume start failed:', error);
      }
    };

    if (isActive) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }

    return () => {
      // 卸载时仅重置，不强制执行耗时的 stop，等待下一次生命周期或延迟关闭
      prevActiveRef.current = null;
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

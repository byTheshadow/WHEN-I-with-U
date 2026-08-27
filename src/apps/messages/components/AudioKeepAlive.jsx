import React, { useEffect, useRef } from 'react';

// 全局单例 AudioContext，多窗口/重渲染复用，避免重复 new
let globalAudioContext = null;

export const AudioKeepAlive = ({ isActive = false }) => {
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);

  // 使用 Ref 记录状态，防止 React 闭包脏读，彻底消除重复触发
  const hasActivatedRef = useRef(false);
  const isActivatingRef = useRef(false);

  useEffect(() => {
    // 如果没有开启保活，则重置状态并安全清理
    if (!isActive) {
      hasActivatedRef.current = false;
      return;
    }

    const stopKeepAlive = async () => {
      try {
        if (oscillatorRef.current) {
          try {
            oscillatorRef.current.stop();
          } catch (e) {}
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
        console.warn('[AudioKeepAlive] 清理保活音频失败:', e);
      }
    };

    const tryActivateAudio = async () => {
      // 锁机制：如果已经激活成功，或者正在激活中，直接拦截，防止打字/触摸重复触发
      if (hasActivatedRef.current || isActivatingRef.current) return;
      isActivatingRef.current = true;
      
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          isActivatingRef.current = false;
          return;
        }

        if (!globalAudioContext) {
          globalAudioContext = new AudioContextClass();
        }

        if (globalAudioContext.state === 'suspended') {
          await globalAudioContext.resume();
        }

        // 初始化超低频无声振荡器（仅在未创建时初始化一次）
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

        // 尝试播放无声音乐文件（仅在暂停状态下播放，避免重复 play() 抛错）
        if (audioRef.current && audioRef.current.paused) {
          try {
            await audioRef.current.play();
          } catch (playErr) {
            console.warn('[AudioKeepAlive] 静音音频播放被浏览器拦截:', playErr);
          }
        }

        // 写入手机锁屏媒体卡片
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'WHEN I with U',
            artist: '个人陪伴空间',
            album: '后台保活运行中'
          });
          navigator.mediaSession.playbackState = 'playing';
        }

        hasActivatedRef.current = true;
        console.log('[AudioKeepAlive] 用户交互触发，音频后台保活已成功激活。');

        // 成功激活后立即移除所有手势监听，释放 CPU 资源
        removeGestureListeners();
      } catch (err) {
        console.log('[AudioKeepAlive] 等待用户点击或手势以激活音频。');
      } finally {
        isActivatingRef.current = false;
      }
    };

    // 绑定常见的手势
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

    // 延迟 150ms 启动保活，避开页面挂载时最密集的计算期
    const initTimeout = setTimeout(() => {
      tryActivateAudio();
      if (!hasActivatedRef.current) {
        addGestureListeners();
      }
    }, 150);

    return () => {
      clearTimeout(initTimeout);
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

import React, { useEffect, useRef } from 'react';

let globalAudioContext = null;

const SILENT_WAV_DATA =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const AudioKeepAlive = ({
  isActive = false,
  audioSrc = ''
}) => {
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);

  const hasActivatedRef = useRef(false);
  const isActivatingRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      hasActivatedRef.current = false;
      return undefined;
    }

    const removeGestureListeners = () => {
      ['touchstart', 'click', 'keydown', 'mousedown'].forEach((eventName) => {
        window.removeEventListener(eventName, tryActivateAudio);
      });
    };

    const stopKeepAlive = async () => {
      try {
        if (oscillatorRef.current) {
          try {
            oscillatorRef.current.stop();
          } catch {}

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

        if (
          globalAudioContext &&
          globalAudioContext.state === 'running'
        ) {
          await globalAudioContext.suspend();
        }

        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
        }
      } catch (error) {
        console.warn(
          '[AudioKeepAlive] 清理保活音频失败:',
          error
        );
      }
    };

    const tryActivateAudio = async () => {
      if (
        hasActivatedRef.current ||
        isActivatingRef.current
      ) {
        return;
      }

      isActivatingRef.current = true;

      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
          return;
        }

        if (!globalAudioContext) {
          globalAudioContext = new AudioContextClass();
        }

        if (globalAudioContext.state === 'suspended') {
          await globalAudioContext.resume();
        }

        if (!oscillatorRef.current) {
          const oscillator = globalAudioContext.createOscillator();
          const gainNode = globalAudioContext.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(
            20,
            globalAudioContext.currentTime
          );

          gainNode.gain.setValueAtTime(
            0.00001,
            globalAudioContext.currentTime
          );

          oscillator.connect(gainNode);
          gainNode.connect(globalAudioContext.destination);
          oscillator.start();

          oscillatorRef.current = oscillator;
          gainNodeRef.current = gainNode;
        }

        if (audioRef.current?.paused) {
          await audioRef.current.play();
        }

        if ('mediaSession' in navigator && 'MediaMetadata' in window) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: audioSrc ? '音乐保活' : 'WHEN I with U',
            artist: '个人陪伴空间',
            album: '后台保活运行中'
          });

          navigator.mediaSession.playbackState = 'playing';
        }

        hasActivatedRef.current = true;
        removeGestureListeners();
      } catch (error) {
        console.warn(
          '[AudioKeepAlive] 音频等待用户交互后启动:',
          error
        );
      } finally {
        isActivatingRef.current = false;
      }
    };

    const addGestureListeners = () => {
      ['touchstart', 'click', 'keydown', 'mousedown'].forEach((eventName) => {
        window.addEventListener(eventName, tryActivateAudio, {
          passive: true
        });
      });
    };

    const initTimeout = window.setTimeout(() => {
      void tryActivateAudio();

      if (!hasActivatedRef.current) {
        addGestureListeners();
      }
    }, 150);

    return () => {
      window.clearTimeout(initTimeout);
      removeGestureListeners();
      void stopKeepAlive();
    };
  }, [isActive, audioSrc]);

  return (
    <audio
      ref={audioRef}
      src={audioSrc || SILENT_WAV_DATA}
      loop
      preload="auto"
      volume="0.45"
      aria-hidden="true"
      onError={() => {
        if (audioSrc) {
          console.warn(
            '[AudioKeepAlive] 音乐 URL 无法播放，将保持保活状态。'
          );
        }
      }}
      style={{ display: 'none' }}
    />
  );
};

export default AudioKeepAlive;

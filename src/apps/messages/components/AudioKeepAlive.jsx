import React, { useEffect, useRef } from 'react';

let generatedKeepAliveUrl = null;

const KEEP_ALIVE_DURATION_SECONDS = 10 * 60;
const KEEP_ALIVE_SAMPLE_RATE = 8000;
const KEEP_ALIVE_CHANNEL_COUNT = 1;
const KEEP_ALIVE_BITS_PER_SAMPLE = 8;

/**
 * 生成一段有效的 10 分钟 WAV 音频。
 *
 * 这是程序生成的数字静音：
 * - 具有完整 WAV 文件头；
 * - 具有真实的 10 分钟时长；
 * - 不是零长度音频；
 * - 采样数据全部位于 8-bit PCM 静音中心值 128；
 * - 不创建振荡器，不产生可听见的音调。
 */
const createKeepAliveWavUrl = () => {
  if (generatedKeepAliveUrl) {
    return generatedKeepAliveUrl;
  }

  const sampleCount =
    KEEP_ALIVE_DURATION_SECONDS *
    KEEP_ALIVE_SAMPLE_RATE;

  const bytesPerSample =
    KEEP_ALIVE_BITS_PER_SAMPLE / 8;

  const dataSize =
    sampleCount *
    KEEP_ALIVE_CHANNEL_COUNT *
    bytesPerSample;

  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(
        offset + index,
        value.charCodeAt(index),
      );
    }
  };

  const writeUint16 = (offset, value) => {
    view.setUint16(offset, value, true);
  };

  const writeUint32 = (offset, value) => {
    view.setUint32(offset, value, true);
  };

  const blockAlign =
    KEEP_ALIVE_CHANNEL_COUNT *
    bytesPerSample;

  const byteRate =
    KEEP_ALIVE_SAMPLE_RATE *
    blockAlign;

  /*
   * RIFF / WAVE 文件头
   */
  writeAscii(0, 'RIFF');
  writeUint32(4, 36 + dataSize);
  writeAscii(8, 'WAVE');

  /*
   * fmt 子块
   */
  writeAscii(12, 'fmt ');
  writeUint32(16, 16);
  writeUint16(20, 1); // PCM
  writeUint16(22, KEEP_ALIVE_CHANNEL_COUNT);
  writeUint32(24, KEEP_ALIVE_SAMPLE_RATE);
  writeUint32(28, byteRate);
  writeUint16(32, blockAlign);
  writeUint16(34, KEEP_ALIVE_BITS_PER_SAMPLE);

  /*
   * data 子块
   */
  writeAscii(36, 'data');
  writeUint32(40, dataSize);

  /*
   * 8-bit PCM 的静音中心值为 128。
   * 整段使用真正的数字静音，不生成正弦波、不生成噪声。
   */
  const silenceValue = 128;

  for (let index = 0; index < dataSize; index += 1) {
    view.setUint8(headerSize + index, silenceValue);
  }

  const blob = new Blob([buffer], {
    type: 'audio/wav',
  });

  generatedKeepAliveUrl = URL.createObjectURL(blob);

  return generatedKeepAliveUrl;
};

export const AudioKeepAlive = ({
  isActive = false,
  audioSrc = '',
}) => {
  const audioRef = useRef(null);

  const isActiveRef = useRef(isActive);
  const activeSourceRef = useRef('');
  const isActivatingRef = useRef(false);
  const hasPlaybackStartedRef = useRef(false);

  /*
   * 保持最新的保活开关状态。
   * 用户关闭设置后，后续事件不会重新启动音频。
   */
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  /**
   * 尝试播放当前已有的唯一 audio 元素。
   *
   * 这个函数是幂等的：
   * - 已经播放时直接返回；
   * - 不创建新的 Audio；
   * - 不创建新的 AudioContext；
   * - 不重复加载音频；
   * - 不会因为多次点击而累积对象。
   */
  const tryPlayExistingAudio = async () => {
    const audio = audioRef.current;

    if (
      !audio ||
      !isActiveRef.current ||
      isActivatingRef.current
    ) {
      return;
    }

    if (!audio.paused && !audio.ended) {
      hasPlaybackStartedRef.current = true;
      return;
    }

    isActivatingRef.current = true;

    try {
      await audio.play();

      hasPlaybackStartedRef.current = true;

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
        } catch {
          // 忽略不完整的 Media Session 实现
        }
      }
    } catch (error) {
      /*
       * 移动浏览器可能因为没有用户手势而拒绝播放。
       * 后续用户点击、触摸或按键时会再次尝试。
       */
      console.warn(
        '[AudioKeepAlive] 音频需要用户交互后才能播放：',
        error,
      );
    } finally {
      isActivatingRef.current = false;
    }
  };

  /**
   * 保活状态或用户音频来源发生变化时处理播放器。
   *
   * isActive：
   *   决定播放器是否持续工作。
   *
   * audioSrc：
   *   只决定当前播放的是用户音频还是默认静音音频，
   *   不决定保活生命周期。
   */
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    if (!isActive) {
      audio.pause();
      audio.currentTime = 0;

      activeSourceRef.current = '';
      hasPlaybackStartedRef.current = false;

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.metadata = null;
        } catch {
          // 忽略不完整的 Media Session 实现
        }
      }

      return undefined;
    }

    /*
     * 用户音频优先。
     * 没有用户音频时，才生成并使用 10 分钟数字静音 WAV。
     */
    const nextSource =
      audioSrc || createKeepAliveWavUrl();

    const usingGeneratedSilence = !audioSrc;

    /*
     * 默认音频本身是数字静音。
     * 这里再设置极低音量作为额外安全层。
     *
     * 用户音频则恢复为正常音量，
     * 保持用户在悬浮球中配置音频的原有行为。
     */
    audio.volume = usingGeneratedSilence
      ? 0.0001
      : 1;

    if (activeSourceRef.current !== nextSource) {
      const wasPlaying =
        !audio.paused && !audio.ended;

      audio.pause();
      audio.currentTime = 0;
      audio.src = nextSource;
      audio.load();

      activeSourceRef.current = nextSource;
      hasPlaybackStartedRef.current = false;

      /*
       * 如果只是用户切换了音频，
       * 尝试让同一个播放器继续播放。
       */
      if (wasPlaying) {
        void tryPlayExistingAudio();
      }
    }

    if (
      'mediaSession' in navigator &&
      'MediaMetadata' in window
    ) {
      try {
        navigator.mediaSession.metadata =
          new MediaMetadata({
            title: audioSrc
              ? '音乐保活'
              : 'WHEN I with U',
            artist: '个人陪伴空间',
            album: '后台保活运行中',
          });

        navigator.mediaSession.playbackState =
          hasPlaybackStartedRef.current
            ? 'playing'
            : 'none';
      } catch {
        // 忽略不完整的 Media Session 实现
      }
    }

    /*
     * 保活开启后主动尝试播放。
     * 如果被浏览器拦截，则等待后续用户手势。
     */
    void tryPlayExistingAudio();

    return undefined;
  }, [isActive, audioSrc]);

  /**
   * 用户手势只用于解锁或恢复已有播放器。
   *
   * 保活播放器本身由 isActive 控制，
   * 不会因为 AI 请求完成而停止。
   */
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleUserGesture = () => {
      void tryPlayExistingAudio();
    };

    const gestureEvents = [
      'touchstart',
      'pointerdown',
      'mousedown',
      'keydown',
      'click',
    ];

    const eventOptions = {
      passive: true,
      capture: true,
    };

    gestureEvents.forEach((eventName) => {
      window.addEventListener(
        eventName,
        handleUserGesture,
        eventOptions,
      );
    });

    return () => {
      gestureEvents.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          handleUserGesture,
          eventOptions,
        );
      });
    };
  }, [isActive]);

  /**
   * 用户关闭保活时才会进入 isActive=false 分支。
   * 组件卸载时进行最终清理。
   */
  useEffect(() => {
    return () => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      activeSourceRef.current = '';
      hasPlaybackStartedRef.current = false;
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      loop
      preload="auto"
      playsInline
      aria-hidden="true"
      onPlay={() => {
        hasPlaybackStartedRef.current = true;

        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState =
              'playing';
          } catch {
            // 忽略不完整的 Media Session 实现
          }
        }
      }}
      onPause={() => {
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = 'none';
          } catch {
            // 忽略不完整的 Media Session 实现
          }
        }
      }}
      onEnded={() => {
        /*
         * 正常情况下 loop 会自动循环。
         * 这里为部分移动浏览器提供兜底。
         */
        if (!isActiveRef.current) {
          return;
        }

        const audio = audioRef.current;

        if (!audio) {
          return;
        }

        audio.currentTime = 0;
        void tryPlayExistingAudio();
      }}
      onError={() => {
        if (audioSrc) {
          console.warn(
            '[AudioKeepAlive] 用户音频无法播放。',
          );
        } else {
          console.warn(
            '[AudioKeepAlive] 默认静音保活音频无法播放。',
          );
        }
      }}
      style={{
        display: 'none',
      }}
    />
  );
};

export default AudioKeepAlive;


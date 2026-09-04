import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';

let generatedKeepAliveUrl = null;

const KEEP_ALIVE_DURATION_SECONDS = 10 * 60;
const KEEP_ALIVE_SAMPLE_RATE = 8000;
const KEEP_ALIVE_CHANNEL_COUNT = 1;
const KEEP_ALIVE_BITS_PER_SAMPLE = 8;

/**
 * 创建一段真实拥有 10 分钟时长的 WAV 音频。
 *
 * 这不是零长度音频，也不是 AudioContext 振荡器。
 * 音频数据全部使用 8-bit PCM 的静音中心值 128，
 * 因此不会产生可听见的声音。
 *
 * 10 分钟、单声道、8kHz、8-bit PCM：
 * 约 4.8 MB。
 */
const createGeneratedKeepAliveAudio = () => {
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

  /*
   * WAV / RIFF header
   */
  writeAscii(0, 'RIFF');
  writeUint32(4, 36 + dataSize);
  writeAscii(8, 'WAVE');

  /*
   * fmt chunk
   */
  writeAscii(12, 'fmt ');
  writeUint32(16, 16); // fmt chunk size
  writeUint16(20, 1); // PCM format
  writeUint16(
    22,
    KEEP_ALIVE_CHANNEL_COUNT,
  );
  writeUint32(
    24,
    KEEP_ALIVE_SAMPLE_RATE,
  );

  const byteRate =
    KEEP_ALIVE_SAMPLE_RATE *
    KEEP_ALIVE_CHANNEL_COUNT *
    bytesPerSample;

  const blockAlign =
    KEEP_ALIVE_CHANNEL_COUNT *
    bytesPerSample;

  writeUint32(28, byteRate);
  writeUint16(32, blockAlign);
  writeUint16(
    34,
    KEEP_ALIVE_BITS_PER_SAMPLE,
  );

  /*
   * data chunk
   */
  writeAscii(36, 'data');
  writeUint32(40, dataSize);

  /*
   * 8-bit PCM 的静音值是 128。
   *
   * 全部填充 128：
   * - 文件具有完整的音频数据；
   * - duration 是 10 分钟；
   * - 没有任何波形；
   * - 不会产生刺耳声音。
   */
  const audioData = new Uint8Array(
    buffer,
    headerSize,
    dataSize,
  );

  audioData.fill(128);

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

  /*
   * 记录 audio 当前实际使用的来源。
   * 这样 React 重渲染不会重复 load 同一个音频。
   */
  const activeSourceRef = useRef('');

  /*
   * 使用 ref 获取最新状态，避免全局手势回调
   * 捕获旧的 isActive 或 audioSrc。
   */
  const isActiveRef = useRef(isActive);
  const audioSrcRef = useRef(audioSrc);

  /*
   * 防止多个用户手势同时触发多个 play()。
   */
  const isPlayRequestPendingRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    audioSrcRef.current = audioSrc;
  }, [audioSrc]);

  /**
   * 播放当前已有的 audio。
   *
   * 这个函数只会复用同一个 <audio>：
   * - 不创建 new Audio()
   * - 不创建 AudioContext
   * - 不创建 oscillator
   * - 不重复生成 WAV
   */
  const tryPlayExistingAudio = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio || !isActiveRef.current) {
      return false;
    }

    /*
     * 已经播放时直接复用，不重复调用 play。
     */
    if (!audio.paused && !audio.ended) {
      return true;
    }

    if (isPlayRequestPendingRef.current) {
      return false;
    }

    isPlayRequestPendingRef.current = true;

    try {
      await audio.play();

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState =
            'playing';
        } catch {
          // 忽略不完整的 Media Session 实现
        }
      }

      return true;
    } catch (error) {
      /*
       * 手机浏览器可能要求用户手势后才能播放。
       * 全局手势监听会在下一次用户操作时重试。
       */
      console.warn(
        '[AudioKeepAlive] 音频等待用户手势后启动：',
        error,
      );

      return false;
    } finally {
      isPlayRequestPendingRef.current = false;
    }
  }, []);

  /**
   * 根据当前设置选择实际音频：
   *
   * 有用户音频：
   *   播放用户音频
   *
   * 没有用户音频：
   *   播放程序生成的 10 分钟数字静音
   */
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    if (!isActive) {
      /*
       * 保活关闭时停止当前播放器。
       * App.jsx 中的 KeepAliveIndicator 会因为
       * isVisible={isKeepAliveActive} 自动消失。
       */
      audio.pause();
      audio.currentTime = 0;

      isPlayRequestPendingRef.current = false;

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

    const nextSource =
      audioSrc || createGeneratedKeepAliveAudio();

    /*
     * 用户音频保持正常音量。
     * 默认生成音频本身就是数字静音，因此不需要使用
     * 刺耳的低频振荡器，也不需要把用户音频压低。
     */
    audio.volume = 1;

    /*
     * 只有来源真正变化时才切换音频。
     */
    if (activeSourceRef.current !== nextSource) {
      const wasPlaying =
        !audio.paused && !audio.ended;

      audio.pause();
      audio.currentTime = 0;
      audio.src = nextSource;
      audio.load();

      activeSourceRef.current = nextSource;

      /*
       * 如果此前正在播放，切换来源后继续尝试播放。
       * 如果浏览器要求用户手势，则由全局手势监听重试。
       */
      if (wasPlaying) {
        void tryPlayExistingAudio();
      }
    }

    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      try {
        navigator.mediaSession.metadata =
          new MediaMetadata({
            title: audioSrc
              ? '音乐保活'
              : 'WHEN I with U',
            artist: '个人陪伴空间',
            album: '后台保活运行中',
          });
      } catch {
        // 忽略不完整的 Media Session 实现
      }
    }

    /*
     * 保活开启后立即尝试播放。
     * 若被自动播放策略拦截，则等待用户手势。
     */
    void tryPlayExistingAudio();

    /*
     * 这里故意不返回 stopKeepAlive cleanup。
     *
     * 原因：
     * - audioSrc 改变时不应销毁保活；
     * - AI 请求完成时不应销毁保活；
     * - ChatRoom 切换时不应销毁保活。
     *
     * 只有 isActive 变成 false 时，上面的分支才会暂停。
     */
    return undefined;
  }, [
    isActive,
    audioSrc,
    tryPlayExistingAudio,
  ]);

  /**
   * 浏览器自动播放被阻止时，等待用户手势。
   *
   * 这些监听器只负责恢复同一个播放器，
   * 不负责创建新的播放器，也不负责决定保活生命周期。
   */
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleUserGesture = () => {
      void tryPlayExistingAudio();
    };

    const eventOptions = {
      capture: true,
      passive: true,
    };

    const gestureEvents = [
      'pointerdown',
      'touchstart',
      'mousedown',
      'keydown',
      'click',
    ];

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
  }, [
    isActive,
    tryPlayExistingAudio,
  ]);

  /**
   * 当用户音频在播放过程中自然结束时：
   *
   * - 用户音频：由于 loop=true，通常会自动循环；
   * - 默认音频：10 分钟结束后手动从头继续；
   *
   * 两种情况都不改变 isActive。
   */
  const handleEnded = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || !isActiveRef.current) {
      return;
    }

    audio.currentTime = 0;
    void tryPlayExistingAudio();
  }, [tryPlayExistingAudio]);

  const handleAudioError = useCallback(() => {
    if (audioSrcRef.current) {
      console.warn(
        '[AudioKeepAlive] 用户音频无法播放。',
      );
    } else {
      console.warn(
        '[AudioKeepAlive] 默认保活音频无法播放。',
      );
    }
  }, []);

  /**
   * 组件真正卸载时释放播放器资源。
   *
   * 正常的 AI 完成、ChatRoom 切换、用户音频切换，
   * 都不会执行这里。
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
      isPlayRequestPendingRef.current = false;

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.metadata = null;
        } catch {
          // 忽略不完整的 Media Session 实现
        }
      }
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      src=""
      loop
      preload="auto"
      aria-hidden="true"
      onEnded={handleEnded}
      onError={handleAudioError}
      onPlay={() => {
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
            navigator.mediaSession.playbackState =
              'none';
          } catch {
            // 忽略不完整的 Media Session 实现
          }
        }
      }}
      style={{
        display: 'none',
      }}
    />
  );
};

export default AudioKeepAlive;


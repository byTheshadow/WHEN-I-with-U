import React, { useEffect, useRef } from 'react';

let generatedKeepAliveUrl = null;

const KEEP_ALIVE_DURATION_SECONDS = 10 * 60;
const KEEP_ALIVE_SAMPLE_RATE = 8000;

/**
 * 生成一段真实存在、时长 10 分钟的低幅度 WAV。
 *
 * 不是零长度音频，也不是完全空白的 WAV。
 * 使用极低幅度的稳定底噪，避免部分浏览器将其视为无效媒体。
 */
const createKeepAliveWavUrl = () => {
  if (generatedKeepAliveUrl) {
    return generatedKeepAliveUrl;
  }

  const channelCount = 1;
  const bitsPerSample = 8;
  const sampleCount =
    KEEP_ALIVE_DURATION_SECONDS * KEEP_ALIVE_SAMPLE_RATE;
  const dataSize = sampleCount * channelCount;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  const writeUint32 = (offset, value) => {
    view.setUint32(offset, value, true);
  };

  const writeUint16 = (offset, value) => {
    view.setUint16(offset, value, true);
  };

  // RIFF header
  writeAscii(0, 'RIFF');
  writeUint32(4, 36 + dataSize);
  writeAscii(8, 'WAVE');

  // fmt chunk
  writeAscii(12, 'fmt ');
  writeUint32(16, 16);
  writeUint16(20, 1); // PCM
  writeUint16(22, channelCount);
  writeUint32(24, KEEP_ALIVE_SAMPLE_RATE);

  const byteRate =
    KEEP_ALIVE_SAMPLE_RATE *
    channelCount *
    (bitsPerSample / 8);

  const blockAlign =
    channelCount * (bitsPerSample / 8);

  writeUint32(28, byteRate);
  writeUint16(32, blockAlign);
  writeUint16(34, bitsPerSample);

  // data chunk
  writeAscii(36, 'data');
  writeUint32(40, dataSize);

  /*
   * 8-bit PCM 的静音中心点是 128。
   * 加入极低幅度的确定性变化，避免整段数据完全相同。
   *
   * 这不是可感知的音乐，只是有效的、极低幅度的媒体内容。
   */
  for (let index = 0; index < sampleCount; index += 1) {
    const slowWave =
      Math.sin((index / KEEP_ALIVE_SAMPLE_RATE) * Math.PI * 2 * 0.17) *
      0.45;

    const tinyNoise =
      ((index * 17) % 7) - 3;

    const sample = Math.max(
      0,
      Math.min(
        255,
        Math.round(128 + slowWave + tinyNoise * 0.12),
      ),
    );

    view.setUint8(headerSize + index, sample);
  }

  const blob = new Blob([buffer], {
    type: 'audio/wav',
  });

  generatedKeepAliveUrl = URL.createObjectURL(blob);

  return generatedKeepAliveUrl;
};

const revokeGeneratedKeepAliveUrl = () => {
  if (!generatedKeepAliveUrl) {
    return;
  }

  URL.revokeObjectURL(generatedKeepAliveUrl);
  generatedKeepAliveUrl = null;
};

// 仅在页面真正卸载时释放 Blob URL。
// 不在 React effect cleanup 中释放，避免组件重渲染导致音频 URL 失效。
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pagehide',
    revokeGeneratedKeepAliveUrl,
    { once: true },
  );
}

export const AudioKeepAlive = ({
  isActive = false,
  audioSrc = '',
}) => {
  const audioRef = useRef(null);
  const activeSourceRef = useRef('');
  const isActiveRef = useRef(isActive);
  const isActivatingRef = useRef(false);
  const hasPlaybackStartedRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  /**
   * 只复用现有的 audio 元素。
   * 不创建新的 Audio、不创建新的 AudioContext，
   * 因此重复点击不会不断累积内存。
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
    } catch (error) {
      /*
       * 自动播放被浏览器拒绝时不抛出到 React。
       * 后续用户手势仍会再次调用本函数。
       */
      console.warn(
        '[AudioKeepAlive] 等待用户手势后启动音频：',
        error,
      );
    } finally {
      isActivatingRef.current = false;
    }
  };

  /**
   * 保活开启时，使用用户音频；没有用户音频时使用
   * 程序生成的 10 分钟有效 WAV。
   */
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    if (!isActive) {
      audio.pause();
      audio.currentTime = 0;
      hasPlaybackStartedRef.current = false;
      activeSourceRef.current = '';

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.metadata = null;
        } catch {
          // 某些浏览器的 Media Session 实现不完整
        }
      }

      return undefined;
    }

    const nextSource =
      audioSrc || createKeepAliveWavUrl();

    /*
     * audioSrc 变化时只更换当前音频，
     * 不销毁组件、不创建第二个 audio。
     */
    if (activeSourceRef.current !== nextSource) {
      const wasPlaying =
        !audio.paused && !audio.ended;

      audio.pause();
      audio.currentTime = 0;
      audio.src = nextSource;
      audio.load();

      activeSourceRef.current = nextSource;
      hasPlaybackStartedRef.current = false;

      if (wasPlaying) {
        void tryPlayExistingAudio();
      }
    }

    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: audioSrc ? '音乐保活' : 'WHEN I with U',
          artist: '个人陪伴空间',
          album: '后台保活运行中',
        });

        navigator.mediaSession.playbackState =
          hasPlaybackStartedRef.current
            ? 'playing'
            : 'none';
      } catch {
        // 某些浏览器的 Media Session 实现不完整
      }
    }

    /*
     * 先尝试自动播放。
     * 如果被浏览器拒绝，下面的全局手势监听会负责重试。
     */
    void tryPlayExistingAudio();

    return undefined;
  }, [isActive, audioSrc]);

  /**
   * 用户点击“回应”、点击悬浮球或进行其他操作时，
   * 只恢复同一个播放器，不重新创建音频资源。
   *
   * 该监听器只在保活开启期间存在。
   */
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleUserGesture = () => {
      void tryPlayExistingAudio();
    };

    const eventOptions = {
      passive: true,
      capture: true,
    };

    const gestureEvents = [
      'touchstart',
      'pointerdown',
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
  }, [isActive]);

  /**
   * 仅当用户关闭保活时停止。
   * AI 请求完成不会触发这里。
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
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      loop
      preload="auto"
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
            navigator.mediaSession.playbackState =
              isActiveRef.current
                ? 'none'
                : 'none';
          } catch {
            // 忽略不完整的 Media Session 实现
          }
        }
      }}
      onEnded={() => {
        /*
         * 正常情况下 loop 会处理。
         * 这里作为部分移动浏览器的兜底。
         */
        if (isActiveRef.current) {
          audioRef.current.currentTime = 0;
          void tryPlayExistingAudio();
        }
      }}
      onError={() => {
        if (audioSrc) {
          console.warn(
            '[AudioKeepAlive] 用户音频无法播放，保活音频将尝试继续运行。',
          );
        }
      }}
      style={{ display: 'none' }}
    />
  );
};

export default AudioKeepAlive;


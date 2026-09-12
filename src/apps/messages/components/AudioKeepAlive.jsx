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
 * 创建一段真实拥有 10 分钟时长的 WAV 音频（8-bit PCM 静音值 128）
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
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  const writeUint16 = (offset, value) => {
    view.setUint16(offset, value, true);
  };

  const writeUint32 = (offset, value) => {
    view.setUint32(offset, value, true);
  };

  writeAscii(0, 'RIFF');
  writeUint32(4, 36 + dataSize);
  writeAscii(8, 'WAVE');

  writeAscii(12, 'fmt ');
  writeUint32(16, 16);
  writeUint16(20, 1);
  writeUint16(22, KEEP_ALIVE_CHANNEL_COUNT);
  writeUint32(24, KEEP_ALIVE_SAMPLE_RATE);

  const byteRate =
    KEEP_ALIVE_SAMPLE_RATE *
    KEEP_ALIVE_CHANNEL_COUNT *
    bytesPerSample;

  const blockAlign =
    KEEP_ALIVE_CHANNEL_COUNT *
    bytesPerSample;

  writeUint32(28, byteRate);
  writeUint16(32, blockAlign);
  writeUint16(34, KEEP_ALIVE_BITS_PER_SAMPLE);

  writeAscii(36, 'data');
  writeUint32(40, dataSize);

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
  const activeSourceRef = useRef('');
  const isActiveRef = useRef(isActive);
  const audioSrcRef = useRef(audioSrc);
  const isPlayRequestPendingRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    audioSrcRef.current = audioSrc;
  }, [audioSrc]);

  // ==========================================================
  // 💓 心跳租约机制：只要保活在跑，定时通知云端“我还活着，别抢戏”
  // ==========================================================
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const sendHeartbeat = () => {
      try {
        const pushServerUrl =
          localStorage.getItem('push_server_url') ||
          localStorage.getItem('pushServerUrl') ||
          '';

        if (!pushServerUrl) {
          return;
        }

        const normalizedUrl = pushServerUrl.replace(/\/+$/, '');

        fetch(`${normalizedUrl}/api/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: Date.now() }),
        }).catch(() => {
          // 断网或离线静默失败，绝不影响保活
        });
      } catch {
        // 忽略 localStorage 读取异常
      }
    };

    // 保活刚开启时立即报告一次存活
    sendHeartbeat();

    // 随后每 2 分钟定期上报一次（后端 3.5 分钟超时，留有充足缓冲）
    const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [isActive]);

  /**
   * 播放已有音频实例
   */
  const tryPlayExistingAudio = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio || !isActiveRef.current) {
      return false;
    }

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
          navigator.mediaSession.playbackState = 'playing';
        } catch {
          // 忽略
        }
      }

      return true;
    } catch (error) {
      console.warn('[AudioKeepAlive] 音频等待用户手势后启动：', error);
      return false;
    } finally {
      isPlayRequestPendingRef.current = false;
    }
  }, []);

  /**
   * 切换播放源或初始化
   */
  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    if (!isActive) {
      audio.pause();
      audio.currentTime = 0;
      isPlayRequestPendingRef.current = false;

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.metadata = null;
        } catch {
          // 忽略
        }
      }

      return undefined;
    }

    const nextSource = audioSrc || createGeneratedKeepAliveAudio();
    audio.volume = 1;

    if (activeSourceRef.current !== nextSource) {
      const wasPlaying = !audio.paused && !audio.ended;

      audio.pause();
      audio.currentTime = 0;
      audio.src = nextSource;
      audio.load();

      activeSourceRef.current = nextSource;

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
      } catch {
        // 忽略
      }
    }

    void tryPlayExistingAudio();
    return undefined;
  }, [isActive, audioSrc, tryPlayExistingAudio]);

  /**
   * 用户手势恢复机制
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
      window.addEventListener(eventName, handleUserGesture, eventOptions);
    });

    return () => {
      gestureEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserGesture, eventOptions);
      });
    };
  }, [isActive, tryPlayExistingAudio]);

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
      console.warn('[AudioKeepAlive] 用户音频无法播放。');
    } else {
      console.warn('[AudioKeepAlive] 默认保活音频无法播放。');
    }
  }, []);

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
          // 忽略
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
            navigator.mediaSession.playbackState = 'playing';
          } catch {
            // 忽略
          }
        }
      }}
      onPause={() => {
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = 'none';
          } catch {
            // 忽略
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


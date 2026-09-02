import db from '../db';

export const LOCKSCREEN_ENABLED_KEY =
  'lockscreenCompanionEnabled';

export const DEFAULT_LOCKSCREEN_QUOTES = [
  '今天辛苦啦，记得早点休息哦。',
  '无论今天过得怎样，我都一直在你身边。',
  '偶尔停下来吸一口气，也很重要。',
  '抬头看看天空吧，今天也是为你加油的一天。',
  '别太累了，剩下的事情明天再处理也不迟。',
  '想你了，随时回来看我一下好吗？',
];

let companionAudio = null;
let companionAudioUrl = null;
let quoteRotateTimer = null;
let startPromise = null;

let lifecycleToken = 0;
let activeMetadata = null;

let retryCharacter = null;
let retryListenersAttached = false;
let retryInProgress = false;

let lastStartStatus = 'idle';

const getMediaSessionSupport = () => {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined'
  ) {
    return false;
  }

  return (
    'mediaSession' in navigator &&
    typeof window.MediaMetadata === 'function'
  );
};

const normalizeQuotes = (quotes) => {
  if (!Array.isArray(quotes)) {
    return [...DEFAULT_LOCKSCREEN_QUOTES];
  }

  const normalizedQuotes = quotes
    .map((quote) => String(quote || '').trim())
    .filter(Boolean)
    .map((quote) => quote.slice(0, 120))
    .filter(
      (quote, index, array) =>
        array.indexOf(quote) === index,
    );

  return normalizedQuotes.length > 0
    ? normalizedQuotes
    : [...DEFAULT_LOCKSCREEN_QUOTES];
};

/**
 * 创建一个标准 PCM WAV 音频。
 *
 * 不使用固定 Base64 MP3，避免部分手机浏览器无法识别
 * data:audio/mp3 音频源。
 */
const createSilentWavUrl = () => {
  if (
    typeof window === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null;
  }

  const sampleRate = 8000;
  const durationSeconds = 1;
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = sampleRate * durationSeconds;
  const dataSize =
    sampleCount * channelCount * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(
        offset + index,
        value.charCodeAt(index),
      );
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * channelCount * bytesPerSample,
    true,
  );
  view.setUint16(
    32,
    channelCount * bytesPerSample,
    true,
  );
  view.setUint16(34, bitsPerSample, true);

  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  /*
   * PCM 数据保持为 0，生成无声音频。
   */
  for (
    let offset = 44;
    offset < buffer.byteLength;
    offset += 2
  ) {
    view.setInt16(offset, 0, true);
  }

  return URL.createObjectURL(
    new Blob([buffer], {
      type: 'audio/wav',
    }),
  );
};

const clearRetryListeners = () => {
  if (
    typeof window === 'undefined' ||
    !retryListenersAttached
  ) {
    return;
  }

  window.removeEventListener(
    'pointerdown',
    handleRetryGesture,
  );

  window.removeEventListener(
    'keydown',
    handleRetryGesture,
  );

  retryListenersAttached = false;
};

const handleRetryGesture = () => {
  if (retryInProgress) return;

  retryInProgress = true;

  void startLockscreenCompanion(retryCharacter)
    .finally(() => {
      retryInProgress = false;
    });
};

const attachRetryListeners = (character) => {
  if (typeof window === 'undefined') return;

  retryCharacter = character;

  if (retryListenersAttached) return;

  window.addEventListener(
    'pointerdown',
    handleRetryGesture,
    {
      passive: true,
    },
  );

  window.addEventListener(
    'keydown',
    handleRetryGesture,
  );

  retryListenersAttached = true;
};

/**
 * 判断当前 Media Session 是否仍然属于锁屏陪伴。
 *
 * 如果其他模块已经接管了媒体卡片，则锁屏服务不清理、
 * 不覆盖其他模块的 metadata。
 */
const ownsCurrentMediaSession = () => {
  if (!getMediaSessionSupport()) {
    return false;
  }

  return (
    activeMetadata &&
    navigator.mediaSession.metadata === activeMetadata
  );
};

/**
 * 更新锁屏媒体卡片。
 *
 * 如果已有其他媒体功能占用 Media Session，则不覆盖它。
 */
const updateMediaSessionMetadata = (
  characterName,
  quoteText,
  avatarUrl,
) => {
  if (!getMediaSessionSupport()) {
    lastStartStatus = 'media-session-unsupported';
    return false;
  }

  try {
    const currentMetadata =
      navigator.mediaSession.metadata;

    /*
     * AudioKeepAlive 或其他播放器已经接管媒体卡片时，
     * 不覆盖它的内容。
     */
    if (
      currentMetadata &&
      currentMetadata !== activeMetadata
    ) {
      lastStartStatus = 'media-session-busy';
      return false;
    }

    const metadata = new window.MediaMetadata({
      title: quoteText || '陪在你身边',
      artist: characterName || '陪伴伴侣',
      album: 'WHEN I with U',
      artwork: avatarUrl
        ? [
            {
              src: avatarUrl,
              sizes: '512x512',
              type: 'image/png',
            },
          ]
        : [],
    });

    navigator.mediaSession.metadata = metadata;
    activeMetadata = metadata;

    /*
     * 不在这里调用 setActionHandler。
     *
     * Media Session 是全局对象。锁屏服务不注册 play/pause
     * handler，避免覆盖项目原有 AudioKeepAlive 的控制逻辑。
     */
    return true;
  } catch (error) {
    console.warn(
      '[LockscreenService] 更新 Media Session 失败:',
      error,
    );

    lastStartStatus = 'media-session-error';
    return false;
  }
};

export const getLockscreenQuotes = async () => {
  try {
    const item = await db.settings.get(
      'lockscreenQuotes',
    );

    if (item && Array.isArray(item.value)) {
      return normalizeQuotes(item.value);
    }
  } catch (error) {
    console.warn(
      '[LockscreenService] 读取自定义台词失败，使用默认台词:',
      error,
    );
  }

  return [...DEFAULT_LOCKSCREEN_QUOTES];
};

export const saveLockscreenQuotes = async (
  quotesArray,
) => {
  const normalizedQuotes = normalizeQuotes(
    quotesArray,
  );

  try {
    await db.settings.put({
      key: 'lockscreenQuotes',
      value: normalizedQuotes,
    });

    return true;
  } catch (error) {
    console.error(
      '[LockscreenService] 保存台词失败:',
      error,
    );

    return false;
  }
};

export const getLockscreenCompanionEnabled =
  async () => {
    try {
      const setting = await db.settings.get(
        LOCKSCREEN_ENABLED_KEY,
      );

      return setting?.value === true;
    } catch (error) {
      console.warn(
        '[LockscreenService] 读取锁屏陪伴开关失败:',
        error,
      );

      return false;
    }
  };

export const setLockscreenCompanionEnabled =
  async (enabled) => {
    try {
      await db.settings.put({
        key: LOCKSCREEN_ENABLED_KEY,
        value: Boolean(enabled),
      });

      return true;
    } catch (error) {
      console.error(
        '[LockscreenService] 保存锁屏陪伴开关失败:',
        error,
      );

      return false;
    }
  };

export const isLockscreenCompanionRunning = () => {
  return Boolean(
    companionAudio &&
    !companionAudio.paused &&
    !companionAudio.ended,
  );
};

export const getLockscreenCompanionStatus = () => {
  return {
    running: isLockscreenCompanionRunning(),
    waitingForGesture: retryListenersAttached,
    status: lastStartStatus,
  };
};

export const updateLockscreenMediaSession = (
  characterName,
  quoteText,
  avatarUrl,
) => {
  return updateMediaSessionMetadata(
    characterName,
    quoteText,
    avatarUrl,
  );
};

export const startLockscreenCompanion = async (
  character = null,
) => {
  if (typeof window === 'undefined') {
    lastStartStatus = 'not-browser';
    return false;
  }

  if (isLockscreenCompanionRunning()) {
    lastStartStatus = 'running';
    clearRetryListeners();
    return true;
  }

  if (startPromise) {
    return startPromise;
  }

  const currentToken = ++lifecycleToken;
  retryCharacter = character;

  startPromise = (async () => {
    try {
      if (!companionAudio) {
        companionAudioUrl = createSilentWavUrl();

        if (!companionAudioUrl) {
          lastStartStatus = 'audio-source-unavailable';
          return false;
        }

        companionAudio = new Audio(
          companionAudioUrl,
        );

        companionAudio.loop = true;
        companionAudio.preload = 'auto';

        /*
         * 保留原有极低音量设置。
         */
        companionAudio.volume = 0.01;

        companionAudio.addEventListener(
          'error',
          () => {
            lastStartStatus = 'audio-error';

            console.warn(
              '[LockscreenService] 锁屏陪伴音频源无法播放:',
              companionAudio?.error,
            );
          },
        );
      }

      await companionAudio.play();

      if (currentToken !== lifecycleToken) {
        companionAudio.pause();
        return false;
      }

      const quotes = await getLockscreenQuotes();

      if (currentToken !== lifecycleToken) {
        return false;
      }

      const randomQuote =
        quotes[
          Math.floor(Math.random() * quotes.length)
        ];

      updateMediaSessionMetadata(
        character?.name || '陪伴伴侣',
        randomQuote,
        character?.avatar,
      );

      if (quoteRotateTimer) {
        clearInterval(quoteRotateTimer);
      }

      quoteRotateTimer = window.setInterval(
        async () => {
          if (
            currentToken !== lifecycleToken ||
            !isLockscreenCompanionRunning()
          ) {
            return;
          }

          const latestQuotes =
            await getLockscreenQuotes();

          if (
            currentToken !== lifecycleToken ||
            !isLockscreenCompanionRunning()
          ) {
            return;
          }

          const nextQuote =
            latestQuotes[
              Math.floor(
                Math.random() * latestQuotes.length,
              )
            ];

          updateMediaSessionMetadata(
            character?.name || '陪伴伴侣',
            nextQuote,
            character?.avatar,
          );
        },
        10 * 60 * 1000,
      );

      lastStartStatus = getMediaSessionSupport()
        ? 'running'
        : 'running-without-media-session';

      clearRetryListeners();

      return true;
    } catch (error) {
      if (
        error?.name === 'NotAllowedError' ||
        error?.name === 'AbortError'
      ) {
        lastStartStatus = 'autoplay-blocked';
        attachRetryListeners(character);
      } else if (
        error?.name === 'NotSupportedError' ||
        error?.name === 'MediaError'
      ) {
        lastStartStatus = 'audio-error';

        console.warn(
          '[LockscreenService] 当前浏览器不支持锁屏陪伴音频:',
          error,
        );
      } else {
        lastStartStatus = 'audio-error';

        console.warn(
          '[LockscreenService] 启动锁屏陪伴失败:',
          error,
        );
      }

      return false;
    } finally {
      startPromise = null;
    }
  })();

  return startPromise;
};

export const stopLockscreenCompanion = () => {
  lifecycleToken += 1;
  lastStartStatus = 'idle';

  retryCharacter = null;
  retryInProgress = false;
  clearRetryListeners();

  if (quoteRotateTimer) {
    clearInterval(quoteRotateTimer);
    quoteRotateTimer = null;
  }

  if (companionAudio) {
    try {
      companionAudio.pause();
      companionAudio.currentTime = 0;
      companionAudio.removeAttribute('src');
      companionAudio.load();
    } catch (error) {
      console.warn(
        '[LockscreenService] 停止锁屏陪伴音频失败:',
        error,
      );
    }

    companionAudio = null;
  }

  if (
    companionAudioUrl &&
    typeof URL !== 'undefined' &&
    typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(companionAudioUrl);
    companionAudioUrl = null;
  }

  /*
   * 只清除锁屏服务自己写入的 metadata。
   *
   * 如果 AudioKeepAlive 已经接管 Media Session，
   * 则不触碰它的媒体卡片。
   */
  if (ownsCurrentMediaSession()) {
    try {
      navigator.mediaSession.metadata = null;
    } catch (error) {
      console.warn(
        '[LockscreenService] 清理 Media Session 失败:',
        error,
      );
    }
  }

  activeMetadata = null;
};

export const retryLockscreenCompanionAfterGesture = (
  character = null,
) => {
  attachRetryListeners(character);
};

export default {
  LOCKSCREEN_ENABLED_KEY,
  DEFAULT_LOCKSCREEN_QUOTES,
  getLockscreenQuotes,
  saveLockscreenQuotes,
  getLockscreenCompanionEnabled,
  setLockscreenCompanionEnabled,
  isLockscreenCompanionRunning,
  getLockscreenCompanionStatus,
  updateLockscreenMediaSession,
  startLockscreenCompanion,
  stopLockscreenCompanion,
  retryLockscreenCompanionAfterGesture,
};

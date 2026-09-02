import db from '../db';

export const LOCKSCREEN_ENABLED_KEY = 'lockscreenCompanionEnabled';

export const DEFAULT_LOCKSCREEN_QUOTES = [
  '今天辛苦啦，记得早点休息哦。',
  '无论今天过得怎样，我都一直在你身边。',
  '偶尔停下来吸一口气，也很重要。',
  '抬头看看天空吧，今天也是为你加油的一天。',
  '别太累了，剩下的事情明天再处理也不迟。',
  '想你了，随时回来看我一下好吗？',
];

let companionAudio = null;
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

  const normalized = quotes
    .map((quote) => String(quote || '').trim())
    .filter(Boolean)
    .map((quote) => quote.slice(0, 120))
    .filter(
      (quote, index, array) => array.indexOf(quote) === index,
    );

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_LOCKSCREEN_QUOTES];
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
    { passive: true },
  );

  window.addEventListener(
    'keydown',
    handleRetryGesture,
  );

  retryListenersAttached = true;
};

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
     * 不在这里注册 play/pause handler。
     * navigator.mediaSession 是全局对象，避免覆盖项目原有的
     * AudioKeepAlive 媒体控制逻辑。
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
    const item = await db.settings.get('lockscreenQuotes');

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

export const saveLockscreenQuotes = async (quotesArray) => {
  const normalizedQuotes = normalizeQuotes(quotesArray);

  try {
    await db.settings.put({
      key: 'lockscreenQuotes',
      value: normalizedQuotes,
    });
  } catch (error) {
    console.error(
      '[LockscreenService] 保存台词失败:',
      error,
    );
  }
};

export const getLockscreenCompanionEnabled = async () => {
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

export const setLockscreenCompanionEnabled = async (
  enabled,
) => {
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
    enabled: false,
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
        const silentMp3 =
          'data:audio/mp3;base64,SUQ3BAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//5AwAAAAAAAAAAAAAAAAAAAAAAAABGluZm8AAAAPAAAAAQAAAAAAAD8AMjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw//5AQAAAAAAAD8AAAAA';

        companionAudio = new Audio(silentMp3);
        companionAudio.loop = true;
        companionAudio.volume = 0.01;
      }

      await companionAudio.play();

      if (currentToken !== lifecycleToken) {
        companionAudio.pause();
        return false;
      }

      const quotes = await getLockscreenQuotes();
      const randomQuote =
        quotes[Math.floor(Math.random() * quotes.length)];

      if (currentToken !== lifecycleToken) {
        return false;
      }

      updateMediaSessionMetadata(
        character?.name || '陪伴伴侣',
        randomQuote,
        character?.avatar,
      );

      if (quoteRotateTimer) {
        clearInterval(quoteRotateTimer);
      }

      quoteRotateTimer = window.setInterval(async () => {
        if (
          currentToken !== lifecycleToken ||
          !isLockscreenCompanionRunning()
        ) {
          return;
        }

        const latestQuotes = await getLockscreenQuotes();

        if (currentToken !== lifecycleToken) {
          return;
        }

        const nextQuote =
          latestQuotes[
            Math.floor(Math.random() * latestQuotes.length)
          ];

        updateMediaSessionMetadata(
          character?.name || '陪伴伴侣',
          nextQuote,
          character?.avatar,
        );
      }, 10 * 60 * 1000);

      lastStartStatus = 'running';
      clearRetryListeners();

      return true;
    } catch (error) {
      if (
        error?.name === 'NotAllowedError' ||
        error?.name === 'AbortError'
      ) {
        lastStartStatus = 'autoplay-blocked';
        attachRetryListeners(character);
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
  clearRetryListeners();

  if (quoteRotateTimer) {
    clearInterval(quoteRotateTimer);
    quoteRotateTimer = null;
  }

  if (companionAudio) {
    companionAudio.pause();
    companionAudio.currentTime = 0;
  }

  /*
   * 只有当前 metadata 仍然是锁屏陪伴写入的对象时才清除。
   * 如果 AudioKeepAlive 或其他媒体功能已经接管 Media Session，
   * 不触碰它的 metadata。
   */
  if (
    typeof navigator !== 'undefined' &&
    'mediaSession' in navigator &&
    activeMetadata &&
    navigator.mediaSession.metadata === activeMetadata
  ) {
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

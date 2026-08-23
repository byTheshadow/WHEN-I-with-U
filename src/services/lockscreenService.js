import db from '../db';

// 默认提供的温馨/偏日常陪伴台词库
export const DEFAULT_LOCKSCREEN_QUOTES = [
  "今天辛苦啦，记得早点休息哦。",
  "无论今天过得怎样，我都一直在你身边。",
  "偶尔停下来吸一口气，也很重要。",
  "抬头看看天空吧，今天也是为你加油的一天。",
  "别太累了，剩下的事情明天再处理也不迟。",
  "想你了，随时回来看我一下好吗？"
];

let companionAudio = null;
let quoteRotateTimer = null;

/**
 * 获取所有的锁屏台词（包括默认 + 用户自定义）
 */
export const getLockscreenQuotes = async () => {
  try {
    const item = await db.settings.get('lockscreenQuotes');
    if (item && Array.isArray(item.value) && item.value.length > 0) {
      return item.value;
    }
  } catch (err) {
    console.warn('[LockscreenService] 读取自定义台词失败，使用默认台词:', err);
  }
  return DEFAULT_LOCKSCREEN_QUOTES;
};

/**
 * 保存台词列表
 */
export const saveLockscreenQuotes = async (quotesArray) => {
  try {
    await db.settings.put({
      key: 'lockscreenQuotes',
      value: quotesArray
    });
  } catch (err) {
    console.error('[LockscreenService] 保存台词失败:', err);
  }
};

/**
 * 更新手机锁屏 Media Session 卡片上的台词与角色信息
 */
export const updateLockscreenMediaSession = (characterName, quoteText, avatarUrl) => {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: quoteText || '陪在你身边',
      artist: characterName || '陪伴伴侣',
      album: 'WHEN I with U',
      artwork: avatarUrl
        ? [{ src: avatarUrl, sizes: '512x512', type: 'image/png' }]
        : []
    });

    // 绑定播放控制 handler 防止系统直接中断卡片
    navigator.mediaSession.setActionHandler('play', () => {
      if (companionAudio) companionAudio.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (companionAudio) companionAudio.pause();
    });
  } catch (err) {
    console.warn('[LockscreenService] 更新 MediaSession 失败:', err);
  }
};

/**
 * 启动锁屏陪伴模式（需要用户主动触发，如点击按钮）
 */
export const startLockscreenCompanion = async (character = null) => {
  if (typeof window === 'undefined') return;

  try {
    // 创建静音/微弱白噪音 Audio 以激活系统的 MediaSession 锁屏挂载
    if (!companionAudio) {
      // 1秒长的无声 base64 mp3
      const silentMp3 = "data:audio/mp3;base64,SUQ3BAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//5AwAAAAAAAAAAAAAAAAAAAAAAAABGluZm8AAAAPAAAAAQAAAAAAAD8AMjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw//5AQAAAAAAAD8AAAAA";
      companionAudio = new Audio(silentMp3);
      companionAudio.loop = true;
      companionAudio.volume = 0.01;
    }

    await companionAudio.play();

    // 立即更新一次台词
    const quotes = await getLockscreenQuotes();
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    updateLockscreenMediaSession(
      character?.name || '陪伴伴侣',
      randomQuote,
      character?.avatar
    );

    // 每 10 分钟轮换一条锁屏台词
    if (quoteRotateTimer) clearInterval(quoteRotateTimer);
    quoteRotateTimer = setInterval(async () => {
      const latestQuotes = await getLockscreenQuotes();
      const nextQuote = latestQuotes[Math.floor(Math.random() * latestQuotes.length)];
      updateLockscreenMediaSession(
        character?.name || '陪伴伴侣',
        nextQuote,
        character?.avatar
      );
    }, 10 * 60 * 1000);

    return true;
  } catch (err) {
    console.error('[LockscreenService] 启动锁屏陪伴失败（需要用户点击触发）:', err);
    return false;
  }
};

/**
 * 停止锁屏陪伴模式
 */
export const stopLockscreenCompanion = () => {
  if (quoteRotateTimer) {
    clearInterval(quoteRotateTimer);
    quoteRotateTimer = null;
  }
  if (companionAudio) {
    companionAudio.pause();
    companionAudio.currentTime = 0;
  }
  if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
  }
};

export default {
  DEFAULT_LOCKSCREEN_QUOTES,
  getLockscreenQuotes,
  saveLockscreenQuotes,
  updateLockscreenMediaSession,
  startLockscreenCompanion,
  stopLockscreenCompanion,
};

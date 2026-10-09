import React, { useEffect, useState, useCallback } from 'react';
import { liveQuery } from 'dexie';
import { Settings as SettingsIcon } from 'lucide-react';
import { lazyWithRetry } from './utils/lazyWithRetry';

import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import PageLoadingBar from './components/PageLoadingBar';
import NotificationToast from './components/NotificationToast';
import KeepAliveIndicator from './components/KeepAliveIndicator';
import HouseManualModal from './components/manual/HouseManualModal';

import HubHeader from './apps/hub/HubHeader';
import QuickBoard from './apps/hub/QuickBoard';

import AppGrid from './apps/hub/AppGrid';
import StorageWarningBadge from './apps/hub/StorageWarningBadge';
import DesktopPetWidget from './apps/pet/DesktopPetWidget';

import MessagesApp from './apps/messages/MessagesApp';

import DailyOfferingHubGate from './apps/daily-offering/DailyOfferingHubGate';
import AudioKeepAlive from './apps/messages/components/AudioKeepAlive';
import AppUpdatePrompt from './apps/app-update/AppUpdatePrompt';

import { startOfflineSessionScheduler, stopOfflineSessionScheduler } from './apps/offline/offlineSessionScheduler';
import { startOfflineCountdownLockscreenScheduler, stopOfflineCountdownLockscreenScheduler } from './apps/offline/offlineCountdownLockscreenScheduler';

import {
  syncWorkflowsToServer,
  pullWorkflowRunStatusFromServer,
} from './services/workflow/workflowSyncService';
import {
  syncPendingPushMessages,
  syncPendingHomeBoard,
  syncPendingDiaries,
} from './services/cloudPushService';

import {
  startArchiveScheduler,
  stopArchiveScheduler
} from './apps/archive/archiveScheduler';


import soundService from './services/soundService';
import { applyPwaIcon } from './services/pwaIconService';


import {
  consumeMcpOAuthCallback,
} from './services/mcp/mcpOAuthService';

import db from './db';

import {
    startAutoMessageScheduler,
  stopAutoMessageScheduler,
} from './services/aiService';

import {
  getLockscreenCompanionEnabled,
  startLockscreenCompanion,
  stopLockscreenCompanion,
} from './services/lockscreenService';

import {
  startTravelPostcardScheduler,
  stopTravelPostcardScheduler,
} from './apps/travels/travelPostcardScheduler';


import {
  startScheduledMessageScheduler,
  stopScheduledMessageScheduler,
} from './apps/messages/scheduledMessageService';

import {
  startWorkflowScheduler,
  stopWorkflowScheduler,
} from './services/workflow/workflowScheduler';

import {
  checkAlmanacGreetings,
} from './apps/almanac/services/almanacGreetingService';

import {
  startGlobalChatScheduler,
  stopGlobalChatScheduler,
} from './services/globalChatScheduler';

import CallOverlayHost from './apps/messages/call/CallOverlayHost';
import { useActiveCall } from './hooks/useActiveCall';



import './apps/daily-offering/daily-offering.css';
import './apps/manual/manual.css';

// 2026-09 试点：懒加载改造的第一个试验品，只改这一行——从"打包时直接把
// 代码塞进主包"变成"点开羁绊大群那一刻才单独下载这个模块的代码"。
// EnsembleApp.jsx 自己和它底下所有的子组件、service 文件完全不用动，
// Vite 的 import() 是构建期自动识别、自动切分的，不需要目标文件本身
// 配合任何写法。
const EnsembleApp = lazyWithRetry(() => import('./apps/ensemble/EnsembleApp'), 'EnsembleApp');

// 2026-09 正式铺开：试点确认没问题后，除 MessagesApp（常驻、必须首屏可用，
// 不懒加载）以外的其余子应用页面全部按同样的模式转成 React.lazy。
// hub 首屏本身（HubHeader/QuickBoard/AppGrid/DailyOfferingHubGate）以及
// 常驻悬浮组件（AudioKeepAlive/AppUpdatePrompt/CallOverlayHost/
// DesktopPetWidget/StorageWarningBadge 等）不属于"点开才用到"的子应用页面，
// 保持原样立即加载，避免首屏出现额外的加载态闪烁。
const HourglassApp = lazyWithRetry(() => import('./apps/hourglass/HourglassApp'), 'HourglassApp');
const BadgeExchangeApp = lazyWithRetry(() => import('./apps/badges/BadgeExchangeApp'), 'BadgeExchangeApp');
const MailArchiveApp = lazyWithRetry(() => import('./apps/mailArchive/MailArchiveApp'), 'MailArchiveApp');
const ArchiveApp = lazyWithRetry(() => import('./apps/archive/ArchiveApp'), 'ArchiveApp');
const CallHistoryApp = lazyWithRetry(() => import('./apps/callHistory/CallHistoryApp'), 'CallHistoryApp');
const SettingsPage = lazyWithRetry(() => import('./apps/settings/SettingsPage'), 'SettingsPage');
const TodoApp = lazyWithRetry(() => import('./apps/todos/TodoApp'), 'TodoApp');
const DiaryApp = lazyWithRetry(() => import('./apps/diaries/DiaryApp'), 'DiaryApp');
const TravelApp = lazyWithRetry(() => import('./apps/travels/TravelApp'), 'TravelApp');
const SnapshotsApp = lazyWithRetry(() => import('./apps/snapshots/SnapshotsApp'), 'SnapshotsApp');
const PebblingApp = lazyWithRetry(() => import('./apps/pebbling/PebblingApp'), 'PebblingApp');
const ImaginariumApp = lazyWithRetry(() => import('./apps/imaginarium/ImaginariumApp'), 'ImaginariumApp');
const BubbleApp = lazyWithRetry(() => import('./apps/bubble/BubbleApp'), 'BubbleApp');
const RpApp = lazyWithRetry(() => import('./apps/rp/RpApp'), 'RpApp');
const HabitatApp = lazyWithRetry(() => import('./apps/habitat/HabitatApp'), 'HabitatApp');
const EphemeraApp = lazyWithRetry(() => import('./apps/ephemera/EphemeraApp'), 'EphemeraApp');

const AskBoxApp = lazyWithRetry(() => import('./apps/askbox/AskBoxApp'), 'AskBoxApp');
const ShellApp = lazyWithRetry(() => import('./apps/shell/ShellApp'), 'ShellApp');
const EmotionKitApp = lazyWithRetry(() => import('./apps/emotionkit/EmotionKitApp'), 'EmotionKitApp');
const ManualApp = lazyWithRetry(() => import('./apps/manual/ManualApp'), 'ManualApp');
const MemoryApp = lazyWithRetry(() => import('./apps/memory/MemoryApp'), 'MemoryApp');
const NewspaperApp = lazyWithRetry(() => import('./apps/newspaper/NewspaperApp'), 'NewspaperApp');
const MarginNotesApp = lazyWithRetry(() => import('./apps/margin-notes/MarginNotesApp'), 'MarginNotesApp');
const AlmanacApp = lazyWithRetry(() => import('./apps/almanac/AlmanacApp'), 'AlmanacApp');
const SharedWorldApp = lazyWithRetry(() => import('./apps/shared-world/SharedWorldApp'), 'SharedWorldApp');
const RhythmApp = lazyWithRetry(() => import('./apps/rhythm/RhythmApp'), 'RhythmApp');
const WorkflowApp = lazyWithRetry(() => import('./apps/workflows/WorkflowApp'), 'WorkflowApp');
const TextGameHallApp = lazyWithRetry(() => import('./apps/textgames/TextGameHallApp'), 'TextGameHallApp');

// 只是"这个模块的代码正在下载"那零点几秒到一两秒（视网络而定）的占位，
// 不是常规的应用内 loading 状态，所以故意做得很轻，没有另起 CSS 文件。
// 铺开的其余子应用统一复用这一个占位组件，不再逐个定制文案。
const EnsembleLoadingFallback = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-sub)',
      fontSize: '13px',
      backgroundColor: 'var(--bg-main)',
    }}
  >
    正在打开羁绊大群…
  </div>
);

// 通用占位：铺开阶段新懒加载的子应用没有 Ensemble 那样专门定制文案的必要，
// 统一用这一个即可，文案不针对具体应用名。
const AppLoadingFallback = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-sub)',
      fontSize: '13px',
      backgroundColor: 'var(--bg-main)',
    }}
  >
    正在加载…
  </div>
);

const THEME_COLORS = {
  'mono-mist': '#fcfbf7',
  'cream-latte': '#f8f5ee',
  'obsidian-dark': '#121212',
  'cyber-velvet': '#171321',
  'rose-quartz': '#fdf8f8',
};

const CHAT_APPS = [
  'messages',
  'imaginarium',
  'ensemble',
  'bubble',
  'habitat',
  'rp',
];

const REGISTERED_APPS = [
  'hub',
  'settings',
  'messages',
  'manual',
  'todos',
  'planner',
  'diaries',
  'travels',
  'travel',
  'snapshots',
  'pebbling',
  'imaginarium',
  'ensemble',
  'bubble',
  'habitat',
  'rp',
  'ephemera',
  'askbox',
  'shell',
  'emotionkit',
  'rhythm',
  'almanac',
  'shared-world',
  'memory',
  'archive',
  'callHistory',
  'hourglass',
  'badges',
    'mailArchive',
  'newspaper',
  'margin-notes',
  'workflows',
  'textgames',
];

const DEFAULT_AUDIO_CONFIG = {
  playlist: [],
  activeTrackId: '',
};


export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  // 玻璃质感风格（白色毛玻璃 frosted / 液态玻璃 liquid），跟 activeTheme
  // 是完全独立的两个维度，组合方式见 src/styles/glassStyles.css。
  const [activeGlassStyle, setActiveGlassStyle] = useState('frosted');
const [showTitle, setShowTitle] = useState(true);
const [hubBackground, setHubBackground] = useState('');

  const [currentApp, setCurrentApp] = useState('hub');
  const [isInsideChatRoom, setIsInsideChatRoom] = useState(false);

  const [isManualOpen, setIsManualOpen] = useState(false);
  const [hasCheckedManual, setHasCheckedManual] = useState(false);

  const [
    activeKeepAliveChats,
    setActiveKeepAliveChats,
  ] = useState([]);

  // 通话本身就在保活（屏幕上有正在进行/响铃中的电话，用户不会让它
  // 被系统挂起），所以电话打起来的时候，保活悬浮球这一个球该让位——
  // 桌宠悬浮球是另一件事，不受这里影响。
  const { activeCall } = useActiveCall();

  const [audioConfig, setAudioConfig] = useState(
    DEFAULT_AUDIO_CONFIG
  );

  const [
    pendingScheduledCount,
    setPendingScheduledCount,
  ] = useState(0);

  const [
    activeCharacterId,
    setActiveCharacterId,
  ] = useState(null);

  const [
    activeChatId,
    setActiveChatId,
  ] = useState(null);

    // 云端离线推送消息开屏/切回前台无感补齐 + 监听 ServiceWorker 点击直达 + 伴侣新消息提示音
  useEffect(() => {
    void syncPendingPushMessages();
    void syncPendingHomeBoard();
    void syncPendingDiaries();

    const handleWakeSync = () => {
      if (document.visibilityState === 'visible') {
        void syncPendingPushMessages();
        void syncPendingHomeBoard();
        void syncPendingDiaries();
      }
    };

    // 监听 Service Worker 投递的消息
    const handleServiceWorkerMessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'SYNC_OFFLINE_MESSAGES') {
        void syncPendingPushMessages();
        void syncPendingHomeBoard();
        void syncPendingDiaries();
        // 收到来自 SW 的新消息广播时播放提示音
        if (data.action === 'new_message' && data.chatId) {
          soundService.playCompanionMessageSound({ chatId: data.chatId });
        }
      } else if (data.type === 'NAVIGATE_TO_CHAT') {
                // 用户点击系统横幅通知时，自动直达消息 App
        setCurrentApp('messages');
      }
    };

    // 监听本地新插入消息事件（仅伴侣发来的消息才响铃，绝不干扰用户发消息）
        const handleLocalMessageInserted = (event) => {
      const detail = event.detail || {};
      // 如果携带了 sender 且不是伴侣，直接退出；用户自己发消息时走聊天框既有音效
      if (detail.sender && detail.sender !== 'character') {
        return;
      }
      soundService.playCompanionMessageSound({
        chatId: detail.chatId,
      });
    };

    // 退后台/锁屏时的云端同步不在这里做——cloudPushService.js 模块加载时
    // 会自己调用 initAutoContextSync()，监听同一组 visibilitychange/pagehide
    // 事件，走的是内存热缓存 + 防抖 + 去重 + sendBeacon 的优化路径。这里以前
    // 还单独挂了一个 handleAppHiding 调用 syncAllChatContextsToCloud()（不带
    // useCacheFirst/keepalive），等于每次退后台都多做一遍全量数据库扫描，
    // 还经常因为没传 keepalive 而在页面隐藏的瞬间被浏览器直接掐掉、白扫一遍
    // 却没发出去。2026-09 排查安卓内存占用问题时发现并删除，避免重复劳动。
    window.addEventListener('focus', handleWakeSync);
    window.addEventListener('pageshow', handleWakeSync);
    document.addEventListener('visibilitychange', handleWakeSync);
    window.addEventListener('new-local-message-inserted', handleLocalMessageInserted);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('focus', handleWakeSync);
      window.removeEventListener('pageshow', handleWakeSync);
      document.removeEventListener('visibilitychange', handleWakeSync);
      window.removeEventListener('new-local-message-inserted', handleLocalMessageInserted);

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);



  useEffect(() => {
    const finishOAuthCallback = async () => {
      const currentUrl = new URL(window.location.href);

      const hasOAuthCallbackParameters =
        currentUrl.searchParams.has('code') ||
        currentUrl.searchParams.has('state') ||
        currentUrl.searchParams.has('error');

      if (!hasOAuthCallbackParameters) {
        return;
      }

      try {
        await consumeMcpOAuthCallback(
          currentUrl.toString()
        );
      } catch (error) {
        console.warn(
          '[MCP OAuth] 授权回调未完成：',
          error
        );
      } finally {
        [
          'code',
          'state',
          'error',
          'error_description',
          'error_uri',
          'iss',
        ].forEach((key) => {
          currentUrl.searchParams.delete(key);
        });

        const safeUrl =
          currentUrl.pathname +
          currentUrl.search +
          currentUrl.hash;

        window.history.replaceState(
          window.history.state,
          document.title,
          safeUrl
        );
      }
    };

    void finishOAuthCallback();
  }, []);

  useEffect(() => {
    // 周期性检查已经并入 globalChatScheduler.js（跟 rhythm/call/
    // snapshotGlobal/parallelOrbit 共用同一个基准 tick，见下面另一个
    // useEffect），这里只保留"App 切回前台时立刻看一眼"这个独立的
    // 触发点，不再自己单独起一个 3 分钟的 setInterval。
    const handleAlmanacWake = () => {
      void checkAlmanacGreetings();
    };

    window.addEventListener(
      'focus',
      handleAlmanacWake
    );

    window.addEventListener(
      'pageshow',
      handleAlmanacWake
    );

    document.addEventListener(
      'visibilitychange',
      handleAlmanacWake
    );

    return () => {
      window.removeEventListener(
        'focus',
        handleAlmanacWake
      );

      window.removeEventListener(
        'pageshow',
        handleAlmanacWake
      );

      document.removeEventListener(
        'visibilitychange',
        handleAlmanacWake
      );
    };
  }, []);

 useEffect(() => {
  let cancelled = false;

   (async () => {
    if (cancelled) return;

        startAutoMessageScheduler();
    startTravelPostcardScheduler();
    startScheduledMessageScheduler();
    startWorkflowScheduler();
    startOfflineSessionScheduler();
    startOfflineCountdownLockscreenScheduler();
    // rhythm / call / snapshotGlobal / almanacGreeting / parallelOrbit
    // 这五个原本各自独立遍历全部聊天窗的调度器，合并到了
    // globalChatScheduler.js 的共享基准 tick 里，见该文件顶部说明。
    startGlobalChatScheduler();

      startArchiveScheduler();

    void syncWorkflowsToServer();
    void pullWorkflowRunStatusFromServer();
  })();

  return () => {
    cancelled = true;
    stopAutoMessageScheduler();
    stopTravelPostcardScheduler();
    stopScheduledMessageScheduler();
    stopWorkflowScheduler();
    stopOfflineSessionScheduler();

        stopOfflineCountdownLockscreenScheduler();
    stopGlobalChatScheduler();
       stopArchiveScheduler();
  };
}, []);


  useEffect(() => {
    let cancelled = false;

    const restoreLockscreenCompanion = async () => {
      try {
        const enabled =
          await getLockscreenCompanionEnabled();

        if (!enabled || cancelled) {
          return;
        }

        const character = await db.characters
          .filter((item) => item.isNpc !== true)
          .first();

        if (cancelled) {
          return;
        }

        await startLockscreenCompanion(
          character || null
        );
      } catch (error) {
        if (!cancelled) {
          console.warn(
            '[App] 恢复锁屏陪伴失败:',
            error
          );
        }
      }
    };

    void restoreLockscreenCompanion();

    return () => {
      cancelled = true;
      stopLockscreenCompanion();
    };
  }, []);

  useEffect(() => {
    // 注意：寄语本身的触发已经交给 rhythmScheduler.js 的独立定时器了。
    // 这里只保留"记住最近活跃的是哪个角色"这一件事——
    // Rhythm（时光作息）页面靠 activeCharacterId 知道当前该显示谁的课表，
    // 这是它在整个 App 里唯一的写入来源，所以不能连同寄语逻辑一起删掉。
    const syncActiveCharacterForRhythm = async () => {
      try {
        const latestChat = await db.chats
          .orderBy('updatedAt')
          .reverse()
          .first();

        if (!latestChat) {
          return;
        }

        const character = await db.characters.get(
          latestChat.characterId
        );

        if (!character) {
          return;
        }

               setActiveCharacterId(character.id);
        setActiveChatId(latestChat.id);
      } catch (err) {
        console.warn(
          '[App] 获取最近活跃角色失败:',
          err
        );
      }
    };

    void syncActiveCharacterForRhythm();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncActiveCharacterForRhythm();
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );
    };
  }, []);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [
        activeChats,
        activeRpSessions,
        savedAudioConfig,
        pendingCount,
      ] = await Promise.all([
        db.chats
          .filter((chat) => chat.keepAlive === true)
          .toArray(),

        // RP会话的保活开关存在 rpSessions 表上（跟主聊天分开的表，见
        // src/apps/rp/rpService.js 顶部注释），跟主聊天共用下面同一套
        // AudioKeepAlive/KeepAliveIndicator，不用为RP另起一套机制。
        db.rpSessions
          .filter((session) => session.keepAlive === true)
          .toArray(),

        db.settings.get('keep_alive_audio_config'),

        // 离线后自动回复（away_return）不计入：它不需要后台音频保活，
        // 应用回到前台时由现有调度器补发，避免整个离线时段都在耗电。
        db.scheduledMessages
          .where('status')
          .equals('pending')
          .filter((task) => task.scheduleType !== 'away_return')
          .count(),
      ]);

      return {
        // 两张表各自查完之后在这里合并成一个数组——下游的 AudioKeepAlive/
        // KeepAliveIndicator 不关心一条记录到底来自 db.chats 还是
        // db.rpSessions，只要有 .id/.title 就行（两边字段名本来就一致）。
        activeChats: [...activeChats, ...activeRpSessions],
        audioConfig:
          savedAudioConfig?.value ||
          DEFAULT_AUDIO_CONFIG,
        pendingCount,
      };
    }).subscribe({
      next: ({
        activeChats,
        audioConfig: nextAudioConfig,
        pendingCount,
      }) => {
        const normalizedAudioConfig = {
          playlist: Array.isArray(
            nextAudioConfig?.playlist
          )
            ? nextAudioConfig.playlist
            : [],
          activeTrackId:
            nextAudioConfig?.activeTrackId || '',
        };

        setActiveKeepAliveChats(activeChats);
        setAudioConfig(normalizedAudioConfig);
        setPendingScheduledCount(pendingCount);
      },

      error: (error) => {
        console.warn(
          'Unable to observe keep-alive state:',
          error
        );

        setActiveKeepAliveChats([]);
        setAudioConfig(DEFAULT_AUDIO_CONFIG);
        setPendingScheduledCount(0);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

    useEffect(() => {
    let cancelled = false;

    const loadHubBackground = async () => {
      try {
        const setting = await db.settings.get(
          'hubBackground',
        );

        if (!cancelled && typeof setting?.value === 'string') {
          setHubBackground(setting.value);
        }
      } catch (error) {
        console.warn(
          '[App] 读取主界面背景失败:',
          error,
        );
      }
    };

    void loadHubBackground();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const applyStoredPwaIcon = async () => {
      try {
        const setting = await db.settings.get('pwaIcon');
        if (typeof setting?.value === 'string' && setting.value) {
          await applyPwaIcon(setting.value);
        }
      } catch (error) {
        console.warn('[App] 读取 PWA 图标设置失败:', error);
      }
    };

    void applyStoredPwaIcon();
  }, []);


  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      activeTheme
    );

    const themeColor =
      THEME_COLORS[activeTheme] || '#fcfbf7';

    document.body.style.backgroundColor = themeColor;

    let metaThemeColor = document.querySelector(
      'meta[name="theme-color"]'
    );

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    metaThemeColor.setAttribute(
      'content',
      themeColor
    );
  }, [activeTheme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-glass-style',
      activeGlassStyle
    );
  }, [activeGlassStyle]);

  useEffect(() => {
    if (
      showPreloader ||
      currentApp !== 'hub' ||
      hasCheckedManual
    ) {
      return;
    }

    let cancelled = false;

    const checkManualStatus = async () => {
      try {
        const setting = await db.settings.get(
          'houseManualSeen'
        );

        if (
          !cancelled &&
          setting?.value !== true
        ) {
          setIsManualOpen(true);
        }
      } catch (error) {
        console.warn(
          '[Manual] 读取首次查看状态失败:',
          error
        );
      } finally {
        if (!cancelled) {
          setHasCheckedManual(true);
        }
      }
    };

    void checkManualStatus();

    return () => {
      cancelled = true;
    };
  }, [
    showPreloader,
    currentApp,
    hasCheckedManual,
  ]);

  const handlePreloaderFinish = useCallback(() => {
    setShowPreloader(false);
  }, []);

  const openApp = useCallback((appId) => {
    setCurrentApp(appId);

    if (!CHAT_APPS.includes(appId)) {
      setIsInsideChatRoom(false);
    }

    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'auto',
      });
    });
  }, []);

  const handleOpenManual = useCallback(() => {
    setIsManualOpen(true);
  }, []);

  const handleCloseManual = useCallback(async () => {
    setIsManualOpen(false);

    try {
      await db.settings.put({
        key: 'houseManualSeen',
        value: true,
      });
    } catch (error) {
      console.warn(
        '[Manual] 保存首次查看状态失败:',
        error
      );
    }
  }, []);


   /*
   * isKeepAliveActive 驱动的是"后台静音音频要不要播放"，它需要在
   * 有预约消息等待发送时也保持开启，否则页面被系统挂起后预约可能
   * 无法按时触发——这个 OR 条件是故意的，不是 bug。
   *
   * 悬浮球（KeepAliveIndicator）曾经只反映"用户自己在某个消息框里
   * 打开了后台音频保活"这一件事，代价是：只要还有预约消息在排队，
   * 音频保活其实一直在跑（包括手势唤醒时那声"静默音频重新播放"的
   * 提示音），但悬浮球完全不显示，用户既看不到也关不掉，只会在毫无
   * 征兆的情况下听到一声"嘀"。
   *
   * 所以现在悬浮球改为同时反映这两种触发来源：用户主动打开的
   * activeKeepAliveChats，或是还有预约消息在排队的 pendingScheduledCount。
   * 只要音频保活在跑，悬浮球就该在，用户才能点开它看到原因、也才有
   * 地方可以管理（哪怕只是看到"有预约消息待发送"）。
 */

  const isKeepAliveActive =
    activeKeepAliveChats.length > 0 ||
    pendingScheduledCount > 0;

    const isKeepAliveWidgetVisible =
  (activeKeepAliveChats.length > 0 ||
    pendingScheduledCount > 0) &&
  !activeCall;

  const activeAudioTrack = audioConfig.playlist.find(
    (track) => track.id === audioConfig.activeTrackId
  );

  const activeAudioUrl = activeAudioTrack?.url || '';

   const shouldDisplayHubHeader =
    currentApp === 'hub' && !isInsideChatRoom;

  const shouldDisplayHubBackground =
    (currentApp === 'hub' || currentApp === 'messages' || currentApp === 'rp') &&
    !isInsideChatRoom &&
    Boolean(hubBackground);

  const isMarginNotesApp =
    currentApp === 'margin-notes';

 const isShellApp = currentApp === 'shell';
const isEmotionKitApp = currentApp === 'emotionkit';
 // 文字游戏大厅是一整张边到边铺满视口的黑白弥散杂志背景，不是普通
  // 卡片车道里的内容——跟 emotionkit 一样需要真正的整视口宽度（不封顶
  // max-w-[420px]），不能只套 margin-notes/shell 那种"车道宽度不变，
  // 只去掉上下 padding"的处理，否则宽屏下左右两侧还是会露出车道外的
  // 空白。
const isTextGameHallApp = currentApp === 'textgames';

  const mainClassName = isInsideChatRoom
    ? 'relative z-10 mx-auto h-[100dvh] w-full max-w-[420px] overflow-hidden'
    : isEmotionKitApp || isTextGameHallApp
      ? 'relative z-10 w-full min-h-[100dvh] overflow-x-hidden'
      : isMarginNotesApp || isShellApp
        ? 'relative z-10 mx-auto min-h-[100dvh] w-full max-w-[420px] overflow-x-hidden'
        : 'relative z-10 mx-auto min-h-[100dvh] w-full max-w-[420px] space-y-6 px-4 pb-20 pt-6';

  return (
    <ErrorBoundary>
      {showPreloader && (
        <ErrorBoundary>
          <Preloader
            onFinish={handlePreloaderFinish}
          />
        </ErrorBoundary>
      )}

      <PageLoadingBar activeKey={currentApp} />

      <NotificationToast />

      <AppUpdatePrompt
        isAppReady={!showPreloader}
        isInsideChatRoom={isInsideChatRoom}
      />

      <HouseManualModal
        isOpen={isManualOpen}
        onClose={handleCloseManual}
      />

      <AudioKeepAlive
        isActive={isKeepAliveActive}
        audioSrc={activeAudioUrl}
      />

      <KeepAliveIndicator
        isVisible={isKeepAliveWidgetVisible}
        activeChats={activeKeepAliveChats}
        pendingScheduledCount={pendingScheduledCount}
        audioConfig={audioConfig}
        onAudioConfigChange={setAudioConfig}
      />

      <DesktopPetWidget />

      {currentApp === 'hub' && (
        <StorageWarningBadge
          onOpenSettings={() => openApp('settings')}
        />
      )}

      <CallOverlayHost />

                  <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-700"
        style={{
          backgroundColor: 'var(--bg-main)',
        }}
      >
        {shouldDisplayHubBackground && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url("${hubBackground}")`,
              opacity: 1,
            }}
          />
        )}

        {!shouldDisplayHubBackground && (
          <>
            <div
              className="absolute -left-32 -top-32 h-[25rem] w-[25rem] rounded-full blur-[115px] transition-colors duration-700"
              style={{
                backgroundColor: 'var(--bg-blob-1)',
              }}
            />

            <div
              className="absolute -right-40 top-[28%] h-[28rem] w-[28rem] rounded-full blur-[130px] transition-colors duration-700"
              style={{
                backgroundColor: 'var(--bg-blob-2)',
              }}
            />

            <div
              className="absolute -bottom-48 left-[10%] h-[25rem] w-[25rem] rounded-full blur-[135px] transition-colors duration-700"
              style={{
                backgroundColor: 'var(--bg-blob-3)',
              }}
            />
          </>
        )}
      </div>



      <main
        className={mainClassName}
        style={{
          paddingTop:
                                           isInsideChatRoom || isMarginNotesApp || isShellApp || isTextGameHallApp
              ? '0'
              : 'calc(1.5rem + env(safe-area-inset-top, 0px))',

          paddingBottom:
            isInsideChatRoom || isMarginNotesApp || isShellApp || isTextGameHallApp
              ? '0'
              : 'calc(5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {shouldDisplayHubHeader && (
          <header
            className={`flex items-start animate-fade-in-up ${
              showTitle
                ? 'justify-between'
                : 'justify-end'
            }`}
          >
            {showTitle && (
              <div>
                <h1
                  className="font-serif text-5xl font-semibold leading-none tracking-tighter"
                  style={{
                    color: 'var(--text-main)',
                  }}
                >
                  WHEN I
                  <br />
                  <span className="font-normal italic opacity-40">
                    with U.
                  </span>
                </h1>

                <div
                  className="mt-3 h-px w-10"
                  style={{
                    backgroundColor: 'var(--text-main)',
                    opacity: 0.2,
                  }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => openApp('settings')}
              title="打开设置"
              aria-label="打开设置"
              className="rounded-full border p-2.5 shadow-sm transition-transform active:scale-95"
              style={{
                color: 'var(--accent-foreground)',
                backgroundColor: 'var(--accent-color)',
                borderColor: 'var(--card-border)',
              }}
            >
              <SettingsIcon
                className="h-4 w-4"
                strokeWidth={1.7}
              />
            </button>
          </header>
        )}

        {currentApp === 'hub' && (
          <DailyOfferingHubGate
            onOpenSettings={() => openApp('settings')}
          >
                        <ErrorBoundary>
              <HubHeader />
            </ErrorBoundary>

            <ErrorBoundary>
                          <QuickBoard delay={300} onOpenArchive={() => openApp('mailArchive')} />
            </ErrorBoundary>

            <ErrorBoundary>
              <AppGrid
                delay={400}
                onOpenApp={openApp}
              />
            </ErrorBoundary>
          </DailyOfferingHubGate>
        )}

        {currentApp === 'settings' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <SettingsPage
                onBack={() => openApp('hub')}
                onOpenManual={handleOpenManual}
                currentTheme={activeTheme}
                onChangeTheme={setActiveTheme}
                currentGlassStyle={activeGlassStyle}
                onChangeGlassStyle={setActiveGlassStyle}
                showTitle={showTitle}
                onToggleTitle={setShowTitle}
                currentHubBackground={hubBackground}
                onChangeHubBackground={setHubBackground}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'manual' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <ManualApp
                onBack={() => openApp('settings')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'messages' && (
          <ErrorBoundary>
            <MessagesApp
              onBackHub={() => openApp('hub')}
              onChatRoomStateChange={
                setIsInsideChatRoom
              }
            />
          </ErrorBoundary>
        )}

        {['todos', 'planner'].includes(currentApp) && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <TodoApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'diaries' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <DiaryApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {['travels', 'travel'].includes(currentApp) && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <TravelApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'margin-notes' && (
          <React.Suspense fallback={<AppLoadingFallback />}>
            <MarginNotesApp
              onBackHub={() => openApp('hub')}
            />
          </React.Suspense>
        )}

        {currentApp === 'snapshots' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <SnapshotsApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'pebbling' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <PebblingApp
                onBack={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'imaginarium' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <ImaginariumApp
                onBackHub={() => openApp('hub')}
                onChatRoomStateChange={
                  setIsInsideChatRoom
                }
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'ensemble' && (
          <ErrorBoundary>
            <React.Suspense fallback={<EnsembleLoadingFallback />}>
              <EnsembleApp
                onBackHub={() => openApp('hub')}
                onChatRoomStateChange={
                  setIsInsideChatRoom
                }
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

              {currentApp === 'bubble' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <BubbleApp
                onBackHub={() => openApp('hub')}
                onChatRoomStateChange={
                  setIsInsideChatRoom
                }
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'rp' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <RpApp
                onBackHub={() => openApp('hub')}
                onChatRoomStateChange={
                  setIsInsideChatRoom
                }
                hubBackground={hubBackground}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'habitat' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <HabitatApp
                onBackHub={() => openApp('hub')}
                onChatRoomStateChange={
                  setIsInsideChatRoom
                }
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'newspaper' && (
          <React.Suspense fallback={<AppLoadingFallback />}>
            <NewspaperApp
              onClose={() => setCurrentApp('hub')}
            />
          </React.Suspense>
        )}

        {currentApp === 'ephemera' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <EphemeraApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

               {currentApp === 'askbox' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <AskBoxApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'shell' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <ShellApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'emotionkit' && (
  <ErrorBoundary>
    <React.Suspense fallback={<AppLoadingFallback />}>
      <EmotionKitApp onBackHub={() => openApp('hub')} />
    </React.Suspense>
  </ErrorBoundary>
)}


        {currentApp === 'rhythm' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
                         <RhythmApp
                onBackHub={() => openApp('hub')}
                currentCharacterId={activeCharacterId}
                currentChatId={activeChatId}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'almanac' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <AlmanacApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'hourglass' && (
  <ErrorBoundary>
    <React.Suspense fallback={<AppLoadingFallback />}>
      <HourglassApp
        onBackHub={() => openApp('hub')}
      />
    </React.Suspense>
  </ErrorBoundary>
)}

        {currentApp === 'badges' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <BadgeExchangeApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

                {currentApp === 'textgames' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <TextGameHallApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'mailArchive' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <MailArchiveApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'shared-world' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <SharedWorldApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

                {currentApp === 'memory' && (
          <React.Suspense fallback={<AppLoadingFallback />}>
            <MemoryApp
              onBackHub={() => openApp('hub')}
            />
          </React.Suspense>
        )}

                {currentApp === 'archive' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <ArchiveApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'callHistory' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <CallHistoryApp
                onBackHub={() => openApp('hub')}
                hubBackground={hubBackground}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {currentApp === 'workflows' && (
          <ErrorBoundary>
            <React.Suspense fallback={<AppLoadingFallback />}>
              <WorkflowApp
                onBackHub={() => openApp('hub')}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}

        {!REGISTERED_APPS.includes(currentApp) && (
          <ErrorBoundary>
            <section className="py-14 text-center">
              <h2
                className="text-xl font-semibold uppercase tracking-[0.16em]"
                style={{
                  color: 'var(--text-main)',
                }}
              >
                {currentApp}
              </h2>

              <p
                className="mt-3 text-xs"
                style={{
                  color: 'var(--text-sub)',
                }}
              >
                此模块将在后续阶段为您呈现。
              </p>

              <button
                type="button"
                onClick={() => openApp('hub')}
                className="mt-6 rounded-full px-5 py-2 text-xs font-semibold transition-transform active:scale-95"
                style={{
                  color: 'var(--accent-foreground)',
                  backgroundColor: 'var(--accent-color)',
                }}
              >
                返回主页
              </button>
            </section>
          </ErrorBoundary>
        )}
      </main>
    </ErrorBoundary>
  );
};

export default App;
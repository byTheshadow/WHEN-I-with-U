import React, { useEffect, useState, useCallback } from 'react';
import { liveQuery } from 'dexie';
import { Settings as SettingsIcon } from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import NotificationToast from './components/NotificationToast';
import KeepAliveIndicator from './components/KeepAliveIndicator';
import HouseManualModal from './components/manual/HouseManualModal';

import ProfileHeader from './apps/hub/ProfileHeader';
import PinnedGallery from './apps/hub/PinnedGallery';
import QuickBoard from './apps/hub/QuickBoard';
import AppGrid from './apps/hub/AppGrid';

import SettingsPage from './apps/settings/SettingsPage';
import MessagesApp from './apps/messages/MessagesApp';
import TodoApp from './apps/todos/TodoApp';
import DiaryApp from './apps/diaries/DiaryApp';
import TravelApp from './apps/travels/TravelApp';
import SnapshotsApp from './apps/snapshots/SnapshotsApp';
import PebblingApp from './apps/pebbling/PebblingApp';
import ImaginariumApp from './apps/imaginarium/ImaginariumApp';
import EnsembleApp from './apps/ensemble/EnsembleApp';
import HabitatApp from './apps/habitat/HabitatApp';
import EphemeraApp from './apps/ephemera/EphemeraApp';
import AskBoxApp from './apps/askbox/AskBoxApp';
import ManualApp from './apps/manual/ManualApp';
import DailyOfferingHubGate from './apps/daily-offering/DailyOfferingHubGate';
import AudioKeepAlive from './apps/messages/components/AudioKeepAlive';
import AppUpdatePrompt from './apps/app-update/AppUpdatePrompt';
import MemoryApp from './apps/memory/MemoryApp';
import NewspaperApp from './apps/newspaper/NewspaperApp';
import MarginNotesApp from './apps/margin-notes/MarginNotesApp';
import AlmanacApp from './apps/almanac/AlmanacApp';

import {
  consumeMcpOAuthCallback,
} from './services/mcp/mcpOAuthService';

import RhythmApp from './apps/rhythm/RhythmApp';
import {
  triggerRhythmActiveReminder,
} from './services/rhythmReminderService';

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
  checkAlmanacGreetings,
  startAlmanacGreetingScheduler,
  stopAlmanacGreetingScheduler,
} from './apps/almanac/services/almanacGreetingService';

import {
  startParallelOrbitScheduler,
  stopParallelOrbitScheduler,
} from './services/parallelOrbitScheduler';

import './apps/daily-offering/daily-offering.css';
import './apps/manual/manual.css';

const THEME_COLORS = {
  'mono-mist': '#fcfbf7',
  'cream-latte': '#f8f5ee',
  'obsidian-dark': '#121212',
  'cyber-velvet': '#171321',
};

const CHAT_APPS = [
  'messages',
  'imaginarium',
  'ensemble',
  'habitat',
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
  'habitat',
  'ephemera',
  'askbox',
  'rhythm',
  'almanac',
  'memory',
  'newspaper',
  'margin-notes',
];

const DEFAULT_AUDIO_CONFIG = {
  playlist: [],
  activeTrackId: '',
};

/**
 * 开屏/唤醒双保险同步函数：
 * 从云端待取池拉取未写入本地的消息，确保用户不点系统通知直接点桌面图标打开 App 也能 100% 看见新消息
 */
async function syncPendingPushMessages() {
  try {
    const pushSetting = await db.settings.get('cloudPushConfig');
    const rawServerUrl = pushSetting?.value?.serverUrl;
    const serverUrl = (rawServerUrl || '').trim().replace(/\/$/, '');

    if (!serverUrl) {
      return;
    }

    const res = await fetch(`${serverUrl}/api/fetch-pending-messages`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;

    const data = await res.json();
    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return;
    }

    const syncedIds = [];

    for (const msg of data.messages) {
      const chatIdNum = Number(msg.chatId || 1);
      const rawTimestamp = msg.timestamp || Date.now();
      const timestampNum = typeof rawTimestamp === 'number' ? rawTimestamp : new Date(rawTimestamp).getTime();

      // 本地查重：优先复合索引，兼容时间+内容查重防崩溃
      let exists = false;
      try {
        exists = await db.messages
          .where('[chatId+timestamp]')
          .equals([chatIdNum, timestampNum])
          .first();
      } catch (err) {
        exists = await db.messages
          .where('chatId')
          .equals(chatIdNum)
          .filter((m) => m.timestamp === timestampNum || (m.content === msg.content && Math.abs((m.timestamp || 0) - timestampNum) < 3000))
          .first();
      }

      if (!exists) {
        const { id, ...recordToSave } = msg;
        const nowIso = new Date(timestampNum).toISOString();

        // ⚠️ 核心修复：sender 必须对齐系统标准 'assistant'，而不是 'character'！
        const rawSender = recordToSave.sender;
        const normalizedSender = (rawSender === 'character' || rawSender === 'assistant') ? 'assistant' : (rawSender || 'assistant');

        const messageRecord = {
          ...recordToSave,
          chatId: chatIdNum,
          characterId: Number(recordToSave.characterId || 1),
          sender: normalizedSender,
          type: recordToSave.type || 'text',
          content: recordToSave.content || '',
          metadata: {
            isOfflinePush: true,
            source: 'cloud-pending-sync',
            ...(recordToSave.metadata || {}),
          },
          quotedMessageId: recordToSave.quotedMessageId ?? null,
          isRead: 0,
          timestamp: timestampNum,
          versions: recordToSave.versions || [
            {
              text: recordToSave.content || '',
              timestamp: timestampNum,
              model: 'cloud-push-ai',
            },
          ],
          currentVersionIndex: 0,
        };

        const newMsgId = await db.messages.add(messageRecord);

        // 同步更新对应会话列表摘要和最后更新时间
        await db.chats.where('id').equals(chatIdNum).modify({
          updatedAt: nowIso,
          summary: (messageRecord.content || '').slice(0, 30),
        });

        // 派发全局事件通知当前打开的聊天框立刻刷新
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('new-local-message-inserted', {
              detail: {
                chatId: chatIdNum,
                messageId: newMsgId,
              },
            })
          );
        }
      }

      if (msg.id) {
        syncedIds.push(msg.id);
      }
    }

    if (syncedIds.length > 0) {
      await fetch(`${serverUrl}/api/ack-pending-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: syncedIds }),
      }).catch(() => {});
    }
  } catch (error) {
    console.warn('[CloudPushSync] 同步未完成:', error);
  }
}


export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  const [showTitle, setShowTitle] = useState(true);
  const [currentApp, setCurrentApp] = useState('hub');
  const [isInsideChatRoom, setIsInsideChatRoom] = useState(false);

  const [isManualOpen, setIsManualOpen] = useState(false);
  const [hasCheckedManual, setHasCheckedManual] = useState(false);

  const [
    activeKeepAliveChats,
    setActiveKeepAliveChats,
  ] = useState([]);

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

   // 云端离线推送消息开屏/切回前台无感补齐 + 监听 ServiceWorker 点击直达
  useEffect(() => {
    void syncPendingPushMessages();

    const handleWakeSync = () => {
      if (document.visibilityState === 'visible') {
        void syncPendingPushMessages();
      }
    };

    // 监听 Service Worker 投递的消息（后台新消息通知或点击通知直达聊天框）
    const handleServiceWorkerMessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'SYNC_OFFLINE_MESSAGES') {
        void syncPendingPushMessages();
      } else if (data.type === 'NAVIGATE_TO_CHAT') {
        // 用户点击系统横幅通知时，自动直达消息 App
        setCurrentApp('messages');
      }
    };

    window.addEventListener('focus', handleWakeSync);
    window.addEventListener('pageshow', handleWakeSync);
    document.addEventListener('visibilitychange', handleWakeSync);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('focus', handleWakeSync);
      window.removeEventListener('pageshow', handleWakeSync);
      document.removeEventListener('visibilitychange', handleWakeSync);
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
    const handleAlmanacWake = () => {
      void checkAlmanacGreetings();
    };

    startAlmanacGreetingScheduler();

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
      stopAlmanacGreetingScheduler();

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
    startAutoMessageScheduler();
    startTravelPostcardScheduler();
    startScheduledMessageScheduler();
    startParallelOrbitScheduler();

    return () => {
      stopAutoMessageScheduler();
      stopTravelPostcardScheduler();
      stopScheduledMessageScheduler();
      stopParallelOrbitScheduler();
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
    const handleCheckReminder = async () => {
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

        const result =
          await triggerRhythmActiveReminder(
            latestChat.id,
            character,
            false
          );

        if (result?.status === 'success') {
          console.log(
            `[RhythmScheduler] AI 已主动留下提醒消息: "${result.text}"`
          );
        }
      } catch (err) {
        console.warn(
          '[RhythmScheduler] 提醒自检未通过或暂无可用角色:',
          err
        );
      }
    };

    void handleCheckReminder();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void handleCheckReminder();
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
        savedAudioConfig,
        pendingCount,
      ] = await Promise.all([
        db.chats
          .filter((chat) => chat.keepAlive === true)
          .toArray(),

        db.settings.get('keep_alive_audio_config'),

        db.scheduledMessages
          .where('status')
          .equals('pending')
          .count(),
      ]);

      return {
        activeChats,
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

  const isKeepAliveActive =
    activeKeepAliveChats.length > 0 ||
    pendingScheduledCount > 0;

  const activeAudioTrack = audioConfig.playlist.find(
    (track) => track.id === audioConfig.activeTrackId
  );

  const activeAudioUrl = activeAudioTrack?.url || '';

  const shouldDisplayHubHeader =
    currentApp === 'hub' && !isInsideChatRoom;

  const isMarginNotesApp =
    currentApp === 'margin-notes';

  const mainClassName = isInsideChatRoom
    ? 'relative z-10 mx-auto h-[100dvh] w-full max-w-[420px] overflow-hidden'
    : isMarginNotesApp
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
        isVisible={isKeepAliveActive}
        activeChats={activeKeepAliveChats}
        audioConfig={audioConfig}
        onAudioConfigChange={setAudioConfig}
      />

      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-colors duration-700"
        style={{
          backgroundColor: 'var(--bg-main)',
        }}
      >
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
      </div>

      <main
        className={mainClassName}
        style={{
          paddingTop:
            isInsideChatRoom || isMarginNotesApp
              ? '0'
              : 'calc(1.5rem + env(safe-area-inset-top, 0px))',

          paddingBottom:
            isInsideChatRoom || isMarginNotesApp
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
              <ProfileHeader delay={100} />
            </ErrorBoundary>

            <ErrorBoundary>
              <PinnedGallery delay={200} />
            </ErrorBoundary>

            <ErrorBoundary>
              <QuickBoard delay={300} />
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
            <SettingsPage
              onBack={() => openApp('hub')}
              onOpenManual={handleOpenManual}
              currentTheme={activeTheme}
              onChangeTheme={setActiveTheme}
              showTitle={showTitle}
              onToggleTitle={setShowTitle}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'manual' && (
          <ErrorBoundary>
            <ManualApp
              onBack={() => openApp('settings')}
            />
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
            <TodoApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'diaries' && (
          <ErrorBoundary>
            <DiaryApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {['travels', 'travel'].includes(currentApp) && (
          <ErrorBoundary>
            <TravelApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'margin-notes' && (
          <MarginNotesApp
            onBackHub={() => openApp('hub')}
          />
        )}

        {currentApp === 'snapshots' && (
          <ErrorBoundary>
            <SnapshotsApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'pebbling' && (
          <ErrorBoundary>
            <PebblingApp
              onBack={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'imaginarium' && (
          <ErrorBoundary>
            <ImaginariumApp
              onBackHub={() => openApp('hub')}
              onChatRoomStateChange={
                setIsInsideChatRoom
              }
            />
          </ErrorBoundary>
        )}

        {currentApp === 'ensemble' && (
          <ErrorBoundary>
            <EnsembleApp
              onBackHub={() => openApp('hub')}
              onChatRoomStateChange={
                setIsInsideChatRoom
              }
            />
          </ErrorBoundary>
        )}

        {currentApp === 'habitat' && (
          <ErrorBoundary>
            <HabitatApp
              onBackHub={() => openApp('hub')}
              onChatRoomStateChange={
                setIsInsideChatRoom
              }
            />
          </ErrorBoundary>
        )}

        {currentApp === 'newspaper' && (
          <NewspaperApp
            onClose={() => setCurrentApp('hub')}
          />
        )}

        {currentApp === 'ephemera' && (
          <ErrorBoundary>
            <EphemeraApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'askbox' && (
          <ErrorBoundary>
            <AskBoxApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'rhythm' && (
          <ErrorBoundary>
            <RhythmApp
              onBackHub={() => openApp('hub')}
              currentCharacterId={activeCharacterId}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'almanac' && (
          <ErrorBoundary>
            <AlmanacApp
              onBackHub={() => openApp('hub')}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'memory' && (
          <MemoryApp
            onBackHub={() => openApp('hub')}
          />
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







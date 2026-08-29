import React, { useEffect, useState, useCallback } from 'react';
import { liveQuery } from 'dexie';
import { Settings as SettingsIcon } from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import NotificationToast from './components/NotificationToast';
import KeepAliveIndicator from './components/KeepAliveIndicator';

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
import {
  consumeMcpOAuthCallback,
} from './services/mcp/mcpOAuthService';



// 👈 导入新增的 Rhythm 模块
import RhythmApp from './apps/rhythm/RhythmApp';
import { triggerRhythmActiveReminder } from './services/rhythmReminderService';

import db from './db';

import {
  requestNotificationPermission,
  startAutoMessageScheduler,
  stopAutoMessageScheduler
} from './services/aiService';

import {
  startTravelPostcardScheduler,
  stopTravelPostcardScheduler
} from './apps/travels/travelPostcardScheduler';

import {
  startScheduledMessageScheduler,
  stopScheduledMessageScheduler
} from './apps/messages/scheduledMessageService';
import {
  startParallelOrbitScheduler,
  stopParallelOrbitScheduler
} from './services/parallelOrbitScheduler';


import './apps/daily-offering/daily-offering.css';
import './apps/manual/manual.css';

const THEME_COLORS = {
  'mono-mist': '#fcfbf7',
  'cream-latte': '#f8f5ee',
  'obsidian-dark': '#121212',
  'cyber-velvet': '#171321'
};

const CHAT_APPS = [
  'messages',
  'imaginarium',
  'ensemble',
  'habitat'
];

// 👈 注册 rhythm 到可用子应用列表中
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
  'memory'
];

const DEFAULT_AUDIO_CONFIG = {
  playlist: [],
  activeTrackId: ''
};

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  const [showTitle, setShowTitle] = useState(true);
  const [currentApp, setCurrentApp] = useState('hub');
  const [isInsideChatRoom, setIsInsideChatRoom] = useState(false);

  const [activeKeepAliveChats, setActiveKeepAliveChats] = useState([]);
  const [audioConfig, setAudioConfig] = useState(DEFAULT_AUDIO_CONFIG);
  
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
        await consumeMcpOAuthCallback(currentUrl.toString());
      } catch (error) {
        console.warn('[MCP OAuth] 授权回调未完成：', error);
      } finally {
        /*
         * 无论成功、拒绝或失败，均不能把 code/state 留在浏览器历史和地址栏。
         */
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
          safeUrl,
        );
      }
    };

    void finishOAuthCallback();
  }, []);

  // 缓存当前角色ID，用于传递给 RhythmApp 子应用
  const [activeCharacterId, setActiveCharacterId] = useState(null);

  useEffect(() => {
  void requestNotificationPermission();

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



  // 👈 新增：开门与切回应用时触发 AI 作息/待办提醒自检
  useEffect(() => {
    const handleCheckReminder = async () => {
      try {
        // 获取最新的聊天会话和角色
        const latestChat = await db.chats.orderBy('updatedAt').reverse().first();
        if (!latestChat) return;

        const character = await db.characters.get(latestChat.characterId);
        if (!character) return;

        // 设置当前活跃角色 ID 缓存
        setActiveCharacterId(character.id);

        // 尝试静默触发 AI 提醒
const result = await triggerRhythmActiveReminder(
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
        console.warn('[RhythmScheduler] 提醒自检未通过或暂无可用角色:', err);
      }
    };

    // 1. 初始化时（开门）自检
    void handleCheckReminder();

    // 2. 切回标签页/回到 PWA 时自检
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void handleCheckReminder();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [activeChats, savedAudioConfig] = await Promise.all([
        db.chats
          .filter((chat) => chat.keepAlive === true)
          .toArray(),

        db.settings.get('keep_alive_audio_config')
      ]);

      return {
        activeChats,
        audioConfig: savedAudioConfig?.value || DEFAULT_AUDIO_CONFIG
      };
    }).subscribe({
      next: ({ activeChats, audioConfig: nextAudioConfig }) => {
        const normalizedAudioConfig = {
          playlist: Array.isArray(nextAudioConfig?.playlist)
            ? nextAudioConfig.playlist
            : [],
          activeTrackId: nextAudioConfig?.activeTrackId || ''
        };

        setActiveKeepAliveChats(activeChats);
        setAudioConfig(normalizedAudioConfig);
      },

      error: (error) => {
        console.warn(
          'Unable to observe keep-alive state:',
          error
        );

        setActiveKeepAliveChats([]);
        setAudioConfig(DEFAULT_AUDIO_CONFIG);
      }
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
        behavior: 'auto'
      });
    });
  }, []);

  const isKeepAliveActive =
    activeKeepAliveChats.length > 0;

  const activeAudioTrack = audioConfig.playlist.find(
    (track) => track.id === audioConfig.activeTrackId
  );

  const activeAudioUrl = activeAudioTrack?.url || '';

  const shouldDisplayHubHeader =
    currentApp === 'hub' && !isInsideChatRoom;

  const mainClassName = isInsideChatRoom
    ? 'relative z-10 mx-auto h-[100dvh] w-full max-w-[420px] overflow-hidden'
    : 'relative z-10 mx-auto min-h-[100dvh] w-full max-w-[420px] space-y-6 px-4 pb-20 pt-6';

  return (
    <ErrorBoundary>
      {showPreloader && (
        <ErrorBoundary>
          <Preloader onFinish={handlePreloaderFinish} />
        </ErrorBoundary>
      )}

     <NotificationToast />

<AppUpdatePrompt
  isAppReady={!showPreloader}
  isInsideChatRoom={isInsideChatRoom}
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
        style={{ backgroundColor: 'var(--bg-main)' }}
      >
        <div
          className="absolute -left-32 -top-32 h-[25rem] w-[25rem] rounded-full blur-[115px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-1)' }}
        />

        <div
          className="absolute -right-40 top-[28%] h-[28rem] w-[28rem] rounded-full blur-[130px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-2)' }}
        />

        <div
          className="absolute -bottom-48 left-[10%] h-[25rem] w-[25rem] rounded-full blur-[135px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-3)' }}
        />
      </div>

      <main
        className={mainClassName}
        style={{
          paddingTop: isInsideChatRoom
            ? '0'
            : 'calc(1.5rem + env(safe-area-inset-top, 0px))',

          paddingBottom: isInsideChatRoom
            ? '0'
            : 'calc(5rem + env(safe-area-inset-bottom, 0px))'
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
                  style={{ color: 'var(--text-main)' }}
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
                    opacity: 0.2
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
                borderColor: 'var(--card-border)'
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
              onOpenManual={() => openApp('manual')}
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
              onChatRoomStateChange={setIsInsideChatRoom}
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
              onChatRoomStateChange={setIsInsideChatRoom}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'ensemble' && (
          <ErrorBoundary>
            <EnsembleApp
              onBackHub={() => openApp('hub')}
              onChatRoomStateChange={setIsInsideChatRoom}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'habitat' && (
          <ErrorBoundary>
            <HabitatApp
              onBackHub={() => openApp('hub')}
              onChatRoomStateChange={setIsInsideChatRoom}
            />
          </ErrorBoundary>
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

        {/* 👈 新增：Rhythm 页面条件分支 */}
        {currentApp === 'rhythm' && (
          <ErrorBoundary>
            <RhythmApp
              onBackHub={() => openApp('hub')}
              currentCharacterId={activeCharacterId}
            />
          </ErrorBoundary>
        )}

        {currentApp === 'memory' && (
  <MemoryApp onBackHub={() => openApp('hub')} />
)}


        {!REGISTERED_APPS.includes(currentApp) && (
          <ErrorBoundary>
            <section className="py-14 text-center">
              <h2
                className="text-xl font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--text-main)' }}
              >
                {currentApp}
              </h2>

              <p
                className="mt-3 text-xs"
                style={{ color: 'var(--text-sub)' }}
              >
                此模块将在后续阶段为您呈现。
              </p>

              <button
                type="button"
                onClick={() => openApp('hub')}
                className="mt-6 rounded-full px-5 py-2 text-xs font-semibold transition-transform active:scale-95"
                style={{
                  color: 'var(--accent-foreground)',
                  backgroundColor: 'var(--accent-color)'
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






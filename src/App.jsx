import React, { useEffect, useState, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import NotificationToast from './components/NotificationToast';
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
import ManualApp from './apps/manual/ManualApp';
import DailyOfferingHubGate from './apps/daily-offering/DailyOfferingHubGate';
import { Settings as SettingsIcon } from 'lucide-react';

import {
  requestNotificationPermission,
  startAutoMessageScheduler,
  stopAutoMessageScheduler
} from './services/aiService';

import {
  startTravelPostcardScheduler,
  stopTravelPostcardScheduler
} from './apps/travels/travelPostcardScheduler';

import './apps/daily-offering/daily-offering.css';
import './apps/manual/manual.css';

const THEME_COLORS = {
  'mono-mist': '#fcfbf7',
  'cream-latte': '#f8f5ee',
  'obsidian-dark': '#121212',
  'cyber-velvet': '#171321'
};

const CHAT_APPS = ['messages', 'imaginarium', 'ensemble', 'habitat'];

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
  'ephemera'
];

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  const [showTitle, setShowTitle] = useState(true);
  const [currentApp, setCurrentApp] = useState('hub');
  const [isInsideChatRoom, setIsInsideChatRoom] = useState(false);

  useEffect(() => {
    void requestNotificationPermission();

    startAutoMessageScheduler();
    startTravelPostcardScheduler();

    return () => {
      stopAutoMessageScheduler();
      stopTravelPostcardScheduler();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);

    const themeColor = THEME_COLORS[activeTheme] || '#fcfbf7';
    document.body.style.backgroundColor = themeColor;

    let metaThemeColor = document.querySelector(
      'meta[name="theme-color"]'
    );

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    metaThemeColor.setAttribute('content', themeColor);
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
              showTitle ? 'justify-between' : 'justify-end'
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
              <SettingsIcon className="h-4 w-4" strokeWidth={1.7} />
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
              <AppGrid delay={400} onOpenApp={openApp} />
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
            <ManualApp onBack={() => openApp('settings')} />
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
            <TodoApp onBackHub={() => openApp('hub')} />
          </ErrorBoundary>
        )}

        {currentApp === 'diaries' && (
          <ErrorBoundary>
            <DiaryApp onBackHub={() => openApp('hub')} />
          </ErrorBoundary>
        )}

        {['travels', 'travel'].includes(currentApp) && (
          <ErrorBoundary>
            <TravelApp onBackHub={() => openApp('hub')} />
          </ErrorBoundary>
        )}

        {currentApp === 'snapshots' && (
          <ErrorBoundary>
            <SnapshotsApp onBackHub={() => openApp('hub')} />
          </ErrorBoundary>
        )}

        {currentApp === 'pebbling' && (
          <ErrorBoundary>
            <PebblingApp onBack={() => openApp('hub')} />
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
            <EphemeraApp onBackHub={() => openApp('hub')} />
          </ErrorBoundary>
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



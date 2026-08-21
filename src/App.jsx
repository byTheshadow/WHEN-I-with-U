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
import { Settings as SettingsIcon } from 'lucide-react';
import { requestNotificationPermission } from './services/aiService';

// 各主题对应的顶栏/背景 HEX 颜色（用于动态更新 iOS 顶栏 meta 标签）
const THEME_COLORS = {
  'mono-mist': '#fcfbf7',
  'cream-latte': '#f8f5ee',
  'obsidian-dark': '#121212',
  'cyber-velvet': '#171321'
};

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  const [showTitle, setShowTitle] = useState(true);
  const [currentApp, setCurrentApp] = useState('hub');
  const [isInsideChatRoom, setIsInsideChatRoom] = useState(false);

  useEffect(() => {
    // 1. 设置根元素 CSS 变量主题
    document.documentElement.setAttribute('data-theme', activeTheme);
    
    // 2. 动态修改手机原生顶栏/状态栏颜色 (iOS Safari & Android Chrome)
    const themeColor = THEME_COLORS[activeTheme] || '#fcfbf7';
    document.body.style.backgroundColor = themeColor;

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', themeColor);

    requestNotificationPermission();
  }, [activeTheme]);

  const handlePreloaderFinish = useCallback(() => {
    setShowPreloader(false);
  }, []);

  const openApp = (appId) => {
    setCurrentApp(appId);

    if (appId !== 'messages') {
      setIsInsideChatRoom(false);
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const shouldDisplayHeader = showTitle && currentApp !== 'settings' && !isInsideChatRoom;

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

      {/* 沉浸式全局背景 */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: 'var(--bg-main)' }}
      >
        <div
          className="absolute -top-32 -left-32 h-[25rem] w-[25rem] rounded-full blur-[115px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-1)' }}
        />
        <div
          className="absolute top-[28%] -right-40 h-[28rem] w-[28rem] rounded-full blur-[130px] transition-colors duration-700"
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
          paddingTop: isInsideChatRoom ? '0' : 'calc(1.5rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {shouldDisplayHeader && (
          <header className="flex items-start justify-between animate-fade-in-up">
            <div>
              <h1
                className="font-serif text-5xl font-semibold leading-none tracking-tighter"
                style={{ color: 'var(--text-main)' }}
              >
                WHEN I
                <br />
                <span className="font-normal italic opacity-40">with U.</span>
              </h1>
              <div
                className="mt-3 h-px w-10"
                style={{ backgroundColor: 'var(--text-main)', opacity: 0.2 }}
              />
            </div>

            <button
              type="button"
              onClick={() => openApp('settings')}
              title="Settings"
              aria-label="Open settings"
              className="ml-auto rounded-full p-2.5 transition-transform active:scale-95 shadow-sm"
              style={{
                color: 'var(--accent-foreground)',
                backgroundColor: 'var(--accent-color)',
                border: '1px solid var(--card-border)'
              }}
            >
              <SettingsIcon className="h-4 w-4" strokeWidth={1.7} />
            </button>
          </header>
        )}

        {currentApp === 'hub' && (
          <>
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
          </>
        )}

        {currentApp === 'settings' && (
          <ErrorBoundary>
            <SettingsPage
              onBack={() => openApp('hub')}
              currentTheme={activeTheme}
              onChangeTheme={setActiveTheme}
              showTitle={showTitle}
              onToggleTitle={setShowTitle}
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

        {!['hub', 'settings', 'messages', 'todos', 'planner', 'diaries', 'travels', 'travel', 'snapshots'].includes(currentApp) && (
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

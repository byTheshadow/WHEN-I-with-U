import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import ProfileHeader from './apps/hub/ProfileHeader';
import PinnedGallery from './apps/hub/PinnedGallery';
import QuickBoard from './apps/hub/QuickBoard';
import AppGrid from './apps/hub/AppGrid';
import SettingsPage from './apps/settings/SettingsPage';
import { Settings as SettingsIcon } from 'lucide-react';

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  const [showTitle, setShowTitle] = useState(true);
  const [currentApp, setCurrentApp] = useState('hub');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  return (
    <ErrorBoundary>
      {/* 开屏占星骰子动画 */}
      {showPreloader && <Preloader onFinish={() => setShowPreloader(false)} />}

      {/* 弥散光影背景 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[100px] opacity-30 transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-1)' }}
        />
        <div
          className="absolute top-1/2 -right-20 w-96 h-96 rounded-full blur-[110px] opacity-30 transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-2)' }}
        />
      </div>

      {/* 移动端视口主容器 */}
      <main className="w-full max-w-[420px] mx-auto min-h-screen relative z-10 px-5 pt-8 pb-20 space-y-6">
        
        {/* 顶部 Header 与 仅 SVG 齿轮按钮 (选项 A) */}
        <header className="flex items-start justify-between">
          <div>
            {showTitle && (
              <>
                <h1 className="font-serif text-5xl tracking-tighter leading-none font-semibold">
                  WHEN I <br />
                  <span className="opacity-35 italic font-normal">with U.</span>
                </h1>
                <div className="mt-3 w-10 h-[1px] bg-black/20 dark:bg-white/20" />
              </>
            )}
          </div>

          {/* 右上角仅 SVG 齿轮圆形按钮 */}
          <button
            onClick={() => setCurrentApp(currentApp === 'settings' ? 'hub' : 'settings')}
            className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-md opacity-70 hover:opacity-100 transition-all active:scale-95 ml-auto"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </header>

        {/* 路由判断：主页 vs 设置 */}
        {currentApp === 'hub' ? (
          <>
            <ErrorBoundary>
              <ProfileHeader delay={100} />
            </ErrorBoundary>

            <ErrorBoundary>
              <PinnedGallery delay={200} />
            </ErrorBoundary>

            <ErrorBoundary>
              <QuickBoard delay={300} messages={[]} />
            </ErrorBoundary>

            <ErrorBoundary>
              <AppGrid delay={400} onOpenApp={(appId) => setCurrentApp(appId)} />
            </ErrorBoundary>
          </>
        ) : currentApp === 'settings' ? (
          <ErrorBoundary>
            <SettingsPage
              onBack={() => setCurrentApp('hub')}
              currentTheme={activeTheme}
              onChangeTheme={(theme) => setActiveTheme(theme)}
              showTitle={showTitle}
              onToggleTitle={(val) => setShowTitle(val)}
            />
          </ErrorBoundary>
        ) : (
          <div className="py-12 text-center space-y-4">
            <h3 className="text-xl font-bold uppercase tracking-wider">{currentApp}</h3>
            <p className="text-xs opacity-60">Sub-App view is ready for Phase 2 implementation.</p>
            <button
              onClick={() => setCurrentApp('hub')}
              className="px-5 py-2 rounded-full bg-black/10 dark:bg-white/10 text-xs font-semibold transition-transform active:scale-95"
            >
              Back to Home Hub
            </button>
          </div>
        )}
      </main>
    </ErrorBoundary>
  );
};

export default App;

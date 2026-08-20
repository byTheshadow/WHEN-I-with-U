import React, { useEffect, useState } from 'react';
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

  const openApp = (appId) => {
    setCurrentApp(appId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ErrorBoundary>
      {showPreloader && (
        <ErrorBoundary>
          <Preloader onFinish={() => setShowPreloader(false)} />
        </ErrorBoundary>
      )}

      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
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

      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[420px] space-y-6 px-5 pb-20 pt-8">
        {currentApp !== 'settings' && (
          <header className="flex items-start justify-between">
            <div>
              {showTitle && (
                <>
                  <h1
                    className="font-serif text-5xl font-semibold leading-none tracking-tighter"
                    style={{ color: 'var(--page-text-main)' }}
                  >
                    WHEN I
                    <br />
                    <span className="font-normal italic opacity-40">with U.</span>
                  </h1>
                  <div
                    className="mt-3 h-px w-10"
                    style={{ backgroundColor: 'var(--page-text-main)', opacity: 0.2 }}
                  />
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => openApp('settings')}
              title="Settings"
              aria-label="Open settings"
              className="ml-auto rounded-full p-2.5 transition-all active:scale-95"
              style={{
                color: '#ffffff',
                backgroundColor: 'var(--accent-color)',
                boxShadow: '0 8px 20px var(--shadow-color)',
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
              <QuickBoard delay={300} messages={[]} />
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

        {!['hub', 'settings'].includes(currentApp) && (
          <ErrorBoundary>
            <section className="py-14 text-center">
              <h2
                className="text-xl font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--page-text-main)' }}
              >
                {currentApp}
              </h2>
              <p
                className="mt-3 text-xs"
                style={{ color: 'var(--page-text-sub)' }}
              >
                This module will be built in a later phase.
              </p>
              <button
                type="button"
                onClick={() => openApp('hub')}
                className="mt-6 rounded-full px-5 py-2 text-xs font-semibold transition-transform active:scale-95"
                style={{
                  color: '#ffffff',
                  backgroundColor: 'var(--accent-color)',
                }}
              >
                Back to Home
              </button>
            </section>
          </ErrorBoundary>
        )}

        <footer
          className="pt-3 text-center font-mono text-[10px]"
          style={{ color: 'var(--page-text-muted)' }}
        >
          by shadow
        </footer>
      </main>
    </ErrorBoundary>
  );
};

export default App;

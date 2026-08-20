import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import ProfileHeader from './apps/hub/ProfileHeader';
import PinnedGallery from './apps/hub/PinnedGallery';
import QuickBoard from './apps/hub/QuickBoard';
import AppGrid from './apps/hub/AppGrid';
import SettingsPage from './apps/settings/SettingsPage';

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist');
  const [showTitle, setShowTitle] = useState(true);
  const [currentApp, setCurrentApp] = useState('hub');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const isSettings = currentApp === 'settings';

  return (
    <ErrorBoundary>
      {showPreloader && (
        <Preloader onFinish={() => setShowPreloader(false)} />
      )}

      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -left-24 -top-24 h-80 w-80 rounded-full blur-[105px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-1)' }}
        />

        <div
          className="absolute -right-28 top-[42%] h-96 w-96 rounded-full blur-[120px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-2)' }}
        />

        <div
          className="absolute bottom-[-10%] left-[20%] h-72 w-72 rounded-full blur-[110px] transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-3)' }}
        />
      </div>

      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[420px] space-y-6 px-5 pb-20 pt-8">
        <header className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {!isSettings && showTitle && (
              <>
                <h1 className="font-serif text-5xl font-semibold leading-none tracking-tighter text-[var(--text-main)]">
                  WHEN I
                  <br />
                  <span className="italic font-normal opacity-40">
                    with U.
                  </span>
                </h1>

                <div className="mt-3 h-px w-10 bg-[var(--text-main)] opacity-15" />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setCurrentApp(isSettings ? 'hub' : 'settings')
            }
            className="ml-3 rounded-full bg-[var(--bg-control)] p-2.5 opacity-65 backdrop-blur-md transition-opacity hover:opacity-100 focus:opacity-100 active:scale-95"
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </header>

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
              <AppGrid
                delay={400}
                onOpenApp={(appId) => setCurrentApp(appId)}
              />
            </ErrorBoundary>
          </>
        ) : currentApp === 'settings' ? (
          <ErrorBoundary>
            <SettingsPage
              onBack={() => setCurrentApp('hub')}
              currentTheme={activeTheme}
              onChangeTheme={setActiveTheme}
              showTitle={showTitle}
              onToggleTitle={setShowTitle}
            />
          </ErrorBoundary>
        ) : (
          <div className="space-y-4 py-12 text-center">
            <h2 className="text-xl font-semibold uppercase tracking-wider">
              {currentApp}
            </h2>

            <p className="text-xs opacity-60">
              Sub-App view is ready for the next phase.
            </p>

            <button
              type="button"
              onClick={() => setCurrentApp('hub')}
              className="rounded-full bg-[var(--bg-control)] px-5 py-2 text-xs font-semibold transition-transform active:scale-95"
            >
              Back to Hub
            </button>
          </div>
        )}
      </main>
    </ErrorBoundary>
  );
};

export default App;

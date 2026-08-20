import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import ProfileHeader from './apps/hub/ProfileHeader';
import PinnedGallery from './apps/hub/PinnedGallery';
import QuickBoard from './apps/hub/QuickBoard';
import AppGrid from './apps/hub/AppGrid';
import { Palette, Settings } from 'lucide-react';

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('nordic-frost'); // 预设主题
  const [currentApp, setCurrentApp] = useState('hub');

  // 主题切换 Engine
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const themes = [
    { id: 'nordic-frost', name: '极光白' },
    { id: 'cream-latte', name: '燕麦拿铁' },
    { id: 'obsidian-dark', name: '黑曜石' },
    { id: 'cyber-velvet', name: '赛博紫' }
  ];

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.id === activeTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setActiveTheme(themes[nextIndex].id);
  };

  return (
    <ErrorBoundary>
      {/* 1. 开屏翻牌动画 */}
      {showPreloader && <Preloader onFinish={() => setShowPreloader(false)} />}

      {/* 2. 弥散光影背景 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-[90px] opacity-40 transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-1)' }}
        />
        <div
          className="absolute top-1/2 -right-20 w-96 h-96 rounded-full blur-[100px] opacity-40 transition-colors duration-700"
          style={{ backgroundColor: 'var(--bg-blob-2)' }}
        />
      </div>

      {/* 3. 移动端主视图 (最大宽度 420px 居中) */}
      <main className="w-full max-w-[420px] mx-auto min-h-screen relative z-10 px-5 pt-10 pb-20 space-y-6">
        
        {/* 顶栏控制器与杂志风大标题 */}
        <header className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-5xl tracking-tighter leading-none font-semibold">
              WHEN I <br />
              <span className="opacity-40 italic font-normal">with U.</span>
            </h1>
            <div className="mt-3 w-10 h-[1px] bg-black/20 dark:bg-white/20" />
          </div>

          {/* 切换主题 Pill 按钮 */}
          <button
            onClick={cycleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs backdrop-blur-md transition-transform active:scale-95"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="capitalize">{activeTheme.replace('-', ' ')}</span>
          </button>
        </header>

        {/* 主界面 Sub-App 路由判定 */}
        {currentApp === 'hub' ? (
          <>
            {/* 1. 个人档案区 */}
            <ErrorBoundary>
              <ProfileHeader delay={100} />
            </ErrorBoundary>

            {/* 2. Pinned Moment (放置于 Mailbox 上方) */}
            <ErrorBoundary>
              <PinnedGallery delay={200} />
            </ErrorBoundary>

            {/* 3. 信箱留言板 (横滑 / 空时可自动折叠) */}
            <ErrorBoundary>
              <QuickBoard delay={300} />
            </ErrorBoundary>

            {/* 4. 杂志化 App 导航网格 */}
            <ErrorBoundary>
              <AppGrid delay={400} onOpenApp={(appId) => setCurrentApp(appId)} />
            </ErrorBoundary>
          </>
        ) : (
          /* 子模块占位视图 */
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

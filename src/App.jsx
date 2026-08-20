import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Preloader from './components/Preloader';
import ProfileHeader from './apps/hub/ProfileHeader';
import PinnedGallery from './apps/hub/PinnedGallery';
import QuickBoard from './apps/hub/QuickBoard';
import AppGrid from './apps/hub/AppGrid';
import SettingsApp from './apps/settings/SettingsApp';
import { Settings } from 'lucide-react';

export const App = () => {
  const [showPreloader, setShowPreloader] = useState(true);
  const [activeTheme, setActiveTheme] = useState('mono-mist'); // 默认白黑极简风
  const [currentApp, setCurrentApp] = useState('hub');

  // 留言板真实数据流 (若为空数组，则 Mailbox 完全不占位渲染)
  const [boardMessages] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  return (
    <ErrorBoundary>
      {/* 1. 开屏动画 (4.0s 占星骰子 3D 甩落 + 治愈诗句) */}
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
      <main className="w-full max-w-[420px] mx-auto min-h-screen relative z-10 px-5 pt-10 pb-16 space-y-6">
        
        {/* 顶栏 Header: 标题 + 右上角 Option A 纯 SVG 齿轮按钮 */}
        <header className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-5xl tracking-tighter leading-none font-semibold">
              WHEN I <br />
              <span className="opacity-40 italic font-normal">with U.</span>
            </h1>
            <div className="mt-3 w-10 h-[1px] bg-current opacity-20" />
          </div>

          {/* Option A: 仅 SVG 齿轮圆形按钮 */}
          <button
            onClick={() => setCurrentApp(currentApp === 'settings' ? 'hub' : 'settings')}
            className="p-3 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-md transition-transform active:scale-95 hover:opacity-80"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 opacity-80" />
          </button>
        </header>

        {/* 视图路由 */}
        {currentApp === 'hub' && (
          <>
            {/* 1. 个人档案 */}
            <ErrorBoundary>
              <ProfileHeader delay={100} />
            </ErrorBoundary>

            {/* 2. 置顶照片墙 (包含图片链接与本地上传) */}
            <ErrorBoundary>
              <PinnedGallery delay={200} />
            </ErrorBoundary>

            {/* 3. 信箱留言板 (为空时彻底隐藏不占位) */}
            <ErrorBoundary>
              <QuickBoard delay={300} messages={boardMessages} />
            </ErrorBoundary>

            {/* 4. 杂志化 App 导航 */}
            <ErrorBoundary>
              <AppGrid delay={400} onOpenApp={(appId) => setCurrentApp(appId)} />
            </ErrorBoundary>
          </>
        )}

        {currentApp === 'settings' && (
          <ErrorBoundary>
            <SettingsApp
              onBack={() => setCurrentApp('hub')}
              currentTheme={activeTheme}
              onChangeTheme={(themeId) => setActiveTheme(themeId)}
            />
          </ErrorBoundary>
        )}

        {currentApp !== 'hub' && currentApp !== 'settings' && (
          <div className="py-16 text-center space-y-4">
            <h3 className="text-xl font-bold uppercase tracking-wider">{currentApp}</h3>
            <p className="text-xs opacity-60">Module view ready for Phase 2 implementation.</p>
            <button
              onClick={() => setCurrentApp('hub')}
              className="px-5 py-2 rounded-full bg-black/10 dark:bg-white/10 text-xs font-semibold"
            >
              Back to Home
            </button>
          </div>
        )}

      </main>
    </ErrorBoundary>
  );
};

export default App;

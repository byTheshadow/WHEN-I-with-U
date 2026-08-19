import React, { useState, useEffect } from 'react';
import { Preloader } from './components/Preloader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProfileHeader } from './apps/hub/ProfileHeader';
import { PhotoGallery } from './apps/hub/PhotoGallery';
import { QuickBoard } from './apps/hub/QuickBoard';
import { GlassDock } from './apps/hub/GlassDock';

const themes = ['obsidian', 'latte', 'cyber-velvet', 'nordic-frost'];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('hub');

  // 主题切换逻辑
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themes[currentThemeIndex]);
  }, [currentThemeIndex]);

  const handleToggleTheme = () => {
    setCurrentThemeIndex((prev) => (prev + 1) % themes.length);
  };

  return (
    <>
      {/* 1. 开屏神秘占星/塔罗动画 */}
      {loading && <Preloader onFinish={() => setLoading(false)} />}

      {/* 2. 主页面结构 */}
      <div className="min-h-screen pb-28 pt-6 px-4 md:px-8 max-w-4xl mx-auto">
        {/* Hub 主页防崩溃沙盒 */}
        <ErrorBoundary moduleName="Hub 主页模块">
          <ProfileHeader
            theme={themes[currentThemeIndex]}
            onThemeToggle={handleToggleTheme}
          />
          <QuickBoard />
          <PhotoGallery />
        </ErrorBoundary>

        {/* 动态显示激活的 Sub-App 占位（后续 Phase 推进） */}
        {activeTab !== 'hub' && (
          <ErrorBoundary moduleName={`${activeTab} 模块`}>
            <div className="glass-panel p-8 rounded-3xl text-center my-6">
              <h2 className="text-lg font-bold mb-2 uppercase tracking-wider">
                {activeTab} Module
              </h2>
              <p className="text-xs text-muted">
                当前 Sub-App 已进入解耦防崩溃沙盒，等待 Phase 2/3 代码填充。
              </p>
            </div>
          </ErrorBoundary>
        )}
      </div>

      {/* 3. 悬浮 Dock 导航栏 */}
      <GlassDock activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />
    </>
  );
}

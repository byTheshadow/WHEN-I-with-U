import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';
import OnboardingIntro from './components/OnboardingIntro.jsx';
import { requestPersistentStorage } from './db/storageUtils.js';
import './services/accessibilityService.js';
import './index.css';
import './styles/accessibility.css';

// 2026-10：启动时悄悄申请一次"持久化存储"，降低浏览器在设备存储紧张时
// 静默驱逐 IndexedDB 数据的概率（见 storageUtils.js 内注释）。不阻塞渲染，
// 批准与否不影响任何功能，失败也不提示用户。
requestPersistentStorage();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('找不到 React 根节点 #root。');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <OnboardingGate>
      <OnboardingIntro>
        <App />
      </OnboardingIntro>
    </OnboardingGate>
  </React.StrictMode>,
);

/*
 * 初始启动文案由 index.html 中的同步脚本负责显示。
 * React 首次完成渲染后，将它移除，避免遮挡正式 Preloader。
 *
 * 使用 requestAnimationFrame 是为了确保：
 * 1. React 已经完成首次提交；
 * 2. 正式 Preloader 已经进入页面；
 * 3. 初始启动层不会造成明显的切换闪烁。
 */
window.requestAnimationFrame(() => {
  const initialStartupQuote = document.getElementById(
    'initial-startup-quote',
  );

  initialStartupQuote?.remove();
});
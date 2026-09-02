import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('找不到 React 根节点 #root。');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
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

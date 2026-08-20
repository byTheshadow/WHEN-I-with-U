import React, { Component } from 'react';
import { Sparkles, ShieldAlert, CheckCircle2 } from 'lucide-react';

// ErrorBoundary 崩溃隔离沙盒
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/30 backdrop-blur-md text-rose-200 my-4 flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg text-rose-300">模块发生异常</h3>
            <p className="text-sm opacity-80 mt-1">该组件渲染异常，已触发沙盒隔离 Protection，全站数据安全不受影响。</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 px-4 py-1.5 text-xs bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg transition-all"
            >
              重置模块
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 主 App 根脚手架组件
export const App = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-100">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-rose-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              WHEN I with U
            </h1>
            <p className="text-xs text-slate-400 tracking-widest uppercase font-mono">
              Scaffold Initialized
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-left text-xs space-y-2 text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>脚手架初始化完毕</span>
            </div>
            <p className="opacity-80 leading-relaxed">
              GitHub Actions 自动构建准备就绪。请确认构建绿勾通过后，发送您的界面设计参考图，开启 Phase 1 核心 UI 构建！
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;

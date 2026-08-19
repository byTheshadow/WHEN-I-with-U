import React from 'react';
import { SvgIcon } from './SvgIcon';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[Module Sandbox Error - ${this.props.moduleName || 'Unknown'}]:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel rounded-3xl p-6 border border-red-500/20 bg-red-500/5 text-center flex flex-col items-center justify-center min-h-[200px]">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-3">
            <SvgIcon name="refresh" className="w-5 h-5" />
          </div>
          <h4 className="text-base font-semibold mb-1">
            {this.props.moduleName || '应用模块'} 发生错误
          </h4>
          <p className="text-xs text-muted mb-4 max-w-xs">
            该模块数据解析或运行异常，已防崩溃隔离，全站其他功能仍正常运作。
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            重置并重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

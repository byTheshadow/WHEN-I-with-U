import React, { Component } from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary trapped error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-md text-rose-500 my-4 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-left">
            <h4 className="font-medium text-sm">模块暂时不可用</h4>
            <p className="text-xs opacity-75 mt-1">沙盒隔离已生效，全站数据安全不受影响。</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 px-3 py-1 text-xs bg-rose-500 text-white rounded-full transition-transform active:scale-95"
            >
              重置重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

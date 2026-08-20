import React, { useState } from 'react';
import { X, Check, Code, Sparkles, RefreshCw } from 'lucide-react';

export const BubbleCustomizer = ({ currentCss = '', onSave, onClose }) => {
  const defaultTemplate = `/* 自定义气泡与文本 CSS (仅作用于当前聊天窗) */
.user-bubble {
  background: var(--accent-color);
  color: var(--accent-foreground);
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  box-shadow: 0 4px 14px rgba(0,0,0,0.06);
}

.ai-bubble {
  background: var(--control-soft-bg);
  color: var(--text-main);
  border: 1px solid var(--divider);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}

.chat-font {
  font-family: inherit;
  font-size: 0.75rem;
  line-height: 1.5;
}`;

  const [customCss, setCustomCss] = useState(currentCss || defaultTemplate);

  const handleReset = () => {
    setCustomCss(defaultTemplate);
  };

  const handleSave = () => {
    onSave(customCss);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-4 shadow-2xl text-xs text-left z-10 overflow-hidden"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-1.5 font-bold">
            <Code className="w-4 h-4" />
            <span>自定义气泡 CSS (Custom CSS)</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] opacity-70 leading-relaxed" style={{ color: 'var(--text-sub)' }}>
          直接编写或修改 CSS 样式代码。包含 <code className="font-mono bg-black/10 dark:bg-white/10 px-1 rounded">.user-bubble</code> 与 <code className="font-mono bg-black/10 dark:bg-white/10 px-1 rounded">.ai-bubble</code> 类名。
        </p>

        {/* 交互编辑框 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
            <span>CSS SCOPED CODE</span>
            <button type="button" onClick={handleReset} className="flex items-center gap-1 hover:opacity-100">
              <RefreshCw className="w-3 h-3" />
              <span>重置预设</span>
            </button>
          </div>

          <textarea
            rows={7}
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            placeholder="输入你的专属 CSS 规则..."
            className="w-full rounded-xl p-3 font-mono text-[11px] outline-none resize-none transition-colors border"
            style={{
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              borderColor: 'var(--divider)'
            }}
          />
        </div>

        {/* 实时作用域注入预览 */}
        <div className="p-3 rounded-2xl space-y-2 border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}>
          <span className="block font-mono text-[9px] opacity-50 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> LIVE PREVIEW / 效果预览
          </span>
          <style>{`
            .preview-scope ${customCss}
          `}</style>
          <div className="preview-scope space-y-2 pt-1">
            <div className="user-bubble chat-font p-2.5 max-w-[85%] ml-auto text-right">
              User 消息气泡效果
            </div>
            <div className="ai-bubble chat-font p-2.5 max-w-[85%] text-left">
              伴侣 消息气泡效果
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-xl font-semibold active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm"
          style={{
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)'
          }}
        >
          <Check className="w-4 h-4" />
          <span>应用并保存规则</span>
        </button>
      </div>
    </div>
  );
};

export default BubbleCustomizer;

import React, { useState } from 'react';
import { X, Check, Code, Sparkles, Wand2 } from 'lucide-react';

export const BubbleCustomizer = ({ currentCss = '', onSave, onClose }) => {
  // 5 套精致预设
  const presets = [
    {
      name: '白雾极简',
      code: `/* 白雾极简 */
.user-bubble {
  background: var(--accent-color);
  color: var(--accent-foreground);
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
}
.ai-bubble {
  background: var(--control-soft-bg);
  color: var(--text-main);
  border: 1px solid var(--divider);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
    },
    {
      name: '暮色甜梦',
      code: `/* 暮色甜梦 */
.user-bubble {
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  color: #2a1b40;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  font-weight: 500;
}
.ai-bubble {
  background: rgba(251, 194, 235, 0.15);
  color: var(--text-main);
  border: 1px solid rgba(161, 140, 209, 0.3);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
    },
    {
      name: '奶油拿铁',
      code: `/* 奶油拿铁 */
.user-bubble {
  background: #4c352a;
  color: #fffaf5;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
}
.ai-bubble {
  background: #f7f0e7;
  color: #2d211c;
  border: 1px solid rgba(76, 54, 39, 0.15);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
    },
    {
      name: '赛博夜色',
      code: `/* 赛博夜色 */
.user-bubble {
  background: #00f2fe;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #051329;
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  font-weight: 600;
}
.ai-bubble {
  background: rgba(79, 172, 254, 0.1);
  color: var(--text-main);
  border: 1px solid rgba(0, 242, 254, 0.3);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
}
.chat-font { font-size: 0.75rem; line-height: 1.5; }`
    },
    {
      name: '复古衬线',
      code: `/* 复古衬线 */
.user-bubble {
  background: var(--text-main);
  color: var(--bg-main);
  border-radius: 1rem 1rem 0.2rem 1rem;
  font-family: Georgia, serif;
}
.ai-bubble {
  background: var(--control-soft-bg);
  color: var(--text-main);
  border: 1px italic var(--divider);
  border-radius: 1rem 1rem 1rem 0.2rem;
  font-family: Georgia, serif;
}
.chat-font { font-size: 0.8rem; line-height: 1.6; }`
    }
  ];

  const [customCss, setCustomCss] = useState(currentCss || presets[0].code);

  const handleSave = () => {
    onSave(customCss);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div 
        className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-3.5 shadow-2xl text-xs text-left z-10 overflow-hidden"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-1.5 font-bold">
            <Code className="w-4 h-4" />
            <span>自定义气泡 CSS</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 预设快速点击选择栏 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 font-mono text-[10px] opacity-60">
            <Wand2 className="w-3 h-3 text-purple-400" />
            <span>QUICK PRESETS / 点击应用预设</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCustomCss(p.code)}
                className="px-2.5 py-1 rounded-full border text-[10px] transition-all active:scale-95 hover:opacity-100"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* CSS 编辑框 */}
        <div className="space-y-1">
          <textarea
            rows={6}
            value={customCss}
            onChange={(e) => setCustomCss(e.target.value)}
            placeholder="输入或修改 CSS 代码..."
            className="w-full rounded-xl p-2.5 font-mono text-[10.5px] outline-none resize-none transition-colors border"
            style={{
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              borderColor: 'var(--divider)'
            }}
          />
        </div>

        {/* 实时作用域注入预览 */}
        <div className="p-2.5 rounded-2xl space-y-1.5 border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}>
          <span className="block font-mono text-[9px] opacity-50 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> LIVE PREVIEW / 效果预览
          </span>
          <style>{`
            .preview-scope ${customCss}
          `}</style>
          <div className="preview-scope space-y-1.5 pt-0.5">
            <div className="user-bubble chat-font p-2 max-w-[85%] ml-auto text-right">
              User 消息气泡预览
            </div>
            <div className="ai-bubble chat-font p-2 max-w-[85%] text-left">
              伴侣 消息气泡预览
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl font-semibold active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm"
          style={{
            background: 'var(--accent-color)',
            color: 'var(--accent-foreground)'
          }}
        >
          <Check className="w-4 h-4" />
          <span>保存规则</span>
        </button>
      </div>
    </div>
  );
};

export default BubbleCustomizer;

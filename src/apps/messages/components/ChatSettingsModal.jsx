import React, { useRef } from 'react';
import { X, Upload, Trash2, Sliders, Image as ImageIcon, AlertTriangle } from 'lucide-react';

export const ChatSettingsModal = ({
  chat,
  onClose,
  onUpdateBgImage,
  onUpdateBgOpacity,
  onOpenBubbleCustomizer,
  onClearHistory
}) => {
  const fileInputRef = useRef(null);

  const bgImage = chat?.bgImage || '';
  const bgOpacity = chat?.bgOpacity ?? 0.3;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateBgImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-4 shadow-2xl text-xs text-left z-10"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--divider)' }}>
          <span className="font-bold text-sm">对话空间设置</span>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 专属背景图设置 */}
        <div className="space-y-2">
          <label className="block font-mono opacity-60 text-[10px]">CHAT BACKGROUND / 聊天窗专属背景图</label>
          <div className="flex items-center gap-3">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-2xl border flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--divider)'
              }}
            >
              {bgImage ? (
                <img src={bgImage} alt="Chat Background" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-5 h-5 opacity-40" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

            <div className="flex-1 space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 rounded-xl border text-center font-medium transition-all"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)',
                  color: 'var(--text-main)'
                }}
              >
                {bgImage ? '更换背景图' : '选择图片上传'}
              </button>
              {bgImage && (
                <button
                  type="button"
                  onClick={() => onUpdateBgImage('')}
                  className="w-full py-1.5 rounded-xl text-rose-500 text-[11px] opacity-80 hover:opacity-100"
                >
                  移除当前背景
                </button>
              )}
            </div>
          </div>

          {/* 透明度滑动条 */}
          {bgImage && (
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between text-[11px] opacity-70">
                <span>背景模糊透明度</span>
                <span className="font-mono">{Math.round(bgOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={bgOpacity}
                onChange={(e) => onUpdateBgOpacity(parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* 气泡 CSS 入口 */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenBubbleCustomizer();
            }}
            className="w-full p-3 rounded-2xl flex items-center justify-between border transition-all"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 opacity-70" />
              <span>定制专属 CSS 气泡与字体</span>
            </div>
            <span className="opacity-40 font-mono text-[10px]">&gt;</span>
          </button>
        </div>

        {/* 清空本聊天记录 */}
        <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--divider)' }}>
          <label className="block font-mono opacity-50 text-[10px] text-rose-500">DANGER ZONE / 危险区域</label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('确定要抹去与伴侣在此聊天窗的全部思绪记录吗？')) {
                onClearHistory();
                onClose();
              }
            }}
            className="w-full py-2.5 rounded-2xl bg-rose-500/10 text-rose-600 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>清空本聊天记录</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSettingsModal;

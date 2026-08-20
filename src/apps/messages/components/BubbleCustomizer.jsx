import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

export const BubbleCustomizer = ({ currentStyle = {}, onSave, onClose }) => {
  const [fontFamily, setFontFamily] = useState(currentStyle.fontFamily || 'font-sans');
  const [fontSize, setFontSize] = useState(currentStyle.fontSize || 'text-xs');
  const [userBg, setUserBg] = useState(currentStyle.userBg || 'bg-black text-white dark:bg-white dark:text-black');
  const [aiBg, setAiBg] = useState(currentStyle.aiBg || 'bg-black/5 dark:bg-white/10 text-current');

  const fontOptions = [
    { id: 'font-sans', label: '无衬线 Modern (Sans)' },
    { id: 'font-serif', label: '衬线经典 (Serif)' },
    { id: 'font-mono', label: '代码打字风 (Mono)' }
  ];

  const sizeOptions = [
    { id: 'text-[11px]', label: '精细 (11px)' },
    { id: 'text-xs', label: '标准 (12px)' },
    { id: 'text-sm', label: '较大 (14px)' }
  ];

  const handleSave = () => {
    onSave({ fontFamily, fontSize, userBg, aiBg });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in-up">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/20 bg-white dark:bg-neutral-900 p-5 space-y-4 shadow-2xl text-xs">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className="font-bold">气泡与文字样式自定义</span>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 字体样式 */}
        <div className="space-y-1.5">
          <label className="block font-mono opacity-50 text-[10px]">FONT FAMILY / 字体系列</label>
          <div className="grid grid-cols-3 gap-1.5">
            {fontOptions.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFontFamily(f.id)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  fontFamily === f.id ? 'border-black dark:border-white font-bold bg-black/5 dark:bg-white/10' : 'border-white/10 opacity-60'
                }`}
              >
                {f.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 字体大小 */}
        <div className="space-y-1.5">
          <label className="block font-mono opacity-50 text-[10px]">FONT SIZE / 字号大小</label>
          <div className="grid grid-cols-3 gap-1.5">
            {sizeOptions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFontSize(s.id)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  fontSize === s.id ? 'border-black dark:border-white font-bold bg-black/5 dark:bg-white/10' : 'border-white/10 opacity-60'
                }`}
              >
                {s.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 预览 */}
        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2 border border-white/10">
          <span className="block font-mono text-[9px] opacity-40 uppercase">LIVE PREVIEW / 效果预览</span>
          <div className={`p-2.5 rounded-2xl max-w-[80%] ml-auto ${userBg} ${fontFamily} ${fontSize}`}>
            User 消息展示样式预览
          </div>
          <div className={`p-2.5 rounded-2xl max-w-[80%] ${aiBg} ${fontFamily} ${fontSize}`}>
            AI 角色消息展示样式预览
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>保存配置</span>
        </button>
      </div>
    </div>
  );
};

export default BubbleCustomizer;

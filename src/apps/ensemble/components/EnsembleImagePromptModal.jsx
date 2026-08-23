import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, X } from 'lucide-react';

export const EnsembleImagePromptModal = ({ onClose, onSubmit }) => {
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');

  const PRESETS = [
    { title: '雨夜街角散落的光影', desc: '湿漉漉的青石板上倒映着黄昏的霓虹，风把伞盖吹得微微倾斜。' },
    { title: '咖啡馆角落的复古黑胶', desc: '唱针慢慢划过胶片划痕，留唱机里播放着久远的爵士乐旋律。' },
    { title: '书房桌前未干的墨迹手稿', desc: '台灯泛出暖洋洋的黄光，羽毛笔斜立在墨水瓶旁。' }
  ];

  const handleApplyPreset = (p) => {
    setContent(p.title);
    setDescription(p.desc);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({
      content: content.trim(),
      metadata: {
        description: description.trim() || '静谧的画面细节漫过镜头，停留在此刻。'
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-up border"
        style={{
          backgroundColor: 'var(--modal-bg)',
          borderColor: 'var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide">
            <ImageIcon className="w-4 h-4" />
            发图 • 3D 画面叙事卡
          </div>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 灵感预设 */}
        <div className="space-y-1.5">
          <span className="text-[10px] opacity-60 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 快捷画面灵感预设：
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2.5 py-1 rounded-full text-[10px] transition-transform active:scale-95 border"
                style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] block opacity-60 mb-1">正面画面简述 (如: 雨夜的古董店)</label>
            <input
              type="text"
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="描述你展现给群成员看的画面主题..."
              className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />
          </div>

          <div>
            <label className="text-[10px] block opacity-60 mb-1">翻面画面细节描写 (3D 卡片背面文字)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描摹镜头焦距、光线与氛围感细节..."
              className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-xs opacity-60">取消</button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              发送叙事卡
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

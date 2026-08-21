// src/apps/pebbling/ThrowPebbleModal.jsx
import React, { useState } from 'react';
import { PEBBLE_TYPES } from './pebbleTypes';
import { X, Send, Feather } from 'lucide-react';

export default function ThrowPebbleModal({
  isOpen,
  onClose,
  characters = [],
  defaultCharId,
  onThrow
}) {
  const [selectedCharId, setSelectedCharId] = useState(defaultCharId || characters[0]?.id);
  const [selectedType, setSelectedType] = useState('stream-pebble');
  const [content, setContent] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || !selectedCharId) return;

    setSubmitting(true);
    await onThrow({
      characterId: selectedCharId,
      stoneType: selectedType,
      userContent: content.trim(),
      delayMinutes: Number(delayMinutes)
    });
    setSubmitting(false);
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative overflow-hidden transition-all"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between pb-4 border-b mb-5" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-2">
            <Feather className="w-5 h-5 opacity-80" />
            <h3 className="text-base font-medium tracking-wide">悄悄抛入一颗小石头</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded.full hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-sub)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 选择目标角色 */}
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80" style={{ color: 'var(--text-sub)' }}>
              选择投入哪个巢穴：
            </label>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            >
              {characters.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 选择石头样式材质 */}
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80" style={{ color: 'var(--text-sub)' }}>
              挑选石头的质感与寓意：
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
              {Object.values(PEBBLE_TYPES).map(type => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      isSelected ? 'ring-1' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: isSelected ? 'var(--control-soft-bg)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent-color)' : 'var(--card-border)',
                    }}
                  >
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: type.stoneColor,
                        borderColor: type.borderColor,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-main)' }} />
                    </div>
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{type.name}</div>
                      <div className="text-[10px] opacity-60 leading-tight mt-0.5" style={{ color: 'var(--text-sub)' }}>{type.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 拟物表达正文 */}
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80" style={{ color: 'var(--text-sub)' }}>
              想要毫无压力地分享点什么？
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="路边看到特别形状的云、听到的一首旧歌、或者只是轻轻打个招呼..."
              className="w-full p-3 rounded-xl border text-sm resize-none focus:outline-none"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
              required
            />
          </div>

          {/* 响应延迟偏好 */}
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80" style={{ color: 'var(--text-sub)' }}>
              期待海浪回应的时间：
            </label>
            <div className="flex items-center gap-2">
              {[
                { label: '快速 (1分钟测试)', value: 1 },
                { label: '漫漫 (15分钟)', value: 15 },
                { label: '悠然 (30分钟)', value: 30 },
              ].map(item => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setDelayMinutes(item.value)}
                  className="flex-1 py-1.5 text-xs rounded-lg border transition-all"
                  style={{
                    backgroundColor: delayMinutes === item.value ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                    color: delayMinutes === item.value ? 'var(--accent-foreground)' : 'var(--text-main)',
                    borderColor: 'var(--card-border)'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 底部提交 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs"
              style={{ color: 'var(--text-sub)' }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? '丢入中...' : '悄悄落入巢中'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

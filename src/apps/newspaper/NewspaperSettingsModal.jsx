// src/apps/newspaper/NewspaperSettingsModal.jsx
import React, { useState } from 'react';
import { X, Plus, Trash2, Key, Tag } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const NewspaperSettingsModal = ({ isOpen, onClose, settings, onSave }) => {
  if (!isOpen) return null;

  const [topics, setTopics] = useState(settings.topics || ['AI 科技与前沿', '文学与艺术', '世界观察']);
  const [newTopic, setNewTopic] = useState('');
  const [tavilyKey, setTavilyKey] = useState(settings.tavilyKey || '');

  const handleAddTopic = () => {
    if (!newTopic.trim()) return;
    if (!topics.includes(newTopic.trim())) {
      setTopics([...topics, newTopic.trim()]);
    }
    setNewTopic('');
  };

  const handleRemoveTopic = (index) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      topics,
      tavilyKey: tavilyKey.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md p-6 space-y-6 text-left max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--text-main)] pb-3 opacity-80">
          <h3 className="font-bold text-sm tracking-wider uppercase">报纸订阅与检索偏好</h3>
          <button onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 订阅主题 */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> 订阅关注主题
          </label>
          <div className="flex flex-wrap gap-2">
            {topics.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10"
              >
                {t}
                <button onClick={() => handleRemoveTopic(idx)} className="opacity-40 hover:opacity-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
              placeholder="添加新关注主题（如：天文学、独立游戏）"
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10 outline-none"
            />
            <button
              onClick={handleAddTopic}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[var(--control-soft-bg)] hover:bg-black/10 dark:hover:bg-white/10"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 专属检索 API Key */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> Tavily Search API Key (可选)
          </label>
          <input
            type="password"
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            placeholder="留空则默认使用免 Key RSS 抓取"
            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10 outline-none font-mono"
          />
          <p className="text-[10px] opacity-40 leading-relaxed">
            若未填写，系统将自动使用 Google News RSS 代理进行免配置真实信息获取。
          </p>
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--text-main)] border-opacity-10">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium opacity-60 hover:opacity-100"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-black dark:bg-white text-white dark:text-black"
          >
            保存设置
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

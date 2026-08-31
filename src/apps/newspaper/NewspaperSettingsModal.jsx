// src/apps/newspaper/NewspaperSettingsModal.jsx
import React, { useState } from 'react';
import { X, Plus, Trash2, Key, Tag, HardDriveDownload } from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const NewspaperSettingsModal = ({ isOpen, onClose, settings, onSave, onCleanOldPosts }) => {
  if (!isOpen) return null;

  const [topics, setTopics] = useState(settings.topics || ['AI 与认知前沿', '独立艺术与设计', '日常哲学与世界观察']);
  const [newTopic, setNewTopic] = useState('');
  const [tavilyKey, setTavilyKey] = useState(settings.tavilyKey || '');
  const [autoClean, setAutoClean] = useState(settings.autoClean !== false);
  const [cleanTip, setCleanTip] = useState('');

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

  const handleClean = async () => {
    if (onCleanOldPosts) {
      const count = await onCleanOldPosts();
      setCleanTip(`已清除 ${count} 份 2 天前的历史旧报`);
      setTimeout(() => setCleanTip(''), 3000);
    }
  };

  const handleSave = () => {
    onSave({
      topics,
      tavilyKey: tavilyKey.trim(),
      autoClean
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md p-6 space-y-6 text-left max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--text-main)] pb-3 opacity-80">
          <h3 className="font-serif font-bold text-sm tracking-widest uppercase">报纸刊印与存储设置</h3>
          <button onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 订阅主题 */}
        <div className="space-y-3">
          <label className="text-xs font-serif font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> 关注主题（随机作为主版头条）
          </label>
          <div className="flex flex-wrap gap-2">
            {topics.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-15 font-serif"
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
              placeholder="添加关注主题..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-15 outline-none font-serif"
            />
            <button
              onClick={handleAddTopic}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[var(--control-soft-bg)] hover:bg-black/10 dark:hover:bg-white/10"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 存储管理：清理两天前旧报 */}
        <div className="space-y-3 border-t border-[var(--text-main)] border-opacity-10 pt-4">
          <label className="text-xs font-serif font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
            <HardDriveDownload className="w-3.5 h-3.5" /> 本地内存与归档保护
          </label>
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10">
            <div className="space-y-0.5">
              <div className="text-xs font-serif font-bold">自动清理历史报纸</div>
              <div className="text-[10px] opacity-50 font-sans">仅保留近 2 天的晨报，保护本地存储</div>
            </div>
            <input
              type="checkbox"
              checked={autoClean}
              onChange={(e) => setAutoClean(e.target.checked)}
              className="accent-[var(--text-main)] scale-110 cursor-pointer"
            />
          </div>

          <button
            onClick={handleClean}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-serif rounded-xl border border-[var(--text-main)] border-opacity-20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-80 hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" /> 立即清理 2 天前的旧报纸
          </button>
          {cleanTip && (
            <p className="text-[11px] text-center font-serif text-emerald-600 dark:text-emerald-400 animate-fade-in">
              {cleanTip}
            </p>
          )}
        </div>

        {/* 专属检索 API Key */}
        <div className="space-y-2 border-t border-[var(--text-main)] border-opacity-10 pt-4">
          <label className="text-xs font-serif font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" /> Tavily Search API Key (可选)
          </label>
          <input
            type="password"
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            placeholder="留空则自动使用开放资讯源"
            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-15 outline-none font-mono"
          />
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--text-main)] border-opacity-10">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-serif opacity-60 hover:opacity-100"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-serif font-bold rounded-xl bg-[var(--text-main)] text-[var(--bg-main)]"
          >
            保存配置
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

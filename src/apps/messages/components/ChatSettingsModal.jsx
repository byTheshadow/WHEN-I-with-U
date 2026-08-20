import React, { useRef, useState } from 'react';
import { X, Upload, Trash2, Sliders, Edit2, Plus, Check } from 'lucide-react';
import AudioKeepAlive from './AudioKeepAlive';
import ConfirmModal from '../../../components/ConfirmModal';
import db from '../../../db';

export const ChatSettingsModal = ({
  chat,
  onClose,
  onUpdateBgImage,
  onUpdateBgOpacity,
  onToggleKeepAlive,
  onOpenBubbleCustomizer,
  onClearHistory,
  onDeletedChat,
  onSaveSummary
}) => {
  const fileInputRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 解析并初始化总结条目数组
  const parseSummaryList = (sum) => {
    if (Array.isArray(sum)) return sum;
    if (typeof sum === 'string' && sum.trim()) {
      return [{ id: 'legacy', content: sum, createdAt: '历史记录', isAuto: true }];
    }
    return [];
  };

  const [summaryList, setSummaryList] = useState(parseSummaryList(chat?.summary));
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [newSummaryText, setNewSummaryText] = useState('');
  const [showAddBox, setShowAddBox] = useState(false);

  const bgImage = chat?.bgImage || '';
  const bgOpacity = chat?.bgOpacity ?? 0.3;
  const keepAlive = chat?.keepAlive ?? false;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateBgImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteEntireChat = async () => {
    await db.chats.delete(chat.id);
    await db.messages.where('chatId').equals(chat.id).delete();
    setShowDeleteConfirm(false);
    onClose();
    if (onDeletedChat) onDeletedChat();
  };

  // 总结条目 CRUD 操作 handler
  const handleStartEdit = (entry) => {
    setEditingId(entry.id);
    setEditingText(entry.content);
  };

  const handleSaveEdit = (id) => {
    const updated = summaryList.map((item) => item.id === id ? { ...item, content: editingText } : item);
    setSummaryList(updated);
    setEditingId(null);
    if (onSaveSummary) onSaveSummary(updated);
  };

  const handleDeleteEntry = (id) => {
    const updated = summaryList.filter((item) => item.id !== id);
    setSummaryList(updated);
    if (onSaveSummary) onSaveSummary(updated);
  };

  const handleAddEntry = () => {
    if (!newSummaryText.trim()) return;
    const nowStr = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const newEntry = {
      id: `sum_${Date.now()}`,
      content: newSummaryText.trim(),
      createdAt: nowStr,
      isAuto: false
    };
    const updated = [...summaryList, newEntry];
    setSummaryList(updated);
    setNewSummaryText('');
    setShowAddBox(false);
    if (onSaveSummary) onSaveSummary(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div 
        className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-4 shadow-2xl text-xs text-left z-10 overflow-y-auto max-h-[90vh] no-scrollbar"
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

        {/* 阶段性多条目心绪总结管理 */}
        <div className="space-y-2 p-3 rounded-2xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] opacity-60">TIMELINE SUMMARY / 阶段事实总结</span>
            <button
              type="button"
              onClick={() => setShowAddBox(!showAddBox)}
              className="flex items-center gap-1 text-[10px] font-semibold text-purple-500 hover:opacity-100"
            >
              <Plus className="w-3 h-3" />
              <span>添加记录</span>
            </button>
          </div>

          {showAddBox && (
            <div className="p-2 rounded-xl border space-y-2" style={{ background: 'var(--bg-main)', borderColor: 'var(--divider)' }}>
              <textarea
                rows={2}
                placeholder="手动新增一段阶段性事实总结..."
                value={newSummaryText}
                onChange={(e) => setNewSummaryText(e.target.value)}
                className="w-full bg-transparent outline-none text-xs leading-relaxed"
                style={{ color: 'var(--text-main)' }}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddBox(false)} className="opacity-60 text-[10px]">取消</button>
                <button type="button" onClick={handleAddEntry} className="text-emerald-500 font-semibold text-[10px]">保存条目</button>
              </div>
            </div>
          )}

          {summaryList.length === 0 ? (
            <p className="text-[11px] opacity-50 italic py-1">暂无阶段性总结记录，满 10 轮对话后将自动生成。</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar pt-1">
              {summaryList.map((item) => (
                <div key={item.id} className="p-2 rounded-xl border space-y-1 text-[11px]" style={{ background: 'var(--bg-main)', borderColor: 'var(--divider)' }}>
                  <div className="flex items-center justify-between text-[9px] opacity-50 font-mono">
                    <span>[{item.createdAt}] {item.isAuto ? '(自动生成)' : '(手动添加)'}</span>
                    <div className="flex items-center gap-1">
                      {editingId === item.id ? (
                        <button type="button" onClick={() => handleSaveEdit(item.id)} className="text-emerald-500 hover:opacity-100" title="保存">
                          <Check className="w-3 h-3" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleStartEdit(item)} className="opacity-60 hover:opacity-100" title="修改">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDeleteEntry(item.id)} className="text-rose-500 opacity-60 hover:opacity-100" title="删除">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {editingId === item.id ? (
                    <textarea
                      rows={2}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full bg-transparent border-b outline-none text-xs leading-relaxed"
                      style={{ borderColor: 'var(--card-border)' }}
                    />
                  ) : (
                    <p className="opacity-80 leading-relaxed font-sans">{item.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 专属背景图 */}
        <div className="space-y-2">
          <label className="block font-mono opacity-60 text-[10px]">CHAT BACKGROUND / 背景图设置</label>
          <div className="flex items-center gap-3">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-2xl border flex items-center justify-center cursor-pointer overflow-hidden relative transition-all"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--divider)'
              }}
            >
              {bgImage ? (
                <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-4 h-4 opacity-40" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

            <div className="flex-1 space-y-1.5">
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
                  className="w-full py-1 text-rose-500 text-[10px] opacity-80 hover:opacity-100"
                >
                  移除背景
                </button>
              )}
            </div>
          </div>

          {bgImage && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] opacity-70">
                <span>背景透明度</span>
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

        {/* 10 分钟+ 后台音频保活 */}
        <div className="pt-1">
          <AudioKeepAlive isActive={keepAlive} onToggle={onToggleKeepAlive} />
        </div>

        {/* 自定义 CSS 气泡 */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenBubbleCustomizer();
            }}
            className="w-full p-2.5 rounded-xl flex items-center justify-between border transition-all"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 opacity-70" />
              <span>自定义气泡 CSS 样式</span>
            </div>
            <span className="opacity-40 font-mono text-[10px]">&gt;</span>
          </button>
        </div>

        {/* 危险区域 */}
        <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-full py-2 rounded-xl bg-rose-500/10 text-rose-600 font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空本聊天记录</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 rounded-xl bg-rose-600 text-white font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>彻底销毁此对话实体</span>
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="清空聊天记录"
        message="确定要清空本聊天框中的所有消息对话吗？操作后数据不可恢复。"
        confirmText="清空记录"
        cancelText="保留"
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          onClearHistory();
          onClose();
        }}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="销毁对话实体"
        message="确定要彻底销毁此对话空间吗？销毁后将直接清空消息并退回消息列表。"
        confirmText="彻底销毁"
        cancelText="取消"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteEntireChat}
      />
    </div>
  );
};

export default ChatSettingsModal;

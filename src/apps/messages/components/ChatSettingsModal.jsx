import React, { useRef, useState } from 'react';
import { X, Upload, Trash2, Sliders, Edit2 } from 'lucide-react';
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
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryInput, setSummaryInput] = useState(chat?.summary || '');

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

  const handleSaveSummaryAction = () => {
    if (onSaveSummary) onSaveSummary(summaryInput);
    setIsEditingSummary(false);
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

        {/* 本窗专属心绪总结查看与编辑 */}
        <div className="space-y-1.5 p-3 rounded-2xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] opacity-60">CHAT SUMMARY / 本窗事实总结</span>
            {!isEditingSummary ? (
              <button 
                type="button" 
                onClick={() => setIsEditingSummary(true)} 
                className="flex items-center gap-1 opacity-70 hover:opacity-100 text-[10px]"
              >
                <Edit2 className="w-3 h-3" />
                <span>编辑</span>
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleSaveSummaryAction} 
                className="font-semibold text-emerald-500 hover:opacity-100 text-[10px]"
              >
                保存
              </button>
            )}
          </div>

          {!isEditingSummary ? (
            <p className="text-[11px] opacity-80 leading-relaxed font-sans">
              {chat?.summary || '暂无客观总结，对话满一定轮次后将自动提取事实。'}
            </p>
          ) : (
            <textarea
              rows={3}
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
              className="w-full rounded-xl p-2 bg-transparent border outline-none text-xs leading-relaxed"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              placeholder="手动修订本窗事实总结..."
            />
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

        {/* 危险区域：清空记录与销毁实体 */}
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

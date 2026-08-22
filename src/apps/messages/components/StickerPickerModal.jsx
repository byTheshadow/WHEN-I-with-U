import React, { useState, useEffect } from 'react';
import { Smile, Plus, Trash2, X, Image as ImageIcon, Check } from 'lucide-react';
import { getAllStickers, addCustomSticker, deleteSticker } from '../../../services/stickerService';

export const StickerPickerModal = ({ isOpen, onClose, onSelectSticker }) => {
  const [stickers, setStickers] = useState([]);
  const [tab, setTab] = useState('list'); // 'list' | 'add'
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStickers();
    }
  }, [isOpen]);

  const loadStickers = async () => {
    const list = await getAllStickers();
    setStickers(list);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    setIsSubmitting(true);
    try {
      await addCustomSticker(newName, newUrl);
      setNewName('');
      setNewUrl('');
      setTab('list');
      await loadStickers();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteSticker(id);
    await loadStickers();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div 
        className="fixed inset-0 transition-opacity" 
        style={{ backgroundColor: 'var(--modal-overlay, rgba(0,0,0,0.4))' }}
        onClick={onClose}
      />

      <div 
        className="relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-5 shadow-2xl backdrop-blur-2xl transition-all z-10 space-y-4"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
          borderStyle: 'solid',
          color: 'var(--text-main)'
        }}
      >
        {/* 头部标题与切换 */}
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            <h3 className="font-bold text-xs">表情包库</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab(tab === 'list' ? 'add' : 'list')}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                color: 'var(--text-main)'
              }}
            >
              {tab === 'list' ? <><Plus className="w-3 h-3" />添加</> : '返回库'}
            </button>
            <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        {tab === 'list' ? (
          <div className="grid grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {stickers.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSticker(s);
                  onClose();
                }}
                className="group relative flex flex-col items-center justify-center p-1.5 rounded-2xl cursor-pointer transition-all hover:scale-105 border border-transparent hover:border-[var(--card-border)]"
                style={{ backgroundColor: 'var(--control-soft-bg)' }}
              >
                <img src={s.url} alt={s.name} className="w-12 h-12 object-cover rounded-xl" />
                <span className="text-[9px] truncate w-full text-center mt-1 opacity-70">
                  {s.name}
                </span>

                {s.category === 'custom' && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, s.id)}
                    className="absolute -top-1 -right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-sub)' }}
                    title="删除"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleAdd} className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] opacity-60 block mb-1">表情含义 / 名称 (让AI能够感知情绪)</label>
              <input
                type="text"
                placeholder="例如: 摸头安慰 / 傲娇生气"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2.5 rounded-xl text-xs outline-none border"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] opacity-60 block mb-1">图片 URL 链接</label>
              <input
                type="url"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full p-2.5 rounded-xl text-xs outline-none border"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存表情包</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default StickerPickerModal;

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Trash2,
  Sliders,
  Edit2,
  Plus,
  Check,
  User,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import db from '../../../db';

export const ChatSettingsModal = ({
  chat,
  character,
  onClose,
  onUpdateBgImage,
  onUpdateBgOpacity,
  onToggleKeepAlive,
  onOpenBubbleCustomizer,
  onClearHistory,
  onDeletedChat,
  onSaveSummary,
  onUpdatedUserPersona
}) => {
  const fileInputRef = useRef(null);
  const userAvatarInputRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 本聊天窗独立拥有的 User 属性
  const [userName, setUserName] = useState(chat?.userName || character?.userName || '');
  const [userAvatar, setUserAvatar] = useState(chat?.userAvatar || character?.userAvatar || '');
  const [userPersona, setUserPersona] = useState(chat?.userPersona || character?.userPersona || '');
  const [inputPlaceholder, setInputPlaceholder] = useState(chat?.inputPlaceholder || '');
  const [typingText, setTypingText] = useState(chat?.typingText || '');

  // 本聊天窗独立的正在输入动画样式
  const [typingStyle, setTypingStyle] = useState(chat?.typingStyle || 'default');

  // 背景图淡化控制：B 方案，只控制背景图本身透明度
  const [isBgDimmed, setIsBgDimmed] = useState(chat?.isBgDimmed ?? true);
  const [bgOpacity, setBgOpacity] = useState(chat?.bgOpacity ?? 0.3);

  const [isSavingUserIdentity, setIsSavingUserIdentity] = useState(false);

  const typingStyleOptions = [
    { id: 'default', label: '默认闪烁' },
    { id: 'phone_call', label: '模拟电话' },
    { id: 'typewriter', label: '诗意打字机' },
    { id: 'wave_pulse', label: '音波律动' }
  ];

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
const [keepAliveNotice, setKeepAliveNotice] = useState('');


  const bgImage = chat?.bgImage || '';
  const keepAlive = chat?.keepAlive ?? false;

  const handleToggleKeepAliveChange = (nextValue) => {
  onToggleKeepAlive(nextValue);
  setKeepAliveNotice(nextValue ? '已开启保活' : '已关闭保活');
};

useEffect(() => {
  if (!keepAliveNotice) return undefined;

  const timer = window.setTimeout(() => {
    setKeepAliveNotice('');
  }, 2200);

  return () => window.clearTimeout(timer);
}, [keepAliveNotice]);


  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateBgImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUserAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUserAvatar(reader.result);
      handleSaveUserIdentity({ nextUserAvatar: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 核心改动：仅更新当前 db.chats 绝不写入 db.characters ，隔离各聊天窗人设
  const handleSaveUserIdentity = async (override = {}) => {
    if (!chat?.id) return;

    const nextUserName = Object.prototype.hasOwnProperty.call(override, 'nextUserName')
      ? override.nextUserName
      : userName;

    const nextUserAvatar = Object.prototype.hasOwnProperty.call(override, 'nextUserAvatar')
      ? override.nextUserAvatar
      : userAvatar;

    const nextUserPersona = Object.prototype.hasOwnProperty.call(override, 'nextUserPersona')
      ? override.nextUserPersona
      : userPersona;

    const nextPlaceholder = Object.prototype.hasOwnProperty.call(override, 'nextPlaceholder')
      ? override.nextPlaceholder
      : inputPlaceholder;

    const nextTypingText = Object.prototype.hasOwnProperty.call(override, 'nextTypingText')
      ? override.nextTypingText
      : typingText;

    const nextTypingStyle = Object.prototype.hasOwnProperty.call(override, 'nextTypingStyle')
      ? override.nextTypingStyle
      : typingStyle;

    const nextIsBgDimmed = Object.prototype.hasOwnProperty.call(override, 'nextIsBgDimmed')
      ? override.nextIsBgDimmed
      : isBgDimmed;

    const nextBgOpacity = Object.prototype.hasOwnProperty.call(override, 'nextBgOpacity')
      ? override.nextBgOpacity
      : bgOpacity;

    const payload = {
      userName: (nextUserName || '').trim(),
      userAvatar: (nextUserAvatar || '').trim(),
      userPersona: (nextUserPersona || '').trim(),
      inputPlaceholder: (nextPlaceholder || '').trim(),
      typingText: (nextTypingText || '').trim(),
      typingStyle: nextTypingStyle || 'default',
      isBgDimmed: Boolean(nextIsBgDimmed),
      bgOpacity: Number(nextBgOpacity)
    };

    try {
      setIsSavingUserIdentity(true);
      await db.chats.update(chat.id, payload);

      if (onUpdatedUserPersona) {
        onUpdatedUserPersona(payload);
      }
    } finally {
      setIsSavingUserIdentity(false);
    }
  };

  const handleTypingStyleChange = async (nextTypingStyle) => {
    if (!chat?.id) return;

    setTypingStyle(nextTypingStyle);
    await db.chats.update(chat.id, { typingStyle: nextTypingStyle });

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ typingStyle: nextTypingStyle });
    }
  };

  const handleToggleBgDimmed = async () => {
    if (!chat?.id) return;

    const nextIsBgDimmed = !isBgDimmed;
    setIsBgDimmed(nextIsBgDimmed);

    await db.chats.update(chat.id, { isBgDimmed: nextIsBgDimmed });

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ isBgDimmed: nextIsBgDimmed });
    }
  };

  const handleBgOpacityChange = async (e) => {
    if (!chat?.id) return;

    const nextOpacity = Number(e.target.value);
    setBgOpacity(nextOpacity);

    if (onUpdateBgOpacity) {
      onUpdateBgOpacity(nextOpacity);
    } else {
      await db.chats.update(chat.id, { bgOpacity: nextOpacity });
    }

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ bgOpacity: nextOpacity });
    }
  };

  const handleDeleteEntireChat = async () => {
    await db.chats.delete(chat.id);
    await db.messages.where('chatId').equals(chat.id).delete();
    setShowDeleteConfirm(false);
    onClose();
    if (onDeletedChat) onDeletedChat();
  };

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
        className="fixed inset-0 backdrop-blur-md"
        style={{
          background: 'var(--modal-backdrop, color-mix(in srgb, var(--bg-main) 72%, transparent))'
        }}
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
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--divider)' }}>
          <span className="font-bold text-sm">对话空间设置</span>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 独立 User 专属配置区（独立于此聊天窗） */}
        <div className="space-y-3 p-3 rounded-2xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <User className="w-3.5 h-3.5" />
              <span>本窗你的个人名片 & 人设</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">
              {isSavingUserIdentity ? 'SAVING...' : 'WINDOW CHAT'}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => userAvatarInputRef.current?.click()}
              className="w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center overflow-hidden relative transition-all active:scale-95"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--divider)'
              }}
              title="上传你的头像"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="User Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 opacity-35" />
              )}
            </button>

            <input
              ref={userAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUserAvatarUpload}
            />

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <label className="block text-[10px] opacity-60 mb-1">你在本窗的称呼</label>
                <input
                  type="text"
                  value={userName}
                  placeholder="例如：阿泽 / 主人 / User"
                  onChange={(e) => setUserName(e.target.value)}
                  onBlur={() => handleSaveUserIdentity()}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                  style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label className="block text-[10px] opacity-60 mb-1">你的头像 URL</label>
                <input
                  type="text"
                  value={userAvatar}
                  placeholder="https://..."
                  onChange={(e) => setUserAvatar(e.target.value)}
                  onBlur={() => handleSaveUserIdentity()}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                  style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">本窗你的专属人设 (User Persona)</label>
            <textarea
              rows={2}
              value={userPersona}
              placeholder="例如：刚下班的程序员 / 喜欢弹吉他的室友..."
              onChange={(e) => setUserPersona(e.target.value)}
              onBlur={() => handleSaveUserIdentity()}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] opacity-60 mb-1">自定义输入框提示</label>
              <input
                type="text"
                value={inputPlaceholder}
                placeholder={`与 ${character?.name || '伴侣'} 倾诉...`}
                onChange={(e) => setInputPlaceholder(e.target.value)}
                onBlur={() => handleSaveUserIdentity()}
                className="w-full px-2.5 py-1.5 rounded-xl border outline-none text-xs"
                style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label className="block text-[10px] opacity-60 mb-1">自定义打字中提示</label>
              <input
                type="text"
                value={typingText}
                placeholder={`${character?.name || '伴侣'} 正在思考...`}
                onChange={(e) => setTypingText(e.target.value)}
                onBlur={() => handleSaveUserIdentity()}
                className="w-full px-2.5 py-1.5 rounded-xl border outline-none text-xs"
                style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            </div>
          </div>
        </div>

        {/* 正在输入加载动画选择 */}
        <div className="space-y-2 p-3 rounded-2xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>正在输入加载动画</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">TYPING STYLE</span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            默认动画保持不变。此处只为本聊天窗选择加载动画，后续新增样式可继续在 TypingIndicator 注册中心追加。
          </p>

          <div className="grid grid-cols-2 gap-1.5">
            {typingStyleOptions.map((option) => {
              const isActive = typingStyle === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleTypingStyleChange(option.id)}
                  className="px-2.5 py-1.5 rounded-xl border text-[10px] font-medium transition-all active:scale-95"
                  style={{
                    background: isActive ? 'var(--control-soft-bg)' : 'var(--bg-main)',
                    borderColor: isActive ? 'var(--accent-color)' : 'var(--card-border)',
                    color: isActive ? 'var(--accent-color)' : 'var(--text-main)',
                    opacity: isActive ? 1 : 0.68
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 阶段性多条目事实总结 */}
        <div className="space-y-2 p-3 rounded-2xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] opacity-60">TIMELINE SUMMARY / 阶段事实总结</span>
            <button
              type="button"
              onClick={() => setShowAddBox(!showAddBox)}
              className="flex items-center gap-1 text-[10px] font-semibold hover:opacity-100"
              style={{ color: 'var(--accent-color)' }}
            >
              <Plus className="w-3 h-3" />
              <span>添加条目</span>
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
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="font-semibold text-[10px]"
                  style={{ color: 'var(--accent-color)' }}
                >
                  保存条目
                </button>
              </div>
            </div>
          )}

          {summaryList.length === 0 ? (
            <p className="text-[11px] opacity-50 italic py-1">暂无阶段性总结记录。</p>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar pt-1">
              {summaryList.map((item) => (
                <div key={item.id} className="p-2 rounded-xl border space-y-1 text-[11px]" style={{ background: 'var(--bg-main)', borderColor: 'var(--divider)' }}>
                  <div className="flex items-center justify-between text-[9px] opacity-50 font-mono">
                    <span>[{item.createdAt}]</span>
                    <div className="flex items-center gap-1">
                      {editingId === item.id ? (
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="hover:opacity-100"
                          style={{ color: 'var(--accent-color)' }}
                          title="保存"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleStartEdit(item)} className="opacity-60 hover:opacity-100" title="修改">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(item.id)}
                        className="opacity-60 hover:opacity-100"
                        style={{ color: 'var(--text-muted)' }}
                        title="删除"
                      >
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

        {/* 背景壁纸配置 */}
        <div className="space-y-2 p-3 rounded-2xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between">
            <label className="block font-mono opacity-60 text-[10px]">CHAT BACKGROUND / 背景图</label>

            <button
              type="button"
              onClick={handleToggleBgDimmed}
              className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 hover:opacity-100 transition-opacity"
              style={{
                color: isBgDimmed ? 'var(--accent-color)' : 'var(--text-muted)'
              }}
              title="切换背景图淡化"
            >
              {isBgDimmed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{isBgDimmed ? '背景已淡化' : '显示原图'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl border flex items-center justify-center cursor-pointer overflow-hidden relative transition-all"
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

            <div className="flex-1 space-y-1">
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
            </div>
          </div>

          {isBgDimmed && (
            <div className="pt-2 space-y-1 border-t" style={{ borderColor: 'var(--divider)' }}>
              <div className="flex items-center justify-between text-[10px] opacity-60">
                <span>背景图透明度</span>
                <span>{Math.round(bgOpacity * 100)}%</span>
              </div>

              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={bgOpacity}
                onChange={handleBgOpacityChange}
                className="w-full"
                style={{ accentColor: 'var(--accent-color)' }}
              />
            </div>
          )}
        </div>

       {/* 后台音频保活设置 */}
       {/* 后台音频保活设置 */}
<div className="pt-1 space-y-2">
  {keepAliveNotice && (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center rounded-2xl border px-3 py-2 text-xs animate-fade-in-down"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)',
      }}
    >
      {keepAliveNotice}
    </div>
  )}

  <div
    className="flex items-center justify-between gap-4 rounded-2xl border p-3"
    style={{
      background: 'var(--control-soft-bg)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-main)',
    }}
  >
    <div className="min-w-0">
      <p className="text-xs font-medium">
        尝试维持后台活跃
      </p>

      <p
        className="mt-1 text-[10px] leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        开启后将尝试维持音频通道。移动端浏览器仍可能因系统省电策略暂停后台任务。
      </p>
    </div>

    <input
      type="checkbox"
      checked={keepAlive}
      onChange={(event) => {
        handleToggleKeepAliveChange(event.target.checked);
      }}
      className="h-4 w-4 shrink-0 cursor-pointer"
      style={{
        accentColor: 'var(--accent-color)',
      }}
      aria-label="尝试维持后台活跃"
    />
  </div>
</div>



        {/* 气泡样式定制 */}
        <div>
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
              <span>定制气泡 CSS 样式</span>
            </div>
            <span className="opacity-40 font-mono text-[10px]">&gt;</span>
          </button>
        </div>

        {/* 危险区 */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
              border: '1px solid var(--card-border)'
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空本窗消息</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
            style={{
              background: 'var(--text-main)',
              color: 'var(--bg-main)'
            }}
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

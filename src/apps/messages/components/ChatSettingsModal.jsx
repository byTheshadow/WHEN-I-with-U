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
  EyeOff,
  Type,
  Palette
} from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import ColorSettingRow from './ColorSettingRow';
import SavedInfoSection from './SavedInfoSection';
import AwaySettingsSection from '../away/AwaySettingsSection';
import db from '../../../db';
import { CHAT_CONTROL_STYLE_OPTIONS } from '../chatControlStylePresets';

import { triggerGlobalToast } from '../../../components/NotificationToast';
import { getLocationSettings, setLocationEnabled } from '../../../apps/location/placeService';


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
  onUpdatedUserPersona,
  onTogglePinTopToolbar,
  onToggleHeartbeatEffect,
  fontStatus,
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

  // 本聊天窗专属的 AI 总提示词设定
  const [systemPrompt, setSystemPrompt] = useState(chat?.systemPrompt || '');

     // 本窗专属的人格分析 / 角色反应指导
  const [characterAnalysisEnabled, setCharacterAnalysisEnabled] = useState(
    chat?.characterAnalysisEnabled === true
  );

  // 本聊天窗是否接收 Rhythm 主动寄语。
  // 未设置时默认视为开启，避免老用户升级后被无声关掉。
  const [rhythmEnabled, setRhythmEnabled] = useState(
    chat?.rhythmEnabled !== false
  );
  const [characterAnalysisPrompt, setCharacterAnalysisPrompt] = useState(
    chat?.characterAnalysisPrompt || ''
  );


  // 背景图淡化控制：B 方案，只控制背景图本身透明度
  const [isBgDimmed, setIsBgDimmed] = useState(chat?.isBgDimmed ?? true);
  const [bgOpacity, setBgOpacity] = useState(chat?.bgOpacity ?? 0.3);

  const [isSavingUserIdentity, setIsavingUserIdentity] = useState(false);

 const typingStyleOptions = [
  { id: 'default', label: '默认闪烁' },
  { id: 'phone_call', label: '模拟电话' },
  { id: 'typewriter', label: '诗意打字机' },
  { id: 'wave_pulse', label: '音波律动' },

  // 新增美化样式
  { id: 'printer', label: '小票打印机' },
  { id: 'radio_tuner', label: '复古收音机' },
  { id: 'potion', label: '思维炼金烧瓶' },
  { id: 'messenger', label: '玻璃信差' },
  { id: 'arcade_combo', label: '街机连击' }
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
  

  const bgImage = chat?.bgImage || '';
  const keepAlive = chat?.keepAlive ?? false;

    const [pinTopToolbar, setPinTopToolbar] = useState(chat?.pinTopToolbar ?? false);

  const handleTogglePinTopToolbarChange = (nextValue) => {
    setPinTopToolbar(nextValue);
    onTogglePinTopToolbar?.(nextValue);
  };

  const [heartbeatEffectEnabled, setHeartbeatEffectEnabled] = useState(
    chat?.heartbeatEffectEnabled ?? false
  );

  const handleToggleHeartbeatEffectChange = (nextValue) => {
    setHeartbeatEffectEnabled(nextValue);
    onToggleHeartbeatEffect?.(nextValue);
  };

    // ===== 本窗字体 / 字号 =====
  const DEFAULT_CHAT_FONT_PX = 12;

  const [fontUrl, setFontUrl] = useState(chat?.fontUrl || '');
  const [fontFamilyName, setFontFamilyName] = useState(chat?.fontFamily || '');
  const [chatFontSize, setChatFontSize] = useState(
    Number.isFinite(chat?.chatFontSize)
      ? chat.chatFontSize
      : DEFAULT_CHAT_FONT_PX,
  );

  const fontStatusText = {
    idle: '',
    loading: '字体加载中...',
    ready: '字体已生效',
    failed: '字体加载失败，已使用默认字体。请确认是 https 网址，且能直接访问',
    'needs-name': '使用字体 CSS 网址时，需要同时填写字体名称',
  }[fontStatus] || '';

  const handleSaveChatFont = async () => {
    if (!chat?.id) return;

    const nextUrl = fontUrl.trim();
    const nextName = fontFamilyName.trim();

    if (
      nextUrl === (chat?.fontUrl || '')
      && nextName === (chat?.fontFamily || '')
    ) {
      return;
    }

    await db.chats.update(chat.id, {
      fontUrl: nextUrl,
      fontFamily: nextName,
    });

    onUpdatedUserPersona?.({ fontUrl: nextUrl, fontFamily: nextName });
  };

  const handleResetChatFont = async () => {
    if (!chat?.id) return;

    setFontUrl('');
    setFontFamilyName('');

    await db.chats.update(chat.id, { fontUrl: '', fontFamily: '' });

    onUpdatedUserPersona?.({ fontUrl: '', fontFamily: '' });
  };

  const handleCommitChatFontSize = async (value) => {
    if (!chat?.id) return;

    const next = Number(value);
    if (next === chat?.chatFontSize) return;

    await db.chats.update(chat.id, { chatFontSize: next });

    onUpdatedUserPersona?.({ chatFontSize: next });
  };

  const handleResetChatFontSize = async () => {
    if (!chat?.id) return;

    setChatFontSize(DEFAULT_CHAT_FONT_PX);

    await db.chats.update(chat.id, { chatFontSize: null });

    onUpdatedUserPersona?.({ chatFontSize: null });
  };

    // field 是 db.chats 里的字段名：inputBarColor / sendBtnColor / respondBtnColor / topBtnColor
  // 空字符串表示恢复默认颜色
  const handleCommitChatColor = async (field, value) => {
    if (!chat?.id) return;

    const next = value || '';

    if (next === (chat?.[field] || '')) return;

    await db.chats.update(chat.id, { [field]: next });

    onUpdatedUserPersona?.({ [field]: next });
  };

  // 本聊天窗的"按钮外观"预设（默认 / 毛玻璃 / 黑玻璃……），跟上面的
  // 自定义颜色是两件独立的事：颜色管的是按钮底色，这里管的是要不要
  // 加模糊/半透明这层质感，两者可以叠加着用。预设列表本身在
  // chatControlStylePresets.js 注册，这里只负责选中和保存。
  const handleCommitControlStyle = async (styleId) => {
    if (!chat?.id) return;

    const next = styleId || 'default';

    if (next === (chat?.controlStyle || 'default')) return;

    await db.chats.update(chat.id, { controlStyle: next });

    onUpdatedUserPersona?.({ controlStyle: next });
  };

  // 组件内部，state区域加：
const [locationEnabled, setLocationEnabledState] = useState(false);

useEffect(() => {
  if (!chat?.id) return;
  getLocationSettings(chat.id).then((settings) => {
    setLocationEnabledState(settings.enabled);
  });
}, [chat?.id]);

const handleToggleLocation = async () => {
  const next = !locationEnabled;
  setLocationEnabledState(next);
  await setLocationEnabled(chat.id, next);
};

  const handleToggleKeepAliveChange = (nextValue) => {
    onToggleKeepAlive(nextValue);

    triggerGlobalToast({
      title: nextValue ? '已开启保活' : '已关闭保活',
      content: nextValue
        ? '正在尝试维持音频通道。'
        : '后台音频保活已停止。',
      iconType: 'bell',
      duration: 2600,
    });
  };

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

    const nextSystemPrompt = Object.prototype.hasOwnProperty.call(override, 'nextSystemPrompt')
      ? override.nextSystemPrompt
      : systemPrompt;

          const nextCharacterAnalysisEnabled =
      Object.prototype.hasOwnProperty.call(
        override,
        'nextCharacterAnalysisEnabled'
      )
        ? override.nextCharacterAnalysisEnabled
        : characterAnalysisEnabled;

    const nextCharacterAnalysisPrompt =
      Object.prototype.hasOwnProperty.call(
        override,
        'nextCharacterAnalysisPrompt'
      )
        ? override.nextCharacterAnalysisPrompt
        : characterAnalysisPrompt;


      

        const payload = {
      userName: (nextUserName || '').trim(),
      userAvatar: (nextUserAvatar || '').trim(),
      userPersona: (nextUserPersona || '').trim(),
      inputPlaceholder: (nextPlaceholder || '').trim(),
      typingText: (nextTypingText || '').trim(),
      typingStyle: nextTypingStyle || 'default',
      isBgDimmed: Boolean(nextIsBgDimmed),
      bgOpacity: Number(nextBgOpacity),
      systemPrompt: (nextSystemPrompt || '').trim(),
      characterAnalysisEnabled: Boolean(nextCharacterAnalysisEnabled),
      characterAnalysisPrompt: (nextCharacterAnalysisPrompt || '').trim()
    };


    try {
      setIsavingUserIdentity(true);
      await db.chats.update(chat.id, payload);

      if (onUpdatedUserPersona) {
        onUpdatedUserPersona(payload);
      }
    } finally {
      setIsavingUserIdentity(false);
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

    const handleToggleRhythmEnabled = async () => {
    if (!chat?.id) return;

    const nextEnabled = !rhythmEnabled;
    setRhythmEnabled(nextEnabled);

    await db.chats.update(chat.id, { rhythmEnabled: nextEnabled });

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ rhythmEnabled: nextEnabled });
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
    const updated = summaryList.map((item) =>
      item.id === id ? { ...item, content: editingText } : item
    );
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

    const nowStr =
      new Date().toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
      }) +
      ' ' +
      new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });

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
        <div
          className="flex items-center justify-between pb-2 border-b"
          style={{ borderColor: 'var(--divider)' }}
        >
          <span className="font-bold text-sm">对话空间设置</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 独立 User 专属配置区（独立于此聊天窗） */}
        <div
          className="space-y-3 p-3 rounded-2xl border"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
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
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
                <label className="block text-[10px] opacity-60 mb-1">
                  你在本窗的称呼
                </label>
                <input
                  type="text"
                  value={userName}
                  placeholder="例如：阿泽 / 主人 / User"
                  onChange={(e) => setUserName(e.target.value)}
                  onBlur={() => handleSaveUserIdentity()}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                  style={{
                    background: 'var(--bg-main)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div>
                <label className="block text-[10px] opacity-60 mb-1">
                  你的头像 URL
                </label>
                <input
                  type="text"
                  value={userAvatar}
                  placeholder="https://..."
                  onChange={(e) => setUserAvatar(e.target.value)}
                  onBlur={() => handleSaveUserIdentity()}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                  style={{
                    background: 'var(--bg-main)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">
              本窗你的专属人设 (User Persona)
            </label>
            <textarea
              rows={3}
              value={userPersona}
              placeholder="例如：刚下班的程序员 / 喜欢弹吉他的室友..."
              onChange={(e) => setUserPersona(e.target.value)}
              onBlur={() => handleSaveUserIdentity()}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed overflow-y-auto resize-y max-h-32 min-h-[48px]"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] opacity-60 mb-1">
                自定义输入框提示
              </label>
              <input
                type="text"
                value={inputPlaceholder}
                placeholder={`与 ${character?.name || '伴侣'} 倾诉...`}
                onChange={(e) => setInputPlaceholder(e.target.value)}
                onBlur={() => handleSaveUserIdentity()}
                className="w-full px-2.5 py-1.5 rounded-xl border outline-none text-xs"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              />
            </div>

                        <div>
              <label className="block text-[10px] opacity-60 mb-1">
                自定义打字中提示（每行一句，会自动轮流显示；只留一行就固定显示那一句）
              </label>
              <textarea
                value={typingText}
                placeholder={'不填的话会自动使用内置的可爱轮换文案\n想固定住可以只填一行，比如：\n' + `${character?.name || '伴侣'} 正在思考...`}
                onChange={(e) => setTypingText(e.target.value)}
                onBlur={() => handleSaveUserIdentity()}
                rows={3}
                className="w-full px-2.5 py-1.5 rounded-xl border outline-none text-xs resize-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>
        </div>

        {/* 正在输入加载动画选择 - 独立区块 */}
        <div
          className="space-y-2 p-3 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>正在输入加载动画</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">
              TYPING STYLE
            </span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            默认动画保持不变。此处只为本聊天窗选择加载动画，后续新增样式可继续在
            TypingIndicator 注册中心追加。
          </p>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {typingStyleOptions.map((styleOpt) => (
              <button
                key={styleOpt.id}
                type="button"
                onClick={() => {
                  setTypingStyle(styleOpt.id);
                  handleSaveUserIdentity({
                    nextTypingStyle: styleOpt.id
                  });
                }}
                className="p-2.5 rounded-xl border text-center font-medium transition-all text-[11px] active:scale-95"
                style={{
                  background:
                    typingStyle === styleOpt.id
                      ? 'var(--accent-color)'
                      : 'var(--bg-main)',
                  borderColor:
                    typingStyle === styleOpt.id
                      ? 'var(--accent-color)'
                      : 'var(--divider)',
                  color:
                    typingStyle === styleOpt.id
                      ? 'var(--accent-foreground)'
                      : 'var(--text-main)'
                }}
              >
                {styleOpt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 自定义总提示词控制区 - 独立区块，宽度撑满 */}
        <div
          className="space-y-2.5 p-3.5 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>本窗总提示词 (System Prompt)</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">
              SYSTEM PROMPT
            </span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            自定义的提示词将覆盖系统的默认提示词，作为指导伴侣行为的最高指令。留空则恢复默认。
          </p>

          <div className="space-y-1.5">
            <textarea
              rows={4}
              value={systemPrompt}
              placeholder={
                chat?.mode === 'rp'
                  ? '未设定自定义设定。默认模式：RP 剧情沉浸模式下严格遵守角色及背景设定进行剧情推进演绎。'
                  : '未设定自定义设定。默认模式：现实陪伴模式下关注用户日常生活细节与情感。'
              }
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={() => handleSaveUserIdentity()}
              className="w-full p-2.5 rounded-xl border outline-none text-[11px] leading-normal overflow-y-auto resize-y max-h-48 min-h-[64px]"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />

            {systemPrompt && (
              <button
                type="button"
                onClick={() => {
                  setSystemPrompt('');
                  handleSaveUserIdentity({ nextSystemPrompt: '' });
                }}
                className="text-[10px] text-red-500 hover:underline flex items-center gap-1 mt-1"
              >
                清空并恢复系统默认
              </button>
            )}
          </div>
        </div>

                {/* 人格分析 / 角色反应指导 */}
        <div
          className="space-y-2.5 p-3.5 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>人格分析 / 角色反应指导</span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={characterAnalysisEnabled}
              onClick={() => {
                const nextEnabled = !characterAnalysisEnabled;

                setCharacterAnalysisEnabled(nextEnabled);

                handleSaveUserIdentity({
                  nextCharacterAnalysisEnabled: nextEnabled
                });
              }}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{
                background: characterAnalysisEnabled
                  ? 'var(--accent-color)'
                  : 'var(--divider)'
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                style={{
                  background: 'var(--bg-main)',
                  transform: characterAnalysisEnabled
                    ? 'translateX(20px)'
                    : 'translateX(2px)'
                }}
              />
            </button>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            开启后，AI 会根据角色设定与当前聊天上下文，先判断角色此刻应有的反应，再生成最终回复。分析过程不会展示给你。关闭时不会加入这套指导。
          </p>

          <div className="space-y-1.5">
            <textarea
              rows={7}
              value={characterAnalysisPrompt}
              disabled={!characterAnalysisEnabled}
              placeholder="留空则使用系统默认的人格分析 / 角色反应指导。填写后将完全替代默认指导。"
              onChange={(e) => setCharacterAnalysisPrompt(e.target.value)}
              onBlur={() => handleSaveUserIdentity()}
              className="w-full p-2.5 rounded-xl border outline-none text-[11px] leading-relaxed overflow-y-auto resize-y max-h-64 min-h-[120px] disabled:opacity-45"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />

            {characterAnalysisPrompt && (
              <button
                type="button"
                disabled={!characterAnalysisEnabled}
                onClick={() => {
                  setCharacterAnalysisPrompt('');
                  handleSaveUserIdentity({
                    nextCharacterAnalysisPrompt: ''
                  });
                }}
                className="text-[10px] text-red-500 hover:underline flex items-center gap-1 mt-1 disabled:opacity-40"
              >
                清空并使用系统默认指导
              </button>
            )}
          </div>
        </div>

 {/* 地理位置 */}
<div
  className="flex items-center justify-between gap-4 rounded-2xl border p-3"
  style={{
    background: 'var(--control-soft-bg)',
    borderColor: 'var(--card-border)',
  }}
>
  <div className="min-w-0">
    <p className="text-xs font-medium">位置感知（地点归类）</p>
    <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
      开启后，{character?.name || '角色'} 会定期感知你的位置并逐渐记住你去过的地方。默认关闭。
    </p>
  </div>
  
  <button
  type="button"
  role="switch"
  aria-checked={locationEnabled}
  onClick={handleToggleLocation}
  className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
  style={{
    background: locationEnabled
      ? 'var(--accent-color)'
      : 'var(--divider)'
  }}
>
  <span
    className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
    style={{
      background: 'var(--bg-main)',
      transform: locationEnabled
        ? 'translateX(20px)'
        : 'translateX(0)'
    }}
  />
</button>

</div>

        {/* Rhythm 主动寄语 */}
        <div
          className="flex items-center justify-between gap-4 rounded-2xl border p-3"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium">Rhythm 主动寄语</p>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              开启后，{character?.name || '角色'} 会结合日程、待办和自己的生活状态，偶尔主动给这个聊天窗发一句寄语。关闭后这个聊天窗不会再收到。
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={rhythmEnabled}
            onClick={handleToggleRhythmEnabled}
            className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
            style={{
              background: rhythmEnabled
                ? 'var(--accent-color)'
                : 'var(--divider)'
            }}
          >
            <span
              className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
              style={{
                background: 'var(--bg-main)',
                transform: rhythmEnabled
                  ? 'translateX(20px)'
                  : 'translateX(0)'
              }}
            />
          </button>
        </div>

        {/* 暂时不在线（每个聊天窗单独设置） */}
        <AwaySettingsSection
          chat={chat}
          character={character}
          onUpdated={onUpdatedUserPersona}
        />

        {/* 阶段性多条目事实总结 */}
        <div
          className="space-y-2 p-3 rounded-2xl border"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] opacity-60">
              TIMELINE SUMMARY / 阶段事实总结
            </span>
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
            <div
              className="p-2 rounded-xl border space-y-2"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--divider)'
              }}
            >
              <textarea
                rows={2}
                placeholder="手动新增一段阶段性事实总结..."
                value={newSummaryText}
                onChange={(e) => setNewSummaryText(e.target.value)}
                className="w-full bg-transparent outline-none text-xs leading-relaxed"
                style={{ color: 'var(--text-main)' }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBox(false)}
                  className="opacity-60 text-[10px]"
                >
                  取消
                </button>
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
            <p className="text-[11px] opacity-50 italic py-1">
              暂无阶段性总结记录。
            </p>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar pt-1">
              {summaryList.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl border space-y-1 text-[11px]"
                  style={{
                    background: 'var(--bg-main)',
                    borderColor: 'var(--divider)'
                  }}
                >
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
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="opacity-60 hover:opacity-100"
                          title="修改"
                        >
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
                    <p className="opacity-80 leading-relaxed font-sans">
                      {item.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 背景壁纸配置 */}
        <div
          className="space-y-2 p-3 rounded-2xl border"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <label className="block font-mono opacity-60 text-[10px]">
              CHAT BACKGROUND / 背景图
            </label>

            <button
              type="button"
              onClick={handleToggleBgDimmed}
              className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 hover:opacity-100 transition-opacity"
              style={{
                color: isBgDimmed
                  ? 'var(--accent-color)'
                  : 'var(--text-muted)'
              }}
              title="切换背景图淡化"
            >
              {isBgDimmed ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
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
                <img
                  src={bgImage}
                  alt="Background"
                  className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <Upload className="w-4 h-4 opacity-40" />
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <div className="flex-1 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1.5 rounded-xl border text-center font-medium transition-all text-[11px]"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)',
                  color: 'var(--text-main)'
                }}
              >
                {bgImage ? '更换背景' : '选择图片'}
              </button>

              {bgImage && (
                <button
                  type="button"
                  onClick={async () => {
                    onUpdateBgImage('');
                    if (onUpdatedUserPersona) {
                      onUpdatedUserPersona({ bgImage: '' });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl border text-center font-medium transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  style={{
                    borderColor: 'var(--divider)'
                  }}
                  title="删除背景图"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isBgDimmed && (
            <div
              className="pt-2 space-y-1 border-t"
              style={{ borderColor: 'var(--divider)' }}
            >
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
        <div
          className="flex items-center justify-between gap-4 rounded-2xl border p-3"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium">尝试维持后台活跃</p>
            <p
              className="mt-1 text-[10px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              移动端浏览器仍可能因系统省电策略暂停后台任务。
            </p>
          </div>

          <input
            type="checkbox"
            checked={keepAlive}
            onChange={(event) => {
              handleToggleKeepAliveChange(event.target.checked);
            }}
            className="h-4 w-4 shrink-0 cursor-pointer"
            style={{ accentColor: 'var(--accent-color)' }}
            aria-label="尝试维持后台活跃"
          />
        </div>

                {/* 顶部按钮常驻设置 */}
        <div
          className="flex items-center justify-between gap-4 rounded-2xl border p-3"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium">常驻顶部快捷按钮</p>
            <p
              className="mt-1 text-[10px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              开启后，顶部按钮（轨迹、爪印菜单、电话、存档与设置等）将始终显示，无需展开伴侣卡片。
            </p>
          </div>

          <input
            type="checkbox"
            checked={pinTopToolbar}
            onChange={(event) => {
              handleTogglePinTopToolbarChange(event.target.checked);
            }}
            className="h-4 w-4 shrink-0 cursor-pointer"
            style={{ accentColor: 'var(--accent-color)' }}
            aria-label="常驻顶部快捷按钮"
          />
        </div>

                {/* 发送心跳动效 */}
        <div
          className="flex items-center justify-between gap-4 rounded-2xl border p-3"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium">发送心跳动效</p>
            <p
              className="mt-1 text-[10px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              开启后，每次发出消息，输入框上方会闪一下心电图波形，纯美观效果，不影响发送。
            </p>
          </div>

          <input
            type="checkbox"
            checked={heartbeatEffectEnabled}
            onChange={(event) => {
              handleToggleHeartbeatEffectChange(event.target.checked);
            }}
            className="h-4 w-4 shrink-0 cursor-pointer"
            style={{ accentColor: 'var(--accent-color)' }}
            aria-label="发送心跳动效"
          />
        </div>

                {/* 本窗字体与字号 */}
        <div
          className="space-y-2.5 p-3 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Type className="w-3.5 h-3.5" />
              <span>字体与字号</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">CHAT FONT</span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            填写字体文件网址（.woff2 / .ttf / .otf）或字体 CSS 网址。使用字体 CSS 网址时，需要再填写字体名称。留空则使用默认字体。仅影响本聊天窗。
          </p>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">
              字体网址
            </label>
            <input
              type="text"
              value={fontUrl}
              placeholder="https://..."
              onChange={(e) => setFontUrl(e.target.value)}
              onBlur={handleSaveChatFont}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">
              字体名称（仅字体 CSS 网址需要）
            </label>
            <input
              type="text"
              value={fontFamilyName}
              placeholder="例如：Noto Serif SC"
              onChange={(e) => setFontFamilyName(e.target.value)}
              onBlur={handleSaveChatFont}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          {(fontStatusText || fontUrl) && (
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="opacity-60">{fontStatusText}</span>

              {fontUrl && (
                <button
                  type="button"
                  onClick={handleResetChatFont}
                  className="shrink-0 text-red-500 hover:underline"
                >
                  恢复默认字体
                </button>
              )}
            </div>
          )}

          <div
            className="pt-2 space-y-1.5 border-t"
            style={{ borderColor: 'var(--divider)' }}
          >
            <div className="flex items-center justify-between text-[10px] opacity-60">
              <span>聊天文字大小</span>
              <span>{chatFontSize}px</span>
            </div>

            <input
              type="range"
              min="10"
              max="24"
              step="1"
              value={chatFontSize}
              onChange={(e) => setChatFontSize(Number(e.target.value))}
              onPointerUp={(e) => handleCommitChatFontSize(e.currentTarget.value)}
              onKeyUp={(e) => handleCommitChatFontSize(e.currentTarget.value)}
              className="w-full"
              style={{ accentColor: 'var(--accent-color)' }}
            />

            <div
              className="rounded-xl border p-2.5 leading-relaxed"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--divider)',
                fontSize: `${chatFontSize / 16}rem`
              }}
            >
              这是一段预览文字。The quick brown fox 0123456789
            </div>

            {Number.isFinite(chat?.chatFontSize) && (
              <button
                type="button"
                onClick={handleResetChatFontSize}
                className="text-[10px] text-red-500 hover:underline"
              >
                恢复默认字号
              </button>
            )}
          </div>
        </div>


        {/* 本窗输入框与按钮颜色 */}
        <div
          className="space-y-2.5 p-3 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Palette className="w-3.5 h-3.5" />
              <span>输入框与按钮颜色</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">CHAT COLORS</span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            点色块选择颜色，图标和文字会根据底色自动选深色或白色。仅影响本聊天窗，气泡颜色请用下方的气泡 CSS 定制。
          </p>

          <ColorSettingRow
            label="输入框底色"
            value={chat?.inputBarColor || ''}
            onCommit={(value) => handleCommitChatColor('inputBarColor', value)}
          />

          <ColorSettingRow
            label="发送按钮"
            value={chat?.sendBtnColor || ''}
            onCommit={(value) => handleCommitChatColor('sendBtnColor', value)}
          />

          <ColorSettingRow
            label="「回应」按钮"
            value={chat?.respondBtnColor || ''}
            onCommit={(value) => handleCommitChatColor('respondBtnColor', value)}
          />

          <ColorSettingRow
            label="顶部按钮"
            value={chat?.topBtnColor || ''}
            onCommit={(value) => handleCommitChatColor('topBtnColor', value)}
          />
        </div>

        {/* 本窗按钮外观预设：默认 / 毛玻璃 / 黑玻璃…… */}
        <div
          className="space-y-2.5 p-3 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Palette className="w-3.5 h-3.5" />
              <span>按钮外观</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">CONTROL STYLE</span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            切换输入栏和顶部这批按钮的质感（比如毛玻璃/黑玻璃）。跟上面的颜色是两件事：颜色管底色，这里管要不要加模糊和半透明，两者可以叠加。
          </p>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {CHAT_CONTROL_STYLE_OPTIONS.map((styleOpt) => {
              const isActive = (chat?.controlStyle || 'default') === styleOpt.id;

              return (
                <button
                  key={styleOpt.id}
                  type="button"
                  onClick={() => handleCommitControlStyle(styleOpt.id)}
                  className="p-2.5 rounded-xl border text-center font-medium transition-all text-[11px] active:scale-95"
                  style={{
                    background: isActive ? 'var(--accent-color)' : 'var(--bg-main)',
                    borderColor: isActive ? 'var(--accent-color)' : 'var(--divider)',
                    color: isActive ? 'var(--accent-foreground)' : 'var(--text-main)'
                  }}
                >
                  {styleOpt.label}
                </button>
              );
            })}
          </div>
        </div>

                {/* 常用信息（全局，所有聊天窗共用） */}
        <SavedInfoSection />

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
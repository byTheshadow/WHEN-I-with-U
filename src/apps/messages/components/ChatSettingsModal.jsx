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
  Palette,
  Download,
  Library
} from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import ColorSettingRow from './ColorSettingRow';
import ButtonDecorationRow from './ButtonDecorationRow';
import { DECORATION_FIELDS, DECORATION_FIELD_LABELS } from '../chatButtonDecorations';
import SavedInfoSection from './SavedInfoSection';
import AwaySettingsSection from '../away/AwaySettingsSection';
import LearningModeSettingsSection from '../learningMode/LearningModeSettingsSection';
import SecretCodeSettingsSection from '../secretCode/SecretCodeSettingsSection';
import ChatReplyLanguageSettingsSection from '../replyLanguage/ChatReplyLanguageSettingsSection';
import ChatImageGenSettingsSection from '../chatImageGen/ChatImageGenSettingsSection';
import PhoneScreenSettingsSection from '../phoneScreen/PhoneScreenSettingsSection';
import db from '../../../db';
import { CHAT_CONTROL_STYLE_OPTIONS } from '../chatControlStylePresets';
import { compressImageFile } from '../../../utils/imageHelper';
import ChatLoveProfileSection from '../loveProfile/ChatLoveProfileSection';
import {
  CHARACTER_ANALYSIS_PRESETS,
  DEFAULT_CHARACTER_ANALYSIS_PROMPT,
} from '../characterAnalysisPrompt';
import { BUILTIN_WORLD_BOOK_METAS } from '../builtinWorldBook';

import { triggerGlobalToast } from '../../../components/NotificationToast';
import { clearChatRealVoiceMedia, clearChatRealPhotoMedia } from '../chatMediaCleanupService';
import ChatExportModal from '../export/ChatExportModal';
import { lazyWithRetry } from '../../../utils/lazyWithRetry';

// 剧情记忆包的管理面板是独立的新界面,点开才加载,不增加聊天设置本身的体积。
const StPackChatPanel = lazyWithRetry(
  () => import('../../stmemory/StPackChatPanel'),
  'StPackChatPanel',
);
import { releasePhotoObjectUrl } from './cards/PhotoCard';
import { getLocationSettings, setLocationEnabled } from '../../../apps/location/placeService';


export const ChatSettingsModal = ({
  chat,
  character,
  onClose,
   onUpdateBgImage,
  onUpdateBgOpacity,
  onUpdateBackgrounds,
  onToggleKeepAlive,
  onOpenBubbleCustomizer,
  onClearHistory,
  onDeletedChat,
  onSaveSummary,
  onUpdatedUserPersona,
  onTogglePinTopToolbar,
  onToggleHeartbeatEffect,
  onOpenWorkAssistantSettings,
  fontStatus,
}) => {


  const fileInputRef = useRef(null);
  const userAvatarInputRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVoiceMediaClearConfirm, setShowVoiceMediaClearConfirm] = useState(false);
  const [isClearingVoiceMedia, setIsClearingVoiceMedia] = useState(false);
  const [showPhotoMediaClearConfirm, setShowPhotoMediaClearConfirm] = useState(false);
   const [isClearingPhotoMedia, setIsClearingPhotoMedia] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
    const [showStPackPanel, setShowStPackPanel] = useState(false);

  const handleClearVoiceMedia = async () => {
    if (!chat?.id) return;

    setIsClearingVoiceMedia(true);
    try {
      const { clearedCount } = await clearChatRealVoiceMedia(chat.id);
      triggerGlobalToast({
        title: clearedCount > 0 ? '清理完成' : '没有可清理的内容',
        content: clearedCount > 0
          ? `已清理 ${clearedCount} 条语音的音频本体，文字转写已保留。`
          : '这个聊天里暂时没有可以清理的语音本体。',
      });

      if (clearedCount > 0) {
        window.dispatchEvent(
          new CustomEvent('new-local-message-inserted', {
            detail: { chatId: chat.id },
          }),
        );
      }
    } catch (error) {
      console.warn('[ChatSettingsModal] 清理语音缓存失败：', error);
      triggerGlobalToast({ title: '清理失败', content: '请稍后再试。' });
    } finally {
      setIsClearingVoiceMedia(false);
      setShowVoiceMediaClearConfirm(false);
    }
  };

  // 跟上面语音缓存清理是同一个思路，针对这个聊天里所有真实图片
  // （type: 'photo'）的图片本体，不是清整条消息——文字记录和视觉识别
  // 描述都保留。
  const handleClearPhotoMedia = async () => {
    if (!chat?.id) return;

    setIsClearingPhotoMedia(true);
    try {
      const { clearedCount, clearedMessageIds } = await clearChatRealPhotoMedia(chat.id);
      triggerGlobalToast({
        title: clearedCount > 0 ? '清理完成' : '没有可清理的内容',
        content: clearedCount > 0
          ? `已清理 ${clearedCount} 张照片的图片本体，文字记录已保留。`
          : '这个聊天里暂时没有可以清理的图片本体。',
      });

      if (clearedCount > 0) {
        // 释放 PhotoCard 缓存的 object URL，否则本体清了，内存里那份
        // blob object URL 还占着——跟 ChatRoom.jsx 单张清除时的做法一致。
        clearedMessageIds.forEach((messageId) => releasePhotoObjectUrl(messageId));

        window.dispatchEvent(
          new CustomEvent('new-local-message-inserted', {
            detail: { chatId: chat.id },
          }),
        );
      }
    } catch (error) {
      console.warn('[ChatSettingsModal] 清理图片缓存失败：', error);
      triggerGlobalToast({ title: '清理失败', content: '请稍后再试。' });
    } finally {
      setIsClearingPhotoMedia(false);
      setShowPhotoMediaClearConfirm(false);
    }
  };

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

  // 角色是否可以自己主动重新布置DIY小屋（不限次数，由角色自己把握
  // 节奏）。未设置时默认视为开启，跟 rhythmEnabled 同一个取舍。
  const [diyAutoDecorateEnabled, setDiyAutoDecorateEnabled] = useState(
    chat?.diyAutoDecorateEnabled !== false
  );

  // 本聊天窗是否开启关键词触发世界书（跟老的"角色专属世界书/全局勾选
  // 世界书"是两套并行机制，这里管的是新的"挂载哪几本共享世界书，靠
  // 关键词命中才注入"）。未设置时默认关闭——这是新功能，不该让老聊天
  // 窗在用户还没去挑过书之前就突然带上一段陌生设定。
  // 内置世界书（builtinWorldBook.js，纯代码维护，想加/改书直接改那个
  // 文件）总开关——未设置时默认关闭，新功能不该让老聊天窗在用户还没
  // 主动打开之前就突然带上一段陌生设定。
  const [worldBookEnabled, setWorldBookEnabled] = useState(
    chat?.worldBookEnabled === true
  );
  // 各本书的独立开关——存书 id 数组；null/undefined 时视为全部开启
  const [enabledWorldBookIds, setEnabledWorldBookIds] = useState(
    chat?.enabledWorldBookIds ?? BUILTIN_WORLD_BOOK_METAS.map((b) => b.id)
  );
  const [characterAnalysisPrompt, setCharacterAnalysisPrompt] = useState(
    chat?.characterAnalysisPrompt || ''
  );


  // 背景图淡化控制：B 方案，只控制背景图本身透明度
  const [isBgDimmed, setIsBgDimmed] = useState(chat?.isBgDimmed ?? true);
  const [bgOpacity, setBgOpacity] = useState(chat?.bgOpacity ?? 0.3);

  // 背景图库：每张图配一句注释，角色会参考注释自主决定什么时候切换背景
  const [galleryBackgrounds, setGalleryBackgrounds] = useState(chat?.backgrounds || []);
  const galleryFileInputRef = useRef(null);

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

  const handleCommitDecoration = async (field, value) => {
    if (!chat?.id) return;

    const next = value || '';
    const currentDecorations = chat?.decorations || {};

    if (next === (currentDecorations[field] || '')) return;

    const nextDecorations = { ...currentDecorations, [field]: next };

    await db.chats.update(chat.id, { decorations: nextDecorations });

    onUpdatedUserPersona?.({ decorations: nextDecorations });
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

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 之前这里直接 readAsDataURL 原图，没有走压缩，是真的没压缩——
    // 现在跟其它上传入口一样，统一走 compressImageFile。
    try {
      const compressed = await compressImageFile(file);
      onUpdateBgImage(compressed);
    } catch (error) {
      console.error('[ChatSettingsModal] 背景图压缩失败：', error);
    }

    e.target.value = '';
  };

  // 背景图库：持久化整份数组（新增/删除/设为当前都走这一个出口）
  const persistBackgrounds = (next) => {
    setGalleryBackgrounds(next);
    if (onUpdateBackgrounds) {
      onUpdateBackgrounds(next);
    }
  };

  const handleAddGalleryImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      const entry = {
        id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        image: compressed,
        caption: '',
      };
      persistBackgrounds([...galleryBackgrounds, entry]);
    } catch (error) {
      console.error('[ChatSettingsModal] 背景图压缩失败：', error);
    }

    e.target.value = '';
  };

  // 注释输入框只在 onChange 时更新本地状态，onBlur 才真正落库，
  // 避免每敲一个字就写一次数据库。
  const handleGalleryCaptionChange = (id, caption) => {
    setGalleryBackgrounds((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption } : item))
    );
  };

  const handleGalleryCaptionBlur = () => {
    if (onUpdateBackgrounds) {
      onUpdateBackgrounds(galleryBackgrounds);
    }
  };

  const handleSetActiveBackground = (entry) => {
    if (onUpdateBgImage) {
      onUpdateBgImage(entry.image);
    }
  };

  const handleDeleteGalleryBackground = (id) => {
    const removed = galleryBackgrounds.find((item) => item.id === id);
    const next = galleryBackgrounds.filter((item) => item.id !== id);
    persistBackgrounds(next);

    // 删除的正好是当前使用中的背景图时，顺手清空当前背景
    if (removed && removed.image && removed.image === bgImage && onUpdateBgImage) {
      onUpdateBgImage('');
    }
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

  const handleToggleDiyAutoDecorate = async () => {
    if (!chat?.id) return;

    const nextEnabled = !diyAutoDecorateEnabled;
    setDiyAutoDecorateEnabled(nextEnabled);

    await db.chats.update(chat.id, { diyAutoDecorateEnabled: nextEnabled });

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ diyAutoDecorateEnabled: nextEnabled });
    }
  };

  const handleToggleWorldBookEnabled = async () => {
    if (!chat?.id) return;

    const nextEnabled = !worldBookEnabled;
    setWorldBookEnabled(nextEnabled);

    await db.chats.update(chat.id, { worldBookEnabled: nextEnabled });

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ worldBookEnabled: nextEnabled });
    }
  };

  const handleToggleBookEnabled = async (bookId) => {
    if (!chat?.id) return;

    const allIds = BUILTIN_WORLD_BOOK_METAS.map((b) => b.id);
    const current = Array.isArray(enabledWorldBookIds)
      ? enabledWorldBookIds
      : allIds;

    const next = current.includes(bookId)
      ? current.filter((id) => id !== bookId)
      : [...current, bookId];

    setEnabledWorldBookIds(next);
    await db.chats.update(chat.id, { enabledWorldBookIds: next });

    if (onUpdatedUserPersona) {
      onUpdatedUserPersona({ enabledWorldBookIds: next });
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
        await db.chatToys.where('chatId').equals(chat.id).delete();
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
            aria-label="关闭对话空间设置"
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
              aria-label="上传你的头像"
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

        {/* 语言学习模式（每个聊天窗单独设置） */}
        <LearningModeSettingsSection
          chat={chat}
          onUpdated={onUpdatedUserPersona}
        />

        {/* 回复语言（每个聊天窗单独设置，不带翻译，直接输出目标语言） */}
        <ChatReplyLanguageSettingsSection
          chat={chat}
          onUpdated={onUpdatedUserPersona}
        />

        {/* AI自动生图（每个聊天窗单独设置，默认关闭） */}
        <ChatImageGenSettingsSection
          chat={chat}
          onUpdated={onUpdatedUserPersona}
        />

                {/* 专属暗号词典（存在角色上，同一角色的所有聊天窗共用） */}
        <SecretCodeSettingsSection
          character={character}
          onUpdated={onUpdatedUserPersona}
        />

                {/* 角色手机截图（每个聊天窗单独设置，默认关闭） */}
        <PhoneScreenSettingsSection
          chat={chat}
          onUpdated={onUpdatedUserPersona}
        />

        
        {/* 剧情记忆包(把别处导入的剧情带进这个聊天;具体操作在独立的新界面里) */}
        <div
          className="space-y-2.5 p-3.5 rounded-2xl border w-full"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Library className="w-3.5 h-3.5" />
              <span>剧情记忆包</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">
              STORY PACKS
            </span>
          </div>
          <p className="text-[10px] leading-relaxed opacity-60">
            把导入的剧情记录挂到这个聊天,让角色知道这些事。
            {Array.isArray(chat?.stPackLinks) && chat.stPackLinks.length > 0
              ? `目前挂了 ${chat.stPackLinks.length} 个,其中 ${chat.stPackLinks.filter((link) => link.enabled).length} 个开启。`
              : '目前还没有挂载。'}
          </p>
          <button
            type="button"
            onClick={() => setShowStPackPanel(true)}
            className="w-full py-2 rounded-xl border text-xs font-semibold"
            style={{
              background: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            打开记忆包面板
          </button>
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
              aria-label="人格分析 / 角色反应指导"
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
            {/* 预设快捷按钮 */}
            <div className="flex flex-wrap gap-1.5">
              {CHARACTER_ANALYSIS_PRESETS.map((preset) => {
                const isActive =
                  preset.id === 'default'
                    ? !characterAnalysisPrompt.trim()
                    : characterAnalysisPrompt.trim() === preset.prompt.trim();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={!characterAnalysisEnabled}
                    onClick={() => {
                      const next =
                        preset.id === 'default' ? '' : preset.prompt.trim();
                      setCharacterAnalysisPrompt(next);
                      handleSaveUserIdentity({
                        nextCharacterAnalysisPrompt: next
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
                    style={{
                      background: isActive
                        ? 'var(--accent-color)'
                        : 'var(--divider)',
                      color: isActive ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

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

         {/* 情感偏好（单窗覆盖，全局默认在设置页） */}
        <ChatLoveProfileSection chat={chat} onUpdated={onUpdatedUserPersona} />

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
  aria-label="位置感知（地点归类）"
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
            aria-label="Rhythm 主动寄语"
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

        {/* 角色自主布置DIY小屋 */}
        <div
          className="flex items-center justify-between gap-4 rounded-2xl border p-3"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium">角色自主布置DIY小屋</p>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              开启后，{character?.name || '角色'} 可以自己决定什么时候重新布置TA的DIY小屋，不限次数。关闭后TA不会再自己动手，小屋只能靠你主动要求或者点按钮来换。
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={diyAutoDecorateEnabled}
            aria-label="角色自主布置DIY小屋"
            onClick={handleToggleDiyAutoDecorate}
            className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
            style={{
              background: diyAutoDecorateEnabled
                ? 'var(--accent-color)'
                : 'var(--divider)'
            }}
          >
            <span
              className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
              style={{
                background: 'var(--bg-main)',
                transform: diyAutoDecorateEnabled
                  ? 'translateX(20px)'
                  : 'translateX(0)'
              }}
            />
          </button>
        </div>

        {/* 内置世界书：总开关 + 每本书单独开关 */}
        <div
          className="space-y-2.5 rounded-2xl border p-3"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          {/* 总开关行 */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium">内置世界书</p>
              <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                开启后，会在最近几条对话里扫描关键词，命中才会把对应条目注入给 AI——不是整本都塞进去。
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={worldBookEnabled}
              aria-label="内置世界书"
              onClick={handleToggleWorldBookEnabled}
              className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
              style={{
                background: worldBookEnabled
                  ? 'var(--accent-color)'
                  : 'var(--divider)'
              }}
            >
              <span
                className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
                style={{
                  background: 'var(--bg-main)',
                  transform: worldBookEnabled
                    ? 'translateX(20px)'
                    : 'translateX(0)'
                }}
              />
            </button>
          </div>

          {/* 总开关开启时，显示每本书的独立开关 */}
          {worldBookEnabled && (
            <div className="space-y-1.5 pt-1">
              {BUILTIN_WORLD_BOOK_METAS.map((meta) => {
                const isOn = Array.isArray(enabledWorldBookIds)
                  ? enabledWorldBookIds.includes(meta.id)
                  : true;
                return (
                  <div
                    key={meta.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2"
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium">{meta.name}</p>
                      {meta.desc && (
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          {meta.desc}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      aria-label={meta.name}
                      onClick={() => handleToggleBookEnabled(meta.id)}
                      className="relative h-4 w-8 shrink-0 overflow-hidden rounded-full transition-colors"
                      style={{
                        background: isOn ? 'var(--accent-color)' : 'var(--divider)'
                      }}
                    >
                      <span
                        className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full transition-transform"
                        style={{
                          background: 'var(--bg-main)',
                          transform: isOn ? 'translateX(16px)' : 'translateX(0)'
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
                          aria-label="保存修改"
                          title="保存"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="opacity-60 hover:opacity-100"
                          aria-label="修改这条阶段性总结"
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
                        aria-label="删除这条阶段性总结"
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
                  aria-label="删除背景图"
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

        {/* 背景图库：AI 自主切换背景用 */}
        <div
          className="space-y-2 p-3 rounded-2xl border"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <label className="block font-mono opacity-60 text-[10px]">
              BACKGROUND GALLERY / 背景图库
            </label>

            <button
              type="button"
              onClick={() => galleryFileInputRef.current?.click()}
              className="flex items-center gap-1 text-[10px] font-semibold opacity-75 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--accent-color)' }}
            >
              <Plus className="w-3 h-3" />
              <span>添加</span>
            </button>

            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAddGalleryImage}
            />
          </div>

          <p className="text-[10px] leading-relaxed opacity-50">
            每张图配一句注释，角色会参考注释自主决定什么时候切换背景（比如写"下雨天用"，聊到下雨角色可能会自己换过去），不设频率限制。注释留空的图，角色不会主动选用。
          </p>

          {galleryBackgrounds.length === 0 ? (
            <p className="text-[10px] opacity-40 py-1">还没有图库，点"添加"上传第一张。</p>
          ) : (
            <div className="space-y-2 pt-1">
              {galleryBackgrounds.map((item) => {
                const isActive = !!item.image && item.image === bgImage;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-1.5 rounded-xl border"
                    style={{
                      borderColor: isActive ? 'var(--accent-color)' : 'var(--divider)',
                      background: isActive ? 'var(--control-soft-bg)' : 'transparent',
                    }}
                  >
                    <div
                      onClick={() => handleSetActiveBackground(item)}
                      className="w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer relative"
                      title="设为当前背景"
                    >
                      <img
                        src={item.image}
                        alt="背景图库"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {isActive && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'rgba(0,0,0,0.25)' }}
                        >
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      value={item.caption}
                      onChange={(e) => handleGalleryCaptionChange(item.id, e.target.value)}
                      onBlur={handleGalleryCaptionBlur}
                      placeholder="注释，比如：下雨天用"
                      maxLength={30}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg border text-[11px] bg-transparent"
                      style={{ borderColor: 'var(--divider)', color: 'var(--text-main)' }}
                    />

                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryBackground(item.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                      aria-label="删除这张背景图"
                      title="删除这张"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
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
            点色块选择颜色，图标和文字会根据底色自动选深色或白色。仅影响本聊天窗，气泡底色/形状请用下方的气泡 CSS 定制；「输入框文字颜色」和下面两个「气泡文字颜色」都会覆盖各自默认的自动配色。
          </p>

          <ColorSettingRow
            label="输入框底色"
            value={chat?.inputBarColor || ''}
            onCommit={(value) => handleCommitChatColor('inputBarColor', value)}
          />

          <ColorSettingRow
            label="输入框文字颜色"
            value={chat?.inputTextColor || ''}
            onCommit={(value) => handleCommitChatColor('inputTextColor', value)}
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

          <ColorSettingRow
            label="我的气泡文字颜色"
            value={chat?.userBubbleTextColor || ''}
            onCommit={(value) => handleCommitChatColor('userBubbleTextColor', value)}
          />

                   <ColorSettingRow
            label="对方气泡文字颜色"
            value={chat?.aiBubbleTextColor || ''}
            onCommit={(value) => handleCommitChatColor('aiBubbleTextColor', value)}
          />
        </div>

        {/* 发送/回应/爪印更多入口按钮的贴图装饰：自己写CSS，想贴图就用上传小助手 */}
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
              <span>按钮贴图</span>
            </div>
            <span className="font-mono text-[9px] opacity-45">BUTTON SKIN</span>
          </div>

          <p className="text-[10px] opacity-55 leading-relaxed">
            跟上面的颜色是另一套维度：这里直接写CSS，图标和底色都会被你写的样式整体替换掉（点击范围和功能不变）。可以只改颜色/圆角/阴影，也可以点「上传贴图」把一张图压缩进去当背景，之后还能接着手动改其它属性。
          </p>

          {DECORATION_FIELDS.map((field) => (
            <ButtonDecorationRow
              key={field}
              label={DECORATION_FIELD_LABELS[field]}
              value={chat?.decorations?.[field] || ''}
              onCommit={(value) => handleCommitDecoration(field, value)}
            />
          ))}
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
            切换输入栏和顶部这批按钮的质感（比如毛玻璃/黑玻璃），正在输入指示器的卡片外观也会跟着一起换。跟上面的颜色是两件事：颜色管底色，这里管要不要加模糊和半透明，两者可以叠加。
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

        {/* work 聊天窗专属：助理身份（名字/头像/人设/对你的偏好）是全局
            共享的，不属于"本窗设置"，单独拎到它自己的面板去改。 */}
        {chat?.mode === 'work' && onOpenWorkAssistantSettings && (
          <div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWorkAssistantSettings();
              }}
              className="w-full p-2.5 rounded-xl flex items-center justify-between border transition-all"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--divider)',
                color: 'var(--text-main)'
              }}
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 opacity-70" />
                <span>助理设置（名字/头像/人设，全部 work 窗口共用）</span>
              </div>
              <span className="opacity-40 font-mono text-[10px]">&gt;</span>
            </button>
          </div>
        )}

        {/* 危险区 */}
                <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
              border: '1px solid var(--card-border)'
            }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出聊天记录</span>
          </button>

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
            onClick={() => setShowVoiceMediaClearConfirm(true)}
            disabled={isClearingVoiceMedia}
            className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
              border: '1px solid var(--card-border)'
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearingVoiceMedia ? '清理中...' : '清理本窗语音缓存'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPhotoMediaClearConfirm(true)}
            disabled={isClearingPhotoMedia}
            className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
              border: '1px solid var(--card-border)'
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearingPhotoMedia ? '清理中...' : '清理本窗图片缓存'}</span>
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

      {showStPackPanel && (
        <React.Suspense fallback={null}>
          <StPackChatPanel
            chat={chat}
            onClose={() => setShowStPackPanel(false)}
            onUpdated={onUpdatedUserPersona}
          />
        </React.Suspense>
      )}
           {showExportModal && (
        <ChatExportModal
          chatId={chat?.id}
          source="live"
          onClose={() => setShowExportModal(false)}
        />
      )}

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
        isOpen={showVoiceMediaClearConfirm}
        title="清理语音缓存"
        message="清空这个聊天里所有 MiniMax 生成语音的音频本体，释放占用的内存/存储空间。每条消息的文字转写会原样保留，之后翻记录还能看到说过什么，只是听不到原声了。操作后不可恢复。"
        confirmText="清理"
        cancelText="保留"
        onCancel={() => setShowVoiceMediaClearConfirm(false)}
        onConfirm={handleClearVoiceMedia}
      />

      <ConfirmModal
        isOpen={showPhotoMediaClearConfirm}
        title="清理图片缓存"
        message="清空这个聊天里所有真实照片的图片本体，释放占用的内存/存储空间。每条消息的文字记录和已识别出的画面描述会原样保留，之后翻记录还能看到发过什么、画面大致是什么内容，只是看不到原图了。操作后不可恢复。"
        confirmText="清理"
        cancelText="保留"
        onCancel={() => setShowPhotoMediaClearConfirm(false)}
        onConfirm={handleClearPhotoMedia}
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
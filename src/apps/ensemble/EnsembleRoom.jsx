import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Sliders, Send, Sparkles, Smile, Image as ImageIcon, Sparkle, Cat, Heart, Zap } from 'lucide-react';
import db from '../../db';
import { generateEnsembleAiResponse, generateEnsembleSummary } from './ensembleService';
import { EnsembleUserSelector } from './components/EnsembleUserSelector';
import { EnsembleMessageItem } from './components/EnsembleMessageItem';
import { EnsembleSettingsModal } from './components/EnsembleSettingsModal';
import StickerPickerModal from '../messages/components/StickerPickerModal';

export const EnsembleRoom = ({ chatId, onBack, onChatRoomStateChange }) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState(null);

  // User 视角
  const [userIdentities, setUserIdentities] = useState([]);
  const [currentIdentityId, setCurrentIdentityId] = useState('');

  // 弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    onChatRoomStateChange(true);
    loadRoomData();
    return () => onChatRoomStateChange(false);
  }, [chatId]);

  const loadRoomData = async () => {
    const chatDoc = await db.ensembleChats.get(chatId);
    if (!chatDoc) return;
    setChat(chatDoc);

    const identities = chatDoc.userIdentities || [{ id: 'u_default', name: '我', persona: '主视角' }];
    setUserIdentities(identities);
    setCurrentIdentityId(chatDoc.currentIdentityId || identities[0].id);

    loadMessages();
  };

  const loadMessages = async () => {
    const msgs = await db.ensembleMessages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    const msgMap = new Map(msgs.map(m => [m.id, m]));
    const enriched = msgs.map(m => (m.quotedMessageId ? { ...m, quotedMessage: msgMap.get(m.quotedMessageId) } : m));

    setMessages(enriched);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // Textarea 自适应增高，最大高度后显示内滚条
  const handleInputTextChange = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // 仅发送消息 (不拉起 AI)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const currentIdent = userIdentities.find(u => u.id === currentIdentityId) || userIdentities[0];

    await db.ensembleMessages.add({
      chatId,
      senderId: currentIdent.id,
      senderName: currentIdent.name,
      senderAvatar: currentIdent.avatar || '',
      senderType: 'user',
      type: 'text',
      content: inputText.trim(),
      quotedMessageId: quotedMessage ? quotedMessage.id : null,
      timestamp: Date.now()
    });

    setInputText('');
    setQuotedMessage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    loadMessages();
  };

  // 触发 AI 生成
  const handleTriggerAi = async (targetCharId = null) => {
    setIsAiThinking(true);
    try {
      await generateEnsembleAiResponse(chatId, { targetCharacterId: targetCharId });
      await loadMessages();
    } catch (err) {
      console.error('AI 生成出错:', err);
    } finally {
      setIsAiThinking(false);
    }
  };

  // 发送表情包 (协议对齐 StickerCard)
  const handleSelectSticker = async (stickerUrl) => {
    const currentIdent = userIdentities.find(u => u.id === currentIdentityId) || userIdentities[0];
    await db.ensembleMessages.add({
      chatId,
      senderId: currentIdent.id,
      senderName: currentIdent.name,
      senderAvatar: currentIdent.avatar || '',
      senderType: 'user',
      type: 'sticker',
      content: stickerUrl,
      metadata: { url: stickerUrl, name: '表情包' },
      timestamp: Date.now()
    });
    setShowStickerPicker(false);
    loadMessages();
  };

  // 发送图片 (协议对齐 ImageCard 3D 翻面)
  const handleUploadImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const currentIdent = userIdentities.find(u => u.id === currentIdentityId) || userIdentities[0];
      await db.ensembleMessages.add({
        chatId,
        senderId: currentIdent.id,
        senderName: currentIdent.name,
        senderAvatar: currentIdent.avatar || '',
        senderType: 'user',
        type: 'image',
        content: '画卷相片快照',
        metadata: { description: '画面静止在这一刻，透出独特的浪漫氛围。', url: evt.target.result },
        timestamp: Date.now()
      });
      loadMessages();
    };
    reader.readAsDataURL(file);
  };

  if (!chat) return null;

  return (
    <div className="ensemble-container relative flex flex-col h-[100dvh] w-full overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* 沉浸背景遮罩 */}
      {chat.bgImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity duration-700"
          style={{ backgroundImage: `url(${chat.bgImage})`, opacity: chat.bgOpacity ?? 0.2 }}
        />
      )}

      {/* 彻底无 Top Bar：仅左右各有一枚带有磨砂底色的独立悬浮按钮 */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto p-2.5 rounded-full shadow-md backdrop-blur-md transition-transform active:scale-95 border"
          style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 悬浮中间群名标牌 */}
        <div
          className="pointer-events-auto px-3.5 py-1 rounded-full text-xs font-semibold shadow-sm backdrop-blur-md border truncate max-w-[180px]"
          style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
        >
          {chat.title}
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="pointer-events-auto p-2.5 rounded-full shadow-md backdrop-blur-md transition-transform active:scale-95 border"
          style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* 消息主滚动轴 */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 pt-14 pb-4 no-scrollbar">
        {messages.map((msg) => (
          <EnsembleMessageItem
            key={msg.id}
            msg={msg}
            onQuote={(m) => setQuotedMessage(m)}
            onRegenerate={() => handleTriggerAi(msg.characterId)}
            onDelete={async (id) => {
              await db.ensembleMessages.delete(id);
              loadMessages();
            }}
            onSummonChar={(charId) => handleTriggerAi(charId)}
          />
        ))}

        {/* 零 Emoji 矢量打字指示器 */}
        {isAiThinking && (
          <div className="flex items-center gap-2 my-3 px-3 py-2 rounded-2xl w-fit text-xs backdrop-blur-md border shadow-sm animate-pulse" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
            <Cat className="w-3.5 h-3.5 animate-bounce" />
            <span>AI 角色正在交替推演演绎...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部悬浮 Dock 输入区域 */}
      <div className="relative z-20 w-full px-3 pb-3 pt-1">
        {/* 多 User 视角胶囊手柄 */}
        <EnsembleUserSelector
          userIdentities={userIdentities}
          currentIdentityId={currentIdentityId}
          onSelectIdentity={(id) => setCurrentIdentityId(id)}
          onAddTempIdentity={(newIdent) => setUserIdentities([...userIdentities, newIdent])}
          onUpdateIdentity={(id, updated) => setUserIdentities(userIdentities.map(u => u.id === id ? { ...u, ...updated } : u))}
        />

        {/* 引用指示条 */}
        {quotedMessage && (
          <div className="flex items-center justify-between px-3 py-1 mb-1.5 rounded-xl text-xs backdrop-blur-md border" style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)' }}>
            <span className="truncate opacity-80">引用 {quotedMessage.senderName}: {quotedMessage.content}</span>
            <button type="button" onClick={() => setQuotedMessage(null)} className="text-xs opacity-50">取消</button>
          </div>
        )}

        {/* 悬浮输入 Dock 本体 */}
        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-1.5 p-2 rounded-3xl backdrop-blur-xl shadow-xl border"
          style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)' }}
        >
          <button
            type="button"
            onClick={() => setShowStickerPicker(true)}
            className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95 shrink-0"
            style={{ color: 'var(--text-main)' }}
          >
            <Smile className="w-4 h-4" />
          </button>

          <label className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95 shrink-0 cursor-pointer" style={{ color: 'var(--text-main)' }}>
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
          </label>

          {/* 可自适应增高 + 内部滚动条 textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputTextChange}
            placeholder="输入对话或动作描述..."
            className="ensemble-textarea-scroll flex-1 px-3 py-1.5 text-xs outline-none bg-transparent resize-none max-h-32"
            style={{ color: 'var(--text-main)' }}
          />

          {/* 发送消息按钮 */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full transition-transform active:scale-95 disabled:opacity-30 shrink-0 shadow-sm"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* 独立触发 AI 按钮 */}
          <button
            type="button"
            onClick={() => handleTriggerAi()}
            disabled={isAiThinking}
            title="触发 AI 多角色链式应答"
            className="p-2.5 rounded-full transition-transform active:scale-95 shrink-0 border shadow-sm"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {showSettings && (
        <EnsembleSettingsModal
          chatId={chatId}
          onClose={() => setShowSettings(false)}
          onUpdated={loadRoomData}
        />
      )}

      {showStickerPicker && (
        <StickerPickerModal
          onClose={() => setShowStickerPicker(false)}
          onSelectSticker={handleSelectSticker}
        />
      )}
    </div>
  );
};

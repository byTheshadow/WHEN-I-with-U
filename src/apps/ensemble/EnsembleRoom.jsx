import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Image, Smile } from 'lucide-react';
import db from '../../db';
import { generateEnsembleAiResponse, generateEnsembleSummary } from './ensembleService';
import { EnsembleHeaderFloating } from './components/EnsembleHeaderFloating';
import { EnsembleUserSelector } from './components/EnsembleUserSelector';
import { EnsembleMessageItem } from './components/EnsembleMessageItem';
import { EnsembleCuteTypingIndicator } from './components/EnsembleCuteTypingIndicator';
import { EnsembleSettingsModal } from './components/EnsembleSettingsModal';
import StickerPickerModal from '../messages/components/StickerPickerModal';

export const EnsembleRoom = ({ chatId, onBack, onChatRoomStateChange }) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [typingCharName, setTypingCharName] = useState('');
  const [quotedMessage, setQuotedMessage] = useState(null);

  // 多 User 身份
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

    const identities = chatDoc.userIdentities || [
      { id: 'u_default', name: '我', persona: '主视角' }
    ];
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
    const enriched = msgs.map(m => {
      if (m.quotedMessageId) {
        return { ...m, quotedMessage: msgMap.get(m.quotedMessageId) };
      }
      return m;
    });

    setMessages(enriched);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // Textarea 自适应高度调整
  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // 发送用户纯文本消息
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const currentIdent = userIdentities.find(u => u.id === currentIdentityId) || userIdentities[0];

    const newMsg = {
      chatId,
      senderId: currentIdent.id,
      senderName: currentIdent.name,
      senderAvatar: currentIdent.avatar || '',
      senderType: 'user',
      type: 'text',
      content: inputText.trim(),
      quotedMessageId: quotedMessage ? quotedMessage.id : null,
      timestamp: Date.now()
    };

    await db.ensembleMessages.add(newMsg);
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setQuotedMessage(null);
    await loadMessages();
  };

  // 触发 AI 应答
  const handleTriggerAi = async (targetCharId = null) => {
    setIsAiThinking(true);
    setTypingCharName('AI 角色群像');
    try {
      await generateEnsembleAiResponse(chatId, { targetCharacterId });
      await loadMessages();
    } catch (err) {
      console.error('AI 生成失败', err);
    } finally {
      setIsAiThinking(false);
    }
  };

  // 发送表情包
  const handleSelectSticker = async (stickerObj) => {
    const currentIdent = userIdentities.find(u => u.id === currentIdentityId) || userIdentities[0];
    await db.ensembleMessages.add({
      chatId,
      senderId: currentIdent.id,
      senderName: currentIdent.name,
      senderAvatar: currentIdent.avatar || '',
      senderType: 'user',
      type: 'sticker',
      content: stickerObj.url || '',
      metadata: { url: stickerObj.url, name: stickerObj.name || '表情包' },
      timestamp: Date.now()
    });
    setShowStickerPicker(false);
    loadMessages();
  };

  // 发送图片叙事卡
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
        content: '一张现场画卷照片',
        metadata: { description: '画卷细节描写被静止在镜头里...', url: evt.target.result },
        timestamp: Date.now()
      });
      loadMessages();
    };
    reader.readAsDataURL(file);
  };

  if (!chat) return null;

  return (
    <div className="ensemble-room-container" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* 沉浸半透明背景图 */}
      {chat.bgImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity"
          style={{ backgroundImage: `url(${chat.bgImage})`, opacity: chat.bgOpacity ?? 0.2 }}
        />
      )}

      {/* 悬浮顶栏 */}
      <EnsembleHeaderFloating
        chat={chat}
        onBack={onBack}
        onOpenSettings={() => setShowSettings(true)}
        onTriggerSummary={() => generateEnsembleSummary(chatId)}
      />

      {/* 消息滚动区 */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3.5 py-2 no-scrollbar">
        {messages.map((msg) => (
          <EnsembleMessageItem
            key={msg.id}
            msg={msg}
            onQuote={(m) => setQuotedMessage(m)}
            onRegenerate={(m) => {
              db.ensembleMessages.delete(m.id).then(() => handleTriggerAi(m.characterId));
            }}
            onDelete={(id) => db.ensembleMessages.delete(id).then(loadMessages)}
            onSummonChar={(charId) => handleTriggerAi(charId)}
          />
        ))}

        {/* 矢量零 Emoji 打字指示器 */}
        {isAiThinking && <EnsembleCuteTypingIndicator charName={typingCharName} styleType="paw" />}

        <div ref={messagesEndRef} />
      </div>

      {/* 悬浮 Dock 输入容器 */}
      <div className="relative z-20 w-full p-2">
        {/* 多 User 身份切换胶囊 */}
        <EnsembleUserSelector
          userIdentities={userIdentities}
          currentIdentityId={currentIdentityId}
          onSelectIdentity={(id) => setCurrentIdentityId(id)}
          onAddTempIdentity={(newIdent) => setUserIdentities([...userIdentities, newIdent])}
        />

        <div className="ensemble-dock-container p-2 space-y-1">
          {quotedMessage && (
            <div className="flex items-center justify-between px-3 py-1 rounded-lg text-[10px] opacity-75" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
              <span className="truncate">引用 {quotedMessage.senderName}: {quotedMessage.content}</span>
              <button type="button" onClick={() => setQuotedMessage(null)} className="opacity-60">取消</button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowStickerPicker(true)}
              className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95 shrink-0"
              style={{ color: 'var(--text-main)' }}
            >
              <Smile className="w-4 h-4" />
            </button>

            <label className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95 shrink-0 cursor-pointer" style={{ color: 'var(--text-main)' }}>
              <Image className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
            </label>

            {/* 自适应高度 Textarea 输入框 */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="发送消息..."
              className="ensemble-textarea-input py-2 px-1"
            />

            {/* 纯发送 */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-full transition-transform active:scale-95 disabled:opacity-30 shrink-0"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>

            {/* 独立触发 AI */}
            <button
              type="button"
              onClick={() => handleTriggerAi()}
              disabled={isAiThinking}
              title="触发 AI 群像发言"
              className="p-2.5 rounded-full transition-transform active:scale-95 shrink-0 border shadow-sm"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
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

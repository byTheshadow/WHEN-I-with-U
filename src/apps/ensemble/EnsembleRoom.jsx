import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Image, Smile, AtSign } from 'lucide-react';
import db from '../../db';
import {
  generateEnsembleAiResponse,
  generateEnsembleSummary
} from './ensembleService';
import { EnsembleHeaderBanner } from './components/EnsembleHeaderBanner';
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

  // User 身份控制
  const [userIdentities, setUserIdentities] = useState([]);
  const [currentIdentityId, setCurrentIdentityId] = useState('');

  // 弹窗控制
  const [showSettings, setShowSettings] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [charList, setCharList] = useState([]);

  const messagesEndRef = useRef(null);

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

    // 读取已关联角色的信息
    if (chatDoc.selectedCharacterIds?.length > 0) {
      const chars = await db.characters.where('id').anyOf(chatDoc.selectedCharacterIds).toArray();
      setCharList(chars);
    }

    loadMessages();
  };

  const loadMessages = async () => {
    const msgs = await db.ensembleMessages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    // 拼装引用数据
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

  // 1. 纯发送用户消息（不触发 AI 回复）
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
    setQuotedMessage(null);
    await loadMessages();
  };

  // 2. 独立触发 AI 回复 (可选指定召唤角色)
  const handleTriggerAi = async (targetCharId = null) => {
    setIsAiThinking(true);
    try {
      await generateEnsembleAiResponse(chatId, {
        targetCharacterId: targetCharId
      });
      await loadMessages();

      // 每 10 条消息自动检测剧情总结
      if (messages.length > 0 && messages.length % 10 === 0) {
        generateEnsembleSummary(chatId);
      }
    } catch (err) {
      console.error('AI 生成失败', err);
    } finally {
      setIsAiThinking(false);
    }
  };

  // 3. 表情包发送
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
      timestamp: Date.now()
    });
    setShowStickerPicker(false);
    loadMessages();
  };

  // 4. 图片发送 (Base64)
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
        content: evt.target.result,
        timestamp: Date.now()
      });
      loadMessages();
    };
    reader.readAsDataURL(file);
  };

  // 删除与重 roll
  const handleDeleteMessage = async (msgId) => {
    await db.ensembleMessages.delete(msgId);
    loadMessages();
  };

  const handleRegenerateMessage = async (msg) => {
    if (msg.senderType === 'user') return;
    await db.ensembleMessages.delete(msg.id);
    handleTriggerAi(msg.characterId);
  };

  if (!chat) return null;

  return (
    <div className="ensemble-container relative flex flex-col h-[100dvh] w-full overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* 自定义全屏透出的背景图 */}
      {chat.bgImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity"
          style={{ backgroundImage: `url(${chat.bgImage})`, opacity: chat.bgOpacity ?? 0.2 }}
        />
      )}

      {/* 紧凑无 Top Bar 状态栏 */}
      <EnsembleHeaderBanner
        chat={chat}
        onBack={onBack}
        onOpenSettings={() => setShowSettings(true)}
        onTriggerSummary={() => generateEnsembleSummary(chatId)}
      />

      {/* 消息滚动主区域 (唯一的 overflow-y-auto 轴) */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-2">
            <Sparkles className="w-8 h-8" />
            <p className="text-xs">羁绊大群已就绪，发送第一条消息开启剧情吧</p>
          </div>
        ) : (
          messages.map((msg) => (
            <EnsembleMessageItem
              key={msg.id}
              msg={msg}
              onQuote={(m) => setQuotedMessage(m)}
              onRegenerate={handleRegenerateMessage}
              onDelete={handleDeleteMessage}
              onSummonChar={(charId) => handleTriggerAi(charId)}
            />
          ))
        )}

        {/* AI 思考中指示 */}
        {isAiThinking && (
          <div className="flex items-center gap-2 my-2 px-3 py-1.5 rounded-full w-fit text-xs opacity-70 animate-pulse" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 角色正在推演剧情...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部单行悬浮 Dock 输入框与 User 视角胶囊 */}
      <div className="relative z-20 w-full p-2 border-t backdrop-blur-lg" style={{ borderColor: 'var(--divider)', backgroundColor: 'var(--modal-overlay)' }}>
        
        {/* 多 User 视角手柄胶囊 */}
        <EnsembleUserSelector
          userIdentities={userIdentities}
          currentIdentityId={currentIdentityId}
          onSelectIdentity={(id) => setCurrentIdentityId(id)}
          onAddTempIdentity={(newIdent) => setUserIdentities([...userIdentities, newIdent])}
        />

        {/* 正在引用条 */}
        {quotedMessage && (
          <div className="flex items-center justify-between px-3 py-1 mb-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
            <span className="truncate">引用 {quotedMessage.senderName}: {quotedMessage.content}</span>
            <button type="button" onClick={() => setQuotedMessage(null)} className="text-xs opacity-60">取消</button>
          </div>
        )}

        {/* 输入框主栏 (分化【发送消息】与【召唤 AI / 触发应答】) */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowStickerPicker(true)}
            className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95"
            style={{ color: 'var(--text-main)' }}
          >
            <Smile className="w-4 h-4" />
          </button>

          <label className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95 cursor-pointer" style={{ color: 'var(--text-main)' }}>
            <Image className="w-4 h-4" />
            <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
          </label>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入对话或动作描述..."
            className="flex-1 px-3 py-2 rounded-full text-xs border outline-none"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          />

          {/* 纯发送按钮 */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full transition-transform active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* 独立触发 AI 按钮 */}
          <button
            type="button"
            onClick={() => handleTriggerAi()}
            disabled={isAiThinking}
            title="触发 AI 多角色应答"
            className="p-2.5 rounded-full transition-transform active:scale-95 shadow-sm"
            style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* 弹窗等 */}
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

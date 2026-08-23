import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Sliders, Send, Sparkles, Smile, Image, BookOpen } from 'lucide-react';
import db from '../../db';
import { generateEnsembleAiResponse, generateEnsembleSummary } from './ensembleService';
import { EnsembleTypingIndicator } from './components/EnsembleTypingIndicator';
import { EnsembleMessageItem } from './components/EnsembleMessageItem';
import { EnsembleSettingsModal } from './components/EnsembleSettingsModal';
import StickerPickerModal from '../messages/components/StickerPickerModal';
import './ensemble.css';

export const EnsembleRoom = ({ chatId, onBack, onChatRoomStateChange }) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [typingState, setTypingState] = useState({ isTyping: false, characterName: '' });
  const [quotedMessage, setQuotedMessage] = useState(null);

  // User 身份
  const [userIdentities, setUserIdentities] = useState([]);
  const [currentIdentityId, setCurrentIdentityId] = useState('');

  // 弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDrawerInfo, setShowDrawerInfo] = useState(false);

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
    const msgs = await db.ensembleMessages.where('chatId').equals(chatId).sortBy('timestamp');
    const msgMap = new Map(msgs.map(m => [m.id, m]));
    const enriched = msgs.map(m => m.quotedMessageId ? { ...m, quotedMessage: msgMap.get(m.quotedMessageId) } : m);
    setMessages(enriched);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  // textarea 自动自增高 (最高 120px，超过后内部自滚动)
  const handleTextareaInput = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // 发送 User 消息
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setQuotedMessage(null);
    loadMessages();
  };

  // 触发 AI
  const handleTriggerAi = async (targetCharName = null) => {
    try {
      await generateEnsembleAiResponse(chatId, { targetCharacterName }, (status) => {
        setTypingState(status);
        scrollToBottom();
      });
      loadMessages();
    } catch (err) {
      console.error('AI 回复失败', err);
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
      metadata: { name: stickerObj.name || '表情包', url: stickerObj.url },
      timestamp: Date.now()
    });
    setShowStickerPicker(false);
    loadMessages();
  };

  if (!chat) return null;

  return (
    <div className="ensemble-room-container relative flex flex-col h-[100dvh] w-full overflow-hidden">
      {/* 透出背景 */}
      {chat.bgImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity"
          style={{ backgroundImage: `url(${chat.bgImage})`, opacity: chat.bgOpacity ?? 0.2 }}
        />
      )}

      {/* 彻底没有 Top Bar！顶部仅放置带独立底色的悬浮按钮 */}
      <div className="relative z-30 flex items-center justify-between p-3 pointer-events-auto">
        <button
          type="button"
          onClick={onBack}
          className="p-2.5 rounded-full shadow-md transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 居中浮动气泡按钮：点击查看场景档案 */}
        <button
          type="button"
          onClick={() => setShowDrawerInfo(!showDrawerInfo)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md text-xs font-semibold transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
        >
          <BookOpen className="w-3.5 h-3.5 opacity-70" />
          <span>{chat.title}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="p-2.5 rounded-full shadow-md transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* 展开的场景与概览浮层 */}
      {showDrawerInfo && (
        <div className="relative z-30 mx-3 p-3 rounded-2xl shadow-xl text-xs space-y-2 animate-fade-in" style={{ backgroundColor: 'var(--modal-bg)', border: '1px solid var(--modal-border)', color: 'var(--text-main)' }}>
          <p className="opacity-80 italic">{chat.scenePrompt || '未设定环境'}</p>
          <div className="flex justify-end border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={() => {
                generateEnsembleSummary(chatId, 'manual');
                setShowDrawerInfo(false);
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              <Sparkles className="w-3 h-3" />
              手动记录当前剧情总结
            </button>
          </div>
        </div>
      )}

      {/* 唯一滑动主轴 */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 py-2 thin-scrollbar">
        {messages.map((msg) => (
          <EnsembleMessageItem
            key={msg.id}
            msg={msg}
            onQuote={(m) => setQuotedMessage(m)}
            onRegenerate={async (m) => {
              await db.ensembleMessages.delete(m.id);
              handleTriggerAi(m.senderName);
            }}
            onDelete={async (id) => {
              await db.ensembleMessages.delete(id);
              loadMessages();
            }}
            onSummonChar={(charName) => handleTriggerAi(charName)}
          />
        ))}

        {/* 矢量打字指示器 */}
        {typingState.isTyping && <EnsembleTypingIndicator characterName={typingState.characterName} />}
        <div ref={messagesEndRef} />
      </div>

      {/* 悬浮 Dock 输入控制框 (与边缘保持距离，带独立滚动条) */}
      <div className="relative z-20 m-3 p-2.5 rounded-3xl shadow-xl space-y-2 backdrop-blur-md" style={{ backgroundColor: 'var(--modal-overlay)', border: '1px solid var(--modal-border)' }}>
        {/* User 视角选择胶囊 */}
        <div className="flex items-center gap-1 overflow-x-auto thin-scrollbar pb-1">
          {userIdentities.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setCurrentIdentityId(u.id)}
              className={`px-3 py-0.5 rounded-full text-[10px] transition-all shrink-0 ${currentIdentityId === u.id ? 'font-semibold shadow-sm' : 'opacity-60'}`}
              style={{
                backgroundColor: currentIdentityId === u.id ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                color: currentIdentityId === u.id ? 'var(--accent-foreground)' : 'var(--text-main)'
              }}
            >
              视角: {u.name}
            </button>
          ))}
        </div>

        {/* 悬浮单行 Dock 输入 */}
        <form onSubmit={handleSendMessage} className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => setShowStickerPicker(true)}
            className="p-2 rounded-full opacity-70 hover:opacity-100"
            style={{ color: 'var(--text-main)' }}
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* 可自动增高并滚动的 textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleTextareaInput}
            placeholder="撰写对话或描写..."
            className="flex-1 px-3 py-2 rounded-2xl text-xs outline-none resize-none thin-scrollbar"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)',
              maxHeight: '120px'
            }}
          />

          {/* 纯发送 */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full transition-transform active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* 独立 AI 触发 */}
          <button
            type="button"
            onClick={() => handleTriggerAi()}
            className="p-2.5 rounded-full transition-transform active:scale-95 shadow-sm"
            style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {showSettings && <EnsembleSettingsModal chatId={chatId} onClose={() => setShowSettings(false)} onUpdated={loadRoomData} />}
      {showStickerPicker && <StickerPickerModal onClose={() => setShowStickerPicker(false)} onSelectSticker={handleSelectSticker} />}
    </div>
  );
};

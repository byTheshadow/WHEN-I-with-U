import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Sliders, Send, Sparkles, Smile, Image as ImageIcon, Cat } from 'lucide-react';
import db from '../../db';
import { generateEnsembleAiResponse } from './ensembleService';
import { EnsembleUserSelector } from './components/EnsembleUserSelector';
import { EnsembleMessageItem } from './components/EnsembleMessageItem';
import { EnsembleSettingsModal } from './components/EnsembleSettingsModal';
import { EnsembleImagePromptModal } from './components/EnsembleImagePromptModal';
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

  // Modal 控制
  const [showSettings, setShowSettings] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);

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

  const handleInputTextChange = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

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

  // 发送表情包 (StickerCard 格式)
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

  // 发送 3D 图片叙事卡
  const handleSendImageNarrativeCard = async (cardData) => {
    const currentIdent = userIdentities.find(u => u.id === currentIdentityId) || userIdentities[0];
    await db.ensembleMessages.add({
      chatId,
      senderId: currentIdent.id,
      senderName: currentIdent.name,
      senderAvatar: currentIdent.avatar || '',
      senderType: 'user',
      type: 'image',
      content: cardData.content,
      metadata: cardData.metadata,
      timestamp: Date.now()
    });
    loadMessages();
  };

  if (!chat) return null;

  return (
    <div className="ensemble-container relative flex flex-col h-[100dvh] w-full overflow-hidden">
      {/* 背景透出遮罩 */}
      {chat.bgImage && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity duration-700"
          style={{ backgroundImage: `url(${chat.bgImage})`, opacity: chat.bgOpacity ?? 0.2 }}
        />
      )}

      {/* 无 Top Bar 浮动操控胶囊 */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto p-2.5 rounded-full shadow-md backdrop-blur-md transition-transform active:scale-95 border"
          style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

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

      {/* 消息透出主面板 */}
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

        {/* 打字指示器 */}
        {isAiThinking && (
          <div className="flex items-center gap-2 my-3 px-3 py-2 rounded-2xl w-fit text-xs backdrop-blur-md border shadow-sm animate-pulse" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
            <Cat className="w-3.5 h-3.5 animate-bounce" />
            <span>AI 角色正在交替推演演绎...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 悬浮 Dock 输入容器 */}
      <div className="relative z-20 w-full px-3 pb-3 pt-1">
        <EnsembleUserSelector
          userIdentities={userIdentities}
          currentIdentityId={currentIdentityId}
          onSelectIdentity={(id) => setCurrentIdentityId(id)}
          onAddTempIdentity={(newIdent) => setUserIdentities([...userIdentities, newIdent])}
          onUpdateIdentity={(id, updated) => setUserIdentities(userIdentities.map(u => u.id === id ? { ...u, ...updated } : u))}
        />

        {quotedMessage && (
          <div className="flex items-center justify-between px-3 py-1 mb-1.5 rounded-xl text-xs backdrop-blur-md border" style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)' }}>
            <span className="truncate opacity-80">引用 {quotedMessage.senderName}: {quotedMessage.content}</span>
            <button type="button" onClick={() => setQuotedMessage(null)} className="text-xs opacity-50">取消</button>
          </div>
        )}

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

          {/* 唤起图片叙事卡 Modal */}
          <button
            type="button"
            onClick={() => setShowImagePromptModal(true)}
            className="p-2 rounded-full opacity-70 hover:opacity-100 transition-transform active:scale-95 shrink-0"
            style={{ color: 'var(--text-main)' }}
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputTextChange}
            placeholder="输入对话或动作描述..."
            className="ensemble-textarea-scroll flex-1 px-3 py-1.5 text-xs outline-none bg-transparent resize-none max-h-32"
            style={{ color: 'var(--text-main)' }}
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full transition-transform active:scale-95 disabled:opacity-30 shrink-0 shadow-sm"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleTriggerAi()}
            disabled={isAiThinking}
            title="触发 AI 多角色应答"
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

      {showImagePromptModal && (
        <EnsembleImagePromptModal
          onClose={() => setShowImagePromptModal(false)}
          onSubmit={handleSendImageNarrativeCard}
        />
      )}
    </div>
  );
};

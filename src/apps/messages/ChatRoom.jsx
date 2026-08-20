import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, Sparkles, Image, Volume2, DollarSign,
  Trash2, Quote, CheckCheck, Check, Settings, User
} from 'lucide-react';
import db from '../../db';
import { triggerAiResponse, subscribeAiEvents } from '../../services/aiService';
import ChatHeaderBar from './components/ChatHeaderBar';
import TypingIndicator from './components/TypingIndicator';
import BubbleCustomizer from './components/BubbleCustomizer';
import ChatSettingsModal from './components/ChatSettingsModal';

import TextCard from './components/cards/TextCard';
import ImageCard from './components/cards/ImageCard';
import VoiceCard from './components/cards/VoiceCard';
import TransferCard from './components/cards/TransferCard';
import ArticleCard from './components/cards/ArticleCard';

export const ChatRoom = ({ chatId, onBack, onOpenCharacterEditor }) => {
  const [chat, setChat] = useState(null);
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedType, setSelectedType] = useState('text');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const [quotedMsg, setQuotedMsg] = useState(null);
  const [showBubbleCustomizer, setShowBubbleCustomizer] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [extraInputMeta, setExtraInputMeta] = useState({});

  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChatData();
    const unsubscribe = subscribeAiEvents((event) => {
      if (event.chatId === chatId) {
        if (event.type === 'AI_TYPING_START') setIsAiTyping(true);
        if (event.type === 'AI_TYPING_END') setIsAiTyping(false);
        if (event.type === 'NEW_MESSAGE' || event.type === 'CHAT_SUMMARY_UPDATED') {
          loadChatData();
        }
      }
    });
    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  const loadChatData = async () => {
    const chatRecord = await db.chats.get(chatId);
    if (!chatRecord) return;
    setChat(chatRecord);

    const charRecord = await db.characters.get(chatRecord.characterId);
    if (charRecord) setCharacter(charRecord);

    const msgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
    setMessages(msgs);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content: inputText.trim() || (selectedType === 'image' ? '看我发给你的这张图片' : '心意转账'),
      metadata: extraInputMeta,
      quotedMessageId: quotedMsg?.id || null,
      isRead: true,
      timestamp: new Date().toISOString()
    };

    const msgId = await db.messages.add(newMsg);
    newMsg.id = msgId;
    setMessages((prev) => [...prev, newMsg]);

    setInputText('');
    setQuotedMsg(null);
    setSelectedType('text');
    setExtraInputMeta({});
    await db.chats.update(chatId, { updatedAt: new Date().toISOString() });
  };

  const handleTriggerAi = () => {
    if (!character || isAiTyping) return;
    // 异步交由后台 AI 服务处理，不受页面切出中断影响
    triggerAiResponse(chatId);
  };

  const handleDeleteMessage = async (id) => {
    await db.messages.delete(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearHistory = async () => {
    await db.messages.where('chatId').equals(chatId).delete();
    setMessages([]);
  };

  const handleSaveCustomCss = async (cssCode) => {
    const updated = { ...chat, customCss: cssCode };
    setChat(updated);
    await db.chats.update(chatId, { customCss: cssCode });
  };

  const handleUpdateBgImage = async (base64Img) => {
    const updated = { ...chat, bgImage: base64Img };
    setChat(updated);
    await db.chats.update(chatId, { bgImage: base64Img });
  };

  const handleUpdateBgOpacity = async (opacity) => {
    const updated = { ...chat, bgOpacity: opacity };
    setChat(updated);
    await db.chats.update(chatId, { bgOpacity: opacity });
  };

  const handleToggleKeepAlive = async (keepAliveVal) => {
    const updated = { ...chat, keepAlive: keepAliveVal };
    setChat(updated);
    await db.chats.update(chatId, { keepAlive: keepAliveVal });
  };

  const handleSaveSummary = async (newSummary) => {
    const updated = { ...chat, summary: newSummary };
    setChat(updated);
    await db.chats.update(chatId, { summary: newSummary });
  };

  if (!chat || !character) return null;

  const defaultCss = `
  .user-bubble {
    background: var(--accent-color);
    color: var(--accent-foreground);
    border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
  }
  .ai-bubble {
    background: var(--control-soft-bg);
    color: var(--text-main);
    border: 1px solid var(--card-border);
    border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
  }
  .chat-font {
    font-size: 0.75rem;
    line-height: 1.5;
  }`;

  const currentCss = chat.customCss || defaultCss;

  return (
    <div className="chat-room-container relative flex flex-col h-[94vh] text-xs text-left animate-fade-in-up">
      <style>{`
        .chat-room-container ${currentCss}
      `}</style>

      {chat.bgImage && (
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl transition-all duration-500 overflow-hidden -z-10"
          style={{
            backgroundImage: `url(${chat.bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: chat.bgOpacity ?? 0.3
          }}
        />
      )}

      {/* 顶栏 */}
      <div className="flex items-center justify-between pb-1 px-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 font-semibold opacity-70 hover:opacity-100 transition-opacity text-xs"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </button>

        <button
          type="button"
          onClick={() => setShowChatSettings(true)}
          className="p-1.5 rounded-full opacity-70 hover:opacity-100 transition-all"
          style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          title="对话空间设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <ChatHeaderBar
        character={character}
        chat={chat}
        onOpenSettings={onOpenCharacterEditor}
        onSaveSummary={handleSaveSummary}
      />

      {/* 消息对话流 */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-1 no-scrollbar">
        {messages.length === 0 && (
          <div className="py-16 text-center space-y-2 opacity-40">
            <p className="font-serif italic text-xs">此刻停在这里，等待你们的对话...</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const quoted = msg.quotedMessageId ? messages.find((m) => m.id === msg.quotedMessageId) : null;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}>
              {quoted && (
                <div 
                  className="px-3 py-1 rounded-xl border-l-2 opacity-60 text-[10px] max-w-[75%] mb-1"
                  style={{
                    background: 'var(--control-soft-bg)',
                    borderColor: 'var(--text-main)'
                  }}
                >
                  <span className="font-bold block">{quoted.sender === 'user' ? '你' : character.name}</span>
                  <p className="truncate">{quoted.content}</p>
                </div>
              )}

              <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isUser ? (
                  character.avatar ? (
                    <img src={character.avatar} alt={character.name} className="w-7 h-7 rounded-full object-cover shrink-0 shadow-sm border border-white/20" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {character.name?.[0]}
                    </div>
                  )
                ) : (
                  character.userAvatar ? (
                    <img src={character.userAvatar} alt="You" className="w-7 h-7 rounded-full object-cover shrink-0 shadow-sm border border-white/20" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[10px] shrink-0">
                      <User className="w-3.5 h-3.5 opacity-60" />
                    </div>
                  )
                )}

                <div className={`p-3 shadow-sm relative transition-all chat-font ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                  {msg.type === 'text' && <TextCard content={msg.content} />}
                  {msg.type === 'image' && <ImageCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'voice' && <VoiceCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'transfer' && <TransferCard content={msg.content} metadata={msg.metadata} sender={msg.sender} />}
                  {msg.type === 'article' && <ArticleCard content={msg.content} metadata={msg.metadata} />}
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                  <button type="button" onClick={() => setQuotedMsg(msg)} className="p-1 opacity-50 hover:opacity-100" title="引用">
                    <Quote className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => handleDeleteMessage(msg.id)} className="p-1 opacity-50 hover:opacity-100 text-rose-500" title="抹去">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* IG 风格对齐时间戳 */}
              <div className={`flex items-center gap-1 text-[9px] opacity-40 font-mono mt-1 px-9 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isUser ? (
                  <CheckCheck className="w-3 h-3 text-blue-500 opacity-80" />
                ) : (
                  <Check className="w-3 h-3 opacity-60" />
                )}
              </div>
            </div>
          );
        })}

        {isAiTyping && <TypingIndicator customText={chat.typingText || `${character.name} 正在提笔回复...`} />}
        <div ref={messagesEndRef} />
      </div>

      {quotedMsg && (
        <div 
          className="flex items-center justify-between p-2 rounded-xl border-l-2 text-[10px] mb-1.5 shadow-sm"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--accent-color)'
          }}
        >
          <div className="truncate pr-2">
            <span className="font-bold">引用 {quotedMsg.sender === 'user' ? '你' : character.name}:</span> {quotedMsg.content}
          </div>
          <button type="button" onClick={() => setQuotedMsg(null)} className="p-1 opacity-60 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {selectedType !== 'text' && (
        <div className="p-2.5 rounded-2xl border mb-2 space-y-2 text-[11px]" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
            <span>MODIFIER: {selectedType.toUpperCase()}</span>
            <button type="button" onClick={() => setSelectedType('text')}>&times;</button>
          </div>
          {selectedType === 'image' && (
            <input
              type="text"
              placeholder="输入图片的视觉描写细节..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full rounded p-1.5 outline-none"
              style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
            />
          )}
          {selectedType === 'transfer' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="转账数字 (如 520.00)"
                onChange={(e) => setExtraInputMeta({ ...extraInputMeta, amount: e.target.value })}
                className="w-1/2 rounded p-1.5 outline-none font-mono"
                style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
              <input
                type="text"
                placeholder="心意留言"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-1/2 rounded p-1.5 outline-none"
                style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* 底部输入框 */}
      <div className="py-1">
        <div 
          className="flex items-center gap-1.5 p-2 rounded-full border backdrop-blur-2xl shadow-xl transition-all duration-300 focus-within:ring-2 focus-within:ring-black/10 dark:focus-within:ring-white/20"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="flex items-center gap-1 border-r pr-1.5 opacity-70" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={() => setSelectedType('image')}
              className={`p-1.5 rounded-full transition-transform active:scale-90 ${selectedType === 'image' ? 'bg-black/10 dark:bg-white/20 font-bold' : ''}`}
              title="画面描述"
            >
              <Image className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('voice')}
              className={`p-1.5 rounded-full transition-transform active:scale-90 ${selectedType === 'voice' ? 'bg-black/10 dark:bg-white/20 font-bold' : ''}`}
              title="模拟语音"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('transfer')}
              className={`p-1.5 rounded-full transition-transform active:scale-90 ${selectedType === 'transfer' ? 'bg-black/10 dark:bg-white/20 font-bold' : ''}`}
              title="心意转账"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder={selectedType === 'text' ? `与 ${character.name} 倾诉...` : `已选 ${selectedType} 模式`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-transparent px-2 outline-none font-sans text-xs"
            style={{ color: 'var(--text-main)' }}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSendMessage}
              className="p-2 rounded-full transition-transform active:scale-90 hover:opacity-90"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)'
              }}
              title="发送记录"
            >
              <Send className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleTriggerAi}
              disabled={isAiTyping}
              className="px-3 py-2 rounded-full font-semibold text-[10px] flex items-center gap-1 transition-transform active:scale-95 disabled:opacity-50 shadow-sm"
              style={{
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
              title="触发伴侣回应"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>回应</span>
            </button>
          </div>
        </div>
      </div>

      {showBubbleCustomizer && (
        <BubbleCustomizer
          currentCss={currentCss}
          onSave={handleSaveCustomCss}
          onClose={() => setShowBubbleCustomizer(false)}
        />
      )}

      {showChatSettings && (
        <ChatSettingsModal
          chat={chat}
          onClose={() => setShowChatSettings(false)}
          onUpdateBgImage={handleUpdateBgImage}
          onUpdateBgOpacity={handleUpdateBgOpacity}
          onToggleKeepAlive={handleToggleKeepAlive}
          onOpenBubbleCustomizer={() => setShowBubbleCustomizer(true)}
          onClearHistory={handleClearHistory}
          onDeletedChat={onBack}
          onSaveSummary={handleSaveSummary}
        />
      )}
    </div>
  );
};

export default ChatRoom;

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, Sparkles, Image, Volume2, DollarSign,
  Trash2, Quote, CheckCheck, Sliders, Settings
} from 'lucide-react';
import db from '../../db';
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

  // 用户发送消息
  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content: inputText.trim() || (selectedType === 'image' ? '看我发给你的这张图片' : '语音消息'),
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

  // 触发 AI 回复 (Trigger AI)
  const handleTriggerAi = async () => {
    if (!character || isAiTyping) return;
    setIsAiTyping(true);

    try {
      const apiSettings = await db.settings.get('apiConfig');
      const apiConfig = apiSettings?.value || {};

      let aiContent = `${character.name} 关注到了你的心绪，并温和地给予了回应。`;

      if (apiConfig.baseUrl && apiConfig.apiKey) {
        const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
        const historyContext = messages.slice(-15).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
 model: apiConfig.model || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: `${character.bio}\n${character.extraNotes}` },
              ...historyContext
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          aiContent = data.choices?.[0]?.message?.content || aiContent;
        }
      }

      const aiMsg = {
        chatId,
        characterId: character.id,
        sender: 'character',
        type: 'text',
        content: aiContent,
        metadata: {},
        isRead: true,
        timestamp: new Date().toISOString()
      };

      const msgId = await db.messages.add(aiMsg);
      aiMsg.id = msgId;
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI Response failed:', err);
    } finally {
      setIsAiTyping(false);
    }
  };

  // 删除单条消息
  const handleDeleteMessage = async (id) => {
    await db.messages.delete(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // 清空聊天记录
  const handleClearHistory = async () => {
    await db.messages.where('chatId').equals(chatId).delete();
    setMessages([]);
  };

  // 更新自定义 CSS 气泡
  const handleSaveCustomCss = async (cssCode) => {
    const updated = { ...chat, customCss: cssCode };
    setChat(updated);
    await db.chats.update(chatId, { customCss: cssCode });
  };

  // 更新背景图
  const handleUpdateBgImage = async (base64Img) => {
    const updated = { ...chat, bgImage: base64Img };
    setChat(updated);
    await db.chats.update(chatId, { bgImage: base64Img });
  };

  // 更新背景透明度
  const handleUpdateBgOpacity = async (opacity) => {
    const updated = { ...chat, bgOpacity: opacity };
    setChat(updated);
    await db.chats.update(chatId, { bgOpacity: opacity });
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
    border: 1px solid var(--divider);
    border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
  }
  .chat-font {
    font-size: 0.75rem;
    line-height: 1.5;
  }`;

  const currentCss = chat.customCss || defaultCss;

  return (
    <div className="chat-room-container relative flex flex-col h-[88vh] text-xs text-left animate-fade-in-up">
      {/* 注入局域气泡 CSS */}
      <style>{`
        .chat-room-container ${currentCss}
      `}</style>

      {/* 专属自定义背景图渲染层 */}
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

      {/* 1. 沉浸式 Top Header */}
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 font-semibold opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowChatSettings(true)}
            className="p-1.5 rounded-full opacity-70 hover:opacity-100 transition-all"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
            title="聊天空间设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 解耦状态栏件 */}
      <ChatHeaderBar character={character} chat={chat} onOpenSettings={onOpenCharacterEditor} />

      {/* 2. 消息对话流 */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1 no-scrollbar">
        {messages.length === 0 && (
          <div className="py-16 text-center space-y-2 opacity-50">
            <p className="font-serif italic text-sm">风停在这里，等待你们的第一次对话...</p>
            <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>
              向 {character.name} 倾诉此刻的心绪
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const quoted = msg.quotedMessageId ? messages.find((m) => m.id === msg.quotedMessageId) : null;

          return (
            <div key={msg.id} className={`flex flex-col space-y-1 group ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1 text-[9px] opacity-40 font-mono px-1">
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isUser && <CheckCheck className="w-3 h-3 text-blue-500 opacity-80" />}
              </div>

              {quoted && (
                <div 
                  className="px-3 py-1.5 rounded-xl border-l-2 opacity-70 text-[10px] max-w-[80%]"
                  style={{
                    background: 'var(--control-soft-bg)',
                    borderColor: 'var(--text-main)'
                  }}
                >
                  <span className="font-bold block">{quoted.sender === 'user' ? '你' : character.name}</span>
                  <p className="truncate">{quoted.content}</p>
                </div>
              )}

              <div className="flex items-end gap-2 max-w-[88%]">
                {!isUser && character.avatar && (
                  <img src={character.avatar} alt={character.name} className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 shadow-sm border border-white/20" />
                )}

                <div className={`p-3.5 shadow-sm relative transition-all chat-font ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                  {msg.type === 'text' && <TextCard content={msg.content} />}
                  {msg.type === 'image' && <ImageCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'voice' && <VoiceCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'transfer' && <TransferCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'article' && <ArticleCard content={msg.content} metadata={msg.metadata} />}
                </div>

                {/* 快捷悬浮按钮 */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                  <button type="button" onClick={() => setQuotedMsg(msg)} className="p-1 opacity-50 hover:opacity-100" title="引用">
                    <Quote className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => handleDeleteMessage(msg.id)} className="p-1 opacity-50 hover:opacity-100 text-rose-500" title="抹去">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isAiTyping && <TypingIndicator customText={chat.typingText || `${character.name} 正在提笔回复...`} />}
        <div ref={messagesEndRef} />
      </div>

      {/* 引用回复提示框 */}
      {quotedMsg && (
        <div 
          className="flex items-center justify-between p-2 rounded-xl border-l-2 text-[10px] mb-2 shadow-sm"
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

      {/* 3. 悬浮输入框与微动效 */}
      <div className="space-y-1.5 pt-1">
        <div 
          className="flex items-center gap-1.5 p-2 rounded-3xl border backdrop-blur-xl shadow-lg transition-all duration-300 hover:shadow-xl focus-within:ring-2 focus-within:ring-black/10 dark:focus-within:ring-white/20"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          {/* 特殊扩展类型 */}
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
              title="浪漫转账"
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

          {/* 双发送按钮 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSendMessage}
              className="p-2 rounded-full transition-transform active:scale-90 hover:opacity-90"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)'
              }}
              title="发送记录 (不触发AI)"
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

        <div className="flex items-center justify-end px-3 text-[9px] opacity-40 font-mono">
          <span>心事尽数封存于此</span>
        </div>
      </div>

      {/* 弹窗：气泡 CSS 自定义 */}
      {showBubbleCustomizer && (
        <BubbleCustomizer
          currentCss={currentCss}
          onSave={handleSaveCustomCss}
          onClose={() => setShowBubbleCustomizer(false)}
        />
      )}

      {/* 弹窗：聊天室专属设置 Modal */}
      {showChatSettings && (
        <ChatSettingsModal
          chat={chat}
          onClose={() => setShowChatSettings(false)}
          onUpdateBgImage={handleUpdateBgImage}
          onUpdateBgOpacity={handleUpdateBgOpacity}
          onOpenBubbleCustomizer={() => setShowBubbleCustomizer(true)}
          onClearHistory={handleClearHistory}
        />
      )}
    </div>
  );
};

export default ChatRoom;

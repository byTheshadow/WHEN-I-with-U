import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Image,
  Volume2,
  DollarSign,
  Trash2,
  Quote,
  CheckCheck,
  Check,
  Settings,
  User,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import db from '../../db';
import { triggerAiResponse, rerollAiResponse, subscribeAiEvents } from '../../services/aiService';
import ChatHeaderBar from './components/ChatHeaderBar';
import TypingIndicator from './components/TypingIndicator';
import BubbleCustomizer from './components/BubbleCustomizer';
import ChatSettingsModal from './components/ChatSettingsModal';

import TextCard from './components/cards/TextCard';
import ImageCard from './components/cards/ImageCard';
import VoiceCard from './components/cards/VoiceCard';
import TransferCard from './components/cards/TransferCard';
import ArticleCard from './components/cards/ArticleCard';

export const ChatRoom = ({
  chatId,
  onBack,
  onOpenCharacterEditor,
  onRoomStateChange
}) => {
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

  const scrollAreaRef = useRef(null);

  useEffect(() => {
    onRoomStateChange?.(true);
    return () => onRoomStateChange?.(false);
  }, [onRoomStateChange]);

  useEffect(() => {
    loadChatData();

    const unsubscribe = subscribeAiEvents((event) => {
      if (event.chatId !== chatId) return;
      if (event.type === 'AI_TYPING_START') setIsAiTyping(true);
      if (event.type === 'AI_TYPING_END') setIsAiTyping(false);
      if (event.type === 'NEW_MESSAGE' || event.type === 'CHAT_SUMMARY_UPDATED') {
        loadChatData();
      }
    });

    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const frameId = window.requestAnimationFrame(() => {
      scrollArea.scrollTo({
        top: scrollArea.scrollHeight,
        behavior: 'smooth'
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [messages, isAiTyping]);

  const loadChatData = async () => {
    const chatRecord = await db.chats.get(chatId);
    if (!chatRecord) return;
    setChat(chatRecord);

    const charRecord = await db.characters.get(chatRecord.characterId);
    if (charRecord) setCharacter(charRecord);

    const msgList = await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    setMessages(msgList);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const userAvatar = chat?.userAvatar || character?.userAvatar || '';
    const userName = chat?.userName || character?.userName || '你';

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content: inputText.trim() || (selectedType === 'image' ? '画面描述' : '心意转账'),
      metadata: extraInputMeta,
      userAvatar,
      userName,
      quotedMessageId: quotedMsg?.id || null,
      isRead: true,
      timestamp: new Date().toISOString()
    };

    const payload = { ...newMsg };
    delete payload.id;

    const msgId = await db.messages.add(payload);
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
    triggerAiResponse(chatId);
  };

  const handleRerollMessage = (msgId) => {
    if (isAiTyping) return;
    rerollAiResponse(chatId, msgId);
  };

  const handleSwitchVersion = async (msg, direction) => {
    if (!msg.versions || msg.versions.length <= 1) return;
    const currentIndex = msg.currentVersionIndex ?? (msg.versions.length - 1);
    let nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= msg.versions.length) return;

    const targetVer = msg.versions[nextIndex];
    await db.messages.update(msg.id, {
      currentVersionIndex: nextIndex,
      type: targetVer.type,
      content: targetVer.content,
      metadata: targetVer.metadata || {}
    });

    loadChatData();
  };

  const handleDeleteMessage = async (id) => {
    await db.messages.delete(id);
    setMessages((previous) => previous.filter((message) => message.id !== id));
  };

  const handleClearHistory = async () => {
    await db.messages.where('chatId').equals(chatId).delete();
    setMessages([]);
  };

  const handleSaveCustomCss = async (cssCode) => {
    setChat((prev) => ({ ...prev, customCss: cssCode }));
    await db.chats.update(chatId, { customCss: cssCode });
  };

  const handleUpdateBgImage = async (base64Img) => {
    setChat((prev) => ({ ...prev, bgImage: base64Img }));
    await db.chats.update(chatId, { bgImage: base64Img });
  };

  const handleUpdateBgOpacity = async (opacity) => {
    setChat((prev) => ({ ...prev, bgOpacity: opacity }));
    await db.chats.update(chatId, { bgOpacity: opacity });
  };

  const handleToggleKeepAlive = async (val) => {
    setChat((prev) => ({ ...prev, keepAlive: val }));
    await db.chats.update(chatId, { keepAlive: val });
  };

  const handleSaveSummary = async (newSummary) => {
    setChat((prev) => ({ ...prev, summary: newSummary }));
    await db.chats.update(chatId, { summary: newSummary });
  };

  const defaultCss = useMemo(() => `
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
    }
  `, []);

  if (!chat || !character) return null;

  const currentCss = chat.customCss || defaultCss;

  // 当前聊天窗独享的 User 头像与昵称
  const activeUserAvatar = chat.userAvatar || character.userAvatar || '';
  const activeUserName = chat.userName || character.userName || '你';

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)'
      }}
    >
      <style>{`.chat-room-container ${currentCss}`}</style>

      {chat.bgImage && (
  <div
    className="absolute inset-0 -z-10 pointer-events-none"
    style={{
      backgroundImage: `url(${chat.bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}
  />
)}


      {/* 顶部按钮控制区：彻底没有横线 border-b */}
      <header className="z-20 shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold opacity-85 hover:opacity-100 transition-opacity"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)'
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回列表</span>
          </button>

          <button
            type="button"
            onClick={() => setShowChatSettings(true)}
            className="rounded-full p-2 opacity-85 hover:opacity-100 transition-opacity"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)'
            }}
            title="对话空间设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <ChatHeaderBar
          character={character}
          chat={chat}
          onOpenSettings={onOpenCharacterEditor}
          onSaveSummary={handleSaveSummary}
        />
      </header>

      {/* 消息历史滚动容器 */}
      <section
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar"
      >
        <div className="space-y-4 pb-2">
          {messages.length === 0 && (
            <div className="space-y-2 py-16 text-center opacity-40">
              <p className="font-serif text-xs italic">
                此刻停在这里，等待你们的对话...
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const versions = msg.versions || [];
            const versionIndex = msg.currentVersionIndex ?? (versions.length > 1 ? versions.length - 1 : 0);
            const isErrorMsg = msg.type === 'error' || msg.metadata?.errorCode;

            const quoted = msg.quotedMessageId
              ? messages.find((m) => m.id === msg.quotedMessageId)
              : null;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* 彻底去除气泡上方的名字展示，保持极简纯净 */}

                {quoted && (
                  <div
                    className="mb-1 max-w-[75%] rounded-xl border-l-2 px-3 py-1 text-[10px] opacity-60"
                    style={{
                      background: 'var(--control-soft-bg)',
                      borderColor: 'var(--divider)'
                    }}
                  >
                    <span className="block font-bold">
                      {quoted.sender === 'user' ? activeUserName : character.name}
                    </span>
                    <p className="truncate">{quoted.content}</p>
                  </div>
                )}

                <div
                  className={`flex max-w-[85%] items-end gap-2 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* 头像渲染 */}
                  {!isUser ? (
                    character.avatar ? (
                      <img
                        src={character.avatar}
                        alt={character.name}
                        className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
                        style={{ borderColor: 'var(--card-border)' }}
                      />
                    ) : (
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'var(--control-soft-bg)' }}
                      >
                        {character.name?.[0]}
                      </div>
                    )
                  ) : activeUserAvatar ? (
                    <img
                      src={activeUserAvatar}
                      alt={activeUserName}
                      className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
                      style={{ borderColor: 'var(--card-border)' }}
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: 'var(--control-soft-bg)' }}
                    >
                      <User className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )}

                  {/* 消息气泡正文 */}
                  <div className="flex flex-col gap-1">
                    {isErrorMsg ? (
                      <div
                        className="p-3 rounded-2xl border shadow-sm space-y-2 chat-font"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          color: 'var(--text-main)'
                        }}
                      >
                        <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-red-500">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>API 报错: {msg.metadata?.errorCode || 'ERROR'}</span>
                        </div>
                        <p className="text-[11px] opacity-90">{msg.content}</p>
                        <button
                          type="button"
                          onClick={() => handleRerollMessage(msg.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>重新尝试 (Re-roll)</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`relative p-3 shadow-sm transition-all chat-font ${
                          isUser ? 'user-bubble' : 'ai-bubble'
                        }`}
                      >
                        {msg.type === 'text' && <TextCard content={msg.content} />}
                        {msg.type === 'image' && <ImageCard content={msg.content} metadata={msg.metadata} />}
                        {msg.type === 'voice' && <VoiceCard content={msg.content} metadata={msg.metadata} />}
                        {msg.type === 'transfer' && <TransferCard content={msg.content} metadata={msg.metadata} sender={msg.sender} />}
                        {msg.type === 'article' && <ArticleCard content={msg.content} metadata={msg.metadata} />}
                      </div>
                    )}
                  </div>

                  {/* 悬浮工具与重roll */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleRerollMessage(msg.id)}
                        disabled={isAiTyping}
                        className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                        title="重roll此回复"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setQuotedMsg(msg)}
                      className="p-1 opacity-50 hover:opacity-100"
                      title="引用"
                    >
                      <Quote className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1 opacity-50 hover:opacity-100"
                      title="抹去"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* 多版本切换与时间戳 */}
                <div
                  className={`mt-1 flex items-center gap-2 px-9 font-mono text-[9px] opacity-60 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {versions.length > 1 && (
                    <div
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 border"
                      style={{
                        background: 'var(--control-soft-bg)',
                        borderColor: 'var(--card-border)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchVersion(msg, 'prev')}
                        disabled={versionIndex === 0}
                        className="p-0.5 disabled:opacity-20 hover:opacity-100"
                        title="上一版本"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span className="px-1 text-[9px] font-bold">
                        {versionIndex + 1} / {versions.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSwitchVersion(msg, 'next')}
                        disabled={versionIndex === versions.length - 1}
                        className="p-0.5 disabled:opacity-20 hover:opacity-100"
                        title="下一版本"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>

                  {isUser ? (
                    <CheckCheck className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <Check className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
              </div>
            );
          })}

          {isAiTyping && (
            <TypingIndicator
              customText={chat.typingText || `${character.name} 正在提笔回复...`}
            />
          )}
        </div>
      </section>

      {/* 悬浮输入框区：无任何线条 border-t ，柔和悬浮胶囊风 */}
      <footer
        className="z-20 shrink-0 px-4 pt-1"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
        }}
      >
        {quotedMsg && (
          <div
            className="mb-2 flex items-center justify-between rounded-2xl p-2 px-3 text-[10px] shadow-md"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)'
            }}
          >
            <div className="truncate pr-2">
              <span className="font-bold">
                引用 {quotedMsg.sender === 'user' ? activeUserName : character.name}:
              </span>{' '}
              {quotedMsg.content}
            </div>

            <button
              type="button"
              onClick={() => setQuotedMsg(null)}
              className="p-1 opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        {selectedType !== 'text' && (
          <div
            className="mb-2 space-y-2 rounded-2xl p-3 text-[11px] shadow-md"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
              <span>MODIFIER: {selectedType.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => setSelectedType('text')}
              >
                &times;
              </button>
            </div>

            {selectedType === 'image' && (
              <input
                type="text"
                placeholder="输入图片的视觉描写细节..."
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                className="w-full rounded-xl p-2 outline-none"
                style={{
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)'
                }}
              />
            )}

            {selectedType === 'transfer' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="转账数字"
                  onChange={(event) => {
                    setExtraInputMeta({
                      ...extraInputMeta,
                      amount: event.target.value
                    });
                  }}
                  className="w-1/2 rounded-xl p-2 font-mono outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />

                <input
                  type="text"
                  placeholder="心意留言"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-1/2 rounded-xl p-2 outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* 极致柔和的悬浮输入胶囊，无任何 border */}
        <div
          className="flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl transition-all duration-300"
          style={{
            background: 'var(--card-bg-gradient)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)'
          }}
        >
          <div className="flex items-center gap-1 opacity-80">
            <button
              type="button"
              onClick={() => setSelectedType('image')}
              className={`rounded-full p-2 transition-all active:scale-90 ${selectedType === 'image' ? 'bg-[var(--control-soft-bg)] opacity-100' : 'hover:opacity-100'}`}
              title="画面描述"
            >
              <Image className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('voice')}
              className={`rounded-full p-2 transition-all active:scale-90 ${selectedType === 'voice' ? 'bg-[var(--control-soft-bg)] opacity-100' : 'hover:opacity-100'}`}
              title="模拟语音"
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('transfer')}
              className={`rounded-full p-2 transition-all active:scale-90 ${selectedType === 'transfer' ? 'bg-[var(--control-soft-bg)] opacity-100' : 'hover:opacity-100'}`}
              title="心意转账"
            >
              <DollarSign className="h-4 w-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder={
              selectedType === 'text'
                ? (chat.inputPlaceholder || `与 ${character.name} 倾诉...`)
                : `已选 ${selectedType} 模式`
            }
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                handleSendMessage();
              }
            }}
            className="min-w-0 flex-1 bg-transparent px-2 font-sans text-xs outline-none"
            style={{ color: 'var(--text-main)' }}
          />

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleSendMessage}
              className="rounded-full p-2 transition-transform hover:opacity-90 active:scale-90"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)'
              }}
              title="发送记录"
            >
              <Send className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleTriggerAi}
              disabled={isAiTyping}
              className="flex items-center gap-1 rounded-full px-3.5 py-2 text-[10px] font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              style={{
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
              title="触发伴侣回应"
            >
              <Sparkles className="h-3 w-3" />
              <span>回应</span>
            </button>
          </div>
        </div>
      </footer>

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
          character={character}
          onClose={() => setShowChatSettings(false)}
          onUpdateBgImage={handleUpdateBgImage}
          onUpdateBgOpacity={handleUpdateBgOpacity}
          onToggleKeepAlive={handleToggleKeepAlive}
          onOpenBubbleCustomizer={() => setShowBubbleCustomizer(true)}
          onClearHistory={handleClearHistory}
          onDeletedChat={onBack}
          onSaveSummary={handleSaveSummary}
          onUpdatedUserPersona={loadChatData}
        />
      )}
    </div>
  );
};

export default ChatRoom;


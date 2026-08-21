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
  User
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

    return () => {
      onRoomStateChange?.(false);
    };
  }, [onRoomStateChange]);

  useEffect(() => {
    loadChatData();

    const unsubscribe = subscribeAiEvents((event) => {
      if (event.chatId !== chatId) return;

      if (event.type === 'AI_TYPING_START') {
        setIsAiTyping(true);
      }

      if (event.type === 'AI_TYPING_END') {
        setIsAiTyping(false);
      }

      if (event.type === 'NEW_MESSAGE' || event.type === 'CHAT_SUMMARY_UPDATED') {
        loadChatData();
      }
    });

    return unsubscribe;
  }, [chatId]);

  /*
    这里绝不能使用 scrollIntoView。
    scrollIntoView 会把 body、main 等祖先容器一起滚动，
    于是顶部返回区和底部输入区都会被带走。

    只操作聊天记录的独立滚动容器，顶部和底部永远不会移动。
  */
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

    if (charRecord) {
      setCharacter(charRecord);
    }

    const msgList = await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    setMessages(msgList);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content:
        inputText.trim()
        || (selectedType === 'image'
          ? '看我发给你的这张图片'
          : '心意转账'),
      metadata: extraInputMeta,
      quotedMessageId: quotedMsg?.id || null,
      isRead: true,
      timestamp: new Date().toISOString()
    };

    const payload = { ...newMsg };
    delete payload.id;

    const msgId = await db.messages.add(payload);

    newMsg.id = msgId;

    setMessages((previous) => [...previous, newMsg]);
    setInputText('');
    setQuotedMsg(null);
    setSelectedType('text');
    setExtraInputMeta({});

    await db.chats.update(chatId, {
      updatedAt: new Date().toISOString()
    });
  };

  const handleTriggerAi = () => {
    if (!character || isAiTyping) return;
    triggerAiResponse(chatId);
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

  const handleToggleKeepAlive = async (keepAliveValue) => {
    const updated = { ...chat, keepAlive: keepAliveValue };
    setChat(updated);
    await db.chats.update(chatId, { keepAlive: keepAliveValue });
  };

  const handleSaveSummary = async (newSummary) => {
    const updated = { ...chat, summary: newSummary };
    setChat(updated);
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

  return (
    <div
      className="chat-room-container relative flex h-full min-h-0 flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)',
        paddingLeft: '1rem',
        paddingRight: '1rem'
      }}
    >
      <style>{`
        .chat-room-container ${currentCss}
      `}</style>

      {chat.bgImage && (
        <div
          className="absolute inset-0 -z-10 pointer-events-none overflow-hidden transition-all duration-500"
          style={{
            backgroundImage: `url(${chat.bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: chat.bgOpacity ?? 0.3
          }}
        />
      )}

      {/* 固定顶部区域：不参与聊天记录滚动 */}
      <header className="z-20 shrink-0">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold opacity-75 transition-opacity hover:opacity-100"
            style={{ color: 'var(--text-main)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </button>

          <button
            type="button"
            onClick={() => setShowChatSettings(true)}
            className="rounded-full p-1.5 opacity-75 transition-all hover:opacity-100"
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

      {/* 唯一可滚动区域：仅聊天记录在这里滚动 */}
      <section
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-3 no-scrollbar"
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

            const quoted = msg.quotedMessageId
              ? messages.find((message) => message.id === msg.quotedMessageId)
              : null;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                {quoted && (
                  <div
                    className="mb-1 max-w-[75%] rounded-xl border-l-2 px-3 py-1 text-[10px] opacity-60"
                    style={{
                      background: 'var(--control-soft-bg)',
                      borderColor: 'var(--divider)'
                    }}
                  >
                    <span className="block font-bold">
                      {quoted.sender === 'user' ? '你' : character.name}
                    </span>
                    <p className="truncate">{quoted.content}</p>
                  </div>
                )}

                <div
                  className={`flex max-w-[85%] items-end gap-2 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
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
                  ) : character.userAvatar ? (
                    <img
                      src={character.userAvatar}
                      alt="You"
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

                  <div
                    className={`relative p-3 shadow-sm transition-all chat-font ${
                      isUser ? 'user-bubble' : 'ai-bubble'
                    }`}
                  >
                    {msg.type === 'text' && <TextCard content={msg.content} />}
                    {msg.type === 'image' && (
                      <ImageCard content={msg.content} metadata={msg.metadata} />
                    )}
                    {msg.type === 'voice' && (
                      <VoiceCard content={msg.content} metadata={msg.metadata} />
                    )}
                    {msg.type === 'transfer' && (
                      <TransferCard
                        content={msg.content}
                        metadata={msg.metadata}
                        sender={msg.sender}
                      />
                    )}
                    {msg.type === 'article' && (
                      <ArticleCard content={msg.content} metadata={msg.metadata} />
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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

                <div
                  className={`mt-1 flex items-center gap-1 px-9 font-mono text-[9px] opacity-40 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>

                  {isUser ? (
                    <CheckCheck
                      className="h-3 w-3"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  ) : (
                    <Check
                      className="h-3 w-3"
                      style={{ color: 'var(--text-muted)' }}
                    />
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

      {/* 固定底部区域：引用、扩展输入、悬浮输入框均不会随记录移动 */}
      <footer className="z-20 shrink-0 pt-1">
        {quotedMsg && (
          <div
            className="mb-1.5 flex items-center justify-between rounded-xl border-l-2 p-2 text-[10px] shadow-sm"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--accent-color)'
            }}
          >
            <div className="truncate pr-2">
              <span className="font-bold">
                引用 {quotedMsg.sender === 'user' ? '你' : character.name}:
              </span>{' '}
              {quotedMsg.content}
            </div>

            <button
              type="button"
              onClick={() => setQuotedMsg(null)}
              className="p-1 opacity-60 hover:opacity-100"
              aria-label="取消引用"
            >
              &times;
            </button>
          </div>
        )}

        {selectedType !== 'text' && (
          <div
            className="mb-2 space-y-2 rounded-2xl border p-2.5 text-[11px]"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)'
            }}
          >
            <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
              <span>MODIFIER: {selectedType.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => setSelectedType('text')}
                aria-label="取消当前模式"
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
                className="w-full rounded p-1.5 outline-none"
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
                  className="w-1/2 rounded p-1.5 font-mono outline-none"
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
                  className="w-1/2 rounded p-1.5 outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div
          className="flex items-center gap-1.5 rounded-full border p-2 shadow-xl backdrop-blur-2xl transition-all duration-300"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div
            className="flex items-center gap-1 border-r pr-1.5 opacity-70"
            style={{ borderColor: 'var(--divider)' }}
          >
            <button
              type="button"
              onClick={() => setSelectedType('image')}
              className={`rounded-full p-1.5 transition-transform active:scale-90 ${
                selectedType === 'image' ? 'opacity-100' : 'opacity-70'
              }`}
              title="画面描述"
            >
              <Image className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('voice')}
              className={`rounded-full p-1.5 transition-transform active:scale-90 ${
                selectedType === 'voice' ? 'opacity-100' : 'opacity-70'
              }`}
              title="模拟语音"
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('transfer')}
              className={`rounded-full p-1.5 transition-transform active:scale-90 ${
                selectedType === 'transfer' ? 'opacity-100' : 'opacity-70'
              }`}
              title="心意转账"
            >
              <DollarSign className="h-4 w-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder={
              selectedType === 'text'
                ? `与 ${character.name} 倾诉...`
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

          <div className="flex shrink-0 items-center gap-1">
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
              className="flex items-center gap-1 rounded-full px-3 py-2 text-[10px] font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
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

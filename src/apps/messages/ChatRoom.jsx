import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';

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
  AlertTriangle,
  BookOpen,
  ReceiptText,
} from 'lucide-react';

import db from '../../db';
import {
  triggerAiResponse,
  rerollAiResponse,
  subscribeAiEvents,
  playMessageSound,
} from '../../services/aiService';

import ChatHeaderBar from './components/ChatHeaderBar';
import TypingIndicator from './components/TypingIndicator';
import BubbleCustomizer from './components/BubbleCustomizer';
import ChatSettingsModal from './components/ChatSettingsModal';
import ScheduledMessageArchive from './components/ScheduledMessageArchive';
import McpToolApprovalModal from './mcp/McpToolApprovalModal';
import ChatInteractionMessage from './interactions/ChatInteractionMessage';

import { createInteractionMessage } from './interactions/interactionService';
import { INTERACTION_TYPES } from './interactions/interactionRules';

import CheckInNotice from './check-in/CheckInNotice';
import { checkForCrossChatCheckIn } from './check-in/checkInService';

import './check-in/check-in.css';
import './interactions/chat-interactions.css';

import {
  registerMcpToolApprovalHandler,
} from '../../services/mcp/mcpApprovalCoordinator';

import {
  subscribeMcpChatTraceEvents,
} from '../../services/mcp/mcpChatTraceService';

import TextCard from './components/cards/TextCard';
import ImageCard from './components/cards/ImageCard';
import VoiceCard from './components/cards/VoiceCard';
import TransferCard from './components/cards/TransferCard';
import ArticleCard from './components/cards/ArticleCard';
import GiftCard from './components/cards/GiftCard';
import FoodDeliveryCard from './components/cards/FoodDeliveryCard';
import KinshipCard from './components/cards/KinshipCard';
import StickerCard from './components/cards/StickerCard';
import McpUsageTraceCard from './components/cards/McpUsageTraceCard';

import McpToolUsageIndicator from './components/McpToolUsageIndicator';
import InteractiveMenuPopover from './components/InteractiveMenuPopover';
import StickerPickerModal from './components/StickerPickerModal';

import {
  cancelPendingScheduledMessagesForChat,
} from './scheduledMessageService';

import ParallelOrbit from './components/ParallelOrbit';

export const ChatRoom = ({
  chatId,
  onBack,
  onOpenChat,
  onOpenCharacterEditor,
  onRoomStateChange,
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
  const [showScheduledArchive, setShowScheduledArchive] = useState(false);
  const [extraInputMeta, setExtraInputMeta] = useState({});
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [checkInDelivery, setCheckInDelivery] = useState(null);
  const [pendingMcpApproval, setPendingMcpApproval] = useState(null);

  /*
   * 当前尚未持久化到 messages.metadata 的实时 MCP 调用轨迹。
   * 最终回复写入数据库后，会由每条消息自身的 metadata.mcpTrace 接管展示。
   */
  const [mcpTrace, setMcpTrace] = useState(null);

  const mcpApprovalResolverRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

  const [showParallelOrbit, setShowParallelOrbit] = useState(false);
  const [isPrioritizedLoaded, setIsPrioritizedLoaded] = useState(false);

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

  const customCssStr = chat?.customCss || '';

  const memoizedStyle = useMemo(() => {
    const cssToApply = customCssStr || defaultCss;
    return <style>{`.chat-room-container ${cssToApply}`}</style>;
  }, [customCssStr, defaultCss]);

  const loadChatData = async () => {
    try {
      const [chatRecord, msgList] = await Promise.all([
        db.chats.get(chatId),
        db.messages.where('chatId').equals(chatId).sortBy('timestamp'),
      ]);

      if (!chatRecord) return;

      const charRecord = await db.characters.get(chatRecord.characterId);

      setChat(chatRecord);

      if (charRecord) {
        setCharacter(charRecord);
      }

      setMessages(Array.isArray(msgList) ? msgList : []);
    } catch (error) {
      console.error(
        '[ChatRoom] loadChatData batch query failed safely:',
        error,
      );
    }
  };

  const handleSendSticker = async (sticker) => {
    if (!sticker || !sticker.name || !chat?.id) return;

    const newMsg = {
      chatId: chat.id,
      characterId: chat.characterId,
      sender: 'user',
      type: 'sticker',
      content: sticker.name,
      metadata: {
        name: sticker.name,
        url: sticker.url,
      },
      isRead: true,
      timestamp: Date.now(),
    };

    await db.messages.add(newMsg);
    await db.chats.update(chat.id, {
      updatedAt: Date.now(),
    });

    await loadChatData();
    triggerAiResponse(chat.id);
  };

  const handleCreateInteraction = async (interactionType) => {
    if (!chat?.id || !character?.id) return;

    try {
      await createInteractionMessage({
        chatId: chat.id,
        characterId: character.id,
        interactionType,
      });

      await loadChatData();
    } catch (error) {
      console.error('[ChatRoom] 创建聊天互动失败：', error);
    }
  };

  const closePendingMcpApproval = useCallback((result) => {
    const resolver = mcpApprovalResolverRef.current;

    mcpApprovalResolverRef.current = null;
    setPendingMcpApproval(null);

    resolver?.(result);
  }, []);

  const handleMcpToolApprovalRequest = useCallback(
    (request) =>
      new Promise((resolve) => {
        /*
         * 同一聊天不应同时存在两份待决授权。
         * 若发生重叠，先安全拒绝旧请求。
         */
        if (mcpApprovalResolverRef.current) {
          mcpApprovalResolverRef.current({
            decision: 'deny',
            scope: 'once',
          });
        }

        mcpApprovalResolverRef.current = resolve;
        setPendingMcpApproval(request);
      }),
    [],
  );

  useEffect(() => {
    const unregister = registerMcpToolApprovalHandler(
      chatId,
      handleMcpToolApprovalRequest,
    );

    return () => {
      unregister();

      if (mcpApprovalResolverRef.current) {
        mcpApprovalResolverRef.current({
          decision: 'deny',
          scope: 'once',
        });

        mcpApprovalResolverRef.current = null;
      }
    };
  }, [chatId, handleMcpToolApprovalRequest]);

  /*
   * MCP Trace 实时事件订阅。
   * 仅用于角色生成过程中的临时提示；历史记录以
   * messages.metadata.mcpTrace 为准。
   */
  useEffect(() => {
    setMcpTrace(null);

    const unsubscribeMcpTrace = subscribeMcpChatTraceEvents((event) => {
      if (
        !event
        || event.type !== 'MCP_CHAT_TRACE_UPDATED'
        || String(event.chatId) !== String(chatId)
      ) {
        return;
      }

      setMcpTrace(event.trace || null);
    });

    return () => {
      unsubscribeMcpTrace?.();
    };
  }, [chatId]);

  useEffect(() => {
    onRoomStateChange?.(true);

    return () => {
      onRoomStateChange?.(false);
    };
  }, [onRoomStateChange]);

  useEffect(() => {
    setIsAiTyping(false);
    setCheckInDelivery(null);
    setMcpTrace(null);

    void loadChatData();

    const unsubscribe = subscribeAiEvents((event) => {
      if (String(event.chatId) !== String(chatId)) return;

      if (event.type === 'AI_TYPING_START') {
        setIsAiTyping(true);
        return;
      }

      if (event.type === 'AI_TYPING_END') {
        setIsAiTyping(false);
        return;
      }

      if (event.type === 'NEW_MESSAGE') {
        setIsAiTyping(false);
        setMcpTrace(null);
        void loadChatData();
        return;
      }

      if (event.type === 'CHAT_SUMMARY_UPDATED') {
        void loadChatData();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsAiTyping(false);
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      unsubscribe();

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [chatId]);

  useEffect(() => {
    const handleLocalMessageNotification = (event) => {
      if (
        String(event.detail?.chatId) !== String(chatId)
      ) {
        return;
      }

      void loadChatData();
    };

    window.addEventListener(
      'new-local-message-inserted',
      handleLocalMessageNotification,
    );

    return () => {
      window.removeEventListener(
        'new-local-message-inserted',
        handleLocalMessageNotification,
      );
    };
  }, [chatId]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;

    if (!scrollArea) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      scrollArea.scrollTo({
        top: scrollArea.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [messages, isAiTyping, mcpTrace]);

  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const userAvatar = chat?.userAvatar || character?.userAvatar || '';
    const userName = chat?.userName || character?.userName || '你';

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content: inputText.trim()
        || (selectedType === 'image' ? '画面描述' : '心意转账'),
      metadata: extraInputMeta,
      userAvatar,
      userName,
      quotedMessageId: quotedMsg?.id || null,
      isRead: true,
      timestamp: new Date().toISOString(),
    };

    const payload = { ...newMsg };
    delete payload.id;

    const msgId = await db.messages.add(payload);
    newMsg.id = msgId;

    try {
      await cancelPendingScheduledMessagesForChat(
        chatId,
        'user_sent_new_message',
      );
    } catch (error) {
      console.warn('[ScheduledMessage] 取消旧预约失败：', error);
    }

    playMessageSound('send');

    setMessages((previous) => [...previous, newMsg]);
    setInputText('');

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    setQuotedMsg(null);
    setSelectedType('text');
    setExtraInputMeta({});

    await db.chats.update(chatId, {
      updatedAt: new Date().toISOString(),
    });

    void checkForCrossChatCheckIn({
      activeChatId: chatId,
      onDelivered: (delivery) => {
        setCheckInDelivery(delivery);
      },
    });
  };

  const handleTriggerAi = () => {
    if (!character || isAiTyping) return;

    setMcpTrace(null);
    triggerAiResponse(chatId);
  };

  const handleRerollMessage = (messageId) => {
    if (isAiTyping) return;

    setMcpTrace(null);
    rerollAiResponse(chatId, messageId);
  };

  const handleSwitchVersion = async (msg, direction) => {
    if (!msg.versions || msg.versions.length <= 1) return;

    const currentIndex = msg.currentVersionIndex
      ?? (msg.versions.length - 1);

    const nextIndex = direction === 'prev'
      ? currentIndex - 1
      : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= msg.versions.length) return;

    const targetVersion = msg.versions[nextIndex];

    await db.messages.update(msg.id, {
      currentVersionIndex: nextIndex,
      type: targetVersion.type,
      content: targetVersion.content,
      metadata: targetVersion.metadata || {},
    });

    await loadChatData();
  };

  const handleDeleteMessage = async (messageId) => {
    await db.messages.delete(messageId);

    setMessages((previous) => (
      previous.filter((message) => message.id !== messageId)
    ));
  };

  const handleClearHistory = async () => {
    await db.messages.where('chatId').equals(chatId).delete();
    setMessages([]);
    setMcpTrace(null);
  };

  const handleSaveCustomCss = async (cssCode) => {
    setChat((previous) => ({
      ...previous,
      customCss: cssCode,
    }));

    await db.chats.update(chatId, {
      customCss: cssCode,
    });
  };

  const handleUpdateBgImage = async (base64Img) => {
    setChat((previous) => ({
      ...previous,
      bgImage: base64Img,
    }));

    await db.chats.update(chatId, {
      bgImage: base64Img,
    });
  };

  const handleUpdateBgOpacity = async (opacity) => {
    setChat((previous) => ({
      ...previous,
      bgOpacity: opacity,
    }));

    await db.chats.update(chatId, {
      bgOpacity: opacity,
    });
  };

  const handleToggleKeepAlive = async (value) => {
    setChat((previous) => ({
      ...previous,
      keepAlive: value,
    }));

    await db.chats.update(chatId, {
      keepAlive: value,
    });
  };

  const handleSaveSummary = async (newSummary) => {
    setChat((previous) => ({
      ...previous,
      summary: newSummary,
    }));

    await db.chats.update(chatId, {
      summary: newSummary,
    });
  };

  if (!chat) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
        <div className="flex flex-col items-center gap-2">
          <RotateCw className="h-6 w-6 animate-spin text-[var(--accent-color)]" />
          <p className="text-sm">正在加载空间...</p>
        </div>
      </div>
    );
  }

  const activeUserAvatar = chat?.userAvatar || character?.userAvatar || '';
  const activeUserName = chat?.userName || character?.userName || '你';
  const bgOpacity = chat?.bgOpacity ?? 0.3;
  const isBgDimmed = chat?.isBgDimmed ?? true;
  const currentCss = chat?.customCss || defaultCss;

  if (showParallelOrbit) {
    return (
      <ParallelOrbit
        chatId={chatId}
        character={character}
        onBack={() => setShowParallelOrbit(false)}
      />
    );
  }

  return (
    <div
      className="chat-room-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
      }}
    >
      {memoizedStyle}

      <CheckInNotice
        delivery={checkInDelivery}
        onDismiss={() => setCheckInDelivery(null)}
        onOpen={() => {
          const targetChatId = checkInDelivery?.chatId;

          setCheckInDelivery(null);

          if (targetChatId) {
            onOpenChat?.(targetChatId);
          }
        }}
      />

      {chat.bgImage && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              backgroundImage: `url(${chat.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />

          {isBgDimmed && (
            <div
              className="absolute inset-0 transition-opacity"
              style={{
                background: `rgba(var(--bg-main-rgb, 0, 0, 0), ${bgOpacity})`,
                backgroundColor: 'var(--bg-main)',
                opacity: bgOpacity,
              }}
            />
          )}
        </div>
      )}

      <header className="z-20 shrink-0 px-4 pb-1 pt-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold opacity-85 transition-opacity hover:opacity-100"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回列表</span>
            </button>

            <button
              type="button"
              onClick={() => setShowParallelOrbit(true)}
              className="flex items-center justify-center rounded-full p-2 opacity-80 transition-all hover:bg-neutral-100 hover:opacity-100 dark:hover:bg-neutral-800"
              style={{
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)',
                background: 'var(--control-soft-bg)',
              }}
              title="翻阅平行轨迹"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScheduledArchive(true)}
              className="rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
              }}
              title="查看稍后联系存档"
              aria-label="查看稍后联系存档"
            >
              <ReceiptText className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowChatSettings(true)}
              className="rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
              }}
              title="对话空间设置"
              aria-label="打开对话空间设置"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ChatHeaderBar
          character={character}
          chat={chat}
          onOpenSettings={onOpenCharacterEditor}
          onSaveSummary={handleSaveSummary}
        />
      </header>

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
            const versionIndex = msg.currentVersionIndex
              ?? (versions.length > 1 ? versions.length - 1 : 0);

            const isErrorMsg = (
              msg.type === 'error'
              || msg.metadata?.errorCode
            );

            const messageMcpTrace = isUser
              ? null
              : msg.metadata?.mcpTrace;

            const quoted = msg.quotedMessageId
              ? messages.find((message) => (
                message.id === msg.quotedMessageId
              ))
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
                      borderColor: 'var(--divider)',
                    }}
                  >
                    <span className="block font-bold">
                      {quoted.sender === 'user'
                        ? activeUserName
                        : (character?.name || '伴侣')}
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
                    character?.avatar ? (
                      <img
                        src={character.avatar}
                        alt={character.name}
                        className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
                        style={{
                          borderColor: 'var(--card-border)',
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          background: 'var(--control-soft-bg)',
                        }}
                      >
                        {character?.name?.[0]}
                      </div>
                    )
                  ) : activeUserAvatar ? (
                    <img
                      src={activeUserAvatar}
                      alt={activeUserName}
                      className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
                      style={{
                        borderColor: 'var(--card-border)',
                      }}
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        background: 'var(--control-soft-bg)',
                      }}
                    >
                      <User className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    {isErrorMsg ? (
                      <div
                        className="space-y-2 rounded-2xl border p-3 shadow-sm chat-font"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          color: 'var(--text-main)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-red-500">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            API 报错: {msg.metadata?.errorCode || 'ERROR'}
                          </span>
                        </div>

                        <p className="text-[11px] opacity-90">
                          {msg.content}
                        </p>

                        <button
                          type="button"
                          onClick={() => handleRerollMessage(msg.id)}
                          className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>重新尝试 (Re-roll)</span>
                        </button>
                      </div>
                    ) : msg.type === 'interaction' ? (
                      <ChatInteractionMessage
                        message={msg}
                        character={character}
                        onResolved={loadChatData}
                      />
                    ) : (
                      <div
                        className={`relative p-3 shadow-sm transition-all chat-font ${
                          isUser ? 'user-bubble' : 'ai-bubble'
                        }`}
                      >
                        {msg.type === 'text' && (
                          <TextCard content={msg.content} />
                        )}

                        {msg.type === 'image' && (
                          <ImageCard
                            content={msg.content}
                            metadata={msg.metadata}
                          />
                        )}

                        {msg.type === 'voice' && (
                          <VoiceCard
                            content={msg.content}
                            metadata={msg.metadata}
                          />
                        )}

                        {msg.type === 'transfer' && (
                          <TransferCard
                            content={msg.content}
                            metadata={msg.metadata}
                            sender={msg.sender}
                          />
                        )}

                        {msg.type === 'article' && (
                          <ArticleCard
                            content={msg.content}
                            metadata={msg.metadata}
                          />
                        )}

                        {msg.type === 'gift' && (
                          <GiftCard
                            metadata={msg.metadata}
                            isUser={isUser}
                          />
                        )}

                        {msg.type === 'food' && (
                          <FoodDeliveryCard
                            metadata={msg.metadata}
                            isUser={isUser}
                          />
                        )}

                        {msg.type === 'kinship' && (
                          <KinshipCard
                            metadata={msg.metadata}
                            isUser={isUser}
                          />
                        )}

                        {msg.type === 'sticker' && (
                          <StickerCard
                            metadata={msg.metadata}
                            isUser={isUser}
                          />
                        )}
                      </div>
                    )}

                    {!isUser && messageMcpTrace && (
                      <McpUsageTraceCard
                        trace={messageMcpTrace}
                      />
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleRerollMessage(msg.id)}
                        disabled={isAiTyping}
                        className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                        title="重 roll 此回复"
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

                <div
                  className={`mt-1 flex items-center gap-2 px-9 font-mono text-[9px] opacity-60 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {versions.length > 1 && (
                    <div
                      className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5"
                      style={{
                        background: 'var(--control-soft-bg)',
                        borderColor: 'var(--card-border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchVersion(msg, 'prev')}
                        disabled={versionIndex === 0}
                        className="p-0.5 hover:opacity-100 disabled:opacity-20"
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
                        className="p-0.5 hover:opacity-100 disabled:opacity-20"
                        title="下一版本"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {isUser ? (
                    <CheckCheck
                      className="h-3 w-3"
                      style={{
                        color: 'var(--text-muted)',
                      }}
                    />
                  ) : (
                    <Check
                      className="h-3 w-3"
                      style={{
                        color: 'var(--text-muted)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {isAiTyping && (
            <>
              {mcpTrace && (
                <McpToolUsageIndicator
                  trace={mcpTrace}
                />
              )}

              <TypingIndicator
                customText={
                  chat.typingText
                  || `${character?.name || '伴侣'} 正在思考...`
                }
                styleType={chat.typingStyle || 'default'}
              />
            </>
          )}
        </div>
      </section>

      <footer
        className="z-20 shrink-0 px-4 pt-1"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
        }}
      >
        {quotedMsg && (
          <div
            className="mb-2 flex items-center justify-between rounded-2xl p-2 px-3 text-[10px] shadow-md"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
            }}
          >
            <div className="truncate pr-2">
              <span className="font-bold">
                引用 {quotedMsg.sender === 'user'
                  ? activeUserName
                  : character?.name}:
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
              color: 'var(--text-main)',
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
                  color: 'var(--text-main)',
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
                      amount: event.target.value,
                    });
                  }}
                  className="w-1/2 rounded-xl p-2 font-mono outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
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
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}

            {selectedType === 'gift' && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="礼物名称 (如: 羊绒围巾)"
                  onChange={(event) => {
                    setExtraInputMeta({
                      ...extraInputMeta,
                      name: event.target.value,
                    });
                  }}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />

                <input
                  type="text"
                  placeholder="寄语或选礼理由..."
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}

            {selectedType === 'food' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="餐品/饮品"
                    onChange={(event) => {
                      setExtraInputMeta({
                        ...extraInputMeta,
                        item: event.target.value,
                      });
                    }}
                    className="w-1/2 rounded-xl p-2 text-xs outline-none"
                    style={{
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                    }}
                  />

                  <input
                    type="text"
                    placeholder="商家/品牌"
                    onChange={(event) => {
                      setExtraInputMeta({
                        ...extraInputMeta,
                        store: event.target.value,
                      });
                    }}
                    className="w-1/2 rounded-xl p-2 text-xs outline-none"
                    style={{
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                <input
                  type="text"
                  placeholder="叮嘱留言 (如: 记得趁热吃)"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}

            {selectedType === 'kinship' && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="额度数字 (如: 5200)"
                  onChange={(event) => {
                    setExtraInputMeta({
                      ...extraInputMeta,
                      amount: event.target.value,
                    });
                  }}
                  className="w-full rounded-xl p-2 font-mono text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />

                <input
                  type="text"
                  placeholder="专属卡面赠言..."
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div
          className="flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl transition-all duration-300"
          style={{
            background: 'var(--card-bg-gradient)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          }}
        >
          <div className="flex items-center gap-1 opacity-80">
            <InteractiveMenuPopover
              onSelectAction={(type) => {
                if (type === 'sticker') {
                  setShowStickerModal(true);
                  return;
                }

                if (type === 'interaction_coin') {
                  void handleCreateInteraction(INTERACTION_TYPES.COIN);
                  return;
                }

                if (type === 'interaction_dice') {
                  void handleCreateInteraction(INTERACTION_TYPES.DICE);
                  return;
                }

                if (type === 'interaction_rps') {
                  void handleCreateInteraction(INTERACTION_TYPES.RPS);
                  return;
                }

                setSelectedType(type);
              }}
            />

            <button
              type="button"
              onClick={() => setSelectedType('image')}
              className={`rounded-full p-2 transition-all active:scale-90 ${
                selectedType === 'image'
                  ? 'bg-[var(--control-soft-bg)] opacity-100'
                  : 'hover:opacity-100'
              }`}
              title="画面描述"
            >
              <Image className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('voice')}
              className={`rounded-full p-2 transition-all active:scale-90 ${
                selectedType === 'voice'
                  ? 'bg-[var(--control-soft-bg)] opacity-100'
                  : 'hover:opacity-100'
              }`}
              title="模拟语音"
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('transfer')}
              className={`rounded-full p-2 transition-all active:scale-90 ${
                selectedType === 'transfer'
                  ? 'bg-[var(--control-soft-bg)] opacity-100'
                  : 'hover:opacity-100'
              }`}
              title="心意转账"
            >
              <DollarSign className="h-4 w-4" />
            </button>
          </div>

          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              event.target.style.height = 'auto';
              event.target.style.height = `${
                Math.min(event.target.scrollHeight, 160)
              }px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder={
              selectedType === 'text'
                ? (
                  chat?.inputPlaceholder
                  || `与 ${character?.name || '伴侣'} 倾诉...`
                )
                : `已选 ${selectedType} 模式`
            }
            className="max-h-40 w-full resize-y overflow-y-auto bg-transparent text-xs leading-relaxed outline-none"
            style={{
              color: 'var(--text-main)',
              minHeight: '24px',
            }}
          />

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleSendMessage()}
              className="rounded-full p-2 transition-transform hover:opacity-90 active:scale-90"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
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
                color: 'var(--accent-foreground)',
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

      {showScheduledArchive && (
        <ScheduledMessageArchive
          chatId={chatId}
          character={character}
          onClose={() => setShowScheduledArchive(false)}
        />
      )}

      <StickerPickerModal
        isOpen={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        onSelectSticker={handleSendSticker}
      />

      <McpToolApprovalModal
        request={pendingMcpApproval}
        onResolve={closePendingMcpApproval}
      />
    </div>
  );
};

export default ChatRoom;

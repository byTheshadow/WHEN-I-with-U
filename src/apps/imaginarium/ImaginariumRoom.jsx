import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sliders, Send, Sparkles, AtSign, Smile, RotateCcw, Quote, Trash2, StopCircle, CheckCheck, Check } from 'lucide-react';
import VoiceCard from '../messages/components/cards/VoiceCard';
import StickerPickerModal from '../messages/components/StickerPickerModal';
import ConfirmModal from '../../components/ConfirmModal';
import ImaginariumSettingsModal from './ImaginariumSettingsModal';
import ImaginariumHeaderBanner from './components/ImaginariumHeaderBanner';
import ImaginariumCuteTypingIndicator from './components/ImaginariumCuteTypingIndicator';

import {
  getImaginariumChatById,
  getImaginariumMessages,
  addImaginariumMessage,
  triggerImaginariumAI,
  updateImaginariumMessage,
  deleteImaginariumMessage,
  deleteImaginariumChat
} from './imaginariumService';
import './imaginarium.css';

export const ImaginariumRoom = ({ chatId, onBack }) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [targetNpcId, setTargetNpcId] = useState(null);

  const [quotedMessage, setQuotedMessage] = useState(null);
  const [activeMsgId, setActiveMsgId] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [deletingChatId, setDeletingChatId] = useState(null);

  const [isFreeDiscussing, setIsFreeDiscussing] = useState(false);
  const freeDiscussCancelRef = useRef(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [thinkingNpc, setThinkingNpc] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    loadChatAndMessages();
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const loadChatAndMessages = async () => {
    const c = await getImaginariumChatById(chatId);
    setChat(c);
    const msgs = await getImaginariumMessages(chatId);
    setMessages(msgs);
  };

  if (!chat) return null;

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleSendMessageOnly = async () => {
    if (!inputText.trim()) return;

    const newMsg = {
      chatId: Number(chatId),
      senderId: 'user',
      senderName: chat.userName || '我',
      senderAvatar: chat.userAvatar || '',
      senderType: 'user',
      type: 'text',
      content: inputText.trim(),
      quotedMessageId: quotedMessage?.id || null,
      quotedSummary: quotedMessage ? `${quotedMessage.senderName}: ${quotedMessage.content}` : null,
      timestamp: Date.now()
    };

    const added = await addImaginariumMessage(newMsg);
    setMessages((prev) => [...prev, added]);
    setInputText('');
    setQuotedMessage(null);
  };

  const handleSummonAI = async (npcIdOverride = null) => {
    if (isAiThinking) return;
    const activeTargetId = npcIdOverride || targetNpcId;
    const targetMember = chat.members?.find((m) => m.id === activeTargetId);

    setIsAiThinking(true);
    setThinkingNpc(targetMember || null);

    try {
      const aiMsg = await triggerImaginariumAI(chatId, activeTargetId);
      setMessages((prev) => [...prev, aiMsg]);
      setTargetNpcId(null);
    } catch (err) {
      alert(err.message || 'AI 响应失败');
    } finally {
      setIsAiThinking(false);
      setThinkingNpc(null);
    }
  };

  const handleStartFreeDiscussion = async () => {
    if (isFreeDiscussing) {
      freeDiscussCancelRef.current = true;
      setIsFreeDiscussing(false);
      return;
    }

    setIsFreeDiscussing(true);
    freeDiscussCancelRef.current = false;

    for (let round = 0; round < 6; round++) {
      if (freeDiscussCancelRef.current) break;
      setIsAiThinking(true);
      try {
        const aiMsg = await triggerImaginariumAI(chatId, null);
        setMessages((prev) => [...prev, aiMsg]);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err) {
        console.error('Free discussion interrupted:', err);
        break;
      } finally {
        setIsAiThinking(false);
      }
    }

    setIsFreeDiscussing(false);
  };

  const handleSelectSticker = async (sticker) => {
    const newMsg = {
      chatId: Number(chatId),
      senderId: 'user',
      senderName: chat.userName || '我',
      senderAvatar: chat.userAvatar || '',
      senderType: 'user',
      type: 'sticker',
      content: sticker.url,
      timestamp: Date.now()
    };

    const added = await addImaginariumMessage(newMsg);
    setMessages((prev) => [...prev, added]);
  };

  const handleRegenerate = async (msg) => {
    if (isAiThinking || msg.senderType !== 'ai') return;
    setIsAiThinking(true);
    try {
      const aiMsg = await triggerImaginariumAI(chatId, msg.senderId);
      const newVersions = [...(msg.versions || [msg.content]), aiMsg.content];
      const newIndex = newVersions.length - 1;

      await updateImaginariumMessage(msg.id, {
        content: aiMsg.content,
        versions: newVersions,
        currentVersionIndex: newIndex
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, content: aiMsg.content, versions: newVersions, currentVersionIndex: newIndex }
            : m
        )
      );
    } catch (err) {
      alert(err.message || '重 roll 失败');
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleConfirmDeleteMsg = async () => {
    if (!deletingMsgId) return;
    await deleteImaginariumMessage(deletingMsgId);
    setMessages((prev) => prev.filter((m) => m.id !== deletingMsgId));
    setDeletingMsgId(null);
  };

  const handleConfirmDeleteChat = async (idToDelete) => {
    await deleteImaginariumChat(idToDelete);
    setDeletingChatId(null);
    setShowSettings(false);
    onBack();
  };

  return (
    <div className="imaginarium-chat-room flex flex-col h-full w-full relative overflow-hidden select-none">
      {chat.customCss && <style>{chat.customCss}</style>}

      {/* 沉浸图像背景遮罩 */}
      {chat.bgImage && (
        <div
          className="imaginarium-bg-overlay"
          style={{
            backgroundImage: `url(${chat.bgImage})`,
            opacity: chat.bgOpacity ?? 0.3
          }}
        />
      )}

      {/* 1. 无实体 Top Bar 底色：浮动导航与状态栏集成 */}
      <div className="z-30 shrink-0 px-3 pt-3 flex flex-col pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <button type="button" onClick={onBack} className="imaginarium-icon-btn">
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleStartFreeDiscussion}
              className="imaginarium-icon-btn text-[11px] font-bold px-3 py-1.5 gap-1"
              style={{
                backgroundColor: isFreeDiscussing ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                color: isFreeDiscussing ? 'var(--accent-foreground)' : 'var(--text-main)'
              }}
            >
              {isFreeDiscussing ? <StopCircle className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isFreeDiscussing ? '停止' : '自由讨论'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="imaginarium-icon-btn"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 可折叠状态栏抽屉 */}
        <div className="pointer-events-auto mt-1">
          <ImaginariumHeaderBanner chat={chat} onUpdateChatInfo={(updated) => setChat(updated)} />
        </div>
      </div>

      {/* 2. 中间消息滚动区域 (独立滑动) */}
      <main
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 relative z-10 scroll-smooth"
        onClick={() => setActiveMsgId(null)}
      >
        {messages.map((m) => {
          const isUser = m.senderType === 'user';
          const isSelected = activeMsgId === m.id;

          return (
            <div
              key={m.id}
              id={`msg-${m.id}`}
              className={`group flex items-start gap-2.5 animate-fade-in-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className="w-8 h-8 rounded-full overflow-hidden shrink-0 font-bold text-xs flex items-center justify-center shadow-sm border"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                {m.senderAvatar ? (
                  <img src={m.senderAvatar} alt={m.senderName} className="w-full h-full object-cover" />
                ) : (
                  m.senderName?.[0]
                )}
              </div>

              <div className={`space-y-1 max-w-[78%] ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] opacity-60 font-serif">{m.senderName}</span>
                </div>

                {m.quotedSummary && (
                  <div className="imaginarium-quote-block">
                    {m.quotedSummary}
                  </div>
                )}

                {/* 气泡本体与时间戳/已读标记 */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMsgId(isSelected ? null : m.id);
                  }}
                  className={`p-3 text-xs leading-relaxed cursor-pointer transition-all active:scale-[0.99] relative group ${isUser ? 'imaginarium-bubble-user' : 'imaginarium-bubble-ai'}`}
                >
                  {m.type === 'sticker' ? (
                    <img src={m.content} alt="贴纸" className="max-w-[120px] rounded-xl" />
                  ) : m.type === 'voice' ? (
                    <VoiceCard content={m.content} metadata={m.metadata} />
                  ) : (
                    m.content
                  )}

                  {/* 气泡底部微小时间戳与已读打钩图标 */}
                  <div className={`flex items-center gap-1 pt-1 text-[9px] opacity-50 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-mono">{formatTimestamp(m.timestamp)}</span>
                    {isUser && (
                      <CheckCheck className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                </div>

                {/* 浮动操作栏 (引用、重roll、删除) */}
                <div
                  className={`flex items-center gap-2 pt-0.5 px-1 text-[10px] transition-all duration-200 ${
                    isSelected ? 'opacity-90 max-h-6' : 'opacity-0 max-h-0 overflow-hidden group-hover:opacity-90 group-hover:max-h-6'
                  } ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuotedMessage(m);
                    }}
                    className="hover:underline flex items-center gap-0.5 opacity-70 hover:opacity-100"
                  >
                    <Quote className="w-3 h-3" /> 引用
                  </button>

                  {!isUser && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate(m);
                      }}
                      className="hover:underline flex items-center gap-0.5 opacity-70 hover:opacity-100"
                    >
                      <RotateCcw className="w-3 h-3" /> 重roll
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingMsgId(m.id);
                    }}
                    className="hover:underline text-rose-500 flex items-center gap-0.5 opacity-70 hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" /> 删除
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* 成员打字中指示器 */}
        {isAiThinking && (
          <div className="py-2 flex items-center justify-start">
            <ImaginariumCuteTypingIndicator
              activeSpeakerName={thinkingNpc?.name}
              activeSpeakerAvatar={thinkingNpc?.avatar}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 3. 底部 Dock 输入栏 (固定) */}
      <footer className="shrink-0 z-30 px-3 pb-3 pt-1">
        <div className="imaginarium-dock max-w-[420px] mx-auto p-2.5 rounded-[1.8rem] border shadow-xl backdrop-blur-xl space-y-2" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          {quotedMessage && (
            <div className="flex items-center justify-between p-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-dashed">
              <span className="truncate opacity-80">引用 [{quotedMessage.senderName}]: {quotedMessage.content}</span>
              <button type="button" onClick={() => setQuotedMessage(null)} className="opacity-60">✕</button>
            </div>
          )}

          {showMemberMenu && (
            <div className="p-2 rounded-2xl border space-y-1 max-h-32 overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="text-[10px] opacity-50 px-2">指定回复成员</div>
              {(chat.members || []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setTargetNpcId(m.id);
                    setShowMemberMenu(false);
                  }}
                  className="w-full text-left p-1.5 rounded-xl text-xs flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span>{m.name}</span>
                  {targetNpcId === m.id && <span className="text-[10px] text-emerald-500 font-bold">已选</span>}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={targetNpcId ? `@${(chat.members || []).find(m => m.id === targetNpcId)?.name} 中...` : "发送你的故事..."}
            className="imaginarium-textarea"
          />

          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setShowStickers(true)} className="imaginarium-icon-btn p-2">
                <Smile className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowMemberMenu(!showMemberMenu)}
                className="imaginarium-icon-btn p-2"
                style={{
                  backgroundColor: targetNpcId ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                  color: targetNpcId ? 'var(--accent-foreground)' : 'var(--text-main)'
                }}
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendMessageOnly}
                className="imaginarium-icon-btn px-3 py-1.5 text-xs font-bold gap-1"
              >
                <Send className="w-3 h-3" /> 发送
              </button>

              <button
                type="button"
                onClick={() => handleSummonAI()}
                className="imaginarium-icon-btn px-3 py-1.5 text-xs font-bold gap-1"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                <Sparkles className="w-3 h-3" /> 召唤 AI
              </button>
            </div>
          </div>
        </div>
      </footer>

      <StickerPickerModal
        isOpen={showStickers}
        onClose={() => setShowStickers(false)}
        onSelectSticker={handleSelectSticker}
      />

      <ImaginariumSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        chat={chat}
        onChatUpdated={(updated) => setChat(updated)}
        onConfirmDeleteChat={(id) => setDeletingChatId(id)}
      />

      <ConfirmModal
        isOpen={Boolean(deletingMsgId)}
        title="删除气泡"
        message="是否彻底移除这条气泡消息？"
        onConfirm={handleConfirmDeleteMsg}
        onCancel={() => setDeletingMsgId(null)}
      />

      <ConfirmModal
        isOpen={Boolean(deletingChatId)}
        title="解散虚构沙龙"
        message="确定要解散此虚构沙龙吗？所有消息与阶段总结将被彻底删除。"
        onConfirm={() => handleConfirmDeleteChat(deletingChatId)}
        onCancel={() => setDeletingChatId(null)}
      />
    </div>
  );
};

export default ImaginariumRoom;

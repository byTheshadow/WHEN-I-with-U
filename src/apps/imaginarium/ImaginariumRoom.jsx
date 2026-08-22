import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sliders, Send, Sparkles, AtSign, Smile, RotateCcw, Quote, Trash2, StopCircle } from 'lucide-react';
import VoiceCard from '../messages/components/cards/VoiceCard';
import StickerPickerModal from '../messages/components/StickerPickerModal';
import ConfirmModal from '../../components/ConfirmModal';
import ImaginariumSettingsModal from './ImaginariumSettingsModal';
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

  // 引用消息
  const [quotedMessage, setQuotedMessage] = useState(null);

  // 弹窗状态
  const [showSettings, setShowSettings] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [deletingChatId, setDeletingChatId] = useState(null);

  // 自由讨论状态
  const [isFreeDiscussing, setIsFreeDiscussing] = useState(false);
  const freeDiscussCancelRef = useRef(false);

  // AI 思考状态
  const [isAiThinking, setIsAiThinking] = useState(false);

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

  // 发送用户消息 (纯添加气泡，不触发 AI)
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

  // 召唤 AI 回复 (单轮)
  const handleSummonAI = async (npcIdOverride = null) => {
    if (isAiThinking) return;
    setIsAiThinking(true);
    try {
      const activeTargetId = npcIdOverride || targetNpcId;
      const aiMsg = await triggerImaginariumAI(chatId, activeTargetId);
      setMessages((prev) => [...prev, aiMsg]);
      setTargetNpcId(null);
    } catch (err) {
      alert(err.message || 'AI 响应失败');
    } finally {
      setIsAiThinking(false);
    }
  };

  // 开启全场自由讨论 (上限 6 轮循环)
  const handleStartFreeDiscussion = async () => {
    if (isFreeDiscussing) {
      // 正在讨论中则停止
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
        // 留出 1.5 秒拟人停顿
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

  // 发送表情包
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

  // 重 roll 某条 AI 气泡
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

  // 删除消息确认
  const handleConfirmDeleteMsg = async () => {
    if (!deletingMsgId) return;
    await deleteImaginariumMessage(deletingMsgId);
    setMessages((prev) => prev.filter((m) => m.id !== deletingMsgId));
    setDeletingMsgId(null);
  };

  // 解散群聊确认
  const handleConfirmDeleteChat = async (idToDelete) => {
    await deleteImaginariumChat(idToDelete);
    setDeletingChatId(null);
    setShowSettings(false);
    onBack();
  };

  return (
    <div className="imaginarium-container select-none">
      {/* 注入用户自定义 CSS */}
      {chat.customCss && <style>{chat.customCss}</style>}

      {/* 背景图叠加层 */}
      {chat.bgImage && (
        <div
          className="imaginarium-bg-overlay"
          style={{
            backgroundImage: `url(${chat.bgImage})`,
            opacity: chat.bgOpacity ?? 0.3
          }}
        />
      )}

      {/* 极简无 Top Bar 沉浸悬浮按钮列 */}
      <header className="imaginarium-floating-header">
        <button type="button" onClick={onBack} className="imaginarium-icon-btn">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartFreeDiscussion}
            className="imaginarium-icon-btn text-xs font-bold px-3 gap-1.5"
            style={{
              backgroundColor: isFreeDiscussing ? 'var(--accent-color)' : 'var(--control-soft-bg)',
              color: isFreeDiscussing ? 'var(--accent-foreground)' : 'var(--text-main)'
            }}
          >
            {isFreeDiscussing ? <StopCircle className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isFreeDiscussing ? '停止讨论' : '自由讨论'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="imaginarium-icon-btn"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 消息滚动区 */}
      <main className="relative z-10 pt-20 pb-32 px-4 space-y-4 max-w-[420px] mx-auto">
        {messages.map((m) => {
          const isUser = m.senderType === 'user';

          return (
            <div
              key={m.id}
              id={`msg-${m.id}`}
              className={`flex items-start gap-2.5 animate-fade-in-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* 头像 */}
              <div
                className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs shadow-sm"
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                {m.senderAvatar ? (
                  <img src={m.senderAvatar} alt={m.senderName} className="w-full h-full object-cover" />
                ) : (
                  m.senderName?.[0]
                )}
              </div>

              {/* 气泡包裹 */}
              <div className={`space-y-1 max-w-[78%] ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>
                <div className="text-[10px] opacity-60 px-1 font-serif">{m.senderName}</div>

                {/* 引用切片 */}
                {m.quotedSummary && (
                  <div className="imaginarium-quote-block">
                    {m.quotedSummary}
                  </div>
                )}

                {/* 气泡正文 */}
                <div className={`p-3 text-xs leading-relaxed ${isUser ? 'imaginarium-bubble-user' : 'imaginarium-bubble-ai'}`}>
                  {m.type === 'sticker' ? (
                    <img src={m.content} alt="贴纸" className="max-w-[120px] rounded-xl" />
                  ) : m.type === 'voice' ? (
                    <VoiceCard content={m.content} metadata={m.metadata} />
                  ) : (
                    m.content
                  )}
                </div>

                {/* 操作快捷工具栏 (引用 / 重roll / 删除) */}
                <div className={`flex items-center gap-2 pt-0.5 px-1 text-[10px] opacity-40 hover:opacity-100 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <button type="button" onClick={() => setQuotedMessage(m)} className="hover:underline flex items-center gap-0.5">
                    <Quote className="w-3 h-3" /> 引用
                  </button>

                  {!isUser && (
                    <button type="button" onClick={() => handleRegenerate(m)} className="hover:underline flex items-center gap-0.5">
                      <RotateCcw className="w-3 h-3" /> 重roll
                    </button>
                  )}

                  <button type="button" onClick={() => setDeletingMsgId(m.id)} className="hover:underline text-rose-500 flex items-center gap-0.5">
                    <Trash2 className="w-3 h-3" /> 删除
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isAiThinking && (
          <div className="flex items-center gap-2 text-xs opacity-50 font-serif italic py-2 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" /> 沙龙成员正在沉思接话...
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 悬浮输入 Dock (Floating Input Dock) */}
      <div className="imaginarium-dock-wrapper">
        <div className="imaginarium-dock">
          {/* 引用展示条 */}
          {quotedMessage && (
            <div className="flex items-center justify-between p-2 mb-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-dashed">
              <span className="truncate opacity-80">引用 [{quotedMessage.senderName}]: {quotedMessage.content}</span>
              <button type="button" onClick={() => setQuotedMessage(null)} className="opacity-60">✕</button>
            </div>
          )}

          {/* @ 选角下拉选单 */}
          {showMemberMenu && (
            <div className="mb-2 p-2 rounded-2xl border space-y-1 max-h-32 overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="text-[10px] opacity-50 px-2">选择指定回复的群员</div>
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

          {/* 多行输入文本框 */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={targetNpcId ? `@${(chat.members || []).find(m => m.id === targetNpcId)?.name} 中...` : "倾诉你的故事..."}
            className="imaginarium-textarea"
          />

          {/* 底部悬浮控制功能按钮区 */}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowStickers(true)}
                className="imaginarium-icon-btn p-2"
                title="表情包"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowMemberMenu(!showMemberMenu)}
                className="imaginarium-icon-btn p-2"
                style={{ backgroundColor: targetNpcId ? 'var(--accent-color)' : 'var(--control-soft-bg)', color: targetNpcId ? 'var(--accent-foreground)' : 'var(--text-main)' }}
                title="@成员"
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 双按钮：发送 (存用户) & 召唤 AI */}
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
      </div>

      {/* 弹窗链 */}
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
        title="删除此气泡"
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

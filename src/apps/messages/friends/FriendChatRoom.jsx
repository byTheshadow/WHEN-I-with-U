// src/apps/messages/friends/FriendChatRoom.jsx
//
// 好友申请 · 切片 D：和朋友聊天的界面（独立的轻量界面，不用 ChatRoom / MessageList）。
// 只读写 friendMessages 和朋友名片，逻辑都在 friendChatService.js。
//
// 用法：<FriendChatRoom friend={{ id, ownerId, name }} onBack={...} />
//   friend.id       名片 id（= 申请 id）
//   friend.ownerId  介绍人角色 id；自己来的传 null
//   friend.name     顶部先显示的名字（名片读出来后以名片为准）
//
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Send, RotateCcw } from 'lucide-react';

import {
  ensureFriendPersona,
  getFriendCard,
  getRecentFriendMessages,
  requestFriendReply,
  sendFriendMessage,
} from './friendChatService';
import { makeRumorAfterFriendChat, refreshRumorAboutIntroducer } from './friendRumorService';
import './friend-chat.css';

const AVATAR_TINTS = ['#d9cfc0', '#c9d3c4', '#d6c4c4', '#c4ccd6', '#d8d0b8', '#cdc4d6'];

const tintFor = (name) => {
  const s = String(name || '');
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
};

// 首字占位头像，和申请页一致；以后换成图片在这里按 avatarId 处理。
const Avatar = ({ name, size = 36 }) => (
  <span
    className="fc-av"
    style={{ width: size, height: size, background: tintFor(name), fontSize: Math.round(size * 0.42) }}
    aria-hidden="true"
  >
    {Array.from(String(name || '?'))[0]}
  </span>
);

export const FriendChatRoom = ({ friend, onBack }) => {
  const [card, setCard] = useState(null);
  const [cardMissing, setCardMissing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const aliveRef = useRef(true);
  const bottomRef = useRef(null);

  const ref = { id: friend?.id, ownerId: friend?.ownerId ?? null };

  const reloadMessages = useCallback(async () => {
    const rows = await getRecentFriendMessages(friend?.id);
    if (aliveRef.current) setMessages(rows);
  }, [friend?.id]);

  // 打开时：读名片、读记录，并在后台把完整人设准备好（第一次会调一次 AI，之后直接用缓存）。
  useEffect(() => {
    aliveRef.current = true;

    (async () => {
      const found = await getFriendCard({ id: friend?.id, ownerId: friend?.ownerId ?? null });
      if (!aliveRef.current) return;
      if (!found) {
        setCardMissing(true);
        return;
      }
      setCard(found);
      await reloadMessages();

      const prepared = await ensureFriendPersona({ id: friend?.id, ownerId: friend?.ownerId ?? null });
      if (aliveRef.current && prepared) setCard(prepared);

      // 风声（切片 E）：看看介绍人和用户最近有没有明显的情绪。放在人设准备好之后，避免两处同时写名片。
      void refreshRumorAboutIntroducer({ id: friend?.id, ownerId: friend?.ownerId ?? null });
    })();

    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.id, friend?.ownerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || cardMissing) return;

    setInput('');
    setError('');
    setSending(true);
    try {
      const result = await sendFriendMessage(ref, text, { onChange: reloadMessages });
      if (!result.ok && result.error && aliveRef.current) setError(result.error);
    } finally {
      if (aliveRef.current) setSending(false);
      await reloadMessages();
    }
  };

  const handleAskReply = async () => {
    if (sending || cardMissing) return;
    setError('');
    setSending(true);
    try {
      const result = await requestFriendReply(ref, { onChange: reloadMessages });
      if (!result.ok && result.error && aliveRef.current) setError(result.error);
    } finally {
      if (aliveRef.current) setSending(false);
      await reloadMessages();
    }
  };

  // 退出时看看这次和朋友聊得怎么样，有明显情绪就给介绍人留一句风声（不阻塞退出）。
  const handleBack = () => {
    void makeRumorAfterFriendChat(ref);
    if (typeof onBack === 'function') onBack();
  };

  const displayName = card?.realName || card?.alias || friend?.name || '朋友';
  const subtitle = card?.relation || '';

  return (
    <div className="fc-root">
      <header className="fc-head">
        <button type="button" className="fc-round" aria-label="返回" onClick={handleBack}>
          <ChevronLeft className="w-[18px] h-[18px]" />
        </button>
        <Avatar name={displayName} size={36} />
        <div className="fc-head-text">
          <span className="fc-head-name">{displayName}</span>
          {subtitle && <span className="fc-head-sub">{subtitle}</span>}
        </div>
      </header>

      <div className="fc-scroll">
        {cardMissing && <div className="fc-empty">找不到这位朋友的名片了</div>}

        {!cardMissing && messages.length === 0 && (
          <div className="fc-empty">你们刚加上好友，先打个招呼吧。</div>
        )}

        {messages.map((msg) => {
          const mine = msg.sender === 'user';
          return (
            <div key={msg.id} className={`fc-row${mine ? ' fc-row--mine' : ''}`}>
              {!mine && <Avatar name={displayName} size={30} />}
              <div className={`fc-bubble${mine ? ' fc-bubble--mine' : ''}`}>{msg.content}</div>
            </div>
          );
        })}

        {sending && (
          <div className="fc-row">
            <Avatar name={displayName} size={30} />
            <div className="fc-bubble fc-typing" aria-label="对方正在输入">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && <div className="fc-error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="fc-compose">
        <button
          type="button"
          className="fc-round"
          aria-label="让 TA 回复"
          title="让 TA 回复（失败后重试也用这个）"
          disabled={sending || cardMissing}
          onClick={handleAskReply}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <textarea
          className="fc-input"
          rows={1}
          value={input}
          placeholder="说点什么"
          disabled={cardMissing}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="button"
          className="fc-send"
          aria-label="发送"
          disabled={sending || cardMissing || !input.trim()}
          onClick={handleSend}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FriendChatRoom;
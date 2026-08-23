import React, { useState } from 'react';
import {
  CheckCheck,
  RotateCw,
  Quote,
  Trash2,
  Sparkles,
  UserRound
} from 'lucide-react';
import StickerCard from '../../messages/components/cards/StickerCard';
import ImageCard from '../../messages/components/cards/ImageCard';
import VoiceCard from '../../messages/components/cards/VoiceCard';

const AvatarFallback = ({ name }) => (
  <div
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
    style={{
      backgroundColor: 'var(--control-soft-bg)',
      borderColor: 'var(--card-border)',
      color: 'var(--text-sub)'
    }}
  >
    {name ? (
      <span className="text-[10px] font-semibold">{name.slice(0, 1)}</span>
    ) : (
      <UserRound className="h-3.5 w-3.5" />
    )}
  </div>
);

const MessageAvatar = ({ avatar, name }) => {
  if (!avatar) {
    return <AvatarFallback name={name} />;
  }

  return (
    <img
      src={avatar}
      alt=""
      className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
      style={{ borderColor: 'var(--card-border)' }}
    />
  );
};

export const EnsembleMessageItem = ({
  msg,
  onQuote,
  onRegenerate,
  onDelete,
  onSummonChar
}) => {
  const [isActionsVisible, setIsActionsVisible] = useState(false);
  const isUser = msg.senderType === 'user';

  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const toggleActions = () => {
    setIsActionsVisible((previous) => !previous);
  };

  const hideActions = () => {
    setIsActionsVisible(false);
  };

  const actionStyle = {
    opacity: isActionsVisible ? 1 : 0,
    pointerEvents: isActionsVisible ? 'auto' : 'none',
    transform: isActionsVisible
      ? 'translateY(0) scale(1)'
      : 'translateY(5px) scale(0.96)',
    visibility: isActionsVisible ? 'visible' : 'hidden',
    transition:
      'opacity 180ms ease, transform 180ms ease, visibility 180ms ease',
    backgroundColor: 'var(--modal-bg)',
    borderColor: 'var(--modal-border)',
    color: 'var(--text-main)'
  };

  const actionButtonStyle = {
    color: 'var(--text-sub)'
  };

  return (
    <article
      className={`relative my-4 flex w-full ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => setIsActionsVisible(true)}
      onMouseLeave={hideActions}
    >
      <div
        className={`relative flex max-w-[88%] items-end gap-2 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* 每个 User 身份 / AI 角色都显示独立头像 */}
        <MessageAvatar avatar={msg.senderAvatar} name={msg.senderName} />

        <div
          className={`relative flex min-w-0 flex-col ${
            isUser ? 'items-end' : 'items-start'
          }`}
          onClick={toggleActions}
        >
          {/* 名称仅作为轻量标签，不形成实体顶部栏 */}
          <div
            className={`mb-1 flex max-w-full items-center gap-1 px-1 text-[10px] ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="truncate">{msg.senderName || '未命名身份'}</span>
          </div>

          {/* 引用内容 */}
          {msg.quotedMessage && (
            <div
              className={`mb-1 w-fit max-w-full rounded-xl border-l-2 px-2.5 py-1 text-left text-[10px] leading-relaxed ${
                isUser ? 'self-end' : 'self-start'
              }`}
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--accent-color)',
                color: 'var(--text-sub)'
              }}
            >
              <span className="mr-1 font-semibold">
                {msg.quotedMessage.senderName || '引用消息'}：
              </span>
              <span className="line-clamp-2">
                {msg.quotedMessage.content || '媒体消息'}
              </span>
            </div>
          )}

          <div className="relative max-w-full">
            {/* 
              操作条：
              绝不常驻。
              仅在 article hover 或当前消息被点击后，由 state 显示。
            */}
            <div
              className={`absolute -top-9 z-20 flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm backdrop-blur-md ${
                isUser ? 'right-0' : 'left-0'
              }`}
              style={actionStyle}
              onClick={(event) => event.stopPropagation()}
              onMouseEnter={() => setIsActionsVisible(true)}
            >
              <button
                type="button"
                title="引用消息"
                aria-label="引用消息"
                className="rounded-full p-1 transition-transform active:scale-95"
                style={actionButtonStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  onQuote?.(msg);
                  hideActions();
                }}
              >
                <Quote className="h-3.5 w-3.5" />
              </button>

              {!isUser && onRegenerate && (
                <button
                  type="button"
                  title="重新生成"
                  aria-label="重新生成"
                  className="rounded-full p-1 transition-transform active:scale-95"
                  style={actionButtonStyle}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRegenerate(msg);
                    hideActions();
                  }}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                title="删除消息"
                aria-label="删除消息"
                className="rounded-full p-1 transition-transform active:scale-95"
                style={{
                  color: 'var(--text-muted)'
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(msg.id);
                  hideActions();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 文本消息 */}
            {msg.type === 'text' && (
              <div
                className={`w-fit max-w-full break-words px-3.5 py-2.5 text-left text-xs leading-relaxed shadow-sm ${
                  isUser ? 'ensemble-bubble-user' : 'ensemble-bubble-char'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}

            {/* 表情包：使用项目既有 StickerCard 的 metadata 协议 */}
            {msg.type === 'sticker' && (
              <StickerCard
                metadata={
                  msg.metadata || {
                    url: msg.content || '',
                    name: '表情包'
                  }
                }
                isUser={isUser}
              />
            )}

            {/* 图片叙事卡：不是上传真实图片，使用项目既有 ImageCard */}
            {msg.type === 'image' && (
              <ImageCard
                content={msg.content}
                metadata={
                  msg.metadata || {
                    description: msg.content || ''
                  }
                }
              />
            )}

            {/* 语音卡 */}
            {msg.type === 'voice' && (
              <VoiceCard content={msg.content} metadata={msg.metadata || {}} />
            )}
          </div>

          {/* AI 消息的轻量“召唤回应”按钮，也与操作条相同：仅 hover / 点击时显示 */}
          {!isUser && onSummonChar && (
            <button
              type="button"
              className="mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-all"
              style={{
                opacity: isActionsVisible ? 0.72 : 0,
                visibility: isActionsVisible ? 'visible' : 'hidden',
                pointerEvents: isActionsVisible ? 'auto' : 'none',
                backgroundColor: 'var(--control-soft-bg)',
                color: 'var(--text-sub)',
                transition: 'opacity 180ms ease, visibility 180ms ease'
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSummonChar(msg.characterId);
                hideActions();
              }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>召唤回应</span>
            </button>
          )}

          {/* 时间戳与已读状态：始终位于气泡下方 */}
          <div
            className={`mt-1 flex items-center gap-1 px-1 text-[9px] ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{timeStr}</span>
            {isUser && <CheckCheck className="h-3 w-3" />}
          </div>
        </div>
      </div>
    </article>
  );
};

export default EnsembleMessageItem;

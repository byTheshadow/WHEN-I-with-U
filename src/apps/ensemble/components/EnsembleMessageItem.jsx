import React, { useState } from 'react';
import { CheckCheck, RotateCw, Quote, Trash2, Sparkles, User } from 'lucide-react';
import StickerCard from '../../messages/components/cards/StickerCard';
import ImageCard from '../../messages/components/cards/ImageCard';
import VoiceCard from '../../messages/components/cards/VoiceCard';

export const EnsembleMessageItem = ({
  msg,
  onQuote,
  onRegenerate,
  onDelete,
  onSummonChar
}) => {
  const [isTapped, setIsTapped] = useState(false);
  const isUser = msg.senderType === 'user';

  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      onClick={() => setIsTapped(!isTapped)}
      className={`ensemble-msg-card group relative flex flex-col my-3 transition-all ${
        isUser ? 'items-end' : 'items-start'
      } ${isTapped ? 'active-tap' : ''}`}
    >
      {/* 发件人头像与名称标题 */}
      <div className={`flex items-center gap-1.5 mb-1 px-1 text-[10px] opacity-70 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {msg.senderAvatar ? (
          <img src={msg.senderAvatar} alt="" className="w-4 h-4 rounded-full object-cover border" style={{ borderColor: 'var(--card-border)' }} />
        ) : (
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
            {msg.senderName?.[0] || <User className="w-2.5 h-2.5" />}
          </div>
        )}
        <span className="font-medium" style={{ color: 'var(--text-main)' }}>{msg.senderName}</span>
      </div>

      {/* 引用上文区域 */}
      {msg.quotedMessage && (
        <div
          className="max-w-[85%] text-[10px] px-2.5 py-1 mb-1 rounded-xl border-l-2 opacity-75 truncate"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--accent-color)',
            color: 'var(--text-sub)'
          }}
        >
          <span className="font-semibold mr-1">{msg.quotedMessage.senderName}:</span>
          {msg.quotedMessage.content}
        </div>
      )}

      {/* 消息本体与浮动操作栏 */}
      <div className="relative max-w-[85%]">
        {/* 操作悬浮栏：默认 100% 隐藏 */}
        <div
          className={`ensemble-msg-actions absolute -top-8 ${
            isUser ? 'right-0' : 'left-0'
          } z-30 flex items-center gap-0.5 px-2 py-1 rounded-full shadow-lg border backdrop-blur-xl`}
          style={{
            backgroundColor: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)',
            color: 'var(--text-main)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onQuote(msg)}
            title="引用"
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <Quote className="w-3 h-3 opacity-75" />
          </button>

          {!isUser && onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(msg)}
              title="重新生成"
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <RotateCw className="w-3 h-3 opacity-75" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(msg.id)}
            title="删除"
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-red-500 opacity-80 hover:opacity-100 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* 消息分发 */}
        {msg.type === 'text' && (
          <div
            className={`w-fit max-w-full text-left break-words px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
              isUser ? 'ensemble-bubble-user' : 'ensemble-bubble-char'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        )}

        {msg.type === 'sticker' && (
          <StickerCard metadata={msg.metadata || { url: msg.content, name: '表情包' }} isUser={isUser} />
        )}

        {msg.type === 'image' && (
          <ImageCard content={msg.content} metadata={msg.metadata || { description: msg.content }} />
        )}

        {msg.type === 'voice' && (
          <VoiceCard content={msg.content} metadata={msg.metadata || {}} />
        )}
      </div>

      {/* 快捷召唤回应 */}
      {!isUser && onSummonChar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSummonChar(msg.characterId);
          }}
          className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] opacity-50 hover:opacity-100 transition-opacity border"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-sub)'
          }}
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>召唤回应</span>
        </button>
      )}

      {/* 时间戳与已读标记 */}
      <div
        className={`flex items-center gap-1 mt-1 text-[9px] font-mono opacity-50 px-1 ${
          isUser ? 'justify-end' : 'justify-start'
        }`}
        style={{ color: 'var(--text-muted)' }}
      >
        <span>{timeStr}</span>
        {isUser && <CheckCheck className="w-3 h-3 text-current" />}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { CheckCheck, RotateCw, Quote, Trash2, Sparkles } from 'lucide-react';
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
      className={`ensemble-msg-item group relative flex flex-col my-3 transition-all ${
        isUser ? 'items-end' : 'items-start'
      } ${isTapped ? 'active-tap' : ''}`}
    >
      {/* 发件人/身份标签 */}
      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] opacity-60">
        {!isUser && msg.senderAvatar && (
          <img src={msg.senderAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
        )}
        <span>{msg.senderName}</span>
        {isUser && msg.senderAvatar && (
          <img src={msg.senderAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
        )}
      </div>

      {/* 被引用的上条消息简述 */}
      {msg.quotedMessage && (
        <div
          className="max-w-[85%] text-[10px] px-2.5 py-1 mb-1 rounded-lg border-l-2 opacity-75 truncate"
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

      {/* 消息本体与悬浮快捷按钮 */}
      <div className="relative max-w-[85%]">
        {/* 悬浮/点击才浮现的操作栏 (彻底避免干扰 UI) */}
        <div
          className={`ensemble-msg-actions absolute -top-8 ${
            isUser ? 'right-0' : 'left-0'
          } z-20 flex items-center gap-1 px-2 py-1 rounded-full shadow-md text-xs backdrop-blur-md`}
          style={{
            backgroundColor: 'var(--modal-bg)',
            border: '1px solid var(--modal-border)',
            color: 'var(--text-main)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onQuote(msg)}
            title="引用消息"
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Quote className="w-3 h-3 opacity-70" />
          </button>

          {!isUser && onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(msg)}
              title="重 roll 生成"
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            >
              <RotateCw className="w-3 h-3 opacity-70" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(msg.id)}
            title="删除消息"
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-red-500 opacity-80 hover:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* 根据消息类型精准对接标准组件 */}
        {msg.type === 'text' && (
          <div
            className={`w-fit max-w-full text-left break-words px-3.5 py-2.5 text-xs leading-relaxed transition-shadow shadow-sm ${
              isUser ? 'ensemble-bubble-user' : 'ensemble-bubble-char'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        )}

        {/* 真正的 StickerCard 对接 */}
        {msg.type === 'sticker' && (
          <StickerCard metadata={msg.metadata || { url: msg.content }} isUser={isUser} />
        )}

        {/* 真正的 ImageCard (支持 3D 翻面查看画面叙事) 对接 */}
        {msg.type === 'image' && (
          <ImageCard content={msg.content} metadata={msg.metadata || { description: msg.content }} />
        )}

        {/* 真正的 VoiceCard 对接 */}
        {msg.type === 'voice' && (
          <VoiceCard content={msg.content} metadata={msg.metadata} />
        )}
      </div>

      {/* 快捷召唤指定 AI 角色继续回应 */}
      {!isUser && onSummonChar && (
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSummonChar(msg.characterId)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] opacity-60 hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              color: 'var(--text-sub)'
            }}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>召唤其接话</span>
          </button>
        </div>
      )}

      {/* 时间戳与已读标记：彻底置于气泡正下方 */}
      <div
        className={`flex items-center gap-1 mt-1 text-[9px] font-mono opacity-50 px-1 ${
          isUser ? 'justify-end' : 'justify-start'
        }`}
      >
        <span>{timeStr}</span>
        {isUser && <CheckCheck className="w-3 h-3 text-current" />}
      </div>
    </div>
  );
};

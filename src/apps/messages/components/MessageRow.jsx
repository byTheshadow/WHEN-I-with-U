import React from 'react';

import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Quote,
  Trash2,
  CheckCheck,
  Check,
  User,
} from 'lucide-react';

import ChatInteractionMessage from '../interactions/ChatInteractionMessage';
import RealVoiceCard from '../../../features/real-voice/components/RealVoiceCard';

import TextCard from './cards/TextCard';
import ImageCard from './cards/ImageCard';
import VoiceCard from './cards/VoiceCard';
import TransferCard from './cards/TransferCard';
import ArticleCard from './cards/ArticleCard';
import GiftCard from './cards/GiftCard';
import FoodDeliveryCard from './cards/FoodDeliveryCard';
import KinshipCard from './cards/KinshipCard';
import StickerCard from './cards/StickerCard';
import McpUsageTraceCard from './cards/McpUsageTraceCard';
import McdOrderCard from './cards/McdOrderCard';

const MessageRow = ({
  msg,
  quoted,
  character,
  activeUserAvatar,
  activeUserName,
  isAiTyping,
  onReroll,
  onDelete,
  onQuote,
  onSwitchVersion,
  onResolvedInteraction,
}) => {
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

const messageOrderCard = isUser
  ? null
  : msg.metadata?.mcdOrderCard?.cards?.[0]; // getOrderCardSummary 存的是 {cards:[...]}，历史消息取第一张

  return (
    <div
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
                onClick={() => onReroll(msg.id)}
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
              onResolved={onResolvedInteraction}
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

              {msg.type === 'realVoice' && (
                <RealVoiceCard
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

          {!isUser && messageMcpTrace && (
  <McpUsageTraceCard
    trace={messageMcpTrace}
  />
)}

{!isUser && messageOrderCard && (
  <McdOrderCard
    orderCard={messageOrderCard}
  />
)}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isUser && (
            <button
              type="button"
              onClick={() => onReroll(msg.id)}
              disabled={isAiTyping}
              className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
              title="重 roll 此回复"
            >
              <RotateCw className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onQuote(msg)}
            className="p-1 opacity-50 hover:opacity-100"
            title="引用"
          >
            <Quote className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(msg.id)}
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
              onClick={() => onSwitchVersion(msg, 'prev')}
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
              onClick={() => onSwitchVersion(msg, 'next')}
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
};

export default React.memo(MessageRow);
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  Sliders,
  Send,
  Sparkles,
  Smile,
  Image as ImageIcon,
  Cat
} from 'lucide-react';
import db from '../../db';
import { generateEnsembleAiResponse } from './ensembleService';
import { EnsembleUserSelector } from './components/EnsembleUserSelector';
import { EnsembleMessageItem } from './components/EnsembleMessageItem';
import { EnsembleSettingsModal } from './components/EnsembleSettingsModal';
import { EnsembleImagePromptModal } from './components/EnsembleImagePromptModal';
import StickerPickerModal from '../messages/components/StickerPickerModal';

export const EnsembleRoom = ({
  chatId,
  onBack,
  onChatRoomStateChange
}) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState(null);

  const [userIdentities, setUserIdentities] = useState([]);
  const [currentIdentityId, setCurrentIdentityId] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    onChatRoomStateChange?.(true);
    void loadRoomData();

    return () => {
      onChatRoomStateChange?.(false);
    };
  }, [chatId]);

  const loadRoomData = async () => {
    const chatDoc = await db.ensembleChats.get(chatId);

    if (!chatDoc) return;

    const identities =
      chatDoc.userIdentities?.length > 0
        ? chatDoc.userIdentities
        : [
            {
              id: 'u_default',
              name: '我',
              avatar: '',
              persona: '主视角'
            }
          ];

    setChat(chatDoc);
    setUserIdentities(identities);
    setCurrentIdentityId(
      chatDoc.currentIdentityId || identities[0]?.id || 'u_default'
    );

    await loadMessages();
  };

  const loadMessages = async () => {
    const records = await db.ensembleMessages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    const messageMap = new Map(records.map((item) => [item.id, item]));

    const enrichedMessages = records.map((item) => ({
      ...item,
      quotedMessage: item.quotedMessageId
        ? messageMap.get(item.quotedMessageId) || null
        : null
    }));

    setMessages(enrichedMessages);

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    });
  };

  const getCurrentIdentity = () => {
    return (
      userIdentities.find((item) => item.id === currentIdentityId) ||
      userIdentities[0] || {
        id: 'u_default',
        name: '我',
        avatar: '',
        persona: '主视角'
      }
    );
  };

  const persistUserIdentities = async (
    nextIdentities,
    nextCurrentIdentityId = currentIdentityId
  ) => {
    setUserIdentities(nextIdentities);
    setCurrentIdentityId(nextCurrentIdentityId);

    await db.ensembleChats.update(chatId, {
      userIdentities: nextIdentities,
      currentIdentityId: nextCurrentIdentityId,
      updatedAt: Date.now()
    });

    setChat((previous) =>
      previous
        ? {
            ...previous,
            userIdentities: nextIdentities,
            currentIdentityId: nextCurrentIdentityId
          }
        : previous
    );
  };

  const handleInputTextChange = (event) => {
    setInputText(event.target.value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const writeUserMessage = async ({
    type = 'text',
    content = '',
    metadata = {}
  }) => {
    const identity = getCurrentIdentity();

    const message = {
      chatId,
      senderId: identity.id,
      senderName: identity.name || '我',
      senderAvatar: identity.avatar || '',
      senderType: 'user',
      type,
      content,
      metadata,
      quotedMessageId: quotedMessage?.id || null,
      isRead: true,
      timestamp: Date.now()
    };

    const messageId = await db.ensembleMessages.add(message);

    await db.ensembleChats.update(chatId, {
      updatedAt: Date.now()
    });

    setQuotedMessage(null);

    return {
      ...message,
      id: messageId
    };
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const content = inputText.trim();
    if (!content) return;

    await writeUserMessage({
      type: 'text',
      content,
      metadata: {}
    });

    setInputText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await loadMessages();
  };

  const handleTriggerAi = async (targetCharacterId = null) => {
    if (isAiThinking) return;

    setIsAiThinking(true);

    try {
      await generateEnsembleAiResponse(chatId, {
        targetCharacterId
      });

      await loadRoomData();
    } catch (error) {
      console.error('Ensemble AI generation failed:', error);
    } finally {
      setIsAiThinking(false);
    }
  };

  /*
   * StickerPickerModal 回传的是完整 sticker 对象：
   * {
   *   id,
   *   name,
   *   url,
   *   category,
   *   createdAt
   * }
   *
   * StickerCard 读取 metadata.url 与 metadata.name，
   * 所以必须按这个协议存储。
   */
  const handleSelectSticker = async (sticker) => {
    if (!sticker?.url) {
      console.warn('Sticker selection is invalid:', sticker);
      return;
    }

    await writeUserMessage({
      type: 'sticker',
      content: '',
      metadata: {
        url: sticker.url,
        name: sticker.name || '表情包',
        stickerId: sticker.id ?? null,
        category: sticker.category || 'default'
      }
    });

    setShowStickerPicker(false);
    await loadMessages();
  };

  /*
   * 图片按钮不上传真实图片。
   * 它发送项目既有 ImageCard 所使用的图片叙事卡：
   * - content: 正面简述
   * - metadata.description: 翻面细节
   */
  const handleSendImageNarrativeCard = async (cardData) => {
    if (!cardData?.content?.trim()) return;

    await writeUserMessage({
      type: 'image',
      content: cardData.content.trim(),
      metadata: {
        description:
          cardData.metadata?.description?.trim() ||
          '静谧的画面细节停留在此刻。'
      }
    });

    setShowImagePromptModal(false);
    await loadMessages();
  };

  const handleQuoteMessage = (message) => {
    setQuotedMessage(message);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleDeleteMessage = async (messageId) => {
    await db.ensembleMessages.delete(messageId);

    if (quotedMessage?.id === messageId) {
      setQuotedMessage(null);
    }

    await loadMessages();
  };

  const handleRegenerateMessage = async (message) => {
    if (!message || message.senderType === 'user') return;

    await db.ensembleMessages.delete(message.id);
    await loadMessages();

    await handleTriggerAi(message.characterId || message.senderId);
  };

  const handleAddTemporaryIdentity = async (identity) => {
    const nextIdentities = [...userIdentities, identity];
    await persistUserIdentities(nextIdentities, identity.id);
  };

  const handleUpdateIdentity = async (identityId, patch) => {
    const nextIdentities = userIdentities.map((identity) =>
      identity.id === identityId
        ? {
            ...identity,
            ...patch
          }
        : identity
    );

    await persistUserIdentities(nextIdentities);
  };

  const handleSelectIdentity = async (identityId) => {
    await persistUserIdentities(userIdentities, identityId);
  };

  if (!chat) return null;

  return (
    <div className="ensemble-container relative flex h-[100dvh] w-full flex-col overflow-hidden">
      {chat.bgImage && (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `url(${chat.bgImage})`,
            opacity: chat.bgOpacity ?? 0.2
          }}
        />
      )}

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回群聊列表"
          className="pointer-events-auto rounded-full border p-2.5 shadow-md backdrop-blur-md transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          className="max-w-[180px] truncate rounded-full border px-3.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-md"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          {chat.title}
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label="打开群聊档案"
          className="pointer-events-auto rounded-full border p-2.5 shadow-md backdrop-blur-md transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>

      <section className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 pt-14 no-scrollbar">
        {messages.map((message) => (
          <EnsembleMessageItem
            key={message.id}
            msg={message}
            onQuote={handleQuoteMessage}
            onRegenerate={handleRegenerateMessage}
            onDelete={handleDeleteMessage}
            onSummonChar={handleTriggerAi}
          />
        ))}

        {isAiThinking && (
          <div
            className="my-3 flex w-fit items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-sm backdrop-blur-md"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Cat className="h-3.5 w-3.5 animate-bounce" />
            <span>角色正在组织下一段回应</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </section>

      <section className="relative z-20 w-full px-3 pb-3 pt-1">
        <EnsembleUserSelector
          userIdentities={userIdentities}
          currentIdentityId={currentIdentityId}
          onSelectIdentity={handleSelectIdentity}
          onAddTempIdentity={handleAddTemporaryIdentity}
          onUpdateIdentity={handleUpdateIdentity}
        />

        {quotedMessage && (
          <div
            className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs backdrop-blur-md"
            style={{
              backgroundColor: 'var(--modal-bg)',
              borderColor: 'var(--modal-border)',
              color: 'var(--text-main)'
            }}
          >
            <span className="min-w-0 truncate opacity-80">
              引用 {quotedMessage.senderName || '消息'}：
              {quotedMessage.type === 'text'
                ? quotedMessage.content
                : '媒体消息'}
            </span>

            <button
              type="button"
              onClick={() => setQuotedMessage(null)}
              className="shrink-0 text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              取消
            </button>
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-1.5 rounded-3xl border p-2 shadow-xl backdrop-blur-xl"
          style={{
            backgroundColor: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)'
          }}
        >
          <button
            type="button"
            onClick={() => setShowStickerPicker(true)}
            aria-label="打开表情包库"
            className="shrink-0 rounded-full p-2 transition-transform active:scale-95"
            style={{ color: 'var(--text-main)' }}
          >
            <Smile className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowImagePromptModal(true)}
            aria-label="发送图片叙事卡"
            className="shrink-0 rounded-full p-2 transition-transform active:scale-95"
            style={{ color: 'var(--text-main)' }}
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputTextChange}
            placeholder="输入对话或动作描述..."
            className="ensemble-textarea-scroll max-h-32 flex-1 resize-none bg-transparent px-3 py-1.5 text-xs outline-none"
            style={{ color: 'var(--text-main)' }}
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            aria-label="发送消息"
            className="shrink-0 rounded-full p-2.5 shadow-sm transition-transform active:scale-95 disabled:opacity-30"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Send className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleTriggerAi()}
            disabled={isAiThinking}
            aria-label="触发角色回应"
            className="shrink-0 rounded-full border p-2.5 shadow-sm transition-transform active:scale-95 disabled:opacity-40"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </form>
      </section>

      <StickerPickerModal
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={handleSelectSticker}
      />

      {showImagePromptModal && (
        <EnsembleImagePromptModal
          onClose={() => setShowImagePromptModal(false)}
          onSubmit={handleSendImageNarrativeCard}
        />
      )}

      {showSettings && (
        <EnsembleSettingsModal
          chatId={chatId}
          onClose={() => setShowSettings(false)}
          onUpdated={loadRoomData}
        />
      )}
    </div>
  );
};

export default EnsembleRoom;

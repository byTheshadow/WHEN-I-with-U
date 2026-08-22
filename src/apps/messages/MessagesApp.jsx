import React, { useState, useEffect } from 'react';
import { Plus, Search, MessageSquare, ArrowLeft, Trash2 } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import ConfirmModal from '../../components/ConfirmModal';
import db from '../../db';
import { subscribeAiEvents } from '../../services/aiService';

import ChatRoom from './ChatRoom';
import CharacterLibrary from './CharacterLibrary';
import CharacterEditor from './CharacterEditor';
import NewChatModal from './NewChatModal';

export const MessagesApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [view, setView] = useState('chats');
  const [activeChatId, setActiveChatId] = useState(null);
  const [editingChar, setEditingChar] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [deletingChatTarget, setDeletingChatTarget] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    onChatRoomStateChange?.(view === 'chat_room');
  }, [view, onChatRoomStateChange]);

  useEffect(() => {
    const unsubscribe = subscribeAiEvents(() => {
      loadData();
    });
    return unsubscribe;
  }, []);

    const loadData = async () => {
    try {
      const chatList = await db.chats.orderBy('updatedAt').reverse().toArray();
      const charList = await db.characters.toArray();
      setChats(Array.isArray(chatList) ? chatList : []);
      setCharacters(Array.isArray(charList) ? charList : []);
    } catch (err) {
      console.error('[MessagesApp] loadData failed safely:', err);
    }
  };


  const handleOpenChat = (chatId) => {
    setActiveChatId(chatId);
    setView('chat_room');
  };

  const handleOpenCharEditor = (charData) => {
    setEditingChar(charData);
    setView('char_editor');
  };

  const handleDeleteChatEntity = async (chatId) => {
    if (!chatId) return;
    await db.chats.delete(chatId);
    await db.messages.where('chatId').equals(chatId).delete();
    setDeletingChatTarget(null);
    loadData();
  };

  const filteredChats = chats.filter((c) => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()));

  if (view === 'chat_room' && activeChatId) {
    return (
      <ChatRoom
        chatId={activeChatId}
        onBack={() => {
          setView('chats');
          loadData();
        }}
        onRoomStateChange={(inRoom) => onChatRoomStateChange?.(inRoom)}
        onOpenCharacterEditor={() => {
          const currentChat = chats.find((c) => c.id === activeChatId);
          const char = characters.find((ch) => ch.id === currentChat?.characterId);
          if (char) handleOpenCharEditor(char);
        }}
      />
    );
  }

  if (view === 'char_editor') {
    return (
      <CharacterEditor
        characterData={editingChar}
        onBack={() => setView('characters')}
        onSaved={() => loadData()}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-12 text-xs text-left">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-2 font-semibold opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回主页</span>
        </button>

        <div
          className="flex items-center gap-1 p-1 rounded-full border shadow-sm"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <button
            type="button"
            onClick={() => setView('chats')}
            className="px-3 py-1 rounded-full transition-all text-xs"
            style={{
              background: view === 'chats' ? 'var(--accent-color)' : 'transparent',
              color: view === 'chats' ? 'var(--accent-foreground)' : 'var(--text-sub)',
              fontWeight: view === 'chats' ? 600 : 400
            }}
          >
            对话
          </button>
          <button
            type="button"
            onClick={() => setView('characters')}
            className="px-3 py-1 rounded-full transition-all text-xs"
            style={{
              background: view === 'characters' ? 'var(--accent-color)' : 'transparent',
              color: view === 'characters' ? 'var(--accent-foreground)' : 'var(--text-sub)',
              fontWeight: view === 'characters' ? 600 : 400
            }}
          >
            角色
          </button>
        </div>
      </div>

      {view === 'chats' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl border"
              style={{
                background: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <Search className="w-3.5 h-3.5 opacity-40" />
              <input
                type="text"
                placeholder="搜索心绪对话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-xs"
                style={{ color: 'var(--text-main)' }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="p-2.5 rounded-2xl active:scale-95 transition-transform shadow-sm"
              style={{
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
              title="开启新对话"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {filteredChats.length === 0 ? (
            <GlassCard className="py-12 text-center space-y-2 opacity-60">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs" style={{ color: 'var(--text-sub)' }}>
                风停在这里，点击右上角 + 开始第一段浪漫陪伴。
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2.5">
              {filteredChats.map((chatItem) => {
                const char = characters.find((c) => c.id === chatItem.characterId);
                return (
                  <GlassCard
                    key={chatItem.id}
                    className="flex items-center justify-between p-4 group hover:opacity-95 transition-all relative"
                  >
                    <div
                      onClick={() => handleOpenChat(chatItem.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      {char?.avatar ? (
                        <img src={char.avatar} alt={chatItem.title} className="w-11 h-11 rounded-full object-cover border border-white/20 shrink-0 shadow-sm" />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm"
                          style={{
                            background: 'var(--control-soft-bg)',
                            color: 'var(--text-main)'
                          }}
                        >
                          {chatItem.title?.[0] || 'C'}
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-sm truncate" style={{ color: 'var(--text-main)' }}>{chatItem.title}</h4>
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-mono border"
                            style={{
                              borderColor: 'var(--divider)',
                              background: 'var(--control-soft-bg)',
                              color: 'var(--text-muted)'
                            }}
                          >
                            {chatItem.mode === 'rp' ? 'RP' : 'Real'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-60 truncate" style={{ color: 'var(--text-sub)' }}>
  {typeof chatItem.summary === 'string' && chatItem.summary.trim()
    ? chatItem.summary 
    : (Array.isArray(chatItem.summary) && chatItem.summary.length > 0 
        ? chatItem.summary.join(' ') 
        : `开启与 ${char?.name || '伴侣'} 的独处时刻`)}
</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChatTarget(chatItem);
                      }}
                      className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--control-soft-bg)] rounded-full"
                      title="抹去此对话实体"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'characters' && (
        <CharacterLibrary
          onSelectCharacter={(char) => handleOpenCharEditor(char)}
          onCreateNew={() => handleOpenCharEditor(null)}
        />
      )}

      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onCreated={(newChat) => {
            setShowNewChatModal(false);
            handleOpenChat(newChat.id);
          }}
          onCreateNewCharacter={() => {
            setShowNewChatModal(false);
            handleOpenCharEditor(null);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deletingChatTarget}
        title="抹去共同记忆"
        message={`确定要彻底销毁与“${deletingChatTarget?.title}”的对话实体吗？此操作不可逆，聊天记录与心绪总结将一并抹去。`}
        confirmText="彻底抹去"
        cancelText="留存"
        onCancel={() => setDeletingChatTarget(null)}
        onConfirm={() => handleDeleteChatEntity(deletingChatTarget.id)}
      />
    </div>
  );
};

export default MessagesApp;


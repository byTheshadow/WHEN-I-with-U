import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, MessageSquare, ArrowLeft } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

import ChatRoom from './ChatRoom';
import CharacterLibrary from './CharacterLibrary';
import CharacterEditor from './CharacterEditor';
import NewChatModal from './NewChatModal';

export const MessagesApp = ({ onBackHub }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [view, setView] = useState('chats'); // 'chats' | 'characters' | 'chat_room' | 'char_editor'
  const [activeChatId, setActiveChatId] = useState(null);
  const [editingChar, setEditingChar] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [view]);

  const loadData = async () => {
    const chatList = await db.chats.orderBy('updatedAt').reverse().toArray();
    const charList = await db.characters.toArray();
    setChats(chatList);
    setCharacters(charList);
  };

  const handleOpenChat = (chatId) => {
    setActiveChatId(chatId);
    setView('chat_room');
  };

  const handleOpenCharEditor = (charData) => {
    setEditingChar(charData);
    setView('char_editor');
  };

  const filteredChats = chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (view === 'chat_room' && activeChatId) {
    return (
      <ChatRoom
        chatId={activeChatId}
        onBack={() => setView('chats')}
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
      {/* 顶部 Header 导航 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-2 font-semibold opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Hub</span>
        </button>

        {/* 精美 Pill shape 视图按钮，绝对没有长条导航栏 */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-black/5 dark:bg-white/10 border border-white/10">
          <button
            type="button"
            onClick={() => setView('chats')}
            className={`px-3 py-1 rounded-full transition-all ${
              view === 'chats' ? 'bg-black text-white dark:bg-white dark:text-black font-semibold' : 'opacity-60'
            }`}
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => setView('characters')}
            className={`px-3 py-1 rounded-full transition-all ${
              view === 'characters' ? 'bg-black text-white dark:bg-white dark:text-black font-semibold' : 'opacity-60'
            }`}
          >
            Characters
          </button>
        </div>
      </div>

      {/* 搜素与新建对话栏 */}
      {view === 'chats' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/5 dark:bg-white/10 border border-white/10">
              <Search className="w-3.5 h-3.5 opacity-40" />
              <input
                type="text"
                placeholder="搜索聊天窗口..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="p-2.5 rounded-2xl bg-black text-white dark:bg-white dark:text-black active:scale-95 transition-all"
              title="新建聊天窗"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {filteredChats.length === 0 ? (
            <GlassCard className="py-12 text-center space-y-2 opacity-50">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">尚无聊天记录，点击右上角 + 开始新的陪伴对话。</p>
            </GlassCard>
          ) : (
            <div className="space-y-2.5">
              {filteredChats.map((chat) => {
                const char = characters.find((c) => c.id === chat.characterId);
                return (
                  <GlassCard
                    key={chat.id}
                    onClick={() => handleOpenChat(chat.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:opacity-90 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {char?.avatar ? (
                        <img src={char.avatar} alt={chat.title} className="w-11 h-11 rounded-full object-cover border border-white/20 shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold shrink-0">
                          {chat.title?.[0]}
                        </div>
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-sm truncate">{chat.title}</h4>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono border ${
                            chat.mode === 'rp' ? 'border-purple-500/30 bg-purple-500/10 text-purple-500' : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                          }`}>
                            {chat.mode === 'rp' ? 'RP' : 'Real'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-60 truncate">点击进入与 {char?.name || '角色'} 的对话</p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 角色库视图 */}
      {view === 'characters' && (
        <CharacterLibrary
          onSelectCharacter={(char) => handleOpenCharEditor(char)}
          onCreateNew={() => handleOpenCharEditor(null)}
        />
      )}

      {/* 新建聊天窗 Modal */}
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
    </div>
  );
};

export default MessagesApp;

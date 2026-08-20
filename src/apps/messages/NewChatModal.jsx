import React, { useState, useEffect } from 'react';
import { X, Sparkles, ShieldCheck, Plus } from 'lucide-react';
import db from '../../db';

export const NewChatModal = ({ onClose, onCreated, onCreateNewCharacter }) => {
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState('');
  const [mode, setMode] = useState('real'); // 'real' | 'rp'
  const [chatTitle, setChatTitle] = useState('');

  useEffect(() => {
    const loadCharacters = async () => {
      const list = await db.characters.toArray();
      setCharacters(list);
      if (list.length > 0) {
        setSelectedCharId(list[0].id.toString());
      }
    };
    loadCharacters();
  }, []);

  const handleCreate = async () => {
    if (!selectedCharId) return;
    const char = characters.find((c) => c.id.toString() === selectedCharId.toString());
    if (!char) return;

    const newChat = {
      characterId: char.id,
      mode,
      title: chatTitle.trim() || `${char.name} (${mode === 'rp' ? 'RP Mode' : 'Real World'})`,
      updatedAt: new Date().toISOString(),
      bubbleStyle: {
        fontFamily: 'font-sans',
        fontSize: 'text-xs',
        userBg: 'bg-black text-white dark:bg-white dark:text-black',
        aiBg: 'bg-black/5 dark:bg-white/10 text-current'
      },
      typingText: `${char.name} 正在回复...`,
      keepAlive: false
    };

    const chatId = await db.chats.add(newChat);
    newChat.id = chatId;
    onCreated(newChat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in-up">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/20 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-2xl text-xs text-left">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className="font-bold text-sm">发起新聊天窗</span>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {characters.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="opacity-60">角色库为空，请先创建一个角色。</p>
            <button
              type="button"
              onClick={onCreateNewCharacter}
              className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold"
            >
              去创建角色
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block opacity-60 mb-1">选择角色</label>
              <select
                value={selectedCharId}
                onChange={(e) => setSelectedCharId(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2.5 outline-none font-medium"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block opacity-60 mb-1">绑定模式 (固定后不可切换)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('real')}
                  className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                    mode === 'real' ? 'border-black dark:border-white bg-black/5 dark:bg-white/10 font-semibold' : 'border-white/10 opacity-60'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>现实模式</span>
                  </div>
                  <p className="text-[10px] opacity-70">陪伴现实中的 User，督促与关注生活。</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('rp')}
                  className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                    mode === 'rp' ? 'border-black dark:border-white bg-black/5 dark:bg-white/10 font-semibold' : 'border-white/10 opacity-60'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>RP 模式</span>
                  </div>
                  <p className="text-[10px] opacity-70">沉浸于特定世界书背景与特定剧情人设。</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block opacity-60 mb-1">聊天窗名称 (可选)</label>
              <input
                type="text"
                placeholder="默认为角色名与模式"
                value={chatTitle}
                onChange={(e) => setChatTitle(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              className="w-full py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold active:scale-95 transition-all mt-2"
            >
              开启对话
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;

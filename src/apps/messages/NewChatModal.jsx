import React, { useEffect, useState } from 'react';
import { X, Sparkles, ShieldCheck } from 'lucide-react';
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

  const getModeCardStyle = (isSelected) => ({
    borderColor: isSelected ? 'var(--accent-color)' : 'var(--divider)',
    background: isSelected ? 'var(--control-soft-bg)' : 'transparent',
    color: isSelected ? 'var(--text-main)' : 'var(--text-sub)',
  });

  const controlStyle = {
    background: 'var(--control-soft-bg)',
    color: 'var(--text-main)',
    border: '1px solid var(--divider)',
  };

  const accentButtonStyle = {
    background: 'var(--accent-color)',
    color: 'var(--accent-foreground)',
  };

  const handleCreate = async () => {
    if (!selectedCharId) return;

    const char = characters.find(
      (character) => character.id.toString() === selectedCharId.toString(),
    );

    if (!char) return;

    const newChat = {
      characterId: char.id,
      mode,
      title:
        chatTitle.trim() ||
        `${char.name} (${mode === 'rp' ? 'RP Mode' : 'Real World'})`,
      updatedAt: new Date().toISOString(),

      // 保持字符串形式，兼容既有消息气泡 className 的使用方式；
      // 不再使用 Tailwind dark:，统一依赖 themes.css 变量。
      bubbleStyle: {
        fontFamily: 'font-sans',
        fontSize: 'text-xs',
        userBg:
          'bg-[var(--accent-color)] text-[var(--accent-foreground)]',
        aiBg:
          'bg-[var(--control-soft-bg)] text-[var(--text-main)] border border-[var(--divider)]',
      },

      typingText: `${char.name} 正在回复...`,
      keepAlive: false,
    };

    const chatId = await db.chats.add(newChat);
    newChat.id = chatId;

    onCreated(newChat);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in-up"
      style={{ backgroundColor: 'rgba(17, 17, 17, 0.22)' }}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] p-6 space-y-4 text-xs text-left"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: 'var(--divider)' }}
        >
          <span className="font-bold text-sm">发起新聊天窗</span>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭新聊天窗口"
            className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {characters.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p style={{ color: 'var(--text-sub)' }}>
              角色库为空，请先创建一个角色。
            </p>

            <button
              type="button"
              onClick={onCreateNewCharacter}
              className="px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform"
              style={accentButtonStyle}
            >
              去创建角色
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="new-chat-character"
                className="block mb-1"
                style={{ color: 'var(--text-sub)' }}
              >
                选择角色
              </label>

              <select
                id="new-chat-character"
                value={selectedCharId}
                onChange={(event) => setSelectedCharId(event.target.value)}
                className="w-full rounded-lg p-2.5 outline-none font-medium transition-colors"
                style={controlStyle}
              >
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p
                className="block mb-1"
                style={{ color: 'var(--text-sub)' }}
              >
                绑定模式（固定后不可切换）
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('real')}
                  className="p-3 rounded-xl border text-left space-y-1 transition-all"
                  style={getModeCardStyle(mode === 'real')}
                >
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>现实模式</span>
                  </div>

                  <p
                    className="text-[10px]"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    陪伴现实中的 User，督促与关注生活。
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('rp')}
                  className="p-3 rounded-xl border text-left space-y-1 transition-all"
                  style={getModeCardStyle(mode === 'rp')}
                >
                  <div className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>RP 模式</span>
                  </div>

                  <p
                    className="text-[10px]"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    沉浸于特定世界书背景与特定剧情人设。
                  </p>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-chat-title"
                className="block mb-1"
                style={{ color: 'var(--text-sub)' }}
              >
                聊天窗名称（可选）
              </label>

              <input
                id="new-chat-title"
                type="text"
                placeholder="默认为角色名与模式"
                value={chatTitle}
                onChange={(event) => setChatTitle(event.target.value)}
                className="w-full rounded-lg p-2 outline-none transition-colors placeholder:opacity-60"
                style={controlStyle}
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              className="w-full py-3 rounded-xl font-semibold active:scale-95 transition-transform mt-2"
              style={accentButtonStyle}
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

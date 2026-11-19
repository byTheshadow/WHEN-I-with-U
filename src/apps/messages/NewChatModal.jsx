import React, { useEffect, useState } from 'react';
import { X, Sparkles, ShieldCheck, Briefcase, UserPlus, ChevronRight } from 'lucide-react';
import db from '../../db';
import { getOrCreateWorkAssistantCharacter } from './work/workAssistantService';

export const NewChatModal = ({ onClose, onCreated, onCreateNewCharacter, hasPendingFriends = false, onOpenFriends }) => {
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState('');
  const [mode, setMode] = useState('real'); // 'real' | 'rp' | 'work'
  const [chatTitle, setChatTitle] = useState('');
  const [isCreatingWork, setIsCreatingWork] = useState(false);

  useEffect(() => {
    const loadCharacters = async () => {
      // work 助理是全局隐藏身份，不进这个选角色列表。
      const list = await db.characters.toArray();
      const visibleList = list.filter((character) => character.isWorkAssistant !== true);
      setCharacters(visibleList);
      if (visibleList.length > 0) {
        setSelectedCharId(visibleList[0].id.toString());
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

  // work 模式没有"选角色"这一步：所有 work 聊天窗共用同一条全局隐藏的
  // 助理身份记录，这里需要时才懒创建它。
  const handleCreateWork = async () => {
    try {
      setIsCreatingWork(true);

      const workCharacter = await getOrCreateWorkAssistantCharacter();

      const newChat = {
        characterId: workCharacter.id,
        mode: 'work',
        title: chatTitle.trim() || `${workCharacter.name || '助理'}`,
        updatedAt: new Date().toISOString(),

        userName: workCharacter.userName || '',
        userAvatar: workCharacter.userAvatar || '',
        userPersona: workCharacter.userPersona || '',
        inputPlaceholder: `跟${workCharacter.name || '助理'}说点什么...`,
        typingText: '',
        keepAlive: false,
      };

      const chatId = await db.chats.add(newChat);
      newChat.id = chatId;

      onCreated(newChat);
    } finally {
      setIsCreatingWork(false);
    }
  };

  const handleCreate = async () => {
    if (mode === 'work') {
      await handleCreateWork();
      return;
    }

    if (!selectedCharId) return;

    const char = characters.find(
      (character) => character.id.toString() === selectedCharId.toString(),
    );

    if (!char) return;

    // 关键改变：为新创建的 chat 初始化独享的 User 人设与称呼
    const newChat = {
      characterId: char.id,
      mode,
      title:
        chatTitle.trim() ||
        `${char.name} (${mode === 'rp' ? 'RP Mode' : 'Real World'})`,
      updatedAt: new Date().toISOString(),

      userName: char.userName || '',
      userAvatar: char.userAvatar || '',
      userPersona: char.userPersona || '',
            inputPlaceholder: `与 ${char.name} 倾诉...`,
      // 不预设固定的等待文案：留空时 TypingIndicator 会自动使用
      // 内置的可爱轮换文案池，用户之后想固定成一句话也可以自己去
      // 聊天设置里填。
      typingText: '',
      keepAlive: false,
    };

    const chatId = await db.chats.add(newChat);
    newChat.id = chatId;

    onCreated(newChat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div
        className="w-full max-w-sm rounded-[2rem] p-6 space-y-4 text-left text-xs"
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

               {typeof onOpenFriends === 'function' && (
          <button
            type="button"
            onClick={onOpenFriends}
            aria-label={hasPendingFriends ? '新的朋友，有新的申请' : '新的朋友'}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left active:scale-[0.99] transition-transform"
            style={{
              background: 'var(--control-soft-bg)',
              border: '1px solid var(--divider)',
              color: 'var(--text-main)',
            }}
          >
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              <UserPlus className="w-[18px] h-[18px]" />
            </span>

            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[13px] font-bold">新的朋友</span>
              <span className="text-[11px]" style={{ color: 'var(--text-sub)' }}>
                {hasPendingFriends ? '有人想认识你' : '暂时没有新的申请'}
              </span>
            </span>

            {hasPendingFriends && (
              <span
                aria-hidden="true"
                className="shrink-0"
                style={{ width: 10, height: 10, borderRadius: '50%', background: '#e5484d' }}
              />
            )}
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-sub)' }} />
          </button>
        )}

        {mode !== 'work' && characters.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p style={{ color: 'var(--text-sub)' }}>
              角色库为空，请先创建一个角色，或者切换到「工作助理」模式（不需要角色）。
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onCreateNewCharacter}
                className="px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform"
                style={accentButtonStyle}
              >
                去创建角色
              </button>

              <button
                type="button"
                onClick={() => setMode('work')}
                className="px-4 py-2 rounded-xl font-semibold active:scale-95 transition-transform border"
                style={{ borderColor: 'var(--divider)', color: 'var(--text-main)' }}
              >
                改用工作助理
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p
                className="block mb-1"
                style={{ color: 'var(--text-sub)' }}
              >
                绑定模式（固定后不可切换）
              </p>

              <div className="grid grid-cols-3 gap-2">
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

                <button
                  type="button"
                  onClick={() => setMode('work')}
                  className="p-3 rounded-xl border text-left space-y-1 transition-all"
                  style={getModeCardStyle(mode === 'work')}
                >
                  <div className="font-bold flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" style={{ color: 'var(--work-accent, #d98a55)' }} />
                    <span>工作助理</span>
                  </div>

                  <p
                    className="text-[10px]"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    通用效率助理，不用选角色，可以开很多个。
                  </p>
                </button>
              </div>
            </div>

            {mode !== 'work' && (
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
            )}

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
                placeholder={mode === 'work' ? '默认为助理名称' : '默认为角色名与模式'}
                value={chatTitle}
                onChange={(event) => setChatTitle(event.target.value)}
                className="w-full rounded-lg p-2 outline-none transition-colors placeholder:opacity-60"
                style={controlStyle}
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreatingWork}
              className="w-full py-3 rounded-xl font-semibold active:scale-95 transition-transform mt-2 disabled:opacity-60"
              style={accentButtonStyle}
            >
              {isCreatingWork ? '正在创建...' : '开启对话'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;
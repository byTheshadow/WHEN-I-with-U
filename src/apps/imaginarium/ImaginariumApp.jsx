import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Sparkles, Compass } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import ImaginariumRoom from './ImaginariumRoom';
import { getImaginariumChats, createImaginariumChat } from './imaginariumService';
import './imaginarium.css';

export const ImaginariumApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [initialNpcName, setInitialNpcName] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  // 状态同步给外层 App
  useEffect(() => {
    if (onChatRoomStateChange) {
      onChatRoomStateChange(Boolean(activeChatId));
    }
  }, [activeChatId, onChatRoomStateChange]);

  const loadChats = async () => {
    const list = await getImaginariumChats();
    setChats(list);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const initialMembers = initialNpcName.trim()
      ? [{ id: `npc_${Date.now()}`, name: initialNpcName.trim(), bio: '初创成员人设' }]
      : [{ id: `npc_${Date.now()}`, name: '提灯旁观者', bio: '性格冷淡但思维敏捷' }];

    const id = await createImaginariumChat({
      title: newTitle.trim(),
      description: newDesc.trim(),
      members: initialMembers
    });

    setNewTitle('');
    setNewDesc('');
    setInitialNpcName('');
    setShowCreateModal(false);
    await loadChats();
    setActiveChatId(id);
  };

  if (activeChatId) {
    return (
      <ImaginariumRoom
        chatId={activeChatId}
        onBack={() => {
          setActiveChatId(null);
          loadChats();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="imaginarium-icon-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h2 className="font-serif font-bold text-lg">IMAGINARIUM</h2>
          <p className="text-[10px] opacity-40 uppercase tracking-widest">虚构沙龙</p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="imaginarium-icon-btn"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      <div className="space-y-3">
        {chats.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-3">
            <Compass className="w-8 h-8 opacity-40 mx-auto" />
            <p className="text-xs opacity-70">尚无虚构沙龙，点击右上角新建一个专属的手稿吧。</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              新建沙龙
            </button>
          </GlassCard>
        ) : (
          chats.map((c, idx) => (
            <GlassCard
              key={c.id}
              delay={idx * 50}
              onClick={() => setActiveChatId(c.id)}
              className="p-4 cursor-pointer flex items-center justify-between group"
            >
              <div className="space-y-1 text-left">
                <h4 className="font-bold text-sm">{c.title}</h4>
                <p className="text-[11px] opacity-60 line-clamp-1">{c.description || '暂无描述'}</p>
                <div className="text-[9px] opacity-40">成员: {(c.members || []).map(m => m.name).join(' / ')}</div>
              </div>
              <Sparkles className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
            </GlassCard>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0" style={{ backgroundColor: 'var(--modal-overlay)' }} onClick={() => setShowCreateModal(false)} />
          <form
            onSubmit={handleCreateSubmit}
            className="relative w-full max-w-xs rounded-[2rem] p-5 shadow-2xl z-10 space-y-4 text-xs"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderWidth: '1px' }}
          >
            <h3 className="font-serif font-bold text-sm">创建虚构沙龙</h3>
            <input
              type="text"
              placeholder="沙龙主题名称 *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border outline-none"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
              required
            />
            <textarea
              rows={2}
              placeholder="场景描述 (例如: 降雨天气的书店)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full p-2.5 rounded-xl border outline-none"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            />
            <input
              type="text"
              placeholder="添加第一个虚拟角色名字"
              value={initialNpcName}
              onChange={(e) => setInitialNpcName(e.target.value)}
              className="w-full p-2.5 rounded-xl border outline-none"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 rounded-xl opacity-60 border"
                style={{ borderColor: 'var(--card-border)' }}
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl font-bold"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                开启沙龙
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ImaginariumApp;

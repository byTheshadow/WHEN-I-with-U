import React, { useState, useEffect } from 'react';
import { Users, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import db from '../../db';
import { EnsembleRoom } from './EnsembleRoom';
import ConfirmModal from '../../components/ConfirmModal';

export const EnsembleApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // 向导
  const [allCharacters, setAllCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    const list = await db.ensembleChats.orderBy('updatedAt').reverse().toArray();
    setChats(list);
  };

  const handleOpenCreate = async () => {
    const chars = await db.characters.toArray();
    setAllCharacters(chars);
    setSelectedIds([]);
    setTitle('');
    setScenePrompt('');
    setShowCreateModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newId = await db.ensembleChats.add({
      title: title.trim(),
      scenePrompt: scenePrompt.trim(),
      selectedCharacterIds: selectedIds,
      localCharacters: [],
      relationsMatrix: [],
      userIdentities: [{ id: 'u_default', name: '我', persona: '主视角' }],
      currentIdentityId: 'u_default',
      aiChainCount: 0,
      autoSummaryFrequency: 5,
      bgOpacity: 0.2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    setShowCreateModal(false);
    loadChats();
    setActiveChatId(newId);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await db.ensembleChats.delete(deleteTargetId);
    await db.ensembleMessages.where('chatId').equals(deleteTargetId).delete();
    await db.ensembleSummaries.where('chatId').equals(deleteTargetId).delete();
    setDeleteTargetId(null);
    loadChats();
  };

  if (activeChatId) {
    return <EnsembleRoom chatId={activeChatId} onBack={() => setActiveChatId(null)} onChatRoomStateChange={onChatRoomStateChange} />;
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBackHub} className="flex items-center gap-1 text-xs font-semibold opacity-70 hover:opacity-100" style={{ color: 'var(--text-main)' }}>
          <ArrowLeft className="w-4 h-4" /> 返回主页
        </button>
        <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-main)' }}>The Ensemble • 羁绊大群</h2>
        <button type="button" onClick={handleOpenCreate} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>
          <Plus className="w-3.5 h-3.5" /> 创建大群
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border opacity-60" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">暂无羁绊群聊，点击右上角创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {chats.map((c) => (
            <div key={c.id} onClick={() => setActiveChatId(c.id)} className="p-4 rounded-3xl border transition-all cursor-pointer relative group shadow-sm" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}>
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-sm">{c.title}</h3>
                <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTargetId(c.id); }} className="opacity-0 group-hover:opacity-100 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs opacity-60 line-clamp-1 mt-1">{c.scenePrompt || '未设定环境'}</p>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleCreate} className="w-full max-w-xs rounded-3xl p-5 space-y-3 shadow-2xl" style={{ backgroundColor: 'var(--modal-bg)', border: '1px solid var(--modal-border)', color: 'var(--text-main)' }}>
            <h3 className="text-xs font-semibold border-b pb-2" style={{ borderColor: 'var(--divider)' }}>新建羁绊群像大群</h3>
            <input type="text" required placeholder="大群名称..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 rounded-xl text-xs border outline-none" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }} />
            <textarea rows={3} placeholder="环境描述 (Scene Prompt)..." value={scenePrompt} onChange={(e) => setScenePrompt(e.target.value)} className="w-full p-2 rounded-xl text-xs border outline-none resize-none" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1 text-xs opacity-60">取消</button>
              <button type="submit" className="px-4 py-1 rounded-xl text-xs font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>创建大群</button>
            </div>
          </form>
        </div>
      )}

      {deleteTargetId && (
        <ConfirmModal title="删除大群" message="确定删除此大群吗？" onConfirm={handleDelete} onCancel={() => setDeleteTargetId(null)} />
      )}
    </div>
  );
};

export default EnsembleApp;

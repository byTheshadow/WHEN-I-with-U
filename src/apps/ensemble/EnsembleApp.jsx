import React, { useState, useEffect } from 'react';
import { Users, Plus, ArrowLeft, Trash2, Sparkles, Layers } from 'lucide-react';
import db from '../../db';
import { EnsembleRoom } from './EnsembleRoom';
import ConfirmModal from '../../components/ConfirmModal';
import './ensemble.css';

export const EnsembleApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // 向导阶段 (Step 1: 勾选角色, Step 2: 名字与场景)
  const [step, setStep] = useState(1);
  const [allCharacters, setAllCharacters] = useState([]);
  const [selectedCharIds, setSelectedCharIds] = useState([]);
  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [userIdentityName, setUserIdentityName] = useState('我');

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    const list = await db.ensembleChats.orderBy('updatedAt').reverse().toArray();
    setChats(list);
  };

  const handleOpenCreateModal = async () => {
    const chars = await db.characters.toArray();
    setAllCharacters(chars);
    setSelectedCharIds([]);
    setTitle('');
    setScenePrompt('');
    setStep(1);
    setShowCreateModal(true);
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    if (!title.trim() || selectedCharIds.length === 0) return;

    const newChat = {
      title: title.trim(),
      scenePrompt: scenePrompt.trim(),
      selectedCharacterIds: selectedCharIds,
      characterOverrides: {},
      userIdentities: [
        { id: 'u_default', name: userIdentityName.trim() || '我', persona: '主视角' }
      ],
      currentIdentityId: 'u_default',
      bgOpacity: 0.2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const insertedId = await db.ensembleChats.add(newChat);
    setShowCreateModal(false);
    loadChats();
    setActiveChatId(insertedId);
  };

  const handleDeleteChat = async () => {
    if (!deleteTargetId) return;
    await db.ensembleChats.delete(deleteTargetId);
    await db.ensembleMessages.where('chatId').equals(deleteTargetId).delete();
    await db.ensembleSummaries.where('chatId').equals(deleteTargetId).delete();
    setDeleteTargetId(null);
    loadChats();
  };

  // 进入沉浸房间
  if (activeChatId) {
    return (
      <EnsembleRoom
        chatId={activeChatId}
        onBack={() => setActiveChatId(null)}
        onChatRoomStateChange={onChatRoomStateChange}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* 头部导航 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1 text-xs font-semibold opacity-70 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          返回主页
        </button>

        <h2 className="text-sm font-serif font-bold tracking-wider uppercase" style={{ color: 'var(--text-main)' }}>
          The Ensemble • 羁绊群像
        </h2>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-transform active:scale-95 shadow-sm"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          创建羁绊大群
        </button>
      </div>

      {/* 列表流 */}
      {chats.length === 0 ? (
        <div
          className="py-16 text-center rounded-3xl border space-y-3"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <Users className="w-10 h-10 mx-auto opacity-30" />
          <p className="text-xs opacity-60">暂无羁绊群聊，点击右上角选择已有角色搭建大群</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className="p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-md relative group"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{chat.title}</h3>
                  <p className="text-xs opacity-60 line-clamp-1">{chat.scenePrompt || '暂无描述'}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(chat.id);
                  }}
                  className="p-1.5 rounded-full opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] opacity-50 border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
                <span>包含 {chat.selectedCharacterIds?.length || 0} 位全局角色</span>
                <span className="font-mono">{new Date(chat.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建群向导 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-up"
            style={{ backgroundColor: 'var(--modal-bg)', border: '1px solid var(--modal-border)', color: 'var(--text-main)' }}
          >
            <h3 className="text-sm font-semibold border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
              新建羁绊大群 ({step}/2)
            </h3>

            {step === 1 ? (
              <div className="space-y-3">
                <p className="text-xs opacity-60">请勾选需要加入群聊的全局角色人设：</p>
                <div className="max-h-52 overflow-y-auto space-y-2 no-scrollbar">
                  {allCharacters.map((c) => {
                    const checked = selectedCharIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (checked) setSelectedCharIds(selectedCharIds.filter((id) => id !== c.id));
                          else setSelectedCharIds([...selectedCharIds, c.id]);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          checked ? 'border-current' : 'opacity-70'
                        }`}
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                      >
                        <div className="flex items-center gap-2">
                          {c.avatar ? (
                            <img src={c.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                              {c.name[0]}
                            </div>
                          )}
                          <span className="text-xs font-semibold">{c.name}</span>
                        </div>
                        <input type="checkbox" checked={checked} readOnly className="accent-current" />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-1.5 rounded-xl text-xs opacity-60"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={selectedCharIds.length === 0}
                    onClick={() => setStep(2)}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  >
                    下一步
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateChat} className="space-y-3">
                <div>
                  <label className="text-[10px] block opacity-60 mb-1">大群名称</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如: 深夜下雨的咖啡书馆"
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  />
                </div>

                <div>
                  <label className="text-[10px] block opacity-60 mb-1">你的第一个视角身份名称</label>
                  <input
                    type="text"
                    required
                    value={userIdentityName}
                    onChange={(e) => setUserIdentityName(e.target.value)}
                    placeholder="例如: 我 / 常客"
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  />
                </div>

                <div>
                  <label className="text-[10px] block opacity-60 mb-1">场景/剧本环境描述 (Scene Prompt)</label>
                  <textarea
                    rows={3}
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    placeholder="描摹此大群的环境与气氛..."
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-1.5 rounded-xl text-xs opacity-60"
                  >
                    上一步
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  >
                    创建大群
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 确认删除弹窗 */}
      {deleteTargetId && (
        <ConfirmModal
          title="删除羁绊大群"
          message="确定要删除该羁绊大群及其历史消息和剧情总结吗？此操作无法撤销。"
          onConfirm={handleDeleteChat}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};

export default EnsembleApp;

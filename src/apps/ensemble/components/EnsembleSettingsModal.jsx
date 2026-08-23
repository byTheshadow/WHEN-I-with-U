import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Users, Layers, Sparkles } from 'lucide-react';
import db from '../../../db';

export const EnsembleSettingsModal = ({
  chatId,
  onClose,
  onUpdated
}) => {
  const [chat, setChat] = useState(null);
  const [allCharacters, setAllCharacters] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'characters' | 'users' | 'summaries'

  // 表单状态
  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.2);

  // 选中的角色与重写关系
  const [selectedIds, setSelectedIds] = useState([]);
  const [charOverrides, setCharOverrides] = useState({});

  // User 身份列表
  const [userIdentities, setUserIdentities] = useState([]);

  useEffect(() => {
    loadData();
  }, [chatId]);

  const loadData = async () => {
    const chatDoc = await db.ensembleChats.get(chatId);
    if (!chatDoc) return;
    setChat(chatDoc);
    setTitle(chatDoc.title || '');
    setScenePrompt(chatDoc.scenePrompt || '');
    setBgImage(chatDoc.bgImage || '');
    setBgOpacity(chatDoc.bgOpacity ?? 0.2);
    setSelectedIds(chatDoc.selectedCharacterIds || []);
    setCharOverrides(chatDoc.characterOverrides || {});
    setUserIdentities(chatDoc.userIdentities || []);

    const chars = await db.characters.toArray();
    setAllCharacters(chars);

    const sumList = await db.ensembleSummaries.where('chatId').equals(chatId).toArray();
    setSummaries(sumList);
  };

  const handleToggleChar = (charId) => {
    if (selectedIds.includes(charId)) {
      setSelectedIds(selectedIds.filter((id) => id !== charId));
    } else {
      setSelectedIds([...selectedIds, charId]);
    }
  };

  const handleUpdateOverride = (charId, field, val) => {
    setCharOverrides((prev) => ({
      ...prev,
      [charId]: {
        ...(prev[charId] || {}),
        [field]: val
      }
    }));
  };

  const handleAddUserIdentity = () => {
    const newU = {
      id: `u_${Date.now()}`,
      name: `视角身份 ${userIdentities.length + 1}`,
      avatar: '',
      persona: ''
    };
    setUserIdentities([...userIdentities, newU]);
  };

  const handleUpdateUserIdentity = (id, field, val) => {
    setUserIdentities((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: val } : u))
    );
  };

  const handleDeleteUserIdentity = (id) => {
    if (userIdentities.length <= 1) return;
    setUserIdentities(userIdentities.filter((u) => u.id !== id));
  };

  const handleSave = async () => {
    await db.ensembleChats.update(chatId, {
      title,
      scenePrompt,
      bgImage,
      bgOpacity: parseFloat(bgOpacity),
      selectedCharacterIds: selectedIds,
      characterOverrides: charOverrides,
      userIdentities,
      updatedAt: Date.now()
    });
    onUpdated();
    onClose();
  };

  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md h-[80vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-scale-up"
        style={{
          backgroundColor: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Modal 顶栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--divider)' }}>
          <h3 className="text-sm font-semibold tracking-wide">羁绊大群剧本档案</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex items-center border-b px-2 text-xs" style={{ borderColor: 'var(--divider)' }}>
          {[
            { id: 'basic', label: '基本设定' },
            { id: 'characters', label: '角色与关系' },
            { id: 'users', label: 'User视角身份' },
            { id: 'summaries', label: '剧情总结' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-center font-medium transition-all ${
                activeTab === tab.id ? 'border-b-2 font-semibold' : 'opacity-60'
              }`}
              style={{
                borderColor: activeTab === tab.id ? 'var(--accent-color)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-sub)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容主体 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {activeTab === 'basic' && (
            <div className="space-y-3">
              <div>
                <label className="block opacity-60 mb-1">大群名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">当前剧本环境设定 (Scene Prompt)</label>
                <textarea
                  rows={4}
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  placeholder="描摹此大群所处的场景、氛围以及当前的特殊剧情上下文..."
                  className="w-full px-3 py-2 rounded-xl border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">聊天界面背景图 (URL 或 Base64)</label>
                <input
                  type="text"
                  value={bgImage}
                  onChange={(e) => setBgImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">背景图不透明度 ({bgOpacity})</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.9"
                  step="0.05"
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {activeTab === 'characters' && (
            <div className="space-y-4">
              <span className="block opacity-60 text-[11px]">勾选入群的全局角色并可重写其场景关系：</span>
              {allCharacters.map((char) => {
                const isChecked = selectedIds.includes(char.id);
                const override = charOverrides[char.id] || {};

                return (
                  <div
                    key={char.id}
                    className="p-3 rounded-2xl border space-y-2"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {char.avatar ? (
                          <img src={char.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
                            {char.name[0]}
                          </div>
                        )}
                        <span className="font-semibold">{char.name}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleChar(char.id)}
                        className="w-4 h-4 accent-current"
                      />
                    </div>

                    {isChecked && (
                      <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
                        <input
                          type="text"
                          placeholder="场景特别行为 / 补充人设..."
                          value={override.notes || ''}
                          onChange={(e) => handleUpdateOverride(char.id, 'notes', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border text-[11px]"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                        />
                        <input
                          type="text"
                          placeholder="与其他角色的关系认知 (如: 对角色B十分戒备)..."
                          value={override.relations || ''}
                          onChange={(e) => handleUpdateOverride(char.id, 'relations', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border text-[11px]"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[11px]">可自由配置多个 User 身份卡：</span>
                <button
                  type="button"
                  onClick={handleAddUserIdentity}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
                >
                  <Plus className="w-3 h-3" />
                  新增身份卡
                </button>
              </div>

              {userIdentities.map((u, idx) => (
                <div
                  key={u.id}
                  className="p-3 rounded-2xl border space-y-2 relative"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]">身份卡 #{idx + 1}</span>
                    {userIdentities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUserIdentity(u.id)}
                        className="text-red-500 opacity-60 hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="身份名称 (如: 主视角/侦探)"
                    value={u.name}
                    onChange={(e) => handleUpdateUserIdentity(u.id, 'name', e.target.value)}
                    className="w-full px-2.5 py-1 rounded-lg border text-xs"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />

                  <textarea
                    rows={2}
                    placeholder="身份人设描述 (AI 回复时会结合此人设视角)..."
                    value={u.persona}
                    onChange={(e) => handleUpdateUserIdentity(u.id, 'persona', e.target.value)}
                    className="w-full px-2.5 py-1 rounded-lg border text-xs resize-none"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <span className="block opacity-60 text-[11px]">动态剧情与角色关系变化总结历史：</span>
              {summaries.length === 0 ? (
                <p className="text-center py-6 opacity-40">暂无剧情总结</p>
              ) : (
                summaries.map((s, i) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-2xl border space-y-1.5 text-[11px]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  >
                    <div className="font-semibold opacity-80 flex items-center justify-between">
                      <span>阶段 #{i + 1}</span>
                      <span className="font-mono text-[9px] opacity-40">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="opacity-90">{s.summaryText}</p>
                    <div className="pt-1 text-[10px] opacity-70 italic border-t" style={{ borderColor: 'var(--divider)' }}>
                      关系变迁: {s.relationChangesText}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal 底栏 */}
        <div className="p-3 border-t flex justify-end" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            保存并生效
          </button>
        </div>
      </div>
    </div>
  );
};

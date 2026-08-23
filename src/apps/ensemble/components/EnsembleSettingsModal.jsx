import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Users, BookOpen, User, ArrowRight } from 'lucide-react';
import db from '../../../db';

export const EnsembleSettingsModal = ({
  chatId,
  onClose,
  onUpdated
}) => {
  const [chat, setChat] = useState(null);
  const [allGlobalChars, setAllGlobalChars] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'members' | 'relations' | 'users' | 'summaries'

  // 基本设定表单
  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.2);

  // 成员管理 (全局选中 ID + 本群专属 AI 角色)
  const [selectedGlobalIds, setSelectedGlobalIds] = useState([]);
  const [localChars, setLocalChars] = useState([]);
  const [showAddLocalModal, setShowAddLocalModal] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalAvatar, setNewLocalAvatar] = useState('');
  const [newLocalBio, setNewLocalBio] = useState('');

  // 关系链表
  const [relations, setRelations] = useState([]); // [{ id, sourceName, targetName, relationText }]
  const [newRelSource, setNewRelSource] = useState('');
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelText, setNewRelText] = useState('');

  // User 身份列表
  const [userIdentities, setUserIdentities] = useState([]);

  // 总结编辑控制
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const [editSumText, setEditSumText] = useState('');
  const [editRelText, setEditRelText] = useState('');

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
    setSelectedGlobalIds(chatDoc.selectedCharacterIds || []);
    setLocalChars(chatDoc.localCharacters || []);
    setRelations(chatDoc.relations || []);
    setUserIdentities(chatDoc.userIdentities || []);

    const globals = await db.characters.toArray();
    setAllGlobalChars(globals);

    loadSummaries();
  };

  const loadSummaries = async () => {
    const list = await db.ensembleSummaries.where('chatId').equals(chatId).sortBy('createdAt');
    setSummaries(list.reverse());
  };

  // 本群专属 AI 角色管理
  const handleAddLocalChar = (e) => {
    e.preventDefault();
    if (!newLocalName.trim()) return;
    const newChar = {
      id: `local_${Date.now()}`,
      name: newLocalName.trim(),
      avatar: newLocalAvatar.trim(),
      bio: newLocalBio.trim() || '本群专属角色'
    };
    setLocalChars([...localChars, newChar]);
    setNewLocalName('');
    setNewLocalAvatar('');
    setNewLocalBio('');
    setShowAddLocalModal(false);
  };

  const handleDeleteLocalChar = (id) => {
    setLocalChars(localChars.filter(c => c.id !== id));
  };

  // 关系阵列管理
  const handleAddRelation = (e) => {
    e.preventDefault();
    if (!newRelSource || !newRelTarget || !newRelText.trim()) return;
    const newRel = {
      id: `rel_${Date.now()}`,
      sourceName: newRelSource,
      targetName: newRelTarget,
      relationText: newRelText.trim()
    };
    setRelations([...relations, newRel]);
    setNewRelText('');
  };

  const handleDeleteRelation = (id) => {
    setRelations(relations.filter(r => r.id !== id));
  };

  // 多 User 身份管理
  const handleAddUserIdentity = () => {
    const newU = {
      id: `u_${Date.now()}`,
      name: `User身份 ${userIdentities.length + 1}`,
      avatar: '',
      persona: '身份说明...'
    };
    setUserIdentities([...userIdentities, newU]);
  };

  const handleUpdateUserIdentity = (id, field, val) => {
    setUserIdentities(prev => prev.map(u => u.id === id ? { ...u, [field]: val } : u));
  };

  // 总结编辑与删除
  const handleDeleteSummary = async (id) => {
    await db.ensembleSummaries.delete(id);
    loadSummaries();
  };

  const handleSaveSummaryEdit = async (id) => {
    await db.ensembleSummaries.update(id, {
      summaryText: editSumText,
      relationChangesText: editRelText
    });
    setEditingSummaryId(null);
    loadSummaries();
  };

  const handleSaveAll = async () => {
    await db.ensembleChats.update(chatId, {
      title,
      scenePrompt,
      bgImage,
      bgOpacity: parseFloat(bgOpacity),
      selectedCharacterIds: selectedGlobalIds,
      localCharacters: localChars,
      relations,
      userIdentities,
      updatedAt: Date.now()
    });
    onUpdated();
    onClose();
  };

  // 获取群内所有可能参与角色的名称列表（用于关系下拉选）
  const allParticipantNames = [
    ...allGlobalChars.filter(c => selectedGlobalIds.includes(c.id)).map(c => c.name),
    ...localChars.map(c => c.name),
    ...userIdentities.map(u => `[User] ${u.name}`)
  ];

  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md h-[82vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-scale-up border"
        style={{
          backgroundColor: 'var(--modal-bg)',
          borderColor: 'var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--divider)' }}>
          <h3 className="text-xs font-bold tracking-wider uppercase">大群剧本与档案设定</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex items-center border-b px-2 text-[11px] overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--divider)' }}>
          {[
            { id: 'basic', label: '基本' },
            { id: 'members', label: '角色' },
            { id: 'relations', label: '关系矩阵' },
            { id: 'users', label: 'User身份' },
            { id: 'summaries', label: '剧情总结' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 font-medium shrink-0 transition-all ${
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

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs no-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-3">
              <div>
                <label className="block opacity-60 text-[10px] mb-1">大群标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 text-[10px] mb-1">当前剧本与环境描摹 (Scene Prompt)</label>
                <textarea
                  rows={4}
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 text-[10px] mb-1">背景图 URL / Base64</label>
                <input
                  type="text"
                  value={bgImage}
                  onChange={(e) => setBgImage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 text-[10px] mb-1">背景图遮罩透明度 ({bgOpacity})</label>
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

          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* 本群专属 AI 角色区 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold opacity-70 text-[11px]">本群专属 AI 角色 ({localChars.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowAddLocalModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
                  >
                    <Plus className="w-3 h-3" />
                    新建群专属角色
                  </button>
                </div>

                {localChars.map((lc) => (
                  <div
                    key={lc.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  >
                    <div className="flex items-center gap-2">
                      {lc.avatar ? (
                        <img src={lc.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                          {lc.name[0]}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold block">{lc.name}</span>
                        <span className="text-[9px] opacity-50 block truncate max-w-[180px]">{lc.bio}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLocalChar(lc.id)}
                      className="text-red-500 opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 勾选全局角色区 */}
              <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--divider)' }}>
                <span className="font-semibold opacity-70 text-[11px] block">选择关联的全局角色</span>
                {allGlobalChars.map((gc) => {
                  const isChecked = selectedGlobalIds.includes(gc.id);
                  return (
                    <div
                      key={gc.id}
                      onClick={() => {
                        if (isChecked) setSelectedGlobalIds(selectedGlobalIds.filter((id) => id !== gc.id));
                        else setSelectedGlobalIds([...selectedGlobalIds, gc.id]);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        {gc.avatar ? (
                          <img src={gc.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                            {gc.name[0]}
                          </div>
                        )}
                        <span className="font-semibold">{gc.name}</span>
                      </div>
                      <input type="checkbox" checked={isChecked} readOnly className="accent-current" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-3">
              <span className="block opacity-60 text-[10px]">建立角色间/视角间的方向性定向关系：</span>
              
              {/* 新建关系表单 */}
              <form onSubmit={handleAddRelation} className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-2">
                  <select
                    value={newRelSource}
                    onChange={(e) => setNewRelSource(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg border text-[10px]"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <option value="">选择主体角色</option>
                    {allParticipantNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>

                  <ArrowRight className="w-3 h-3 opacity-40 shrink-0" />

                  <select
                    value={newRelTarget}
                    onChange={(e) => setNewRelTarget(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg border text-[10px]"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <option value="">选择对象角色</option>
                    {allParticipantNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="如: 表面互相挖苦，实际极度依赖..."
                  value={newRelText}
                  onChange={(e) => setNewRelText(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />

                <button
                  type="submit"
                  className="w-full py-1.5 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  添加定向关系描述
                </button>
              </form>

              {/* 现有关系图谱列表 */}
              {relations.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl border space-y-1 relative"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                >
                  <div className="flex items-center justify-between font-semibold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span>{r.sourceName}</span>
                      <ArrowRight className="w-3 h-3 opacity-40" />
                      <span>{r.targetName}</span>
                    </span>
                    <button type="button" onClick={() => handleDeleteRelation(r.id)} className="text-red-500 opacity-60 hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">{r.relationText}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[10px]">User 身份视角卡管理：</span>
                <button
                  type="button"
                  onClick={handleAddUserIdentity}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
                >
                  <Plus className="w-3 h-3" />
                  新增 User 身份
                </button>
              </div>

              {userIdentities.map((u, idx) => (
                <div
                  key={u.id}
                  className="p-3 rounded-2xl border space-y-2"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]">身份视角 #{idx + 1}</span>
                    {userIdentities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setUserIdentities(userIdentities.filter(item => item.id !== u.id))}
                        className="text-red-500 opacity-60 hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="身份名称 (如: 我 / 旁白)"
                    value={u.name}
                    onChange={(e) => handleUpdateUserIdentity(u.id, 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />

                  <input
                    type="text"
                    placeholder="头像 URL 或 Base64 (选填)"
                    value={u.avatar || ''}
                    onChange={(e) => handleUpdateUserIdentity(u.id, 'avatar', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />

                  <textarea
                    rows={2}
                    placeholder="该身份视角的描写与人设..."
                    value={u.persona || ''}
                    onChange={(e) => handleUpdateUserIdentity(u.id, 'persona', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border text-xs resize-none"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <span className="block opacity-60 text-[10px]">历史剧情总结记录 (全部总结在 AI 上下文中生效)：</span>
              {summaries.length === 0 ? (
                <p className="text-center py-6 opacity-40">暂无剧情总结</p>
              ) : (
                summaries.map((s, idx) => {
                  const isEditing = editingSummaryId === s.id;
                  return (
                    <div
                      key={s.id}
                      className="p-3 rounded-2xl border space-y-2"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span>阶段总结 #{summaries.length - idx}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSummaryId(s.id);
                              setEditSumText(s.summaryText);
                              setEditRelText(s.relationChangesText);
                            }}
                            className="opacity-60 hover:opacity-100"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSummary(s.id)}
                            className="text-red-500 opacity-60 hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows={3}
                            value={editSumText}
                            onChange={(e) => setEditSumText(e.target.value)}
                            className="w-full p-2 rounded-lg border text-xs"
                            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                          />
                          <input
                            type="text"
                            value={editRelText}
                            onChange={(e) => setEditRelText(e.target.value)}
                            className="w-full p-2 rounded-lg border text-xs"
                            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveSummaryEdit(s.id)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                          >
                            保存总结修改
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs opacity-90 leading-relaxed">{s.summaryText}</p>
                          <div className="pt-1 text-[10px] opacity-70 italic border-t" style={{ borderColor: 'var(--divider)' }}>
                            关系变迁: {s.relationChangesText}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-6 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            保存档案设置
          </button>
        </div>
      </div>

      {/* 新建本群专属角色 Modal */}
      {showAddLocalModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl p-4 space-y-3 border shadow-xl" style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)' }}>
            <h4 className="text-xs font-bold border-b pb-2">新建本群专属 AI 角色</h4>
            <form onSubmit={handleAddLocalChar} className="space-y-2 text-xs">
              <input
                type="text"
                required
                placeholder="角色姓名"
                value={newLocalName}
                onChange={(e) => setNewLocalName(e.target.value)}
                className="w-full p-2 rounded-lg border outline-none"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
              />
              <input
                type="text"
                placeholder="头像 URL 或 Base64"
                value={newLocalAvatar}
                onChange={(e) => setNewLocalAvatar(e.target.value)}
                className="w-full p-2 rounded-lg border outline-none"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
              />
              <textarea
                rows={2}
                placeholder="角色人设描述..."
                value={newLocalBio}
                onChange={(e) => setNewLocalBio(e.target.value)}
                className="w-full p-2 rounded-lg border outline-none resize-none"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddLocalModal(false)} className="px-3 py-1 opacity-60">取消</button>
                <button type="submit" className="px-4 py-1 rounded-lg font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>创建</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


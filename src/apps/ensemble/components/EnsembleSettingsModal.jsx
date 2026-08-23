import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, UserCheck, Layers, Sparkles, Save } from 'lucide-react';
import db from '../../../db';

export const EnsembleSettingsModal = ({ chatId, onClose, onUpdated }) => {
  const [chat, setChat] = useState(null);
  const [globalCharacters, setGlobalCharacters] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');

  // 基本字段
  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.2);

  // 成员与本群角色
  const [selectedGlobalIds, setSelectedGlobalIds] = useState([]);
  const [localCharacters, setLocalCharacters] = useState([]);
  const [showAddLocalModal, setShowAddLocalModal] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalBio, setNewLocalBio] = useState('');

  // 关系矩阵 (sourceId -> targetId -> relation)
  const [relationsMatrix, setRelationsMatrix] = useState([]);
  const [newRelSource, setNewRelSource] = useState('');
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelText, setNewRelText] = useState('');

  // 总结编辑
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
    setLocalCharacters(chatDoc.localCharacters || []);
    setRelationsMatrix(chatDoc.relationsMatrix || []);

    const globals = await db.characters.toArray();
    setGlobalCharacters(globals);

    loadSummaries();
  };

  const loadSummaries = async () => {
    const list = await db.ensembleSummaries.where('chatId').equals(chatId).toArray();
    setSummaries(list);
  };

  // 添加本群独占 AI 角色 (不涉及 db.characters)
  const handleAddLocalChar = (e) => {
    e.preventDefault();
    if (!newLocalName.trim()) return;
    if (selectedGlobalIds.length + localCharacters.length >= 8) {
      alert('大群角色上限为 8 位');
      return;
    }
    const newLocal = {
      id: `local_${Date.now()}`,
      name: newLocalName.trim(),
      avatar: '',
      bio: newLocalBio.trim() || '本群独占角色'
    };
    setLocalCharacters([...localCharacters, newLocal]);
    setNewLocalName('');
    setNewLocalBio('');
    setShowAddLocalModal(false);
  };

  const handleDeleteLocalChar = (localId) => {
    setLocalCharacters(localCharacters.filter(c => c.id !== localId));
  };

  // 添加方向性关系
  const handleAddRelation = (e) => {
    e.preventDefault();
    if (!newRelSource || !newRelTarget || !newRelText.trim()) return;
    const newRel = {
      id: `rel_${Date.now()}`,
      sourceName: newRelSource,
      targetName: newRelTarget,
      relation: newRelText.trim()
    };
    setRelationsMatrix([...relationsMatrix, newRel]);
    setNewRelText('');
  };

  const handleDeleteRelation = (relId) => {
    setRelationsMatrix(relationsMatrix.filter(r => r.id !== relId));
  };

  // 总结编辑与删除
  const handleSaveSummaryEdit = async (sumId) => {
    await db.ensembleSummaries.update(sumId, {
      summaryText: editSumText,
      relationChangesText: editRelText,
      updatedAt: Date.now()
    });
    setEditingSummaryId(null);
    loadSummaries();
  };

  const handleDeleteSummary = async (sumId) => {
    await db.ensembleSummaries.delete(sumId);
    loadSummaries();
  };

  const handleSaveAll = async () => {
    await db.ensembleChats.update(chatId, {
      title,
      scenePrompt,
      bgImage,
      bgOpacity: parseFloat(bgOpacity),
      selectedCharacterIds: selectedGlobalIds,
      localCharacters,
      relationsMatrix,
      updatedAt: Date.now()
    });
    onUpdated();
    onClose();
  };

  // 所有备选角色名列表 (用于关系矩阵下拉)
  const allMemberNames = [
    ...globalCharacters.filter(g => selectedGlobalIds.includes(g.id)).map(g => g.name),
    ...localCharacters.map(l => l.name)
  ];

  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md h-[82vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-scale-up"
        style={{
          backgroundColor: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--divider)' }}>
          <h3 className="text-xs font-semibold tracking-wide">羁绊大群档案库</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center border-b px-2 text-[11px]" style={{ borderColor: 'var(--divider)' }}>
          {[
            { id: 'basic', label: '基本' },
            { id: 'members', label: '角色 (限8位)' },
            { id: 'relations', label: '方向认知矩阵' },
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs thin-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-3">
              <div>
                <label className="block opacity-60 mb-1">群名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">剧本环境描摹 (Scene Prompt)</label>
                <textarea
                  rows={4}
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">背景图片 URL</label>
                <input
                  type="text"
                  value={bgImage}
                  onChange={(e) => setBgImage(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[11px]">全局与本群独占角色 (已选 {selectedGlobalIds.length + localCharacters.length}/8)</span>
                <button
                  type="button"
                  onClick={() => setShowAddLocalModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
                >
                  <Plus className="w-3 h-3" />
                  新建本群独占角色
                </button>
              </div>

              {/* 全局角色选框 */}
              <div className="space-y-2">
                <span className="font-semibold text-[11px] block">选择全局已有角色：</span>
                {globalCharacters.map((g) => {
                  const checked = selectedGlobalIds.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        if (checked) setSelectedGlobalIds(selectedGlobalIds.filter(id => id !== g.id));
                        else {
                          if (selectedGlobalIds.length + localCharacters.length >= 8) return alert('做多 8 位');
                          setSelectedGlobalIds([...selectedGlobalIds, g.id]);
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer ${checked ? 'border-current' : 'opacity-60'}`}
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    >
                      <span>{g.name} (全局)</span>
                      <input type="checkbox" checked={checked} readOnly className="accent-current" />
                    </div>
                  );
                })}
              </div>

              {/* 本群独占角色 */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
                <span className="font-semibold text-[11px] block">本群独占角色：</span>
                {localCharacters.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-2 rounded-xl border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  >
                    <div>
                      <span className="font-semibold">{l.name}</span>
                      <p className="text-[10px] opacity-60 truncate">{l.bio}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLocalChar(l.id)}
                      className="text-red-500 opacity-60 hover:opacity-100 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-4">
              <span className="opacity-60 text-[11px] block">维护角色与角色 / User 身份之间的单向认知态度：</span>
              
              {/* 新增关系表达 */}
              <form onSubmit={handleAddRelation} className="p-3 rounded-2xl border space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-2">
                  <select
                    value={newRelSource}
                    onChange={(e) => setNewRelSource(e.target.value)}
                    className="flex-1 p-1 rounded border text-xs"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <option value="">-- 看法发起者 --</option>
                    {allMemberNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <span className="text-[10px] opacity-50">对</span>
                  <input
                    type="text"
                    placeholder="目标角色/User身份"
                    value={newRelTarget}
                    onChange={(e) => setNewRelTarget(e.target.value)}
                    className="flex-1 p-1 rounded border text-xs"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="态度描述 (如: 极度警戒但言听计从)..."
                  value={newRelText}
                  onChange={(e) => setNewRelText(e.target.value)}
                  className="w-full p-1 rounded border text-xs"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
                <button
                  type="submit"
                  className="w-full py-1 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  添加方向性看法
                </button>
              </form>

              {/* 现有关系矩阵列表 */}
              <div className="space-y-2">
                {relationsMatrix.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-xl border flex items-center justify-between text-[11px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                    <div>
                      <span className="font-semibold">{r.sourceName} → {r.targetName}:</span>
                      <p className="opacity-80 mt-0.5">{r.relation}</p>
                    </div>
                    <button type="button" onClick={() => handleDeleteRelation(r.id)} className="text-red-500 opacity-60 hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <span className="opacity-60 text-[11px] block">历史剧情总结列表 (全部处于生效状态)：</span>
              {summaries.map((s, idx) => (
                <div key={s.id} className="p-3 rounded-2xl border space-y-2 text-[11px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  {editingSummaryId === s.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editSumText}
                        onChange={(e) => setEditSumText(e.target.value)}
                        className="w-full p-2 rounded-lg border"
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                      />
                      <input
                        type="text"
                        value={editRelText}
                        onChange={(e) => setEditRelText(e.target.value)}
                        className="w-full p-1.5 rounded-lg border"
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingSummaryId(null)} className="px-2 py-1 opacity-60">取消</button>
                        <button type="button" onClick={() => handleSaveSummaryEdit(s.id)} className="px-3 py-1 rounded-lg font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between font-semibold">
                        <span>阶段 #{idx + 1} ({s.source === 'manual' ? '手动' : '自动'})</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => {
                            setEditingSummaryId(s.id);
                            setEditSumText(s.summaryText);
                            setEditRelText(s.relationChangesText);
                          }} className="opacity-60 hover:opacity-100">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteSummary(s.id)} className="text-red-500 opacity-60 hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="opacity-90">{s.summaryText}</p>
                      <p className="opacity-70 italic text-[10px] border-t pt-1" style={{ borderColor: 'var(--divider)' }}>关系变迁: {s.relationChangesText}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t flex justify-end" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            保存并生效
          </button>
        </div>
      </div>

      {/* 新建本群角色子弹窗 */}
      {showAddLocalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleAddLocalChar} className="w-full max-w-xs rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--modal-bg)', border: '1px solid var(--modal-border)' }}>
            <h4 className="text-xs font-semibold">创建本群独占 AI 角色</h4>
            <input
              type="text"
              required
              placeholder="角色名字"
              value={newLocalName}
              onChange={(e) => setNewLocalName(e.target.value)}
              className="w-full p-2 rounded-lg border text-xs"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />
            <textarea
              rows={3}
              placeholder="性格与基本人设描摹..."
              value={newLocalBio}
              onChange={(e) => setNewLocalBio(e.target.value)}
              className="w-full p-2 rounded-lg border text-xs resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddLocalModal(false)} className="px-3 py-1 text-xs opacity-60">取消</button>
              <button type="submit" className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>创建并加入</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

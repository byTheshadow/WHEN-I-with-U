import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, Users, Sparkles, UserPlus } from 'lucide-react';
import db from '../../../db';

export const EnsembleSettingsModal = ({ chatId, onClose, onUpdated }) => {
  const [chat, setChat] = useState(null);
  const [allGlobalChars, setAllGlobalChars] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');

  // 基本设定
  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.2);
  const [summaryFreq, setSummaryFreq] = useState(5);

  // 成员与定向关系
  const [selectedGlobalIds, setSelectedGlobalIds] = useState([]);
  const [localChars, setLocalChars] = useState([]);
  const [relations, setRelations] = useState([]);

  // 新增本群专属角色 Modal
  const [showAddLocalModal, setShowAddLocalModal] = useState(false);
  const [localName, setLocalName] = useState('');
  const [localBio, setLocalBio] = useState('');
  const [localNotes, setLocalNotes] = useState('');

  // 编辑剧情总结 Modal
  const [editingSummary, setEditingSummary] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [relationText, setRelationText] = useState('');

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
    setSummaryFreq(chatDoc.summaryFrequencyRounds || 5);

    setSelectedGlobalIds(chatDoc.selectedCharacterIds || []);
    setLocalChars(chatDoc.localCharacters || []);
    setRelations(chatDoc.relations || []);

    const globals = await db.characters.toArray();
    setAllGlobalChars(globals);

    loadSummaries();
  };

  const loadSummaries = async () => {
    const sumList = await db.ensembleSummaries.where('chatId').equals(chatId).toArray();
    setSummaries(sumList);
  };

  // 全局角色勾选控制 (上限 8 位成员)
  const handleToggleGlobalChar = (charId) => {
    if (selectedGlobalIds.includes(charId)) {
      setSelectedGlobalIds(selectedGlobalIds.filter(id => id !== charId));
    } else {
      if (selectedGlobalIds.length + localChars.length >= 8) {
        alert('一个大群最多包含 8 位 AI 角色');
        return;
      }
      setSelectedGlobalIds([...selectedGlobalIds, charId]);
    }
  };

  // 创建本群专属角色
  const handleCreateLocalChar = (e) => {
    e.preventDefault();
    if (!localName.trim()) return;
    if (selectedGlobalIds.length + localChars.length >= 8) {
      alert('一个大群最多包含 8 位 AI 角色');
      return;
    }

    const newChar = {
      id: `local_${Date.now()}`,
      name: localName.trim(),
      bio: localBio.trim(),
      extraNotes: localNotes.trim()
    };

    setLocalChars([...localChars, newChar]);
    setLocalName('');
    setLocalBio('');
    setLocalNotes('');
    setShowAddLocalModal(false);
  };

  const handleDeleteLocalChar = (id) => {
    setLocalChars(localChars.filter(c => c.id !== id));
  };

  // 定向关系管理
  const handleAddRelation = () => {
    setRelations([
      ...relations,
      {
        id: `rel_${Date.now()}`,
        sourceName: '角色A',
        targetName: '角色B',
        relation: '互相竞争但彼此尊重'
      }
    ]);
  };

  const handleUpdateRelation = (id, field, val) => {
    setRelations(relations.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleDeleteRelation = (id) => {
    setRelations(relations.filter(r => r.id !== id));
  };

  // 总结编辑与删除
  const handleSaveSummaryEdit = async () => {
    if (!editingSummary) return;
    await db.ensembleSummaries.update(editingSummary.id, {
      summaryText,
      relationChangesText: relationText,
      updatedAt: Date.now()
    });
    setEditingSummary(null);
    loadSummaries();
  };

  const handleDeleteSummary = async (id) => {
    await db.ensembleSummaries.delete(id);
    loadSummaries();
  };

  const handleSaveAll = async () => {
    await db.ensembleChats.update(chatId, {
      title,
      scenePrompt,
      bgImage,
      bgOpacity: parseFloat(bgOpacity),
      summaryFrequencyRounds: parseInt(summaryFreq, 10) || 5,
      selectedCharacterIds: selectedGlobalIds,
      localCharacters: localChars,
      relations,
      updatedAt: Date.now()
    });
    onUpdated();
    onClose();
  };

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
          <h3 className="text-sm font-semibold">羁绊群像剧本档案</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b px-2 text-xs" style={{ borderColor: 'var(--divider)' }}>
          {[
            { id: 'basic', label: '基本设定' },
            { id: 'members', label: '角色档案(限8人)' },
            { id: 'relations', label: '关系矩阵' },
            { id: 'summaries', label: '剧情总结' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 font-medium transition-all ${
                activeTab === t.id ? 'border-b-2 font-semibold' : 'opacity-60'
              }`}
              style={{
                borderColor: activeTab === t.id ? 'var(--accent-color)' : 'transparent',
                color: activeTab === t.id ? 'var(--text-main)' : 'var(--text-sub)'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
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
                <label className="block opacity-60 mb-1">剧本环境描摹 (Scene Prompt)</label>
                <textarea
                  rows={4}
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">自动总结触发频率 (每 X 次 AI 链式回复后)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={summaryFreq}
                  onChange={(e) => setSummaryFreq(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 mb-1">背景图 URL / Base64</label>
                <input
                  type="text"
                  value={bgImage}
                  onChange={(e) => setBgImage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[11px]">本群专属 AI 角色列表：</span>
                <button
                  type="button"
                  onClick={() => setShowAddLocalModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium active:scale-95 transition-transform"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  <UserPlus className="w-3 h-3" />
                  新建专属角色
                </button>
              </div>

              {localChars.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl border flex items-center justify-between" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  <div>
                    <div className="font-semibold text-xs">{c.name} <span className="text-[9px] opacity-50 font-mono">(本群专属)</span></div>
                    <p className="text-[10px] opacity-60">{c.bio}</p>
                  </div>
                  <button type="button" onClick={() => handleDeleteLocalChar(c.id)} className="text-red-500 opacity-60 hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <span className="block opacity-60 text-[11px] pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
                勾选入群的全局已有角色：
              </span>
              {allGlobalChars.map((c) => {
                const checked = selectedGlobalIds.includes(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                    <span className="font-semibold">{c.name}</span>
                    <input type="checkbox" checked={checked} onChange={() => handleToggleGlobalChar(c.id)} className="accent-current w-4 h-4" />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[11px]">明确的定向关系矩阵：</span>
                <button type="button" onClick={handleAddRelation} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                  <Plus className="w-3 h-3" /> 新增关系链
                </button>
              </div>

              {relations.map((r) => (
                <div key={r.id} className="p-3 rounded-2xl border space-y-2 relative" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={r.sourceName}
                      onChange={(e) => handleUpdateRelation(r.id, 'sourceName', e.target.value)}
                      placeholder="主体角色"
                      className="w-1/2 px-2 py-1 rounded border text-xs"
                    />
                    <span className="opacity-40">→</span>
                    <input
                      type="text"
                      value={r.targetName}
                      onChange={(e) => handleUpdateRelation(r.id, 'targetName', e.target.value)}
                      placeholder="客体角色/User"
                      className="w-1/2 px-2 py-1 rounded border text-xs"
                    />
                    <button type="button" onClick={() => handleDeleteRelation(r.id)} className="text-red-500 opacity-60 hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={r.relation}
                    onChange={(e) => handleUpdateRelation(r.id, 'relation', e.target.value)}
                    placeholder="关系描述与态度认知..."
                    className="w-full px-2 py-1 rounded border text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <span className="block opacity-60 text-[11px]">全量历史总结 (均持续生效，支持自由编辑与删除)：</span>
              {summaries.map((s, idx) => (
                <div key={s.id} className="p-3 rounded-2xl border space-y-1.5 text-[11px] relative" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center justify-between font-semibold">
                    <span>阶段 #{idx + 1} 总结</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSummary(s);
                          setSummaryText(s.summaryText);
                          setRelationText(s.relationChangesText);
                        }}
                        className="opacity-60 hover:opacity-100"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => handleDeleteSummary(s.id)} className="text-red-500 opacity-60 hover:opacity-100">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="opacity-90">{s.summaryText}</p>
                  <p className="opacity-70 italic text-[10px]">关系演变: {s.relationChangesText}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal 底栏 */}
        <div className="p-3 border-t flex justify-end" style={{ borderColor: 'var(--divider)' }}>
          <button type="button" onClick={handleSaveAll} className="px-5 py-2 rounded-xl text-xs font-semibold active:scale-95" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>
            保存剧本档案
          </button>
        </div>
      </div>

      {/* 新增本群角色 Modal */}
      {showAddLocalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <form onSubmit={handleCreateLocalChar} className="w-full max-w-xs rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--modal-bg)' }}>
            <h4 className="font-semibold text-xs border-b pb-2">创建本群专属 AI 角色</h4>
            <input type="text" required placeholder="角色名字" value={localName} onChange={(e) => setLocalName(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border text-xs" />
            <input type="text" placeholder="人设基底描述" value={localBio} onChange={(e) => setLocalBio(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border text-xs" />
            <textarea rows={2} placeholder="特别行为规则..." value={localNotes} onChange={(e) => setLocalNotes(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border text-xs resize-none" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddLocalModal(false)} className="px-3 py-1 text-xs opacity-60">取消</button>
              <button type="submit" className="px-4 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>创建</button>
            </div>
          </form>
        </div>
      )}

      {/* 编辑总结 Modal */}
      {editingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-xs rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--modal-bg)' }}>
            <h4 className="font-semibold text-xs border-b pb-2">编辑剧情总结</h4>
            <textarea rows={3} value={summaryText} onChange={(e) => setSummaryText(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border text-xs resize-none" />
            <textarea rows={2} value={relationText} onChange={(e) => setRelationText(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border text-xs resize-none" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSummary(null)} className="px-3 py-1 text-xs opacity-60">取消</button>
              <button type="button" onClick={handleSaveSummaryEdit} className="px-4 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>保存更新</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { X, User, Users, Plus, Trash2, ShieldAlert } from 'lucide-react';
import db from '../../db';

const PRESET_RELATIONS = [
  '互嘲的室友',
  '咖啡馆死党',
  '社团搭档',
  '青梅竹马',
  '职场竞争对手',
  '同好交流伙伴',
  '书友'
];

export const SnapshotSettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('user');
  const [globalPersona, setGlobalPersona] = useState('');
  const [globalAvatar, setGlobalAvatar] = useState('');
  
  const [characters, setCharacters] = useState([]);
  const [relations, setRelations] = useState([]);
  const [charA, setCharA] = useState('');
  const [charB, setCharB] = useState('');
  const [relationText, setRelationText] = useState(PRESET_RELATIONS[0]);

  const [npcs, setNpcs] = useState([]);
  const [newNpcName, setNewNpcName] = useState('');
  const [newNpcTag, setNewNpcTag] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    try {
      const savedPersona = await db.snapshotSettings.get('globalPersona');
      const savedAvatar = await db.snapshotSettings.get('globalAvatar');
      const savedNpcs = await db.snapshotSettings.get('npcs');
      if (savedPersona) setGlobalPersona(savedPersona.value || '');
      if (savedAvatar) setGlobalAvatar(savedAvatar.value || '');
      if (savedNpcs) setNpcs(savedNpcs.value || []);

      const charList = await db.characters.toArray();
      setCharacters(charList);

      const relList = await db.snapshotRelations.toArray();
      setRelations(relList);
    } catch (err) {
      console.error('Failed to load snapshot settings:', err);
    }
  };

  const handleSaveUser = async () => {
    try {
      await db.snapshotSettings.put({ key: 'globalPersona', value: globalPersona });
      await db.snapshotSettings.put({ key: 'globalAvatar', value: globalAvatar });
      onClose();
    } catch (err) {
      console.error('Failed to save user persona:', err);
    }
  };

  const handleAddRelation = async () => {
    if (!charA || !charB || charA === charB) return;
    try {
      await db.snapshotRelations.add({
        characterId: Number(charA),
        targetCharacterId: Number(charB),
        relation: relationText
      });
      setCharA('');
      setCharB('');
      loadData();
    } catch (err) {
      console.error('Failed to add relation:', err);
    }
  };

  const handleDeleteRelation = async (id) => {
    try {
      await db.snapshotRelations.delete(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete relation:', err);
    }
  };

  const handleAddNpc = async () => {
    if (!newNpcName.trim()) return;
    const updated = [...npcs, { id: Date.now(), name: newNpcName, roleTag: newNpcTag || '路人NPC' }];
    setNpcs(updated);
    await db.snapshotSettings.put({ key: 'npcs', value: updated });
    setNewNpcName('');
    setNewNpcTag('');
  };

  const handleDeleteNpc = async (npcId) => {
    const updated = npcs.filter(n => n.id !== npcId);
    setNpcs(updated);
    await db.snapshotSettings.put({ key: 'npcs', value: updated });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-[2rem] p-5 space-y-4 border shadow-2xl flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="font-bold text-sm">Snapshots 全局与关系设置</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100"
            style={{ color: 'var(--text-main)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'user' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: activeTab === 'user' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            全局 User 人设
          </button>
          <button
            onClick={() => setActiveTab('relations')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'relations' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: activeTab === 'relations' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            角色关系矩阵
          </button>
          <button
            onClick={() => setActiveTab('npcs')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'npcs' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: activeTab === 'npcs' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            NPC 管理
          </button>
        </div>

        {/* Tab 内容区 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'user' && (
            <div className="space-y-3 pt-1">
              <p className="text-[11px] opacity-60">
                当未指定具体的聊天框关联时，Snapshots 动态与评论将统一采用此处配置的 User 形象与人设。
              </p>

              <div>
                <label className="text-xs font-semibold block mb-1">User 头像 URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={globalAvatar}
                  onChange={(e) => setGlobalAvatar(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">全局 User 人设与习惯描述</label>
                <textarea
                  placeholder="描述你在动态社交圈里的身份、语言语气风格..."
                  value={globalPersona}
                  onChange={(e) => setGlobalPersona(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none h-24 resize-none"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <button
                onClick={handleSaveUser}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                保存全局 User 设置
              </button>
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-4 pt-1">
              <div
                className="p-2.5 rounded-xl border text-[11px] space-y-1"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>社交互动规则提示</span>
                </div>
                <p className="opacity-70 leading-relaxed">
                  角色之间的关系仅限于朋友、同僚、室友等社交契约，禁止配置为亲密情侣关系。
                </p>
              </div>

              {/* 新增关系表单 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold block">新建角色社交关系</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={charA}
                    onChange={(e) => setCharA(e.target.value)}
                    className="text-xs p-2 rounded-xl border outline-none"
                    style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <option value="">选择角色 A</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={charB}
                    onChange={(e) => setCharB(e.target.value)}
                    className="text-xs p-2 rounded-xl border outline-none"
                    style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <option value="">选择角色 B</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入或选择关系描述..."
                    value={relationText}
                    onChange={(e) => setRelationText(e.target.value)}
                    className="flex-1 text-xs p-2 rounded-xl border outline-none"
                    style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  />
                  <button
                    onClick={handleAddRelation}
                    className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  >
                    添加
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_RELATIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRelationText(preset)}
                      className="px-2 py-0.5 rounded-full text-[10px] border opacity-70 hover:opacity-100"
                      style={{ borderColor: 'var(--card-border)' }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 已有关系列表 */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">已配置的关系</h4>
                {relations.length === 0 ? (
                  <p className="text-[11px] opacity-40 italic">暂未配置角色间关系</p>
                ) : (
                  <div className="space-y-1.5">
                    {relations.map((rel) => {
                      const nameA = characters.find(c => c.id === rel.characterId)?.name || '未知角色';
                      const nameB = characters.find(c => c.id === rel.targetCharacterId)?.name || '未知角色';
                      return (
                        <div
                          key={rel.id}
                          className="flex items-center justify-between p-2 rounded-xl border text-xs"
                          style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                        >
                          <span>{nameA} & {nameB}：<strong className="underline">{rel.relation}</strong></span>
                          <button
                            onClick={() => handleDeleteRelation(rel.id)}
                            className="p-1 opacity-50 hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'npcs' && (
            <div className="space-y-4 pt-1">
              <p className="text-[11px] opacity-60">
                可在这里添加常驻的小 NPC（如街角咖啡师、流动摄影师），也可在无预设时由 AI 自由发挥出场。
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="NPC 名称 (如：咖啡师阿杰)"
                  value={newNpcName}
                  onChange={(e) => setNewNpcName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="身份标签 (如：路人摄影师)"
                    value={newNpcTag}
                    onChange={(e) => setNewNpcTag(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-xl border outline-none"
                    style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  />
                  <button
                    onClick={handleAddNpc}
                    className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  >
                    添加 NPC
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold">NPC 列表</h4>
                {npcs.length === 0 ? (
                  <p className="text-[11px] opacity-40 italic">暂无自定义 NPC</p>
                ) : (
                  <div className="space-y-1.5">
                    {npcs.map((npc) => (
                      <div
                        key={npc.id}
                        className="flex items-center justify-between p-2 rounded-xl border text-xs"
                        style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                      >
                        <div>
                          <span className="font-bold">{npc.name}</span>
                          <span className="ml-2 text-[10px] opacity-60">({npc.roleTag})</span>
                        </div>
                        <button
                          onClick={() => handleDeleteNpc(npc.id)}
                          className="p-1 opacity-50 hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnapshotSettingsModal;

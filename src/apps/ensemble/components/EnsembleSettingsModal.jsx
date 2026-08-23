import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, UserPlus, Sparkles, Sliders } from 'lucide-react';
import db from '../../../db';

export const EnsembleSettingsModal = ({ chatId, onClose, onUpdated }) => {
  const [chat, setChat] = useState(null);
  const [allGlobalChars, setAllGlobalChars] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');

  const [title, setTitle] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.2);

  const [selectedGlobalIds, setSelectedGlobalIds] = useState([]);
  const [localChars, setLocalChars] = useState([]);
  const [relations, setRelations] = useState([]);

  // 子弹窗
  const [showAddLocal, setShowAddLocal] = useState(false);
  const [localName, setLocalName] = useState('');
  const [localBio, setLocalBio] = useState('');

  const [editingSummary, setEditingSummary] = useState(null);
  const [sumText, setSumText] = useState('');
  const [relText, setRelText] = useState('');

  useEffect(() => {
    loadData();
  }, [chatId]);

  const loadData = async () => {
    const doc = await db.ensembleChats.get(chatId);
    if (!doc) return;
    setChat(doc);
    setTitle(doc.title || '');
    setScenePrompt(doc.scenePrompt || '');
    setBgImage(doc.bgImage || '');
    setBgOpacity(doc.bgOpacity ?? 0.2);
    setSelectedGlobalIds(doc.selectedCharacterIds || []);
    setLocalChars(doc.localCharacters || []);
    setRelations(doc.relations || []);

    const globals = await db.characters.toArray();
    setAllGlobalChars(globals);

    loadSummaries();
  };

  const loadSummaries = async () => {
    const list = await db.ensembleSummaries.where('chatId').equals(chatId).toArray();
    setSummaries(list);
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
      updatedAt: Date.now()
    });
    onUpdated();
    onClose();
  };

  const handleCreateLocal = (e) => {
    e.preventDefault();
    if (!localName.trim()) return;
    setLocalChars([...localChars, { id: `local_${Date.now()}`, name: localName.trim(), bio: localBio.trim() }]);
    setLocalName('');
    setLocalBio('');
    setShowAddLocal(false);
  };

  const handleSaveSummaryEdit = async () => {
    if (!editingSummary) return;
    await db.ensembleSummaries.update(editingSummary.id, {
      summaryText: sumText,
      relationChangesText: relText,
      updatedAt: Date.now()
    });
    setEditingSummary(null);
    loadSummaries();
  };

  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm h-[78vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border animate-scale-up"
        style={{
          backgroundColor: 'var(--modal-bg)',
          borderColor: 'var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Modal 顶栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wider">
            <Sliders className="w-3.5 h-3.5" />
            <span>剧本档案 Manifest</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-50 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 标签栏 */}
        <div className="flex items-center border-b px-2 text-[11px]" style={{ borderColor: 'var(--divider)' }}>
          {[
            { id: 'basic', label: '基础设定' },
            { id: 'members', label: 'AI角色' },
            { id: 'relations', label: '定向关系' },
            { id: 'summaries', label: '剧情总结' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 font-medium transition-all ${
                activeTab === t.id ? 'border-b-2 font-semibold' : 'opacity-50'
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

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs no-scrollbar">
          {activeTab === 'basic' && (
            <div className="space-y-3">
              <div>
                <label className="block opacity-60 text-[10px] mb-1">大群名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 text-[10px] mb-1">环境场景描摹 (Scene Prompt)</label>
                <textarea
                  rows={4}
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="block opacity-60 text-[10px] mb-1">壁纸 URL</label>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[10px]">本群专属角色：</span>
                <button
                  type="button"
                  onClick={() => setShowAddLocal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  <UserPlus className="w-3 h-3" />
                  新建专属角色
                </button>
              </div>

              {localChars.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl border flex items-center justify-between" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  <div>
                    <span className="font-semibold">{c.name}</span>
                    <p className="text-[10px] opacity-60">{c.bio || '无描述'}</p>
                  </div>
                  <button type="button" onClick={() => setLocalChars(localChars.filter((x) => x.id !== c.id))} className="text-red-500 opacity-60 hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <span className="block opacity-60 text-[10px] pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
                全局角色勾选 (最多可装载 8 位)：
              </span>
              {allGlobalChars.map((c) => {
                const checked = selectedGlobalIds.includes(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                    <div className="flex items-center gap-2">
                      {c.avatar ? <img src={c.avatar} alt="" className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full bg-black/10 text-[9px] flex items-center justify-center">{c.name[0]}</div>}
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) setSelectedGlobalIds(selectedGlobalIds.filter((id) => id !== c.id));
                        else setSelectedGlobalIds([...selectedGlobalIds, c.id]);
                      }}
                      className="w-4 h-4 accent-current"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="opacity-60 text-[10px]">明确的关系描述链：</span>
                <button
                  type="button"
                  onClick={() => setRelations([...relations, { id: `rel_${Date.now()}`, sourceName: '角色A', targetName: '角色B', relation: '关系描述...' }])}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Plus className="w-3 h-3" /> 新增关系
                </button>
              </div>

              {relations.map((r) => (
                <div key={r.id} className="p-2.5 rounded-xl border space-y-1.5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center gap-1">
                    <input type="text" value={r.sourceName} onChange={(e) => setRelations(relations.map((x) => (x.id === r.id ? { ...x, sourceName: e.target.value } : x)))} className="w-1/2 px-2 py-0.5 rounded border text-[11px]" />
                    <span className="opacity-40">→</span>
                    <input type="text" value={r.targetName} onChange={(e) => setRelations(relations.map((x) => (x.id === r.id ? { ...x, targetName: e.target.value } : x)))} className="w-1/2 px-2 py-0.5 rounded border text-[11px]" />
                    <button type="button" onClick={() => setRelations(relations.filter((x) => x.id !== r.id))} className="text-red-500 opacity-60 hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <input type="text" value={r.relation} onChange={(e) => setRelations(relations.map((x) => (x.id === r.id ? { ...x, relation: e.target.value } : x)))} className="w-full px-2 py-0.5 rounded border text-[11px]" />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-2">
              <span className="block opacity-60 text-[10px]">剧情演进历史总结：</span>
              {summaries.map((s, idx) => (
                <div key={s.id} className="p-2.5 rounded-xl border space-y-1 text-[11px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center justify-between font-semibold">
                    <span>总结 #{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => { setEditingSummary(s); setSumText(s.summaryText); setRelText(s.relationChangesText); }} className="opacity-60 hover:opacity-100">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={async () => { await db.ensembleSummaries.delete(s.id); loadSummaries(); }} className="text-red-500 opacity-60 hover:opacity-100">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="opacity-80">{s.summaryText}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal 底栏 */}
        <div className="p-3 border-t flex justify-end" style={{ borderColor: 'var(--divider)' }}>
          <button type="button" onClick={handleSaveAll} className="px-5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>
            保存档案
          </button>
        </div>
      </div>

      {/* 新增专属角色弹窗 */}
      {showAddLocal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleCreateLocal} className="w-full max-w-xs rounded-2xl p-4 space-y-3 border" style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)' }}>
            <h4 className="font-semibold text-xs border-b pb-2">新建本群专属 AI 角色</h4>
            <input type="text" required placeholder="角色名称" value={localName} onChange={(e) => setLocalName(e.target.value)} className="w-full px-3 py-1 rounded-lg border text-xs outline-none" />
            <input type="text" placeholder="人设基底" value={localBio} onChange={(e) => setLocalBio(e.target.value)} className="w-full px-3 py-1 rounded-lg border text-xs outline-none" />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAddLocal(false)} className="px-3 py-1 text-xs opacity-60">取消</button>
              <button type="submit" className="px-4 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>创建</button>
            </div>
          </form>
        </div>
      )}

      {/* 编辑总结弹窗 */}
      {editingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl p-4 space-y-3 border" style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)' }}>
            <h4 className="font-semibold text-xs border-b pb-2">编辑剧情总结</h4>
            <textarea rows={3} value={sumText} onChange={(e) => setSumText(e.target.value)} className="w-full px-3 py-1 rounded-lg border text-xs outline-none resize-none" />
            <textarea rows={2} value={relText} onChange={(e) => setRelText(e.target.value)} className="w-full px-3 py-1 rounded-lg border text-xs outline-none resize-none" />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditingSummary(null)} className="px-3 py-1 text-xs opacity-60">取消</button>
              <button type="button" onClick={handleSaveSummaryEdit} className="px-4 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>保存更新</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


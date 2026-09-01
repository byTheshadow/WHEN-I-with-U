import React, { useState, useRef } from 'react';
import {
  ArrowLeft, Save, Trash2, Upload, Plus, BookOpen, Brain,
  List, User, X, Activity, Shield, ChevronDown, ChevronRight, FoldVertical, UnfoldVertical
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';
import VoiceProfilePanel from '../../features/real-voice/components/VoiceProfilePanel';
import { normalizeVoiceProfile } from '../../features/real-voice/realVoiceDefaults';


export const CharacterEditor = ({ characterData, onBack, onSaved }) => {
  const [character, setCharacter] = useState({
    id: characterData?.id || null,
    name: characterData?.name || '',
    avatar: characterData?.avatar || '',
    bio: characterData?.bio || '',
    extraNotes: characterData?.extraNotes || '',
    summaryFrequency: characterData?.summaryFrequency || 10,
    summaries: characterData?.summaries || [],
    worldBookEntries: characterData?.worldBookEntries || [],
    knowledgeEntries: characterData?.knowledgeEntries || [],
    linkTodo: characterData?.linkTodo ?? true,
    autoDiary: characterData?.autoDiary ?? true,
    userPersona: characterData?.userPersona || '',
    userAvatar: characterData?.userAvatar || '',
    statusList: characterData?.statusList || ['月色与你同在', '在咖啡馆看书', '静候你的回应', '心绪停留于此'],
voiceProfile: normalizeVoiceProfile(characterData?.voiceProfile),


  });

  // 控制世界书与知识库手风琴折叠展开状态 (Key: entryId -> boolean)
  const [expandedWorldEntries, setExpandedWorldEntries] = useState({});
  const [expandedKnowledgeEntries, setExpandedKnowledgeEntries] = useState({});

  const [newStatus, setNewStatus] = useState('');
  const [newWorldTitle, setNewWorldTitle] = useState('');
  const [newWorldContent, setNewWorldContent] = useState('');
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [newSummaryContent, setNewSummaryContent] = useState('');
  
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const avatarInputRef = useRef(null);
  const userAvatarInputRef = useRef(null);

  const handleImageUpload = (e, targetField) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCharacter((prev) => ({ ...prev, [targetField]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const addStatus = () => {
    if (!newStatus.trim()) return;
    setCharacter((prev) => ({ ...prev, statusList: [...prev.statusList, newStatus.trim()] }));
    setNewStatus('');
  };

  const removeStatus = (idx) => {
    setCharacter((prev) => ({ ...prev, statusList: prev.statusList.filter((_, i) => i !== idx) }));
  };

  const addSummary = () => {
    if (!newSummaryContent.trim()) return;
    const item = { id: Date.now(), content: newSummaryContent.trim(), date: new Date().toLocaleDateString() };
    setCharacter((prev) => ({ ...prev, summaries: [item, ...prev.summaries] }));
    setNewSummaryContent('');
  };

  const removeSummary = (id) => {
    setCharacter((prev) => ({ ...prev, summaries: prev.summaries.filter((s) => s.id !== id) }));
  };

  // 世界书展开/折叠
  const toggleWorldEntry = (id) => {
    setExpandedWorldEntries(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllWorldEntries = (expandAll) => {
    const nextState = {};
    character.worldBookEntries.forEach(w => { nextState[w.id] = expandAll; });
    setExpandedWorldEntries(nextState);
  };

  const addWorldEntry = () => {
    if (!newWorldTitle.trim() || !newWorldContent.trim()) return;
    const newId = Date.now();
    const entry = { id: newId, title: newWorldTitle.trim(), content: newWorldContent.trim(), isEnabled: true };
    setCharacter((prev) => ({ ...prev, worldBookEntries: [...prev.worldBookEntries, entry] }));
    setExpandedWorldEntries(prev => ({ ...prev, [newId]: true }));
    setNewWorldTitle('');
    setNewWorldContent('');
  };

  const removeWorldEntry = (id) => {
    setCharacter((prev) => ({ ...prev, worldBookEntries: prev.worldBookEntries.filter((w) => w.id !== id) }));
  };

  // 知识库展开/折叠
  const toggleKnowledgeEntry = (id) => {
    setExpandedKnowledgeEntries(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllKnowledgeEntries = (expandAll) => {
    const nextState = {};
    character.knowledgeEntries.forEach(k => { nextState[k.id] = expandAll; });
    setExpandedKnowledgeEntries(nextState);
  };

  const addKnowledgeEntry = () => {
    if (!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()) return;
    const newId = Date.now();
    const entry = { id: newId, title: newKnowledgeTitle.trim(), content: newKnowledgeContent.trim(), isEnabled: true };
    setCharacter((prev) => ({ ...prev, knowledgeEntries: [...prev.knowledgeEntries, entry] }));
    setExpandedKnowledgeEntries(prev => ({ ...prev, [newId]: true }));
    setNewKnowledgeTitle('');
    setNewKnowledgeContent('');
  };

  const removeKnowledgeEntry = (id) => {
    setCharacter((prev) => ({ ...prev, knowledgeEntries: prev.knowledgeEntries.filter((k) => k.id !== id) }));
  };

  const handleSave = async () => {
    if (!character.name.trim()) return;

    try {
      const payload = { ...character };
      
      if (!payload.id) {
        delete payload.id;
        const newId = await db.characters.add({
          ...payload,
          createdAt: new Date().toISOString()
        });
        payload.id = newId;
      } else {
        await db.characters.put(payload);
      }

      if (onSaved) onSaved(payload);
      onBack();
    } catch (err) {
      console.error('Save character failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!character.id) return;
    await db.characters.delete(character.id);
    if (onSaved) onSaved(null);
    onBack();
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-16 text-xs text-left">
      {/* 顶部 Navbar */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-2 font-semibold opacity-70 hover:opacity-100">
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="font-mono opacity-40 text-[10px] uppercase">CHARACTER BUILDER</span>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold active:scale-95 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存</span>
        </button>
      </div>

      {/* 1. 基础形象与信息 */}
      <GlassCard className="space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm">
          <User className="w-4 h-4" />
          <span>角色基础形象 (Profile Info)</span>
        </div>

        <div className="flex items-start gap-4 pt-1">
          <div className="space-y-2 shrink-0 text-center">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="w-16 h-16 rounded-full border border-white/20 bg-black/5 dark:bg-white/10 flex items-center justify-center cursor-pointer overflow-hidden relative group"
            >
              {character.avatar ? (
                <img src={character.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-5 h-5 opacity-40" />
              )}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'avatar')} />
            <span className="text-[10px] opacity-50 block">角色头像</span>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <label className="block opacity-60 mb-1">角色姓名</label>
              <input
                type="text"
                placeholder="例如: Elena"
                value={character.name}
                onChange={(e) => setCharacter({ ...character, name: e.target.value })}
                className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none font-medium"
              />
            </div>

                        <div>
              <label className="block opacity-60 mb-1">角色简介 (Bio)</label>
              <textarea
                rows={3}
                placeholder="一句话性格描述..."
                value={character.bio}
                onChange={(e) => setCharacter({ ...character, bio: e.target.value })}
                className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none resize-y overflow-y-auto max-h-32 min-h-[48px]"
              />
            </div>

          </div>
        </div>

              <div>
          <label className="block opacity-60 mb-1">其它补充说明 (Extra Notes)</label>
          <textarea
            rows={3}
            placeholder="关于角色的特殊补充偏好或人设限制..."
            value={character.extraNotes}
            onChange={(e) => setCharacter({ ...character, extraNotes: e.target.value })}
            className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none resize-y overflow-y-auto max-h-32 min-h-[48px]"
          />
        </div>

      </GlassCard>

            <VoiceProfilePanel
        value={character.voiceProfile}
        onChange={(voiceProfile) => {
          setCharacter((previous) => ({
            ...previous,
            voiceProfile,
          }));
        }}
      />


      {/* 2. 状态列表 (Status List) */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Activity className="w-4 h-4" />
          <span>角色状态列表 (Status Pool)</span>
        </div>
        <p className="opacity-60 text-[10px]">角色会从中随机抽取状态显示在顶部状态栏。</p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="例如: 正在咖啡馆看书..."
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="flex-1 bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
          />
          <button type="button" onClick={addStatus} className="px-3 py-2 rounded-lg bg-black/10 dark:bg-white/10 font-semibold">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {character.statusList.map((st, idx) => (
            <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[11px]">
              <span>{st}</span>
              <button type="button" onClick={() => removeStatus(idx)} className="opacity-50 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </GlassCard>

      {/* 3. 总结与频率设置 */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <List className="w-4 h-4" />
          <span>对话总结 (Summary Settings)</span>
        </div>

        <div className="flex items-center justify-between">
          <span>总结触发频率 (对话轮数)</span>
          <input
            type="number"
            value={character.summaryFrequency}
            onChange={(e) => setCharacter({ ...character, summaryFrequency: parseInt(e.target.value) || 10 })}
            className="w-20 bg-black/5 dark:bg-white/10 rounded-lg p-1.5 text-center outline-none"
          />
        </div>

        <div className="space-y-2 pt-2 border-t border-white/10">
          <label className="block opacity-60">历史总结条目 (Summaries)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="新增一条阶段性总结..."
              value={newSummaryContent}
              onChange={(e) => setNewSummaryContent(e.target.value)}
              className="flex-1 bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
            />
            <button type="button" onClick={addSummary} className="px-3 py-2 rounded-lg bg-black/10 dark:bg-white/10 font-semibold">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {character.summaries.map((sum) => (
              <div key={sum.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                <div className="space-y-0.5">
                  <p className="opacity-90">{sum.content}</p>
                  <span className="text-[9px] opacity-40 font-mono">{sum.date}</span>
                </div>
                <button type="button" onClick={() => removeSummary(sum.id)} className="opacity-50 hover:opacity-100 p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* 4. 角色的世界书 (支持展开与折叠) */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <BookOpen className="w-4 h-4" />
            <span>角色的世界书 (World Book)</span>
          </div>

          {character.worldBookEntries.length > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => toggleAllWorldEntries(false)}
                className="flex items-center gap-1 opacity-60 hover:opacity-100"
              >
                <FoldVertical className="w-3 h-3" />
                <span>全部收起</span>
              </button>
              <button
                type="button"
                onClick={() => toggleAllWorldEntries(true)}
                className="flex items-center gap-1 opacity-60 hover:opacity-100"
              >
                <UnfoldVertical className="w-3 h-3" />
                <span>全部展开</span>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="条目标题 (例如: 设定背景)"
            value={newWorldTitle}
            onChange={(e) => setNewWorldTitle(e.target.value)}
            className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
          />
          <textarea
            rows={2}
            placeholder="详细世界观与条目正文..."
            value={newWorldContent}
            onChange={(e) => setNewWorldContent(e.target.value)}
            className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none resize-none"
          />
          <button type="button" onClick={addWorldEntry} className="w-full py-2 rounded-xl bg-black/10 dark:bg-white/10 font-semibold">
            添加世界书条目
          </button>
        </div>

        <div className="space-y-2 pt-2">
          {character.worldBookEntries.map((w) => {
            const isExpanded = expandedWorldEntries[w.id] ?? false;
            return (
              <div key={w.id} className="rounded-xl bg-black/5 dark:bg-white/5 overflow-hidden transition-all">
                <div
                  onClick={() => toggleWorldEntry(w.id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 font-bold min-w-0 pr-2">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                    <span className="truncate">{w.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWorldEntry(w.id);
                    }}
                    className="opacity-50 hover:opacity-100 p-1"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-black/5 dark:border-white/5 text-[11px] opacity-80 leading-relaxed font-sans">
                    {w.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* 5. 角色的知识库 (支持展开与折叠) */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Brain className="w-4 h-4" />
            <span>角色的知识库 (Knowledge Base)</span>
          </div>

          {character.knowledgeEntries.length > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => toggleAllKnowledgeEntries(false)}
                className="flex items-center gap-1 opacity-60 hover:opacity-100"
              >
                <FoldVertical className="w-3 h-3" />
                <span>全部收起</span>
              </button>
              <button
                type="button"
                onClick={() => toggleAllKnowledgeEntries(true)}
                className="flex items-center gap-1 opacity-60 hover:opacity-100"
              >
                <UnfoldVertical className="w-3 h-3" />
                <span>全部展开</span>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="知识点标题 (例如: 喜爱的音乐)"
            value={newKnowledgeTitle}
            onChange={(e) => setNewKnowledgeTitle(e.target.value)}
            className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
          />
          <textarea
            rows={2}
            placeholder="知识库正文细节..."
            value={newKnowledgeContent}
            onChange={(e) => setNewKnowledgeContent(e.target.value)}
            className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none resize-none"
          />
          <button type="button" onClick={addKnowledgeEntry} className="w-full py-2 rounded-xl bg-black/10 dark:bg-white/10 font-semibold">
            添加知识库条目
          </button>
        </div>

        <div className="space-y-2 pt-2">
          {character.knowledgeEntries.map((k) => {
            const isExpanded = expandedKnowledgeEntries[k.id] ?? false;
            return (
              <div key={k.id} className="rounded-xl bg-black/5 dark:bg-white/5 overflow-hidden transition-all">
                <div
                  onClick={() => toggleKnowledgeEntry(k.id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 font-bold min-w-0 pr-2">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                    <span className="truncate">{k.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeKnowledgeEntry(k.id);
                    }}
                    className="opacity-50 hover:opacity-100 p-1"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-black/5 dark:border-white/5 text-[11px] opacity-80 leading-relaxed font-sans">
                    {k.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* 6. 系统关联与 User 人设 */}
      <GlassCard className="space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Shield className="w-4 h-4" />
          <span>联动与用户人设 (System & User Persona)</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span>关联 TODO 与 日历</span>
            <input
              type="checkbox"
              checked={character.linkTodo}
              onChange={(e) => setCharacter({ ...character, linkTodo: e.target.checked })}
              className="w-4 h-4 accent-black dark:accent-white"
            />
          </div>

          <div className="flex items-center justify-between">
            <span>允许角色主动写日记</span>
            <input
              type="checkbox"
              checked={character.autoDiary}
              onChange={(e) => setCharacter({ ...character, autoDiary: e.target.checked })}
              className="w-4 h-4 accent-black dark:accent-white"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 space-y-3">
          <div>
            <label className="block opacity-60 mb-1">我的人设 (User Persona - RP 模式生效)</label>
            <textarea
              rows={3}
              placeholder="在此设定您的特定身份、称呼与背景..."
              value={character.userPersona}
              onChange={(e) => setCharacter({ ...character, userPersona: e.target.value })}
              className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none resize-y overflow-y-auto max-h-48 min-h-[64px]"
            />
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => userAvatarInputRef.current?.click()}
              className="w-10 h-10 rounded-full border border-white/20 bg-black/5 dark:bg-white/10 flex items-center justify-center cursor-pointer overflow-hidden"
            >
              {character.userAvatar ? (
                <img src={character.userAvatar} alt="User Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 opacity-40" />
              )}
            </div>
            <input ref={userAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'userAvatar')} />
            <span className="opacity-60 text-[11px]">点击自定义“我”在该对话中的专属头像</span>
          </div>
        </div>
      </GlassCard>

      {/* 删除按钮 */}
      {character.id && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            className="w-full py-3 rounded-2xl bg-rose-500/10 text-rose-600 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除该角色</span>
          </button>
        </div>
      )}

      {/* 二次删除确认弹窗 */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-neutral-900 border border-white/20 p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm">强确认：是否彻底删除角色？</h3>
            <p className="opacity-70 text-[11px] leading-relaxed">此操作将移除该角色的全部设置与知识库数据，无法撤销。</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 font-semibold">
                取消
              </button>
              <button type="button" onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-semibold">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterEditor;


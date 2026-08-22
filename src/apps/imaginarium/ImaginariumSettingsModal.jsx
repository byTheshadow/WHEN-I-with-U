import React, { useState, useEffect } from 'react';
import { X, Sparkles, User, Users, Palette, Trash2, Plus, Check, Edit2, BookOpen } from 'lucide-react';
import {
  getImaginariumSummaries,
  generateSummaryForChat,
  updateImaginariumSummary,
  deleteImaginariumSummary,
  updateImaginariumChat
} from './imaginariumService';

export const ImaginariumSettingsModal = ({
  isOpen,
  onClose,
  chat,
  onChatUpdated,
  onConfirmDeleteChat
}) => {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'persona' | 'members' | 'summaries'
  const [title, setTitle] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.3);
  const [customCss, setCustomCss] = useState('');

  // User 人设
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [userPersona, setUserPersona] = useState('');

  // 虚拟成员列表
  const [members, setMembers] = useState([]);
  const [editingMemberIndex, setEditingMemberIndex] = useState(null);
  const [memberForm, setMemberForm] = useState({ id: '', name: '', avatar: '', bio: '' });

  // 多总结列表
  const [summaries, setSummaries] = useState([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const [editingSummaryText, setEditingSummaryText] = useState('');

  useEffect(() => {
    if (chat && isOpen) {
      setTitle(chat.title || '');
      setBgImage(chat.bgImage || '');
      setBgOpacity(chat.bgOpacity ?? 0.3);
      setCustomCss(chat.customCss || '');
      setUserName(chat.userName || '我');
      setUserAvatar(chat.userAvatar || '');
      setUserPersona(chat.userPersona || '');
      setMembers(chat.members || []);

      loadSummaries();
    }
  }, [chat, isOpen]);

  const loadSummaries = async () => {
    if (!chat?.id) return;
    const list = await getImaginariumSummaries(chat.id);
    setSummaries(list);
  };

  if (!isOpen || !chat) return null;

  // 保存基础设置 & 人设 & 成员
  const handleSaveAll = async () => {
    const updates = {
      title,
      bgImage,
      bgOpacity: Number(bgOpacity),
      customCss,
      userName,
      userAvatar,
      userPersona,
      members
    };
    await updateImaginariumChat(chat.id, updates);
    onChatUpdated({ ...chat, ...updates });
    onClose();
  };

  // 添加/更新虚拟成员
  const handleSaveMember = (e) => {
    e.preventDefault();
    if (!memberForm.name.trim()) return;

    let updatedList = [...members];
    if (editingMemberIndex !== null) {
      updatedList[editingMemberIndex] = { ...memberForm };
    } else {
      const newNpc = {
        ...memberForm,
        id: memberForm.id || `npc_${Date.now()}`
      };
      updatedList.push(newNpc);
    }

    setMembers(updatedList);
    setEditingMemberIndex(null);
    setMemberForm({ id: '', name: '', avatar: '', bio: '' });
  };

  const handleDeleteMember = (index) => {
    const updated = members.filter((_, i) => i !== index);
    setMembers(updated);
  };

  // AI 总结生成与修改
  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      await generateSummaryForChat(chat.id);
      await loadSummaries();
    } catch (err) {
      alert(err.message || '生成总结失败');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSaveSummaryEdit = async (id) => {
    await updateImaginariumSummary(id, editingSummaryText);
    setEditingSummaryId(null);
    await loadSummaries();
  };

  const handleDeleteSummaryItem = async (id) => {
    await deleteImaginariumSummary(id);
    await loadSummaries();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="fixed inset-0"
        style={{ backgroundColor: 'var(--modal-overlay)' }}
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl z-10 space-y-5 max-h-[85dvh] flex flex-col"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
          color: 'var(--text-main)'
        }}
      >
        {/* Header & Tabs */}
        <div className="flex items-center justify-between shrink-0 pb-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="font-serif font-bold text-sm tracking-wide">沙龙手稿配置</h3>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl shrink-0" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'settings' ? 'shadow-sm font-bold' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'settings' ? 'var(--card-bg)' : 'transparent' }}
          >
            <Palette className="w-3.5 h-3.5" /> 基础外观
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('persona')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'persona' ? 'shadow-sm font-bold' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'persona' ? 'var(--card-bg)' : 'transparent' }}
          >
            <User className="w-3.5 h-3.5" /> User人设
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'members' ? 'shadow-sm font-bold' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'members' ? 'var(--card-bg)' : 'transparent' }}
          >
            <Users className="w-3.5 h-3.5" /> 虚拟群友
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summaries')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'summaries' ? 'shadow-sm font-bold' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'summaries' ? 'var(--card-bg)' : 'transparent' }}
          >
            <BookOpen className="w-3.5 h-3.5" /> 多总结
          </button>
        </div>

        {/* Tab 内容区 */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* TAB 1: 基础外观 */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              <div>
                <label className="opacity-60 text-[10px] block mb-1">沙龙名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="opacity-60 text-[10px] block mb-1">背景图片 URL</label>
                <input
                  type="url"
                  value={bgImage}
                  onChange={(e) => setBgImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="opacity-60 text-[10px] block mb-1">背景透明度 ({bgOpacity})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="opacity-60 text-[10px] block mb-1">自定义 CSS 样式规则</label>
                <textarea
                  rows={3}
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  placeholder=".imaginarium-bubble-ai { border-color: gold; }"
                  className="w-full p-2.5 rounded-xl border outline-none font-mono text-[11px]"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div className="pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <button
                  type="button"
                  onClick={() => onConfirmDeleteChat(chat.id)}
                  className="w-full py-2.5 rounded-xl border text-rose-500 font-semibold flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> 解散该虚构沙龙
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: User人设 */}
          {activeTab === 'persona' && (
            <div className="space-y-3">
              <div>
                <label className="opacity-60 text-[10px] block mb-1">我的名字</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="opacity-60 text-[10px] block mb-1">我的头像 URL</label>
                <input
                  type="url"
                  value={userAvatar}
                  onChange={(e) => setUserAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="opacity-60 text-[10px] block mb-1">我在本群的人设描述</label>
                <textarea
                  rows={4}
                  value={userPersona}
                  onChange={(e) => setUserPersona(e.target.value)}
                  placeholder="例如: 深夜书店的常客 / 偶尔沉默的发问者..."
                  className="w-full p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: 虚拟群员管理 */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {members.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-2xl border"
                    style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs" style={{ backgroundColor: 'var(--card-bg)' }}>
                        {m.avatar ? <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" /> : m.name?.[0]}
                      </div>
                      <div className="truncate">
                        <div className="font-bold">{m.name}</div>
                        <div className="text-[10px] opacity-60 truncate">{m.bio || '暂无人设'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMemberIndex(idx);
                          setMemberForm({ ...m });
                        }}
                        className="p-1.5 rounded-full opacity-60 hover:opacity-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(idx)}
                        className="p-1.5 rounded-full text-rose-500 opacity-60 hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 增加/修改表单 */}
              <form onSubmit={handleSaveMember} className="p-3 rounded-2xl border space-y-2.5" style={{ borderColor: 'var(--card-border)' }}>
                <h4 className="font-bold text-[11px]">
                  {editingMemberIndex !== null ? '编辑群员信息' : '添加新虚拟群员'}
                </h4>
                <input
                  type="text"
                  placeholder="角色姓名 *"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="w-full p-2 rounded-xl border outline-none text-xs"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  required
                />
                <input
                  type="url"
                  placeholder="头像 URL"
                  value={memberForm.avatar}
                  onChange={(e) => setMemberForm({ ...memberForm, avatar: e.target.value })}
                  className="w-full p-2 rounded-xl border outline-none text-xs"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
                <textarea
                  rows={2}
                  placeholder="角色人设 / 性格特点"
                  value={memberForm.bio}
                  onChange={(e) => setMemberForm({ ...memberForm, bio: e.target.value })}
                  className="w-full p-2 rounded-xl border outline-none text-xs"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> {editingMemberIndex !== null ? '保存修改' : '放入沙龙'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: 多总结 */}
          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <button
                type="button"
                disabled={isGeneratingSummary}
                onClick={handleGenerateSummary}
                className="w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingSummary ? 'AI 凝练梗概中...' : '生成新阶段总结'}</span>
              </button>

              <div className="space-y-2.5 pt-2">
                {summaries.length === 0 ? (
                  <p className="text-center opacity-50 py-4">暂无总结记录，点击上方按钮生成。</p>
                ) : (
                  summaries.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-2xl border space-y-2"
                      style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                    >
                      {editingSummaryId === s.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={editingSummaryText}
                            onChange={(e) => setEditingSummaryText(e.target.value)}
                            className="w-full p-2 rounded-xl border outline-none text-xs"
                            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveSummaryEdit(s.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px]"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSummaryId(null)}
                              className="px-3 py-1 rounded-lg opacity-60 text-[10px]"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="leading-relaxed opacity-90">{s.content}</p>
                          <div className="flex items-center justify-between pt-1 border-t opacity-60 text-[9px]" style={{ borderColor: 'var(--card-border)' }}>
                            <span>{new Date(s.createdAt).toLocaleString()}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSummaryId(s.id);
                                  setEditingSummaryText(s.content);
                                }}
                                className="hover:opacity-100"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSummaryItem(s.id)}
                                className="text-rose-500 hover:opacity-100"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部确认主按钮 */}
        <div className="shrink-0 pt-2">
          <button
            type="button"
            onClick={handleSaveAll}
            className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Check className="w-4 h-4" /> 保存并返回沙龙
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImaginariumSettingsModal;

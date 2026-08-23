import React, { useState, useEffect } from 'react';
import { X, Sparkles, User, Users, Palette, Trash2, Plus, Check, Edit2, BookOpen, Upload, Wand2, Ticket } from 'lucide-react';
import {
  getImaginariumSummaries,
  generateSummaryForChat,
  updateImaginariumSummary,
  deleteImaginariumSummary,
  updateImaginariumChat
} from './imaginariumService';

const CSS_PRESETS = [
  {
    name: '复古墨水 (Paper & Ink)',
    css: `.imaginarium-bubble-ai { background: var(--bg-surface-strong); border: 1px dashed var(--card-border); font-family: serif; }\n.imaginarium-bubble-user { font-family: serif; }`
  },
  {
    name: '柔粉渐变 (Soft Rose)',
    css: `.imaginarium-bubble-user { background: linear-gradient(135deg, #e879f9 0%, #f43f5e 100%) !important; color: #ffffff !important; }\n.imaginarium-bubble-ai { border-color: #f472b6 !important; }`
  },
  {
    name: '霓虹暗夜 (Cyber Glow)',
    css: `.imaginarium-bubble-ai { background: rgba(15, 23, 42, 0.85) !important; color: #38bdf8 !important; border: 1px solid #0284c7 !important; }\n.imaginarium-bubble-user { background: #0284c7 !important; }`
  },
  {
    name: '极简无边 (Borderless Clean)',
    css: `.imaginarium-bubble-ai { background: transparent !important; border: none !important; border-left: 2px solid var(--accent-color) !important; border-radius: 0 !important; }\n.imaginarium-bubble-user { border-radius: 999px !important; }`
  }
];

export const ImaginariumSettingsModal = ({
  isOpen,
  onClose,
  chat,
  onChatUpdated,
  onConfirmDeleteChat
}) => {
  const [activeTab, setActiveTab] = useState('settings');
  const [title, setTitle] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0.3);
  const [customCss, setCustomCss] = useState('');

  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [userPersona, setUserPersona] = useState('');

  const [members, setMembers] = useState([]);
  const [editingMemberIndex, setEditingMemberIndex] = useState(null);
  const [memberForm, setMemberForm] = useState({ id: '', name: '', avatar: '', bio: '' });

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

  const handleImageFileUpload = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setter(evt.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen || !chat) return null;

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
    setMembers(members.filter((_, i) => i !== index));
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div
        className="fixed inset-0"
        style={{ backgroundColor: 'var(--modal-overlay)' }}
        onClick={onClose}
      />

      {/* 拟物小票 / 剧场票根容器 */}
      <div className="imaginarium-receipt-card relative w-full max-w-sm p-6 shadow-2xl z-10 space-y-4 max-h-[85dvh] flex flex-col">
        {/* 票根顶部撕脱口线条 */}
        <div className="flex items-center justify-between border-b-2 border-dashed pb-3" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 rotate-45 opacity-70" />
            <div>
              <h3 className="font-serif font-bold text-xs uppercase tracking-widest">Salon Ticket</h3>
              <span className="text-[9px] opacity-40 font-mono block">NO. #{chat.id || '001'}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 拟物 Card Tab 菜单 */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl shrink-0" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${activeTab === 'settings' ? 'shadow-sm' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'settings' ? 'var(--card-bg)' : 'transparent' }}
          >
            <Palette className="w-3.5 h-3.5" /> 预设/背景
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('persona')}
            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${activeTab === 'persona' ? 'shadow-sm' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'persona' ? 'var(--card-bg)' : 'transparent' }}
          >
            <User className="w-3.5 h-3.5" /> 我的设定
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${activeTab === 'members' ? 'shadow-sm' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'members' ? 'var(--card-bg)' : 'transparent' }}
          >
            <Users className="w-3.5 h-3.5" /> 虚拟成员
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summaries')}
            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${activeTab === 'summaries' ? 'shadow-sm' : 'opacity-60'}`}
            style={{ backgroundColor: activeTab === 'summaries' ? 'var(--card-bg)' : 'transparent' }}
          >
            <BookOpen className="w-3.5 h-3.5" /> 阶段总结
          </button>
        </div>

        {/* 小票内部可滑动内容区域 */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs font-serif">
          {activeTab === 'settings' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                <label className="font-bold opacity-70 block text-[11px]">沙龙主题名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 rounded-lg border outline-none text-xs font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-center justify-between">
                  <label className="font-bold opacity-70 text-[11px]">背景图片 (Base64 / URL)</label>
                  <label className="text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer flex items-center gap-1" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                    <Upload className="w-3 h-3" /> 选择本地
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileUpload(e, setBgImage)} />
                  </label>
                </div>
                <input
                  type="url"
                  value={bgImage}
                  onChange={(e) => setBgImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2 rounded-lg border outline-none text-xs font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
                <div className="flex items-center justify-between pt-1 font-sans">
                  <span className="opacity-60 text-[10px]">背景透明度: {bgOpacity}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(e.target.value)}
                    className="w-28 accent-[var(--accent-color)]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-1 font-bold opacity-70 text-[11px]">
                  <Wand2 className="w-3.5 h-3.5" /> 预设主题美化
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1 font-sans">
                  {CSS_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCustomCss(preset.css)}
                      className="p-1.5 rounded-lg border text-[10px] font-medium text-left truncate hover:border-[var(--accent-color)]"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  placeholder="自定义 CSS 样式规则..."
                  className="w-full p-2 rounded-lg border outline-none font-mono text-[10px] mt-1"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <button
                type="button"
                onClick={() => onConfirmDeleteChat(chat.id)}
                className="w-full py-2 rounded-xl border text-rose-500 font-bold flex items-center justify-center gap-1"
                style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
              >
                <Trash2 className="w-3.5 h-3.5" /> 解散本沙龙
              </button>
            </div>
          )}

          {activeTab === 'persona' && (
            <div className="p-3 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
              <div>
                <label className="font-bold opacity-70 block mb-1 text-[11px]">我的名称</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full p-2 rounded-lg border outline-none font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold opacity-70 text-[11px]">我的头像</label>
                  <label className="text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer flex items-center gap-1" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                    <Upload className="w-3 h-3" /> 上传
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileUpload(e, setUserAvatar)} />
                  </label>
                </div>
                <input
                  type="url"
                  value={userAvatar}
                  onChange={(e) => setUserAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2 rounded-lg border outline-none font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="font-bold opacity-70 block mb-1 text-[11px]">人设设定</label>
                <textarea
                  rows={3}
                  value={userPersona}
                  onChange={(e) => setUserPersona(e.target.value)}
                  className="w-full p-2 rounded-lg border outline-none font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {members.map((m, idx) => (
                  <div key={m.id || idx} className="flex items-center justify-between p-2 rounded-xl border" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 font-bold text-xs flex items-center justify-center border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                        {m.avatar ? <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" /> : m.name?.[0]}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs">{m.name}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => { setEditingMemberIndex(idx); setMemberForm({ ...m }); }} className="p-1 opacity-60"><Edit2 className="w-3 h-3" /></button>
                      <button type="button" onClick={() => handleDeleteMember(idx)} className="p-1 text-rose-500 opacity-60"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSaveMember} className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                <h4 className="font-bold text-[11px]">{editingMemberIndex !== null ? '修改成员' : '添加新成员'}</h4>
                <input
                  type="text"
                  placeholder="角色姓名 *"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="w-full p-2 rounded-lg border outline-none font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  required
                />
                <div className="flex items-center gap-1">
                  <input
                    type="url"
                    placeholder="头像 URL"
                    value={memberForm.avatar}
                    onChange={(e) => setMemberForm({ ...memberForm, avatar: e.target.value })}
                    className="flex-1 p-2 rounded-lg border outline-none font-sans"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                  />
                  <label className="p-2 rounded-lg border cursor-pointer shrink-0" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                    <Upload className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileUpload(e, (url) => setMemberForm({ ...memberForm, avatar: url }))} />
                  </label>
                </div>
                <textarea
                  rows={2}
                  placeholder="角色人设描述"
                  value={memberForm.bio}
                  onChange={(e) => setMemberForm({ ...memberForm, bio: e.target.value })}
                  className="w-full p-2 rounded-lg border outline-none font-sans"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                />
                <button type="submit" className="w-full py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 font-sans" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}>
                  <Plus className="w-3.5 h-3.5" /> 保存成员
                </button>
              </form>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <button
                type="button"
                disabled={isGeneratingSummary}
                onClick={handleGenerateSummary}
                className="w-full py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 font-sans"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingSummary ? '凝炼总结中...' : '生成新阶段总结'}</span>
              </button>

              <div className="space-y-2">
                {summaries.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-xl border space-y-1.5" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                    {editingSummaryId === s.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={editingSummaryText}
                          onChange={(e) => setEditingSummaryText(e.target.value)}
                          className="w-full p-2 rounded-lg border outline-none text-xs font-sans"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                        />
                        <div className="flex gap-2 font-sans">
                          <button type="button" onClick={() => handleSaveSummaryEdit(s.id)} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px]">保存</button>
                          <button type="button" onClick={() => setEditingSummaryId(null)} className="px-2.5 py-1 rounded-lg opacity-60 text-[10px]">取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="leading-relaxed opacity-90">{s.content}</p>
                        <div className="flex items-center justify-between pt-1 border-t opacity-50 text-[9px] font-mono" style={{ borderColor: 'var(--card-border)' }}>
                          <span>{new Date(s.createdAt).toLocaleString()}</span>
                          <div className="flex gap-2 font-sans">
                            <button type="button" onClick={() => { setEditingSummaryId(s.id); setEditingSummaryText(s.content); }}>编辑</button>
                            <button type="button" onClick={() => handleDeleteSummaryItem(s.id)} className="text-rose-500">删除</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 票根底部伪条形码装饰与保存 */}
        <div className="shrink-0 pt-2 border-t space-y-2" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex justify-center opacity-30 tracking-widest font-mono text-[8px]">
            ||| | |||| | ||| || |||| | ||
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Check className="w-4 h-4" /> 盖章并保存票根
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImaginariumSettingsModal;

import React, { useState } from 'react';
import { User, Plus, Check, Zap, Edit3, Image as ImageIcon } from 'lucide-react';

export const EnsembleUserSelector = ({
  userIdentities = [],
  currentIdentityId,
  onSelectIdentity,
  onAddTempIdentity,
  onUpdateIdentity
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [avatar, setAvatar] = useState('');

  const openCreateModal = () => {
    setEditingItem(null);
    setName('');
    setPersona('');
    setAvatar('');
    setShowModal(true);
  };

  const openEditModal = (item, e) => {
    e.stopPropagation();
    setEditingItem(item);
    setName(item.name || '');
    setPersona(item.persona || '');
    setAvatar(item.avatar || '');
    setShowModal(true);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setAvatar(evt.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      onUpdateIdentity(editingItem.id, {
        name: name.trim(),
        persona: persona.trim(),
        avatar
      });
    } else {
      const newId = `temp_${Date.now()}`;
      onAddTempIdentity({
        id: newId,
        name: name.trim(),
        persona: persona.trim() || '临时视角身份',
        avatar,
        isTemp: true
      });
      onSelectIdentity(newId);
    }
    setShowModal(false);
  };

  return (
    <div className="relative mb-2 flex items-center justify-between px-1">
      {/* 身份视角独立悬浮胶囊栏 */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
        <span className="text-[10px] font-medium uppercase opacity-40 shrink-0 flex items-center gap-1 mr-1">
          <User className="w-3 h-3" />
          视角:
        </span>

        {userIdentities.map((item) => {
          const isActive = item.id === currentIdentityId;
          return (
            <div
              key={item.id}
              onClick={() => onSelectIdentity(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer active:scale-95 border ${
                isActive ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                color: isActive ? 'var(--accent-foreground)' : 'var(--text-main)',
                borderColor: isActive ? 'transparent' : 'var(--card-border)'
              }}
            >
              {item.avatar ? (
                <img src={item.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-current opacity-20 flex items-center justify-center text-[8px]">
                  {item.name[0]}
                </div>
              )}
              <span>{item.name}</span>
              {item.isTemp && <span className="text-[9px] opacity-60 font-mono">(临时)</span>}
              <button
                type="button"
                onClick={(e) => openEditModal(item, e)}
                className="p-0.5 opacity-40 hover:opacity-100"
              >
                <Edit3 className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-transform active:scale-95 shrink-0 opacity-70 hover:opacity-100"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            color: 'var(--text-sub)',
            border: '1px border-dashed var(--card-border)'
          }}
        >
          <Plus className="w-3 h-3" />
          <span>临时视角</span>
        </button>
      </div>

      {/* 视角卡配置 / 新增 Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-xs rounded-2xl p-4 space-y-3 shadow-xl animate-scale-up"
            style={{
              backgroundColor: 'var(--modal-bg)',
              border: '1px solid var(--modal-border)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                {editingItem ? '编辑视角身份' : '新增临时视角'}
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-xs opacity-50 hover:opacity-100">
                取消
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="text-[10px] block opacity-60 mb-1">身份名称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如: 旁白 / 侦探"
                  className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="text-[10px] block opacity-60 mb-1">身份头像 (URL 或 本地图片)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs border outline-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                  />
                  <label className="p-2 rounded-lg border cursor-pointer opacity-70 hover:opacity-100" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                    <ImageIcon className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] block opacity-60 mb-1">人设描述 / 视角立场</label>
                <textarea
                  rows={2}
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  placeholder="例如: 冷静记录事件走向的第三视角..."
                  className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform mt-1"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                保存视角
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


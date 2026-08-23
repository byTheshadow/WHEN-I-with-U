import React, { useState } from 'react';
import { User, Plus, Check, Zap } from 'lucide-react';

export const EnsembleUserSelector = ({
  userIdentities = [],
  currentIdentityId,
  onSelectIdentity,
  onAddTempIdentity
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempPersona, setTempPersona] = useState('');

  const currentIdentity = userIdentities.find((u) => u.id === currentIdentityId) || userIdentities[0];

  const handleCreateTemp = (e) => {
    e.preventDefault();
    if (!tempName.trim()) return;
    const newId = `temp_${Date.now()}`;
    const newIdentity = {
      id: newId,
      name: tempName.trim(),
      avatar: '',
      persona: tempPersona.trim() || '临时扮演角色',
      isTemp: true
    };
    onAddTempIdentity(newIdentity);
    onSelectIdentity(newId);
    setTempName('');
    setTempPersona('');
    setShowAddModal(false);
  };

  return (
    <div className="relative mb-2 flex items-center justify-between px-1">
      {/* 身份胶囊选择轴 */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
        <span className="text-[10px] font-medium tracking-wider uppercase opacity-40 shrink-0 flex items-center gap-1 mr-1">
          <User className="w-3 h-3" />
          视角:
        </span>

        {userIdentities.map((item) => {
          const isActive = item.id === currentIdentityId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectIdentity(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 active:scale-95 ${
                isActive
                  ? 'shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                color: isActive ? 'var(--accent-foreground)' : 'var(--text-main)',
                border: isActive ? '1px solid transparent' : '1px solid var(--card-border)'
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
              {isActive && <Check className="w-3 h-3 ml-0.5" />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-transform active:scale-95 shrink-0 opacity-70 hover:opacity-100"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            color: 'var(--text-sub)',
            border: '1px border-dashed var(--card-border)'
          }}
        >
          <Plus className="w-3 h-3" />
          <span>临时身份</span>
        </button>
      </div>

      {/* 极简新增临时身份弹窗 */}
      {showAddModal && (
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
                切换临时身份视角
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs opacity-50 hover:opacity-100"
              >
                取消
              </button>
            </div>

            <form onSubmit={handleCreateTemp} className="space-y-2.5">
              <div>
                <label className="text-[10px] block opacity-60 mb-1">身份名称 (如: 旁白 / 咖啡师)</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="例如: 旁白"
                  className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] block opacity-60 mb-1">临时人设 / 视角描摹 (选填)</label>
                <input
                  type="text"
                  value={tempPersona}
                  onChange={(e) => setTempPersona(e.target.value)}
                  placeholder="例如: 冷眼旁观历史发展的第三方"
                  className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl text-xs font-semibold transition-transform active:scale-95 mt-1"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                切入该身份视角
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

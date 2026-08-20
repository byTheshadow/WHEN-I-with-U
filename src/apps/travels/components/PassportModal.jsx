import React, { useState } from 'react';
import { ShieldCheck, Luggage, User, Sparkles, X, ChevronRight } from 'lucide-react';

export const PassportModal = ({ isOpen, onClose, character, onNext }) => {
  const [userPersona, setUserPersona] = useState('');
  const [luggageNotes, setLuggageNotes] = useState('');
  const [durationHours, setDurationHours] = useState(12);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext({
      userPersona: userPersona.trim() || '喜欢慢节奏漫步与随性摄影的旅人。',
      luggageNotes: luggageNotes.trim() || '随身胶片相机、复古手帳本、舒服的走鞋。',
      durationHours: Number(durationHours)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div 
        className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">旅行护照与漫游行囊签发</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-500/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 双护照卡片展示 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 伴侣拟真护照 (只读) */}
            <div 
              className="p-5 rounded-2xl border relative overflow-hidden flex flex-col justify-between"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                <ShieldCheck className="w-32 h-32" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-amber-600 dark:text-amber-400 font-bold">
                    PILOT PASSPORT
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    PASSPORT NO: P-{character?.id || 0}992
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <img 
                    src={character?.avatar} 
                    alt={character?.name} 
                    className="w-14 h-14 rounded-xl object-cover border-2 border-amber-500/30"
                  />
                  <div>
                    <h4 className="font-bold text-base">{character?.name || '伴侣'}</h4>
                    <p className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                      {character?.bio || '专管浪漫与偏爱'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t text-[11px] space-y-1" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                <div>签发地：伴侣专属角色库</div>
                <div>旅途性格：{character?.extraNotes ? character.extraNotes.slice(0, 20) + '...' : '自由浪漫的旅伴'}</div>
              </div>
            </div>

            {/* User 拟真护照 (自定) */}
            <div 
              className="p-5 rounded-2xl border relative overflow-hidden flex flex-col justify-between"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-600 dark:text-emerald-400 font-bold">
                    TRAVELER PASSPORT
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    USER IDENT
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-sm">我的专属旅途人设</span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  本次旅行专属行囊设定 (不依赖历史旧人设)
                </p>
              </div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                READY FOR TAKE-OFF
              </div>
            </div>
          </div>

          {/* 表单输入：人设与行囊 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                独立旅途人设 / 心情偏好
              </label>
              <textarea
                value={userPersona}
                onChange={(e) => setUserPersona(e.target.value)}
                placeholder="填写本次旅行的人设，例如：极度喜爱猫咪咖啡馆、喜欢慢节奏踩水摄影…"
                className="w-full p-3 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none h-20"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <Luggage className="w-3.5 h-3.5 text-amber-500" />
                <span>随身行囊清单</span>
              </label>
              <input
                type="text"
                value={luggageNotes}
                onChange={(e) => setLuggageNotes(e.target.value)}
                placeholder="例如：胶片相机、雨伞、拍立得、无糖拿铁..."
                className="w-full p-3 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-amber-500"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                托管旅行时间跨度 (12 小时起步)
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full p-3 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-amber-500"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              >
                <option value={12}>12 小时 (精致短途漫游)</option>
                <option value={24}>24 小时 (一日沉浸游历)</option>
                <option value={48}>48 小时 (双日深度探索)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-medium hover:bg-neutral-500/10"
              style={{ color: 'var(--text-muted)' }}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1.5 shadow-md"
            >
              <span>下一步：选择目的地</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PassportModal;

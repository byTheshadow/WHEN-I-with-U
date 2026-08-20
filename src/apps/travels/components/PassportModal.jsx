import React, { useState } from 'react';
import { ShieldCheck, Luggage, User, ChevronRight, ArrowLeft, X } from 'lucide-react';

export const PassportModal = ({ isOpen, onClose, character, onNext }) => {
  const [step, setStep] = useState(1); // Step 1: Companion | Step 2: User

  // 伴侣护照自定项
  const [companionIssuing, setCompanionIssuing] = useState('伴侣专属角色库签发处');
  const [companionPersonality, setCompanionPersonality] = useState('');

  // User 护照自定项
  const [userPassportName, setUserPassportName] = useState('User');
  const [userPersona, setUserPersona] = useState('');
  const [luggageNotes, setLuggageNotes] = useState('');
  const [durationHours, setDurationHours] = useState(12);

  if (!isOpen) return null;

  const handleCompletePassport = (e) => {
    e.preventDefault();
    onNext({
      companionIssuing,
      companionPersonality: companionPersonality.trim() || '随性浪漫且专注倾听的同游伴侣',
      userPassportName: userPassportName.trim() || 'User',
      userPersona: userPersona.trim() || '喜爱慢节奏踩水、街角咖啡馆与胶片摄影的旅人。',
      luggageNotes: luggageNotes.trim() || '随身胶片相机、手帳本、舒服的走鞋。',
      durationHours: Number(durationHours)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
      <div 
        className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--modal-bg)', border: '1px solid var(--modal-border)', color: 'var(--text-main)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--text-main)' }} />
            <h2 className="text-base font-bold font-serif">
              {step === 1 ? '步骤 1/2：伴侣旅行护照' : '步骤 2/2：User 旅行护照'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 步骤 1：伴侣护照 */}
        {step === 1 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div 
              className="p-4 rounded-2xl border text-xs space-y-1"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
            >
              <div className="font-bold" style={{ color: 'var(--text-main)' }}>数据来源说明</div>
              <div>本护照已调取【角色库】中的全量背景、性格与设定信息，不涉及任何聊天记录。</div>
            </div>

            {/* 伴侣 ID 页面 */}
            <div 
              className="p-5 rounded-2xl border space-y-4 shadow-inner"
              style={{ background: 'var(--card-bg-gradient)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--divider)' }}>
                <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                  COMPANION DUAL-TRAVEL PASSPORT
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  PASSPORT NO: P-{character?.id || '01'}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {character?.avatar ? (
                  <img src={character.avatar} alt={character.name} className="w-16 h-16 rounded-2xl object-cover border" style={{ borderColor: 'var(--card-border)' }} />
                ) : (
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-serif text-xl border" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                    {character?.name?.[0]}
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <div className="text-base font-bold font-serif">{character?.name || '伴侣'}</div>
                  <div className="opacity-70" style={{ color: 'var(--text-sub)' }}>{character?.bio || '伴侣人设简介'}</div>
                  {character?.handle && <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>@{character.handle}</div>}
                </div>
              </div>

              <div className="pt-2 text-xs space-y-1" style={{ color: 'var(--text-sub)' }}>
                {character?.extraNotes && <div>人设细节：{character.extraNotes}</div>}
              </div>
            </div>

            {/* 自定项 */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">伴侣护照签发地文案</label>
                <input
                  type="text"
                  value={companionIssuing}
                  onChange={(e) => setCompanionIssuing(e.target.value)}
                  className="w-full p-3 rounded-xl border focus:outline-none"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">本次同游伴侣性格微调</label>
                <input
                  type="text"
                  value={companionPersonality}
                  onChange={(e) => setCompanionPersonality(e.target.value)}
                  placeholder="例如：专为你拍照的温柔摄影师 / 随性自由的漫步者"
                  className="w-full p-3 rounded-xl border focus:outline-none"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end" style={{ borderColor: 'var(--divider)' }}>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                <span>下一步：签发 User 护照</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 步骤 2：User 护照 */}
        {step === 2 && (
          <form onSubmit={handleCompletePassport} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
            <div 
              className="p-4 rounded-2xl border text-xs space-y-1"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
            >
              <div className="font-bold" style={{ color: 'var(--text-main)' }}>User 专属设定说明</div>
              <div>以下内容为本次旅程的独立人设与行囊，全新填写，不会读取过去保存的旧人设。</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>User 本次旅行护照名称</span>
                </label>
                <input
                  type="text"
                  value={userPassportName}
                  onChange={(e) => setUserPassportName(e.target.value)}
                  placeholder="填写你的护照称呼"
                  className="w-full p-3 rounded-xl border focus:outline-none"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">User 本次旅行完整人设 & 期待陪伴方式</label>
                <textarea
                  value={userPersona}
                  onChange={(e) => setUserPersona(e.target.value)}
                  placeholder="填写你的旅行性格，如：喜欢慢节奏散步、喜欢逛旧书店、希望伴侣在遇到漂亮风景时随时提醒我..."
                  className="w-full p-3 rounded-xl border focus:outline-none resize-none h-20"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 flex items-center gap-1">
                  <Luggage className="w-3.5 h-3.5" />
                  <span>User 的随身行囊清单</span>
                </label>
                <input
                  type="text"
                  value={luggageNotes}
                  onChange={(e) => setLuggageNotes(e.target.value)}
                  placeholder="例如：胶片相机、雨伞、拍立得、无糖拿铁..."
                  className="w-full p-3 rounded-xl border focus:outline-none"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">托管旅行时间跨度 (最低 12 小时)</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="w-full p-3 rounded-xl border focus:outline-none"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                >
                  <option value={12}>12 小时 (精致短途同游)</option>
                  <option value={24}>24 小时 (一日沉浸游历)</option>
                  <option value={48}>48 小时 (双日深度探索)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--divider)' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border flex items-center gap-1 hover:opacity-70"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回伴侣护照</span>
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                <span>核准护照 · 去选机票</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PassportModal;


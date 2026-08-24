import React, { useState, useEffect } from 'react';
import { Sparkles, Camera, X } from 'lucide-react';
import db from '../../../db';

const PRESETS = [
  {
    id: 'preset_moss',
    name: '月光苔藓',
    type: 'plant',
    persona: '一种生长在幽深树洞里的月光植物。只有在安静的夜晚才会微微发光，性格沉静而带着露水的湿润感，喜欢潮湿和微光。',
    avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%232c3e2f"/><circle cx="50" cy="50" r="30" fill="%237db874" opacity="0.3"/><path d="M40 70 Q 50 40 60 70 Z" fill="%23438a37"/><path d="M30 75 Q 45 45 50 75 Z" fill="%232d6624"/><path d="M50 73 Q 58 50 68 73 Z" fill="%235a9e4f"/></svg>'
  },
  {
    id: 'preset_jellyfish',
    name: '琉璃水滴水母',
    type: 'animal',
    persona: '游荡在深海之中的透明生命。性格傲娇又灵动，喜欢在深海的旋律里吐泡泡，讨厌强光，说话总是带着淡淡的冰冷海水味。',
    avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a2639"/><path d="M30 50 Q 50 20 70 50 Q 65 50 60 48 Q 50 52 40 48 Q 35 50 30 50" fill="%238ec5fc" opacity="0.7"/><path d="M40 50 Q 42 75 45 80" stroke="%238ec5fc" stroke-width="2" fill="none"/><path d="M50 50 Q 50 78 52 82" stroke="%238ec5fc" stroke-width="2" fill="none"/><path d="M60 50 Q 58 75 55 80" stroke="%238ec5fc" stroke-width="2" fill="none"/></svg>'
  },
  {
    id: 'preset_kitten',
    name: '阳光小猫',
    type: 'animal',
    persona: '一团由阳光和小纸屑构成的顽皮小猫。性格极其热情且有些顽皮，总是精力旺盛地想和一切事物玩耍，害怕孤独，被抚摸时会发出暖洋洋的呼噜声。',
    avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f9e4b7"/><circle cx="50" cy="50" r="28" fill="%23e8a353"/><path d="M30 35 L 42 42 L 35 50 Z" fill="%23e8a353"/><path d="M70 35 L 58 42 L 65 50 Z" fill="%23e8a353"/><circle cx="43" cy="48" r="3" fill="%232d1e0d"/><circle cx="57" cy="48" r="3" fill="%232d1e0d"/><path d="M47 55 Q 50 57 53 55" stroke="%232d1e0d" stroke-width="2" fill="none"/></svg>'
  }
];

export const AdoptionAndEditModal = ({ habitat, onClose, onSave }) => {
  const isEdit = !!habitat;
  const [characters, setCharacters] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(isEdit ? '' : 'preset_moss');
  
  const [name, setName] = useState('');
  const [type, setType] = useState('plant');
  const [persona, setPersona] = useState('');
  const [avatar, setAvatar] = useState('');
  const [guardianId, setGuardianId] = useState('');

  useEffect(() => {
    const loadCharacters = async () => {
      const list = await db.characters.toArray();
      setCharacters(list);
    };
    void loadCharacters();
  }, []);

  useEffect(() => {
    if (isEdit && habitat) {
      setName(habitat.name);
      setType(habitat.type);
      setPersona(habitat.persona);
      setAvatar(habitat.avatar);
      setGuardianId(habitat.guardianCharacterId ? String(habitat.guardianCharacterId) : '');
    } else {
      applyPreset('preset_moss');
    }
  }, [habitat, isEdit]);

  const applyPreset = (presetId) => {
    setSelectedPreset(presetId);
    if (presetId === 'custom') {
      setName('自定义生命体');
      setType('animal');
      setPersona('安静的数字生命，喜欢在角落感受你的陪伴和照料。');
      setAvatar('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eee"/><circle cx="50" cy="50" r="20" fill="%23ccc"/></svg>');
    } else {
      const preset = PRESETS.find(p => p.id === presetId);
      if (preset) {
        setName(preset.name);
        setType(preset.type);
        setPersona(preset.persona);
        setAvatar(preset.avatar);
      }
    }
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result);
      setSelectedPreset('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      ...(habitat || {}),
      name: name.trim(),
      type,
      persona: persona.trim(),
      avatar,
      guardianCharacterId: guardianId ? Number(guardianId) : null
    };
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-[380px] overflow-hidden rounded-2xl border transition-all duration-300 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
            {isEdit ? '编辑生命档案' : '唤醒数字生命'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-neutral-500/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[75dvh] overflow-y-auto">
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-sub)' }}>
                源起模板
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className="px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all"
                    style={{
                      borderColor: selectedPreset === p.id ? 'var(--accent-color)' : 'var(--card-border)',
                      backgroundColor: selectedPreset === p.id ? 'var(--control-soft-bg)' : 'transparent',
                      color: selectedPreset === p.id ? 'var(--text-main)' : 'var(--text-sub)'
                    }}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyPreset('custom')}
                  className="px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all"
                  style={{
                    borderColor: selectedPreset === 'custom' ? 'var(--accent-color)' : 'var(--card-border)',
                    backgroundColor: selectedPreset === 'custom' ? 'var(--control-soft-bg)' : 'transparent',
                    color: selectedPreset === 'custom' ? 'var(--text-main)' : 'var(--text-sub)'
                  }}
                >
                  虚空造物...
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-full border overflow-hidden flex items-center justify-center shrink-0" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}>
              {avatar ? (
                <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>无头像</span>
              )}
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-4 w-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
                图像连接或上传
              </label>
              <input
                type="text"
                placeholder="或输入图片 URL"
                value={avatar.startsWith('data:') ? '' : avatar}
                onChange={(e) => {
                  setAvatar(e.target.value);
                  setSelectedPreset('');
                }}
                className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
                名字
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
                类型
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                <option value="animal">动物</option>
                <option value="plant">植物</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
              性格人设手稿
            </label>
            <textarea
              required
              rows={3}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none resize-none"
              placeholder="例如：脾气傲娇，但十分关心环境湿度..."
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
              联合照料人 (绑定角色)
            </label>
            <select
              value={guardianId}
              onChange={(e) => setGuardianId(e.target.value)}
              className="w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            >
              <option value="">独自照顾 (不绑定)</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2 text-xs font-semibold transition-transform active:scale-95"
              style={{
                borderColor: 'var(--card-border)',
                color: 'var(--text-sub)'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg py-2 text-xs font-semibold transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              保存并写入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

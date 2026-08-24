import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Sliders, ArrowLeft, Trash2, Heart } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import ConfirmModal from '../../components/ConfirmModal';
import { AdoptionAndEditModal } from './components/AdoptionAndEditModal';
import { HabitatApiSettingsModal } from './components/HabitatApiSettingsModal';
import { HabitatRoom } from './HabitatRoom';
import { getHabitats, saveHabitat, deleteHabitat } from './habitatService';
import './habitat.css';

export const HabitatApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [view, setView] = useState('list'); // 'list' | 'room'
  const [selectedId, setSelectedId] = useState(null);
  
  const [habitats, setHabitats] = useState([]);
  const [showAdoptModal, setShowAdoptModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [editingHabitat, setEditingHabitat] = useState(null);
  const [releasingId, setReleasingId] = useState(null);

  const loadList = useCallback(async () => {
    const list = await getHabitats();
    setHabitats(list);
  }, []);

  useEffect(() => {
    if (view === 'list') {
      loadList();
    }
  }, [view, loadList]);

  const handleOpenRoom = (id) => {
    setSelectedId(id);
    setView('room');
    onChatRoomStateChange(true);
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedId(null);
    onChatRoomStateChange(false);
  };

  const handleCreateOrUpdate = async (data) => {
    await saveHabitat(data);
    setShowAdoptModal(false);
    setEditingHabitat(null);
    loadList();
  };

  const handleConfirmRelease = async () => {
    if (releasingId) {
      await deleteHabitat(releasingId);
      setReleasingId(null);
      loadList();
    }
  };

  if (view === 'room') {
    return (
      <HabitatRoom
        habitatId={selectedId}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-2 rounded-full p-2.5 transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--control-soft-bg)',
            border: '1px solid var(--card-border)'
          }}
          title="返回主页"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="font-serif text-lg font-bold" style={{ color: 'var(--text-main)' }}>
          生态温室
        </h2>
        <button
          type="button"
          onClick={() => setShowApiModal(true)}
          className="flex items-center gap-2 rounded-full p-2.5 transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--control-soft-bg)',
            border: '1px solid var(--card-border)'
          }}
          title="副 API 设置"
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-center italic" style={{ color: 'var(--text-muted)' }}>
        在这里，你与角色共同照料数字生命。温室最大可容纳三个生命瓶。
      </p>

      <div className="grid grid-cols-1 gap-6">
        {habitats.map((h) => (
          <GlassCard
            key={h.id}
            onClick={() => handleOpenRoom(h.id)}
            className="cursor-pointer relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
          >
            <div className="flex items-center gap-4">
              <div 
                className="relative h-20 w-20 rounded-full flex items-center justify-center border shadow-inner overflow-hidden shrink-0"
                style={{
                  background: 'radial-gradient(circle at 50% 15%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.05) 85%)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <img 
                  src={h.avatar} 
                  alt={h.name} 
                  className="h-12 w-12 object-contain animate-float-gentle"
                />
              </div>

              <div className="flex-1 space-y-2 overflow-hidden">
                <div className="flex items-start justify-between">
                  <div className="truncate">
                    <h3 className="font-serif text-base font-bold truncate" style={{ color: 'var(--text-main)' }}>
                      {h.name}
                    </h3>
                    <span 
                      className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--control-soft-bg)',
                        color: 'var(--text-sub)'
                      }}
                    >
                      {h.type === 'animal' ? '小动物' : '植物'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingHabitat(h);
                        setShowAdoptModal(true);
                      }}
                      className="text-[10px] px-2 py-1 rounded hover:bg-neutral-500/10"
                      style={{ color: 'var(--text-sub)' }}
                    >
                      档案
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReleasingId(h.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/10 text-red-400"
                      title="放归自然"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="space-y-0.5">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>水分</span>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                      <div className="h-full transition-all duration-500" style={{ width: `${h.moisture}%`, backgroundColor: 'var(--accent-color)', opacity: 0.8 }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>养分</span>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                      <div className="h-full transition-all duration-500" style={{ width: `${h.nutrients}%`, backgroundColor: 'var(--accent-color)', opacity: 0.8 }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>清洁</span>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                      <div className="h-full transition-all duration-500" style={{ width: `${h.sanitation}%`, backgroundColor: 'var(--accent-color)', opacity: 0.8 }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Heart className="h-3 w-3" style={{ color: 'var(--accent-color)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    羁绊值: {h.bondPoints || 0}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}

        {habitats.length < 3 && (
          <button
            type="button"
            onClick={() => {
              setEditingHabitat(null);
              setShowAdoptModal(true);
            }}
            className="w-full py-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:border-neutral-400"
            style={{
              borderColor: 'var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-sub)'
            }}
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">唤醒新的生命瓶</span>
          </button>
        )}
      </div>

      {showAdoptModal && (
        <AdoptionAndEditModal
          habitat={editingHabitat}
          onClose={() => {
            setShowAdoptModal(false);
            setEditingHabitat(null);
          }}
          onSave={handleCreateOrUpdate}
        />
      )}

      {showApiModal && (
        <HabitatApiSettingsModal
          onClose={() => setShowApiModal(false)}
          onSave={() => setShowApiModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={releasingId !== null}
        title="放归自然"
        message="你确定要将这个数字生命放归大自然吗？它的照料手账与数据将被永久抹去。"
        onConfirm={handleConfirmRelease}
        onCancel={() => setReleasingId(null)}
      />
    </div>
  );
};

export default HabitatApp;

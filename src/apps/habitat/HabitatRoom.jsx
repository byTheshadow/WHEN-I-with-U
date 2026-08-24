import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Droplets, Sparkles, Heart, Apple, Settings, Send, BookOpen } from 'lucide-react';
import db from '../../db';
import { performUserCare, getLogs, getHabitatById, saveHabitat } from './habitatService';
import { chatWithHabitat } from './habitatAiService';
import { AdoptionAndEditModal } from './components/AdoptionAndEditModal';

export const HabitatRoom = ({ habitatId, onBack }) => {
  const [habitat, setHabitat] = useState(null);
  const [logs, setLogs] = useState([]);
  const [bubbleText, setBubbleText] = useState('沙沙，我在静静地呼吸。');
  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('control'); // 'control' | 'ledger'
  const [sprayActive, setSprayActive] = useState(false);

  const scrollRef = useRef(null);

  const loadRoom = useCallback(async () => {
    const data = await getHabitatById(Number(habitatId));
    if (data) {
      setHabitat(data);
      // 根据状态低值产生开场白气泡提示
      if (data.moisture < 30) {
        setBubbleText(data.type === 'animal' ? '好渴，喉咙有些干涸...' : '干巴巴的，希望下一场微雨。');
      } else if (data.nutrients < 30) {
        setBubbleText(data.type === 'animal' ? '肚子空空的，有些提不起精神。' : '土里的肥料不够了，叶片有点蔫。');
      } else if (data.sanitation < 30) {
        setBubbleText('玻璃外壳脏了，你能帮我擦洗干净吗？');
      }
    }
    const logList = await getLogs(Number(habitatId));
    setLogs(logList);
  }, [habitatId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleAction = async (actionType) => {
    if (sprayActive) return;
    if (actionType === 'water') {
      setSprayActive(true);
      setTimeout(() => setSprayActive(false), 1200);
    }

    const updated = await performUserCare(habitatId, actionType);
    if (updated) {
      setHabitat(updated);
      const logList = await getLogs(Number(habitatId));
      setLogs(logList);
      
      // 等待 AI 照料日志反馈异步生成
      setTimeout(async () => {
        const freshLogs = await getLogs(Number(habitatId));
        setLogs(freshLogs);
        if (freshLogs.length > 0 && freshLogs[0].logType === 'user_action') {
          setBubbleText(freshLogs[0].content);
        }
      }, 900);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isAiResponding) return;

    const text = inputText.trim();
    setInputText('');
    setIsAiResponding(true);

    // 1. 写入用户聊天记录
    await db.habitatLogs.add({
      habitatId: Number(habitatId),
      logType: 'user_action',
      operatorName: '我',
      avatar: '',
      actionType: 'chat',
      content: text,
      timestamp: Date.now()
    });
    
    let freshLogs = await getLogs(Number(habitatId));
    setLogs(freshLogs);

    // 2. 调用副 API 获得回复
    try {
      const contextLogs = freshLogs.slice(0, 5).reverse();
      const reply = await chatWithHabitat(habitat, text, contextLogs);
      
      await db.habitatLogs.add({
        habitatId: Number(habitatId),
        logType: 'npc_action',
        operatorName: habitat.name,
        avatar: habitat.avatar,
        actionType: 'chat',
        content: reply,
        timestamp: Date.now()
      });
      
      setBubbleText(reply);
    } catch (err) {
      console.error(err);
      setBubbleText('静静地看着你，吐出了一个小气泡。');
    } finally {
      setIsAiResponding(false);
      const finalLogs = await getLogs(Number(habitatId));
      setLogs(finalLogs);
    }
  };

  const handleUpdate = async (data) => {
    await saveHabitat(data);
    setShowEditModal(false);
    loadRoom();
  };

  if (!habitat) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
        加载生命中...
      </div>
    );
  }

  const isAnimal = habitat.type === 'animal';
  const labels = {
    feed: isAnimal ? '喂食' : '施肥',
    water: isAnimal ? '喷雾' : '浇水',
    clean: '擦拭',
    play: isAnimal ? '玩耍' : '抚育'
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--divider)' }}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-full p-2 transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--control-soft-bg)',
            border: '1px solid var(--card-border)'
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <span className="font-serif text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
          {habitat.name}
        </span>

        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 rounded-full p-2 transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--control-soft-bg)',
            border: '1px solid var(--card-border)'
          }}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Dome Display & Scroll Panel */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 flex flex-col items-center">
        {/* Dialogue Bubble */}
        <div 
          className="relative max-w-[280px] p-3 rounded-2xl text-xs border leading-relaxed shadow-sm transition-all duration-300"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          {bubbleText}
          <div 
            className="absolute bottom-[-6px] left-[50%] -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)'
            }}
          />
        </div>

        {/* Dome Representation */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div className="habitat-glass-dome w-40 h-40 flex items-center justify-center relative">
            <img 
              src={habitat.avatar} 
              alt={habitat.name} 
              className="h-24 w-24 object-contain animate-float-gentle"
            />
            {sprayActive && (
              <div className="mist-particles">
                <div className="mist-spray-active w-24 h-24 rounded-full bg-white/20 blur-md" />
              </div>
            )}
          </div>
          <div 
            className="absolute bottom-1 w-32 h-2 rounded-full border-t"
            style={{
              backgroundColor: 'var(--card-border)',
              borderColor: 'var(--divider)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}
          />
        </div>

        {/* Tab selection */}
        <div className="w-full flex border-b shrink-0" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('control')}
            className="flex-1 pb-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors"
            style={{
              borderColor: activeTab === 'control' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'control' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            照料盘
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className="flex-1 pb-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors"
            style={{
              borderColor: activeTab === 'ledger' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'ledger' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            照料手账
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'control' && (
          <div className="w-full space-y-5 animate-fade-in shrink-0">
            <div className="space-y-3.5 p-3 rounded-xl" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium">
                  <span style={{ color: 'var(--text-sub)' }}>水分与湿度</span>
                  <span style={{ color: 'var(--text-main)' }}>{habitat.moisture}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={habitat.moisture} 
                  disabled
                  className="physical-slider w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium">
                  <span style={{ color: 'var(--text-sub)' }}>养分与饱腹</span>
                  <span style={{ color: 'var(--text-main)' }}>{habitat.nutrients}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={habitat.nutrients} 
                  disabled
                  className="physical-slider w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium">
                  <span style={{ color: 'var(--text-sub)' }}>外壳洁净度</span>
                  <span style={{ color: 'var(--text-main)' }}>{habitat.sanitation}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={habitat.sanitation} 
                  disabled
                  className="physical-slider w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleAction('feed')}
                className="flex items-center justify-center gap-2 rounded-xl py-3 border text-xs font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                <Apple className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
                {labels.feed}
              </button>

              <button
                type="button"
                onClick={() => handleAction('water')}
                className="flex items-center justify-center gap-2 rounded-xl py-3 border text-xs font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                <Droplets className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
                {labels.water}
              </button>

              <button
                type="button"
                onClick={() => handleAction('clean')}
                className="flex items-center justify-center gap-2 rounded-xl py-3 border text-xs font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                <Sparkles className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
                {labels.clean}
              </button>

              <button
                type="button"
                onClick={() => handleAction('play')}
                className="flex items-center justify-center gap-2 rounded-xl py-3 border text-xs font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                <Heart className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
                {labels.play}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="w-full flex-1 flex flex-col space-y-3 max-h-[220px] overflow-y-auto animate-fade-in p-1">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                还没有照料手账记录。
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3 rounded-lg border text-xs relative"
                    style={{
                      backgroundColor: log.logType === 'co_care' ? 'var(--control-soft-bg)' : 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      borderLeft: log.logType === 'co_care' ? '3px solid var(--accent-color)' : '1px solid var(--card-border)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {log.avatar && (
                          <img src={log.avatar} alt="avatar" className="h-4.5 w-4.5 rounded-full object-cover shrink-0" />
                        )}
                        <span className="font-semibold" style={{ color: 'var(--text-main)' }}>
                          {log.operatorName}
                        </span>
                      </div>
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="leading-relaxed" style={{ color: 'var(--text-sub)' }}>
                      {log.content}
                    </p>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat bottom bar */}
      <div className="p-3 border-t shrink-0 bg-transparent" style={{ borderColor: 'var(--divider)' }}>
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAiResponding}
            placeholder={isAiResponding ? '聆听感应中...' : '与生态瓶交流...'}
            className="flex-1 rounded-full border px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent-color"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          />
          <button
            type="submit"
            disabled={isAiResponding || !inputText.trim()}
            className="rounded-full p-2.5 transition-transform active:scale-95 flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {showEditModal && (
        <AdoptionAndEditModal
          habitat={habitat}
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Droplets, 
  Sparkles, 
  Heart, 
  Apple, 
  Settings, 
  Send, 
  BookOpen, 
  MessageSquare,
  Activity,
  RotateCcw,
  User,
  CheckCheck
} from 'lucide-react';
import db from '../../db';
import { performUserCare, getLogs, getHabitatById, saveHabitat, rerollMessage } from './habitatService';
import { chatWithHabitat } from './habitatAiService';
import { AdoptionAndEditModal } from './components/AdoptionAndEditModal';

export const HabitatRoom = ({ habitatId, onBack }) => {
  const [habitat, setHabitat] = useState(null);
  const [logs, setLogs] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // 三 Tab 设计：'care' (照料) | 'chat' (对话) | 'ledger' (照料手账)
  const [activeTab, setActiveTab] = useState('care'); 
  
  // 照料物理动效状态
  const [sprayActive, setSprayActive] = useState(false);
  const [sparkleActive, setSparkleActive] = useState(false);
  
  // 物理操作的顶部浮动 Toast 状态
  const [toastMessage, setToastMessage] = useState('');
  
  // 控制重 Roll 时 hover 显示
  const [hoveredLogId, setHoveredLogId] = useState(null);

  const scrollRef = useRef(null);
  const ledgerScrollRef = useRef(null);

  const triggerLocalToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  const loadRoom = useCallback(async () => {
    const data = await getHabitatById(Number(habitatId));
    if (data) {
      setHabitat(data);
    }
    const logList = await getLogs(Number(habitatId));
    setLogs(logList);
    
    // 过滤出聊天面板需要的数据
    const chats = logList.filter(l => l.actionType === 'chat' || l.logType === 'npc_action');
    setChatList(chats);
  }, [habitatId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (activeTab === 'chat' && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatList, activeTab]);

  useEffect(() => {
    if (activeTab === 'ledger' && ledgerScrollRef.current) {
      ledgerScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleAction = async (actionType) => {
    if (sprayActive || sparkleActive) return;
    
    const isAnimal = habitat.type === 'animal';
    const actionNames = {
      feed: isAnimal ? '喂食' : '施肥',
      water: isAnimal ? '喷雾' : '浇水',
      clean: '擦拭外壳',
      play: isAnimal ? '玩耍' : '剪枝抚育'
    };
    
    if (actionType === 'water') {
      setSprayActive(true);
      setTimeout(() => setSprayActive(false), 1200);
    } else if (actionType === 'clean' || actionType === 'play') {
      setSparkleActive(true);
      setTimeout(() => setSparkleActive(false), 1200);
    }

    triggerLocalToast(`正在对小家伙进行 [${actionNames[actionType]}] 照料...`);

    const updated = await performUserCare(habitatId, actionType);
    if (updated) {
      setHabitat(updated);
      const logList = await getLogs(Number(habitatId));
      setLogs(logList);
      
      // 3秒后拉取最新的照料人留言或回执
      setTimeout(async () => {
        const freshLogs = await getLogs(Number(habitatId));
        setLogs(freshLogs);
        if (freshLogs.length > 0) {
          triggerLocalToast(`照料完毕。获得生命反馈。`);
        }
      }, 1000);
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
    setChatList(freshLogs.filter(l => l.actionType === 'chat' || l.logType === 'npc_action'));

    // 2. 调用副 API 获得回复
    try {
      const contextLogs = freshLogs.filter(l => l.actionType === 'chat').slice(0, 5).reverse();
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
    } catch (err) {
      console.error(err);
      await db.habitatLogs.add({
        habitatId: Number(habitatId),
        logType: 'npc_action',
        operatorName: habitat.name,
        avatar: habitat.avatar,
        actionType: 'chat',
        content: '静静地看着你，没有发出声音。',
        timestamp: Date.now()
      });
    } finally {
      setIsAiResponding(false);
      const finalLogs = await getLogs(Number(habitatId));
      setLogs(finalLogs);
      setChatList(finalLogs.filter(l => l.actionType === 'chat' || l.logType === 'npc_action'));
    }
  };

  const handleReroll = async (logId) => {
    if (isAiResponding) return;
    setIsAiResponding(true);
    triggerLocalToast('正在重新唤醒生命回应...');
    
    try {
      const newText = await rerollMessage(habitatId, logId);
      if (newText) {
        triggerLocalToast('回应已更新');
      }
    } catch (err) {
      console.error(err);
      triggerLocalToast('连接失败，请检查配置');
    } finally {
      setIsAiResponding(false);
      const freshLogs = await getLogs(Number(habitatId));
      setLogs(freshLogs);
      setChatList(freshLogs.filter(l => l.actionType === 'chat' || l.logType === 'npc_action'));
    }
  };

  const handleUpdate = async (data) => {
    await saveHabitat(data);
    setShowEditModal(false);
    void loadRoom();
  };

  if (!habitat) {
    return (
      <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
        加载温室生命中...
      </div>
    );
  }

  const isAnimal = habitat.type === 'animal';
  const labels = {
    feed: isAnimal ? '喂食' : '施肥',
    water: isAnimal ? '喷水' : '浇灌',
    clean: '擦拭',
    play: isAnimal ? '玩耍' : '抚育'
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* 浮动 Toast 提醒 */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-50 flex justify-center animate-fade-in-up">
          <div 
            className="px-4 py-2 rounded-xl text-xs font-semibold shadow-lg border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            {toastMessage}
          </div>
        </div>
      )}

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

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Top Dome Area */}
        <div className="flex flex-col items-center py-6 shrink-0 border-b" style={{ borderColor: 'var(--divider)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <div className="habitat-glass-dome w-36 h-36 flex items-center justify-center relative">
              <img 
                src={habitat.avatar} 
                alt={habitat.name} 
                className="h-20 w-20 object-contain animate-float-gentle"
              />
              
              {sprayActive && (
                <div className="mist-particles">
                  <div className="mist-spray-active w-24 h-24 rounded-full bg-white/20 blur-md" />
                </div>
              )}
              {sparkleActive && (
                <div className="mist-particles">
                  <div className="w-20 h-20 bg-amber-200/20 rounded-full blur-lg animate-pulse" />
                </div>
              )}
            </div>
            <div 
              className="absolute bottom-1 w-28 h-2 rounded-full border-t"
              style={{
                backgroundColor: 'var(--card-border)',
                borderColor: 'var(--divider)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            />
          </div>

          <div className="flex items-center gap-1 mt-2">
            <Heart className="h-3 w-3" style={{ color: 'var(--accent-color)' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              羁绊指数: {habitat.bondPoints || 0}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="w-full flex border-b shrink-0" style={{ borderColor: 'var(--divider)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('care')}
            className="flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors"
            style={{
              borderColor: activeTab === 'care' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'care' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <Activity className="h-3.5 w-3.5" />
            照料面板
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className="flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors"
            style={{
              borderColor: activeTab === 'chat' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            灵性对话
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className="flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors"
            style={{
              borderColor: activeTab === 'ledger' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'ledger' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            照料手账
          </button>
        </div>

        {/* Tab Contents: Flex Container to auto-fill */}
        <div className="flex-1 overflow-hidden flex flex-col relative min-h-0">
          
          {/* TAB 1: CARE PANEL */}
          {activeTab === 'care' && (
            <div className="flex-grow overflow-y-auto p-4 space-y-6 animate-fade-in flex flex-col justify-between">
              <div className="space-y-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold">
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
                  <div className="flex justify-between text-[11px] font-semibold">
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
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span style={{ color: 'var(--text-sub)' }}>外表洁净度</span>
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

              <div className="grid grid-cols-2 gap-4 pb-2">
                <button
                  type="button"
                  onClick={() => handleAction('feed')}
                  className="flex items-center justify-center gap-2 rounded-xl py-3.5 border text-xs font-semibold shadow-sm transition-all active:scale-95 active:translate-y-0.5"
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
                  className="flex items-center justify-center gap-2 rounded-xl py-3.5 border text-xs font-semibold shadow-sm transition-all active:scale-95 active:translate-y-0.5"
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
                  className="flex items-center justify-center gap-2 rounded-xl py-3.5 border text-xs font-semibold shadow-sm transition-all active:scale-95 active:translate-y-0.5"
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
                  className="flex items-center justify-center gap-2 rounded-xl py-3.5 border text-xs font-semibold shadow-sm transition-all active:scale-95 active:translate-y-0.5"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                >
                  <Activity className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
                  {labels.play}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SENSORY CHAT (独立对话流) */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
              <div className="flex-grow overflow-y-auto p-4 space-y-4 min-h-0">
                {chatList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                    <span>屏里安安静静的。</span>
                    <span>打字说点什么，来呼唤小家伙吧。</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatList.map((log) => {
                      const isMe = log.logType === 'user_action';
                      return (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                          onMouseEnter={() => !isMe && setHoveredLogId(log.id)}
                          onMouseLeave={() => setHoveredLogId(null)}
                          onClick={() => !isMe && setHoveredLogId(hoveredLogId === log.id ? null : log.id)}
                        >
                          {!isMe && (
                            <div 
                              className="h-8 w-8 rounded-full border overflow-hidden shrink-0 flex items-center justify-center"
                              style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}
                            >
                              <img src={log.avatar} alt="avatar" className="h-full w-full object-cover" />
                            </div>
                          )}

                          <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div 
                              className="p-3 rounded-2xl text-xs leading-relaxed break-words border relative shadow-sm"
                              style={{
                                backgroundColor: isMe ? 'var(--control-soft-bg)' : 'var(--card-bg)',
                                borderColor: 'var(--card-border)',
                                color: 'var(--text-main)',
                                borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px'
                              }}
                            >
                              {log.content}

                              {/* Hover/Click 可见的操作条 (引用/重roll) */}
                              {!isMe && hoveredLogId === log.id && (
                                <div 
                                  className="absolute bottom-[-24px] left-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-semibold bg-[var(--bg-surface)] border-[var(--card-border)] animate-fade-in z-20"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleReroll(log.id);
                                    }}
                                    className="flex items-center gap-1 hover:opacity-80 transition-opacity active:scale-95"
                                    style={{ color: 'var(--text-sub)' }}
                                  >
                                    <RotateCcw className="h-2.5 w-2.5" />
                                    重发回应
                                  </button>
                                </div>
                              )}
                            </div>

                            <span className="text-[9px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {isMe && <CheckCheck className="h-3 w-3" style={{ color: 'var(--accent-color)' }} />}
                            </span>
                          </div>

                          {isMe && (
                            <div 
                              className="h-8 w-8 rounded-full border overflow-hidden shrink-0 flex items-center justify-center"
                              style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}
                            >
                              <User className="h-4.5 w-4.5" style={{ color: 'var(--text-sub)' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={scrollRef} />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t shrink-0 bg-transparent" style={{ borderColor: 'var(--divider)' }}>
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isAiResponding}
                    placeholder={isAiResponding ? '小生命正在构思辞章...' : '倾听生态瓶的声音...'}
                    className="flex-1 rounded-full border px-4 py-2 text-xs focus:outline-none"
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
            </div>
          )}

          {/* TAB 3: CO-CARE LEDGER (照料手账纸条) */}
          {activeTab === 'ledger' && (
            <div className="flex-grow overflow-y-auto p-4 space-y-4 animate-fade-in flex flex-col justify-between min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    暂无照料日志。
                  </div>
                ) : (
                  <div className="space-y-4 pr-1">
                    {logs.map((log) => {
                      const isCoCare = log.logType === 'co_care';
                      return (
                        <div 
                          key={log.id} 
                          className="p-4 rounded-xl border text-xs shadow-sm transition-all"
                          style={{
                            backgroundColor: isCoCare ? 'var(--control-soft-bg)' : 'var(--card-bg)',
                            borderColor: 'var(--card-border)',
                            borderLeft: isCoCare ? '3px solid var(--accent-color)' : '1px solid var(--card-border)'
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              {log.avatar ? (
                                <img src={log.avatar} alt="avatar" className="h-5 w-5 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-neutral-500/10 flex items-center justify-center shrink-0">
                                  <User className="h-3 w-3" style={{ color: 'var(--text-sub)' }} />
                                </div>
                              )}
                              <span className="font-bold font-serif" style={{ color: 'var(--text-main)' }}>
                                {log.operatorName}
                              </span>
                              {isCoCare && (
                                <span 
                                  className="text-[8px] uppercase tracking-wider px-1 rounded-sm scale-90"
                                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                                >
                                  联合照顾者
                                </span>
                              )}
                            </div>
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                              {new Date(log.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' })} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="leading-relaxed font-sans italic" style={{ color: 'var(--text-sub)' }}>
                            {log.content}
                          </p>
                        </div>
                      );
                    })}
                    <div ref={ledgerScrollRef} />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
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

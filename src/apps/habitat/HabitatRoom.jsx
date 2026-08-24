import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Droplets, Sparkles, Heart, Apple, Settings, 
  Send, RefreshCw, Trash2, Cpu, Activity, User, Users
} from 'lucide-react';
import db from '../../db';
import { performUserCare, getLogs, getHabitatById, saveHabitat, clearLogsByType } from './habitatService';
import { chatWithHabitat } from './habitatAiService';
import { AdoptionAndEditModal } from './components/AdoptionAndEditModal';

export const HabitatRoom = ({ habitatId, onBack }) => {
  const [habitat, setHabitat] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // 监视器状态栏文本
  const [statusMessage, setStatusMessage] = useState('SYSTEM MONITOR ACTIVE');
  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // 底部大 Tab: 'care' (照料指令) | 'chat' (心灵感应) | 'ledger' (照料手账)
  const [activeTab, setActiveTab] = useState('care');
  
  // 手账子过滤: 'user' | 'guardian'
  const [ledgerSubTab, setLedgerSubTab] = useState('user');
  
  // 交互动作反馈动效
  const [interactionText, setInteractionText] = useState(null);
  const [sprayActive, setSprayActive] = useState(false);

  const scrollRef = useRef(null);

  const loadRoom = useCallback(async () => {
    const data = await getHabitatById(Number(habitatId));
    if (data) {
      setHabitat(data);
      if (data.moisture < 35) {
        setStatusMessage('WARN: MOISTURE DEFIENCY');
      } else if (data.nutrients < 35) {
        setStatusMessage('WARN: NUTRIENTS DEFIENCY');
      } else if (data.sanitation < 35) {
        setStatusMessage('WARN: DEPOSIT DETECTED');
      } else {
        setStatusMessage('SYSTEM: LIFEFORM RUNNING STABLE');
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

  // 照料按钮点击
  const handleAction = async (actionType) => {
    if (sprayActive) return;
    
    // 视觉特效触发
    if (actionType === 'water') {
      setSprayActive(true);
      setTimeout(() => setSprayActive(false), 1200);
    }

    const actionTextMap = {
      feed: 'INJECTING NUTRIENTS (+30)',
      water: 'SPRAYING DEW MIST (+30)',
      clean: 'PURGING SURFACE DUST (+30)',
      play: 'COMMENCING STIMULATE (+15 BOND)'
    };
    
    setInteractionText(actionTextMap[actionType]);
    setTimeout(() => setInteractionText(null), 1500);

    const updated = await performUserCare(habitatId, actionType);
    if (updated) {
      setHabitat(updated);
      await loadRoom();
    }
  };

  // 心灵感应发送
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isAiResponding) return;

    const text = inputText.trim();
    setInputText('');
    setIsAiResponding(true);

    // 写入聊天记录 (chat_user)
    await db.habitatLogs.add({
      habitatId: Number(habitatId),
      logType: 'chat_user',
      operatorName: '我',
      avatar: '',
      actionType: 'chat',
      content: text,
      timestamp: Date.now()
    });
    
    await loadRoom();

    try {
      const activeLogs = logs
        .filter(l => l.logType === 'chat_user' || l.logType === 'chat_npc')
        .slice(0, 6)
        .reverse();

      const reply = await chatWithHabitat(habitat, text, activeLogs);
      
      await db.habitatLogs.add({
        habitatId: Number(habitatId),
        logType: 'chat_npc',
        operatorName: habitat.name,
        avatar: habitat.avatar,
        actionType: 'chat',
        content: reply,
        timestamp: Date.now()
      });
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiResponding(false);
      await loadRoom();
    }
  };

  // 重 roll AI 消息
  const handleReroll = async (logId) => {
    if (isAiResponding) return;
    setIsAiResponding(true);

    try {
      const allLogs = await db.habitatLogs
        .where('habitatId')
        .equals(Number(habitatId))
        .sortBy('timestamp');

      const targetIdx = allLogs.findIndex(l => l.id === logId);
      if (targetIdx === -1) return;

      // 寻找该 AI 消息之前的那条用户输入
      let lastUserText = '你好';
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (allLogs[i].logType === 'chat_user') {
          lastUserText = allLogs[i].content;
          break;
        }
      }

      // 获取上下文
      const historyContext = allLogs
        .slice(0, targetIdx)
        .filter(l => l.logType === 'chat_user' || l.logType === 'chat_npc')
        .slice(-6);

      const reply = await chatWithHabitat(habitat, lastUserText, historyContext);

      // 更新原数据
      await db.habitatLogs.update(logId, {
        content: reply,
        timestamp: Date.now()
      });

    } catch (err) {
      console.error('重roll失败', err);
    } finally {
      setIsAiResponding(false);
      await loadRoom();
    }
  };

  // 一键清空照料手账
  const handleClearLedger = async (type) => {
    const dbType = type === 'user' ? 'user_action' : 'co_care';
    await clearLogsByType(habitatId, dbType);
    await loadRoom();
  };

  if (!habitat) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        CONNECTING TO SPECIMEN...
      </div>
    );
  }

  const isAnimal = habitat.type === 'animal';

  // 筛选日志
  const userActions = logs.filter(l => l.logType === 'user_action');
  const guardianActions = logs.filter(l => l.logType === 'co_care');
  const chatMessages = logs.filter(l => l.logType === 'chat_user' || l.logType === 'chat_npc');

  return (
    <div className="flex flex-col h-full overflow-hidden font-mono text-[var(--text-main)]">
      {/* 顶部监视面板 Header */}
      <div className="p-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--divider)', backgroundColor: 'var(--bg-surface)' }}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded border px-2.5 py-1 transition-transform active:scale-95 text-xs font-semibold"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)'
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          EXIT
        </button>

        <div className="text-right flex flex-col items-end">
          <span className="text-[10px] font-bold tracking-widest opacity-80">SYS_ID: HAB_00{habitat.id}</span>
          <span className="text-[9px] opacity-40">VER: 3.1.2-STABLE</span>
        </div>
      </div>

      {/* 核心拟物化电子屏区 */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4">
        {/* 系统监视状态面板 */}
        <div className="border px-3 py-2 rounded flex justify-between items-center text-[10px] uppercase font-semibold" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 animate-pulse" style={{ color: 'var(--accent-color)' }} />
            {statusMessage}
          </span>
          <span className="opacity-60">UPTIME: 00:00:24</span>
        </div>

        {/* 生态舱监控显示框 */}
        <div 
          className="relative flex-1 border rounded-2xl flex flex-col items-center justify-center p-6 overflow-hidden min-h-[180px]"
          style={{ 
            borderColor: 'var(--card-border)',
            backgroundImage: 'radial-gradient(var(--card-border) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            backgroundColor: 'var(--card-bg)'
          }}
        >
          {/* 反馈信息弹幕 */}
          {interactionText && (
            <div className="absolute top-4 px-3 py-1 text-[10px] border border-dashed rounded bg-black/80 text-green-400 font-bold animate-bounce tracking-widest">
              {interactionText}
            </div>
          )}

          {/* 拟物圆形视网膜舱 */}
          <div className="relative w-36 h-36 flex items-center justify-center rounded-full border shadow-inner" style={{ borderColor: 'var(--card-border)' }}>
            <div className="absolute inset-0 rounded-full bg-radial-glow opacity-10 pointer-events-none" />
            <img 
              src={habitat.avatar} 
              alt={habitat.name} 
              className="h-24 w-24 object-contain animate-float-gentle"
            />
            {sprayActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-white/10 blur animate-pulse" />
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <h3 className="font-serif text-base font-bold">{habitat.name}</h3>
            <p className="text-[10px] mt-0.5 opacity-60 tracking-widest">
              {isAnimal ? 'SYNTHETIC ANIMAL LIFEFORM' : 'BIOLOGICAL DOME VEGETAL'}
            </p>
          </div>
        </div>

        {/* 核心数值展示条 */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="border p-2 rounded text-center" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--bg-surface)' }}>
            <span className="text-[9px] uppercase tracking-wider block opacity-50">MOISTURE</span>
            <span className="text-sm font-bold block">{habitat.moisture}%</span>
            <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full" style={{ width: `${habitat.moisture}%`, backgroundColor: 'var(--accent-color)' }} />
            </div>
          </div>
          <div className="border p-2 rounded text-center" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--bg-surface)' }}>
            <span className="text-[9px] uppercase tracking-wider block opacity-50">NUTRIENTS</span>
            <span className="text-sm font-bold block">{habitat.nutrients}%</span>
            <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full" style={{ width: `${habitat.nutrients}%`, backgroundColor: 'var(--accent-color)' }} />
            </div>
          </div>
          <div className="border p-2 rounded text-center" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--bg-surface)' }}>
            <span className="text-[9px] uppercase tracking-wider block opacity-50">BOND INDEX</span>
            <span className="text-sm font-bold block">{habitat.bondPoints || 0}</span>
            <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full" style={{ width: `${Math.min(100, habitat.bondPoints || 0)}%`, backgroundColor: 'var(--accent-color)' }} />
            </div>
          </div>
        </div>

        {/* 功能切换 Tab 控制台 */}
        <div className="border rounded-xl flex flex-col overflow-hidden" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--bg-surface)' }}>
          {/* Tab 按钮 */}
          <div className="flex border-b text-[10px]" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('care')}
              className={`flex-1 py-2 font-bold tracking-widest text-center border-r transition-all ${activeTab === 'care' ? 'opacity-100' : 'opacity-40'}`}
              style={{ 
                borderColor: 'var(--divider)',
                backgroundColor: activeTab === 'care' ? 'var(--control-soft-bg)' : 'transparent'
              }}
            >
              CONTROL PANEL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 font-bold tracking-widest text-center border-r transition-all ${activeTab === 'chat' ? 'opacity-100' : 'opacity-40'}`}
              style={{ 
                borderColor: 'var(--divider)',
                backgroundColor: activeTab === 'chat' ? 'var(--control-soft-bg)' : 'transparent'
              }}
            >
              SENSORY CHAT
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`flex-1 py-2 font-bold tracking-widest text-center transition-all ${activeTab === 'ledger' ? 'opacity-100' : 'opacity-40'}`}
              style={{ 
                backgroundColor: activeTab === 'ledger' ? 'var(--control-soft-bg)' : 'transparent'
              }}
            >
              CO-CARE LOGS
            </button>
          </div>

          {/* Tab 核心内容区 */}
          <div className="p-3 min-h-[140px] max-h-[140px] overflow-y-auto">
            {/* 1. 照料指令区 */}
            {activeTab === 'care' && (
              <div className="grid grid-cols-2 gap-2 h-full items-center">
                <button
                  type="button"
                  onClick={() => handleAction('feed')}
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 border text-[11px] font-bold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Apple className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
                  {labels.feed}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('water')}
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 border text-[11px] font-bold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Droplets className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
                  {labels.water}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('clean')}
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 border text-[11px] font-bold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
                  {labels.clean}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('play')}
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 border text-[11px] font-bold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Heart className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
                  {labels.play}
                </button>
              </div>
            )}

            {/* 2. 心灵感应对话区 (独立终端记录形式) */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full justify-between">
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px]">
                  {chatMessages.length === 0 ? (
                    <p className="text-center py-4 opacity-40">AWAITING SENSORY SIGNALS...</p>
                  ) : (
                    <div className="space-y-2">
                      {chatMessages.map((log) => {
                        const isUser = log.logType === 'chat_user';
                        return (
                          <div 
                            key={log.id} 
                            className="group flex flex-col border-b pb-1.5 last:border-0"
                            style={{ borderColor: 'var(--divider)' }}
                          >
                            <div className="flex items-center justify-between text-[9px] opacity-50 mb-0.5">
                              <span className="font-bold flex items-center gap-1">
                                {isUser ? <User className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
                                {log.operatorName.toUpperCase()}
                              </span>
                              <div className="flex items-center gap-2">
                                <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {!isUser && (
                                  <button
                                    type="button"
                                    onClick={() => handleReroll(log.id)}
                                    title="重新生成"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--accent-color)] active:scale-95"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="leading-relaxed opacity-85">{log.content}</p>
                          </div>
                        );
                      })}
                      <div ref={scrollRef} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. 共同照料手账 */}
            {activeTab === 'ledger' && (
              <div className="flex flex-col h-full space-y-2">
                {/* 我做的 / 角色做的 筛选控制层 */}
                <div className="flex justify-between items-center text-[9px] shrink-0 border-b pb-1" style={{ borderColor: 'var(--divider)' }}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLedgerSubTab('user')}
                      className={`flex items-center gap-1 font-bold ${ledgerSubTab === 'user' ? 'opacity-100 underline decoration-2' : 'opacity-40'}`}
                      style={{ textDecorationColor: 'var(--accent-color)' }}
                    >
                      <User className="h-2.5 w-2.5" />
                      我做的 ({userActions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerSubTab('guardian')}
                      className={`flex items-center gap-1 font-bold ${ledgerSubTab === 'guardian' ? 'opacity-100 underline decoration-2' : 'opacity-40'}`}
                      style={{ textDecorationColor: 'var(--accent-color)' }}
                    >
                      <Users className="h-2.5 w-2.5" />
                      角色做的 ({guardianActions.length})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClearLedger(ledgerSubTab)}
                    className="flex items-center gap-0.5 text-red-400 hover:text-red-500 font-bold active:scale-95"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    CLEAR
                  </button>
                </div>

                {/* 手账日志输出框 */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px]">
                  {ledgerSubTab === 'user' ? (
                    userActions.length === 0 ? (
                      <p className="text-center py-6 opacity-30">NO LOGS FOUND</p>
                    ) : (
                      userActions.map(log => (
                        <div key={log.id} className="flex justify-between border-b border-dashed py-1" style={{ borderColor: 'var(--divider)' }}>
                          <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
                          <span className="flex-1 px-2 truncate opacity-80">{log.content}</span>
                        </div>
                      ))
                    )
                  ) : (
                    guardianActions.length === 0 ? (
                      <p className="text-center py-6 opacity-30">NO GUARDIAN NOTES FOUND</p>
                    ) : (
                      guardianActions.map(log => (
                        <div key={log.id} className="border border-dashed p-1.5 rounded" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--control-soft-bg)' }}>
                          <div className="flex justify-between text-[8px] opacity-40 mb-0.5">
                            <span>BY: {log.operatorName.toUpperCase()}</span>
                            <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="leading-relaxed opacity-80 italic">"{log.content}"</p>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 仅在心灵感应 Tab 激活时显示输入条，其他时候完美隐藏不占空间 */}
      {activeTab === 'chat' && (
        <div className="p-3 border-t shrink-0 flex items-center bg-transparent" style={{ borderColor: 'var(--divider)' }}>
          <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isAiResponding}
              placeholder={isAiResponding ? 'CONNECTING SIGNAL...' : 'INPUT SENSORY DATA...'}
              className="flex-1 rounded border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-color font-mono"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
            <button
              type="submit"
              disabled={isAiResponding || !inputText.trim()}
              className="rounded border p-1.5 transition-transform active:scale-95 flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
                borderColor: 'var(--card-border)'
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

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

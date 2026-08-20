import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings, Activity, Shield, Sparkles } from 'lucide-react';

export const ChatHeaderBar = ({ character, chat, onOpenSettings }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!character || !chat) return null;

  const currentStatus = Array.isArray(character.statusList) && character.statusList.length > 0
    ? character.statusList[Math.floor(Math.random() * character.statusList.length)]
    : '月色与你同在';

  const isRpMode = chat.mode === 'rp';

  return (
    <div className="sticky top-0 z-30 w-full transition-all">
      <div 
        className="rounded-3xl border backdrop-blur-xl shadow-sm p-3.5 space-y-2"
        style={{
          background: 'var(--card-bg-gradient)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* 收起状态 Header */}
        <div className="flex items-center justify-between gap-3">
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
          >
            <div className="relative shrink-0">
              {character.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="w-10 h-10 rounded-full object-cover border shadow-sm"
                  style={{ borderColor: 'var(--card-border)' }}
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'var(--control-soft-bg)' }}
                >
                  {character.name?.[0] || 'C'}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-semibold text-sm truncate">{character.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono tracking-wider uppercase border ${
                  isRpMode 
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300' 
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                }`}>
                  {isRpMode ? 'RP Mode' : 'Real World'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] opacity-70">
                <Activity className="w-3 h-3 shrink-0" />
                <span className="truncate">{currentStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-full opacity-70 hover:opacity-100 transition-all active:scale-95"
              style={{ background: 'var(--control-soft-bg)' }}
              title="伴侣设定与设置"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-full opacity-70 hover:opacity-100 transition-all"
              style={{ background: 'var(--control-soft-bg)' }}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 展开面板 */}
        {isExpanded && (
          <div className="pt-3 border-t space-y-3 text-xs animate-fade-in-up" style={{ borderColor: 'var(--divider)' }}>
            {character.bio && (
              <p 
                className="italic opacity-80 leading-relaxed font-serif text-[11px] p-2.5 rounded-xl border"
                style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
              >
                "{character.bio}"
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2.5 rounded-xl space-y-1 border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}>
                <div className="flex items-center gap-1 opacity-50 font-mono">
                  <Shield className="w-3 h-3" />
                  <span>模式固定说明</span>
                </div>
                <p className="opacity-80">
                  {isRpMode ? '沉浸于剧情背景与专属世界书中。' : '关注现实中的你，给予生活温度。'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl space-y-1 border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}>
                <div className="flex items-center gap-1 opacity-50 font-mono">
                  <Sparkles className="w-3 h-3" />
                  <span>心绪总结</span>
                </div>
                <p className="opacity-80">每 {character.summaryFrequency || 10} 轮对话记录记忆</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeaderBar;

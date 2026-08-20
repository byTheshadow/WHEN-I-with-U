import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Edit3, Activity, Shield, Sparkles } from 'lucide-react';

export const ChatHeaderBar = ({ character, chat, onOpenSettings }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!character || !chat) return null;

  // 使用 useMemo 锁定打字时的状态抽搐 BUG
  const currentStatus = useMemo(() => {
    if (Array.isArray(character.statusList) && character.statusList.length > 0) {
      return character.statusList[Math.floor(Math.random() * character.statusList.length)];
    }
    return '月色与你同在';
  }, [character.id, character.statusList]);

  const isRpMode = chat.mode === 'rp';

  // 严格隔离：仅读取【当前聊天窗】自身的专属总结，绝不跨窗口同步 (Fix Summary Isolation)
  const currentChatSummary = chat.summary || null;

  return (
    <div className="sticky top-0 z-30 w-full transition-all flex flex-col items-center">
      {/* 1. 未唤醒/收起状态：精美 Pill shape 胶囊小按钮 */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-sm backdrop-blur-xl transition-transform active:scale-95 hover:opacity-90"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="relative shrink-0">
            {character.avatar ? (
              <img
                src={character.avatar}
                alt={character.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
                style={{ background: 'var(--control-soft-bg)' }}
              >
                {character.name?.[0] || 'C'}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>

          <span className="font-serif font-semibold text-xs truncate max-w-[100px]">{character.name}</span>

          <span className="text-[10px] opacity-60 font-mono truncate max-w-[90px]">· {currentStatus}</span>

          <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-0.5" />
        </button>
      ) : (
        /* 2. 展开状态：Carrd 杂志风面板 */
        <div 
          className="w-full rounded-3xl border backdrop-blur-xl shadow-md p-4 space-y-3 animate-fade-in-up text-left"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
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
              {/* 使用 Edit3 解决 npm run build 无法导出 UserEdit 的错误 */}
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2 rounded-full opacity-70 hover:opacity-100 transition-all active:scale-95"
                style={{ background: 'var(--control-soft-bg)' }}
                title="编辑伴侣人设"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-full opacity-70 hover:opacity-100 transition-all"
                style={{ background: 'var(--control-soft-bg)' }}
                title="收起状态栏"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t space-y-2 text-xs" style={{ borderColor: 'var(--divider)' }}>
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
                  <span>模式约定</span>
                </div>
                <p className="opacity-80">
                  {isRpMode ? '沉浸于剧情背景与专属世界书中。' : '伴于现实，关注日常生活细节。'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl space-y-1 border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}>
                <div className="flex items-center gap-1 opacity-50 font-mono">
                  <Sparkles className="w-3 h-3" />
                  <span>本窗专属总结</span>
                </div>
                {/* 彻底隔离：只呈现当前聊天窗 (chat.summary) 的独有总结 */}
                <p className="opacity-80 truncate">
                  {currentChatSummary ? currentChatSummary : `暂无本对话总结 (每 ${character.summaryFrequency || 10} 轮自动记忆)`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeaderBar;

import React, { useState, useMemo, useEffect } from 'react';
import { Heart, ChevronUp, Edit3, Activity, Shield, Sparkles, Loader2 } from 'lucide-react';
import { subscribeSummaryStatus } from '../../../services/aiService';

export const ChatHeaderBar = ({ character, chat, onOpenSettings, onSaveSummary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSummaryStatus(({ chatId, isSummarizing }) => {
      if (chatId === chat.id) setIsSummarizing(isSummarizing);
    });
    return unsubscribe;
  }, [chat.id]);

  if (!character || !chat) return null;

  const currentStatus = useMemo(() => {
    if (Array.isArray(character.statusList) && character.statusList.length > 0) {
      return character.statusList[Math.floor(Math.random() * character.statusList.length)];
    }
    return '月色与你同在';
  }, [character.id, character.statusList]);

  const isRpMode = chat.mode === 'rp';

  const summaryEntries = useMemo(() => {
    if (Array.isArray(chat.summary)) return chat.summary;
    if (typeof chat.summary === 'string' && chat.summary.trim()) {
      return [{ id: 'legacy', content: chat.summary, createdAt: '历史记录', isAuto: true }];
    }
    return [];
  }, [chat.summary]);

  return (
    <div className="sticky top-0 z-30 w-full flex flex-col items-center transition-all">
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm backdrop-blur-xl transition-all active:scale-95"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
          title={`${character.name} · ${currentStatus}`}
        >
          <Heart
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'var(--accent-color)' }}
          />
          <span className="font-serif font-medium text-[11px] truncate max-w-[84px]">
            {character.name}
          </span>

          {isSummarizing && (
            <span
              className="flex items-center gap-1 text-[9px] font-mono pl-1.5 ml-0.5 border-l opacity-75"
              style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
            >
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>整理中</span>
            </span>
          )}
        </button>
      ) : (
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
                    style={{
                      background: 'var(--control-soft-bg)',
                      color: 'var(--text-main)'
                    }}
                  >
                    {character.name?.[0] || 'C'}
                  </div>
                )}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                  style={{
                    background: 'var(--accent-color)',
                    borderColor: 'var(--bg-main)'
                  }}
                />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-serif font-semibold text-sm truncate">
                    {character.name}
                  </h3>
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-mono tracking-wider uppercase border"
                    style={{
                      borderColor: 'var(--divider)',
                      background: 'var(--control-soft-bg)',
                      color: 'var(--text-muted)'
                    }}
                  >
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
                className="p-2 rounded-full opacity-75 hover:opacity-100 transition-all active:scale-95"
                style={{ background: 'var(--control-soft-bg)' }}
                title="编辑伴侣人设"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-full opacity-75 hover:opacity-100 transition-all active:scale-95"
                style={{ background: 'var(--control-soft-bg)' }}
                title="收起"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t space-y-2 text-xs" style={{ borderColor: 'var(--divider)' }}>
            {character.bio && (
              <p
                className="italic opacity-80 leading-relaxed font-serif text-[11px] p-2.5 rounded-xl border"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)'
                }}
              >
                "{character.bio}"
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div
                className="p-2.5 rounded-xl space-y-1 border"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)'
                }}
              >
                <div className="flex items-center gap-1 opacity-50 font-mono">
                  <Shield className="w-3 h-3" />
                  <span>模式约定</span>
                </div>
                <p className="opacity-80">
                  {isRpMode ? '沉浸于剧情背景与专属世界书中。' : '伴于现实，关注日常生活细节。'}
                </p>
              </div>

              <div
                className="p-2.5 rounded-xl space-y-1 border"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)'
                }}
              >
                <div className="flex items-center justify-between opacity-50 font-mono">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>阶段总结 ({summaryEntries.length})</span>
                  </div>
                </div>

                {isSummarizing ? (
                  <p className="opacity-60 italic animate-pulse">正在整理最新总结…</p>
                ) : summaryEntries.length === 0 ? (
                  <p className="opacity-60 italic">暂无阶段总结条目</p>
                ) : (
                  <p className="opacity-80 truncate">
                    最新: {summaryEntries[summaryEntries.length - 1]?.content}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeaderBar;

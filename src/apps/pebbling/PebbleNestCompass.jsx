// src/apps/pebbling/PebbleNestCompass.jsx
import React from 'react';
import { Waves, Sparkles, Feather, Plus } from 'lucide-react';

export default function PebbleNestCompass({
  characters = [],
  activeCharId,
  onSelectChar,
  countsMap = {},
  onOpenThrowModal,
  onAiInitiate
}) {
  const activeChar = characters.find(c => c.id === activeCharId) || characters[0];

  return (
    <div className="w-full mb-6">
      {/* 巢穴顶部名牌与意象 */}
      <div 
        className="p-5 rounded-2xl border transition-all duration-500 relative overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
        }}
      >
        {/* 背景微柔光弧线 */}
        <div 
          className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: 'var(--accent-color)' }}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          {/* 左侧：活跃巢穴提示 */}
          <div className="flex items-center gap-3">
            <div className="relative">
              {activeChar?.avatar ? (
                <img 
                  src={activeChar.avatar} 
                  alt={activeChar.name}
                  className="w-12 h-12 rounded-full object-cover border-2"
                  style={{ borderColor: 'var(--accent-color)' }}
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center border"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  <Feather className="w-5 h-5 opacity-70" style={{ color: 'var(--text-main)' }} />
                </div>
              )}
              <span 
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] border"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)', borderColor: 'var(--card-bg)' }}
              >
                <Sparkles className="w-2.5 h-2.5" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium tracking-wide" style={{ color: 'var(--text-main)' }}>
                  {activeChar?.name || '共栖伙伴'} 的小石巢
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full border opacity-80" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}>
                  {countsMap[activeCharId] || 0} 颗暖石
                </span>
              </div>
              <p className="text-xs opacity-75 mt-0.5" style={{ color: 'var(--text-sub)' }}>
                {activeChar?.personality ? `${activeChar.personality.slice(0, 32)}...` : '毫无负担的延迟陪伴与温热心意分享'}
              </p>
            </div>
          </div>

          {/* 右侧动作按钮区 */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => onAiInitiate(activeCharId)}
              className="px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
              title="召唤角色去海边漫步，衔一颗石头回巢"
            >
              <Waves className="w-3.5 h-3.5 opacity-80" />
              <span>漫步寻石</span>
            </button>

            <button
              onClick={() => onOpenThrowModal(activeCharId)}
              className="px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-95 shadow-sm"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Plus className="w-4 h-4" />
              <span>悄悄丢入巢中</span>
            </button>
          </div>
        </div>

        {/* 下方：拟物海滩巢穴选择印章盘 */}
        <div className="mt-5 pt-4 border-t flex items-center gap-3 overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--divider)' }}>
          <span className="text-[11px] font-mono uppercase tracking-wider opacity-60 flex-shrink-0" style={{ color: 'var(--text-sub)' }}>
            HABITAT NESTS:
          </span>
          {characters.map(char => {
            const isActive = char.id === activeCharId;
            const count = countsMap[char.id] || 0;
            return (
              <button
                key={char.id}
                onClick={() => onSelectChar(char.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all duration-300 flex-shrink-0 ${
                  isActive ? 'scale-105 shadow-sm font-medium' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--card-bg)' : 'var(--control-soft-bg)',
                  borderColor: isActive ? 'var(--accent-color)' : 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                {char.avatar ? (
                  <img src={char.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]" style={{ borderColor: 'var(--card-border)' }}>
                    {char.name ? char.name[0] : 'C'}
                  </div>
                )}
                <span>{char.name}</span>
                <span className="text-[10px] opacity-60 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

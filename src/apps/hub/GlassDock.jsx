import React from 'react';
import { SvgIcon } from '../../components/SvgIcon';

const navItems = [
  { id: 'messages', label: '消息', icon: 'messages' },
  { id: 'diaries', label: '日记', icon: 'diaries' },
  { id: 'travel', label: '旅行', icon: 'travel' },
  { id: 'planner', label: '日程', icon: 'planner' },
  { id: 'settings', label: '设置', icon: 'settings' }
];

export const GlassDock = ({ activeTab, onSelectTab }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="glass-panel px-4 py-2.5 rounded-full flex items-center gap-2 border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative px-4 py-2 rounded-full transition-all duration-300 flex items-center gap-2 text-xs ${
                isActive
                  ? 'bg-purple-600/30 text-white font-medium shadow-inner border border-purple-400/30'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <SvgIcon name={item.icon} className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
              {isActive && (
                <span className="absolute -top-1 right-2 w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

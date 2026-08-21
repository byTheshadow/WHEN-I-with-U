import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Gift, Utensils, CreditCard, X } from 'lucide-react';

export const InteractiveMenuPopover = ({ onSelectAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // 点击外部自动收起
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (type) => {
    setIsOpen(false);
    onSelectAction(type);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* 底部悬浮栏上的唯一新按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-full transition-all duration-200 flex items-center justify-center"
        style={{
          backgroundColor: isOpen ? 'var(--accent-color, #7c3aed)' : 'var(--control-soft-bg, rgba(0, 0, 0, 0.05))',
          color: isOpen ? '#ffffff' : 'var(--text-main, #1a1a1a)',
        }}
        title="互动心意菜单"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* 向上展开的 Popover 菜单 */}
      {isOpen && (
        <div 
          className="absolute bottom-14 left-0 mb-2 w-48 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.9))',
            borderColor: 'var(--card-border, rgba(0, 0, 0, 0.1))',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b text-[11px] font-semibold opacity-60" style={{ borderColor: 'var(--card-border, rgba(0, 0, 0, 0.08))' }}>
            <span>发送专属心意</span>
            <button onClick={() => setIsOpen(false)}><X className="w-3 h-3" /></button>
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleAction('GIFT')}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.04))', color: 'var(--text-main)' }}
            >
              <Gift className="w-4 h-4 text-purple-500" />
              <span>赠送礼物</span>
            </button>

            <button
              onClick={() => handleAction('FOOD')}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.04))', color: 'var(--text-main)' }}
            >
              <Utensils className="w-4 h-4 text-amber-500" />
              <span>叫外卖代点</span>
            </button>

            <button
              onClick={() => handleAction('KINSHIP')}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.04))', color: 'var(--text-main)' }}
            >
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>赠送亲属卡</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMenuPopover;

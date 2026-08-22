import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Gift, Utensils, CreditCard, X, Smile } from 'lucide-react';

export const InteractiveMenuPopover = ({ onSelectAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // 点击外部自动收起 Popover
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
      {/* 底部悬浮输入栏上的唯一新入口按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full p-2 transition-all active:scale-90 flex items-center justify-center"
        style={{
          background: isOpen ? 'var(--accent-color)' : 'var(--control-soft-bg)',
          color: isOpen ? 'var(--accent-foreground)' : 'var(--text-main)',
        }}
        title="心意互动菜单"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {/* 向上平滑展开的子菜单 */}
      {isOpen && (
        <div
          className="absolute bottom-12 left-0 mb-1 w-44 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: 'var(--text-main)',
          }}
        >
          <div
            className="flex items-center justify-between px-2 py-1 mb-1 border-b text-[10px] font-semibold opacity-60"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <span>心意互动</span>
            <button type="button" onClick={() => setIsOpen(false)}>
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleAction('sticker')}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>表情包</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('gift')}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>赠送礼物</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('food')}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>外卖代点</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('kinship')}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-85"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>开通亲属卡</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMenuPopover;

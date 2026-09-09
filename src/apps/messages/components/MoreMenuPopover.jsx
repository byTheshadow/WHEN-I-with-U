import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, CalendarDays, Settings } from 'lucide-react';

const MoreMenuPopover = ({ onOpenCalendar, onOpenSettings }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
        style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
        title="更多"
        aria-label="更多选项"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-36 overflow-hidden rounded-2xl py-1 text-xs shadow-2xl animate-fade-in-up"
          style={{
            background: 'var(--card-bg-gradient, var(--bg-main))',
            border: '1px solid var(--card-border)',
            color: 'var(--text-main)',
          }}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onOpenCalendar(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--control-soft-bg)]"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            聊天日历
          </button>

          <button
            type="button"
            onClick={() => { setOpen(false); onOpenSettings(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--control-soft-bg)]"
          >
            <Settings className="h-3.5 w-3.5" />
            对话空间设置
          </button>
        </div>
      )}
    </div>
  );
};

export default MoreMenuPopover;
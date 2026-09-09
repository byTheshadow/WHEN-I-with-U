import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './chat-calendar.css';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseMessageDate = (timestamp) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getHeatLevel = (count) => {
  if (count >= 20) return 3;
  if (count >= 5) return 2;
  return 1;
};

const ChatCalendarModal = ({ isOpen, messages, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [slideDir, setSlideDir] = useState('right');
  const [activeTooltipKey, setActiveTooltipKey] = useState(null);

  // 挂载/卸载 + 进出场动画的时序控制
  useEffect(() => {
    let showTimer;
    let hideTimer;

    if (isOpen) {
      setMounted(true);
      showTimer = requestAnimationFrame(() => setVisible(true));
    } else if (mounted) {
      setVisible(false);
      hideTimer = setTimeout(() => setMounted(false), 260);
    }

    return () => {
      if (showTimer) cancelAnimationFrame(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date());
      setActiveTooltipKey(null);
    }
  }, [isOpen]);

  const activeDayMap = useMemo(() => {
    const map = new Map();

    (messages || []).forEach((message) => {
      const date = parseMessageDate(message.timestamp);
      if (!date) return;

      const key = toDateKey(date);
      map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
  }, [messages]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const list = [];
    for (let i = 0; i < startWeekday; i += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push(new Date(year, month, day));
    }
    return list;
  }, [year, month]);

  const todayKey = toDateKey(new Date());

  const goPrevMonth = useCallback(() => {
    setSlideDir('left');
    setActiveTooltipKey(null);
    setViewDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const goNextMonth = useCallback(() => {
    setSlideDir('right');
    setActiveTooltipKey(null);
    setViewDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const handleDayClick = useCallback((key) => {
    setActiveTooltipKey((previous) => (previous === key ? null : key));
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`cc-backdrop ${visible ? 'cc-visible' : ''}`}
      onClick={onClose}
    >
      <div
        className="cc-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="cc-close-btn" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="cc-header">
          <button type="button" className="cc-nav-btn" onClick={goPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="cc-month-label">{year} 年 {month + 1} 月</div>

          <button type="button" className="cc-nav-btn" onClick={goNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="cc-weekday-row">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="cc-weekday-cell">{label}</div>
          ))}
        </div>

        <div
          key={`${year}-${month}`}
          className={`cc-day-grid ${
            slideDir === 'right' ? 'cc-month-slide-right' : 'cc-month-slide-left'
          }`}
        >
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} />;

            const key = toDateKey(date);
            const count = activeDayMap.get(key) || 0;
            const hasActivity = count > 0;
            const isToday = key === todayKey;
            const heatLevel = hasActivity ? getHeatLevel(count) : 0;

            return (
              <div
                key={key}
                className={[
                  'cc-day-cell',
                  hasActivity ? 'cc-has-activity' : '',
                  hasActivity ? `cc-heat-${heatLevel}` : '',
                  isToday ? 'cc-is-today' : '',
                ].filter(Boolean).join(' ')}
                style={{ '--cc-i': index }}
                onClick={() => hasActivity && handleDayClick(key)}
              >
                {date.getDate()}

                {hasActivity && (
                  <span
                    className={`cc-day-tooltip ${
                      activeTooltipKey === key ? 'cc-tooltip-visible' : ''
                    }`}
                  >
                    {date.getMonth() + 1}/{date.getDate()} · {count} 条
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="cc-footer-hint">高亮日期代表当天有聊天记录</div>
      </div>
    </div>
  );
};

export default ChatCalendarModal;
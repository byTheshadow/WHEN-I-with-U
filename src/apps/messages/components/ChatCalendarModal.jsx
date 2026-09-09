import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './chat-calendar.css';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MINI_HEAT_DAYS = 28; // 底部装饰性小热力图覆盖最近几天

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

// 从某一天的消息里挑一条"能读的"文字摘一句放进小纸条
const pickSnippet = (dayMessages) => {
  const readable = dayMessages
    .filter((message) => message.type === 'text' && message.content)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (readable.length === 0) return null;

  const raw = readable[0].content.trim();
  return raw.length > 32 ? `${raw.slice(0, 32)}…` : raw;
};

const ChatCalendarModal = ({ isOpen, messages, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [slideDir, setSlideDir] = useState('right');
  const [selectedDayKey, setSelectedDayKey] = useState(null);

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
      setSelectedDayKey(null);
    }
  }, [isOpen]);

  // 按日期分组一次，日历格子的热度和底部小热力图共用这份数据
  const messagesByDay = useMemo(() => {
    const map = new Map();

    (messages || []).forEach((message) => {
      const date = parseMessageDate(message.timestamp);
      if (!date) return;

      const key = toDateKey(date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(message);
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

  const miniHeatDays = useMemo(() => {
    const list = [];
    const today = new Date();

    for (let i = MINI_HEAT_DAYS - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = toDateKey(date);
      const count = messagesByDay.get(key)?.length || 0;

      list.push({ key, level: count > 0 ? getHeatLevel(count) : 0 });
    }

    return list;
  }, [messagesByDay]);

  const todayKey = toDateKey(new Date());

  const goPrevMonth = useCallback(() => {
    setSlideDir('left');
    setSelectedDayKey(null);
    setViewDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const goNextMonth = useCallback(() => {
    setSlideDir('right');
    setSelectedDayKey(null);
    setViewDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const handleDayClick = useCallback((key) => {
    setSelectedDayKey((previous) => (previous === key ? null : key));
  }, []);

  if (!mounted) return null;

  const selectedDayMessages = selectedDayKey
    ? (messagesByDay.get(selectedDayKey) || [])
    : [];
  const selectedDate = selectedDayKey
    ? new Date(`${selectedDayKey}T00:00:00`)
    : null;
  const selectedSnippet = selectedDayKey ? pickSnippet(selectedDayMessages) : null;

  return (
    <div className={`cc-backdrop ${visible ? 'cc-visible' : ''}`} onClick={onClose}>
      <div className="cc-aura cc-aura-a" />
      <div className="cc-aura cc-aura-b" />

      <div className="cc-panel" onClick={(event) => event.stopPropagation()}>
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
            const count = messagesByDay.get(key)?.length || 0;
            const hasActivity = count > 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedDayKey;
            const heatLevel = hasActivity ? getHeatLevel(count) : 0;

            return (
              <div
                key={key}
                className={[
                  'cc-day-cell',
                  hasActivity ? 'cc-has-activity' : '',
                  hasActivity ? `cc-heat-${heatLevel}` : '',
                  isToday ? 'cc-is-today' : '',
                  isSelected ? 'cc-is-selected' : '',
                ].filter(Boolean).join(' ')}
                style={{ '--cc-i': index }}
                onClick={() => hasActivity && handleDayClick(key)}
              >
                {date.getDate()}
              </div>
            );
          })}
        </div>

        <div className={`cc-note ${selectedDayKey ? 'cc-note-visible' : ''}`}>
          {selectedDate && (
            <>
              <div className="cc-note-head">
                <span className="cc-note-date">
                  {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日
                </span>
                <span className="cc-note-count">
                  聊了 {selectedDayMessages.length} 条
                </span>
              </div>

              <div className="cc-note-text">
                {selectedSnippet || '这天留下的是一段特别的记录。'}
              </div>
            </>
          )}
        </div>

        <div className="cc-mini-heat">
          <div className="cc-mini-heat-title">最近的印记</div>

          <div className="cc-mini-heat-grid">
            {miniHeatDays.map(({ key, level }) => (
              <div
                key={key}
                className={`cc-mini-heat-cell ${level ? `cc-heat-${level}` : ''}`}
              />
            ))}
          </div>

          <div className="cc-mini-heat-legend">
            <span>少</span>
            <span
              className="cc-mini-heat-legend-cell"
              style={{ background: 'color-mix(in srgb, var(--text-main) 8%, transparent)' }}
            />
            <span
              className="cc-mini-heat-legend-cell"
              style={{ background: 'color-mix(in srgb, var(--accent-color) 30%, transparent)' }}
            />
            <span
              className="cc-mini-heat-legend-cell"
              style={{ background: 'color-mix(in srgb, var(--accent-color) 60%, transparent)' }}
            />
            <span
              className="cc-mini-heat-legend-cell"
              style={{ background: 'var(--accent-color)' }}
            />
            <span>多</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatCalendarModal;
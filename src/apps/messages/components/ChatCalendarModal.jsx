import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Gift,
  Sparkles,
  Pencil,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import {
  XINJI_TYPES,
  runXinjiReflection,
  getXinjiEntriesForChat,
  deleteXinjiEntry,
  updateXinjiEntry,
} from '../../../services/xinjiService';
import './chat-calendar.css';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MINI_HEAT_DAYS = 28;

const XINJI_TYPE_META = {
  [XINJI_TYPES.ANNIVERSARY]: { icon: Star, label: '纪念日' },
  [XINJI_TYPES.MOMENT]: { icon: Sparkles, label: '瞬间' },
  [XINJI_TYPES.WISH]: { icon: Gift, label: '心愿' },
};

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toMonthDay = (dateKey) => dateKey.slice(5);

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

const pickSnippet = (dayMessages) => {
  const readable = dayMessages
    .filter((message) => message.type === 'text' && message.content)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (readable.length === 0) return null;

  const raw = readable[0].content.trim();
  return raw.length > 32 ? `${raw.slice(0, 32)}…` : raw;
};

const ChatCalendarModal = ({
  isOpen,
  chatId,
  character,
  messages,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [slideDir, setSlideDir] = useState('right');
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  const [xinjiEntries, setXinjiEntries] = useState([]);
  const [isReflecting, setIsReflecting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    title: '',
    content: '',
  });
  const [isXinjiExpanded, setIsXinjiExpanded] = useState(false);

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
  }, [isOpen, mounted]);

  const loadXinjiEntries = useCallback(async () => {
    if (!chatId) return;

    const list = await getXinjiEntriesForChat(chatId);
    setXinjiEntries(list);
  }, [chatId]);

  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date());
      setSelectedDayKey(null);
      void loadXinjiEntries();
    }
  }, [isOpen, loadXinjiEntries]);

  const messagesByDay = useMemo(() => {
    const map = new Map();

    (messages || []).forEach((message) => {
      const date = parseMessageDate(message.timestamp);
      if (!date) return;

      const key = toDateKey(date);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(message);
    });

    return map;
  }, [messages]);

  const {
    xinjiByExactDate,
    recurringXinjiByMonthDay,
  } = useMemo(() => {
    const exact = new Map();
    const recurring = new Map();

    xinjiEntries.forEach((entry) => {
      if (!entry.date) return;

      if (entry.isRecurringYearly) {
        const monthDay = toMonthDay(entry.date);

        if (!recurring.has(monthDay)) {
          recurring.set(monthDay, []);
        }

        recurring.get(monthDay).push(entry);
      } else {
        if (!exact.has(entry.date)) {
          exact.set(entry.date, []);
        }

        exact.get(entry.date).push(entry);
      }
    });

    return {
      xinjiByExactDate: exact,
      recurringXinjiByMonthDay: recurring,
    };
  }, [xinjiEntries]);

  const getXinjiForDateKey = useCallback(
    (key) => {
      const exactMatches = xinjiByExactDate.get(key) || [];
      const recurringMatches =
        recurringXinjiByMonthDay.get(toMonthDay(key)) || [];

      return [...exactMatches, ...recurringMatches];
    },
    [xinjiByExactDate, recurringXinjiByMonthDay],
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const list = [];

    for (let i = 0; i < startWeekday; i += 1) {
      list.push(null);
    }

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

      list.push({
        key,
        level: count > 0 ? getHeatLevel(count) : 0,
      });
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
    setSelectedDayKey((previous) => (
      previous === key ? null : key
    ));
  }, []);

  const handleReflect = useCallback(async () => {
    if (!chatId || isReflecting) return;

    setIsReflecting(true);

    try {
      await runXinjiReflection({
        chatId,
        characterId: character?.id,
        character,
      });

      await loadXinjiEntries();
    } finally {
      setIsReflecting(false);
    }
  }, [
    chatId,
    character,
    isReflecting,
    loadXinjiEntries,
  ]);

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditDraft({
      title: entry.title,
      content: entry.content,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (entryId) => {
    await updateXinjiEntry(entryId, {
      title: editDraft.title.trim() || '未命名',
      content: editDraft.content.trim(),
    });

    setEditingId(null);
    await loadXinjiEntries();
  };

  const handleDeleteEntry = async (entryId) => {
    await deleteXinjiEntry(entryId);
    await loadXinjiEntries();
  };

  if (!mounted) return null;

  const selectedDayMessages = selectedDayKey
    ? messagesByDay.get(selectedDayKey) || []
    : [];

  const selectedDate = selectedDayKey
    ? new Date(`${selectedDayKey}T00:00:00`)
    : null;

  const selectedSnippet = selectedDayKey
    ? pickSnippet(selectedDayMessages)
    : null;

  const selectedDayXinji = selectedDayKey
    ? getXinjiForDateKey(selectedDayKey)
    : [];

  return (
    <div
      className={`cc-backdrop ${visible ? 'cc-visible' : ''}`}
      onClick={onClose}
    >
      <div className="cc-aura cc-aura-a" />
      <div className="cc-aura cc-aura-b" />

      <div
        className="cc-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="cc-close-btn"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="cc-header">
          <button
            type="button"
            className="cc-nav-btn"
            onClick={goPrevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="cc-month-label">
            {year} 年 {month + 1} 月
          </div>

          <button
            type="button"
            className="cc-nav-btn"
            onClick={goNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="cc-weekday-row">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="cc-weekday-cell"
            >
              {label}
            </div>
          ))}
        </div>

        <div
          key={`${year}-${month}`}
          className={`cc-day-grid ${
            slideDir === 'right'
              ? 'cc-month-slide-right'
              : 'cc-month-slide-left'
          }`}
        >
          {cells.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} />;
            }

            const key = toDateKey(date);
            const count = messagesByDay.get(key)?.length || 0;
            const hasActivity = count > 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedDayKey;
            const heatLevel = hasActivity
              ? getHeatLevel(count)
              : 0;

            const dayXinji = getXinjiForDateKey(key);
            const hasXinji = dayXinji.length > 0;

            const XinjiBadgeIcon = hasXinji
              ? XINJI_TYPE_META[dayXinji[0].type]?.icon
              : null;

            return (
              <div
                key={key}
                className={[
                  'cc-day-cell',
                  hasActivity ? 'cc-has-activity' : '',
                  hasActivity ? `cc-heat-${heatLevel}` : '',
                  isToday ? 'cc-is-today' : '',
                  isSelected ? 'cc-is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--cc-i': index }}
                onClick={() => (
                  (hasActivity || hasXinji) &&
                  handleDayClick(key)
                )}
              >
                {date.getDate()}

                {XinjiBadgeIcon && (
                  <span className="cc-xinji-badge">
                    <XinjiBadgeIcon className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className={`cc-note ${
            selectedDayKey ? 'cc-note-visible' : ''
          }`}
        >
          {selectedDate && (
            <>
              <div className="cc-note-head">
                <span className="cc-note-date">
                  {selectedDate.getMonth() + 1} 月{' '}
                  {selectedDate.getDate()} 日
                </span>

                <span className="cc-note-count">
                  聊了 {selectedDayMessages.length} 条
                </span>
              </div>

              <div className="cc-note-text">
                {selectedSnippet || '这天留下的是一段特别的记录。'}
              </div>

              {selectedDayXinji.length > 0 && (
                <div className="cc-note-xinji-tags">
                  {selectedDayXinji.map((entry) => {
                    const meta =
                      XINJI_TYPE_META[entry.type] ||
                      XINJI_TYPE_META[XINJI_TYPES.MOMENT];

                    const Icon = meta.icon;

                    return (
                      <span
                        key={entry.id}
                        className="cc-note-xinji-tag"
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {entry.title}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="cc-mini-heat">
          <div className="cc-mini-heat-title">
            最近的印记
          </div>

          <div className="cc-mini-heat-grid">
            {miniHeatDays.map(({ key, level }) => (
              <div
                key={key}
                className={`cc-mini-heat-cell ${
                  level ? `cc-heat-${level}` : ''
                }`}
              />
            ))}
          </div>

          <div className="cc-mini-heat-legend">
            <span>少</span>

            <span
              className="cc-mini-heat-legend-cell"
              style={{
                background:
                  'color-mix(in srgb, var(--text-main) 8%, transparent)',
              }}
            />

            <span
              className="cc-mini-heat-legend-cell"
              style={{
                background:
                  'color-mix(in srgb, var(--accent-color) 30%, transparent)',
              }}
            />

            <span
              className="cc-mini-heat-legend-cell"
              style={{
                background:
                  'color-mix(in srgb, var(--accent-color) 60%, transparent)',
              }}
            />

            <span
              className="cc-mini-heat-legend-cell"
              style={{
                background: 'var(--accent-color)',
              }}
            />

            <span>多</span>
          </div>
        </div>

        <div className="cc-xinji-section">
          <button
            type="button"
            className="cc-xinji-handle"
            onClick={() => setIsXinjiExpanded((previous) => !previous)}
            aria-label="展开或收起心记"
            aria-expanded={isXinjiExpanded}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 cc-xinji-handle-chevron ${
                isXinjiExpanded
                  ? 'cc-xinji-handle-chevron-open'
                  : ''
              }`}
            />
          </button>

          <div
            className={`cc-xinji-body ${
              isXinjiExpanded ? 'cc-xinji-body-open' : ''
            }`}
          >
            <div className="cc-xinji-section-head">
              <button
                type="button"
                className="cc-xinji-reflect-btn"
                onClick={handleReflect}
                disabled={isReflecting}
              >
                {isReflecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}

                {isReflecting ? '回顾中...' : '回顾'}
              </button>
            </div>

            {xinjiEntries.length === 0 && !isReflecting && (
              <div className="cc-xinji-empty">
                点“回顾”，让角色想想有没有值得记下的日子。
              </div>
            )}

            <div className="cc-xinji-list">
              {xinjiEntries.map((entry) => {
                const meta =
                  XINJI_TYPE_META[entry.type] ||
                  XINJI_TYPE_META[XINJI_TYPES.MOMENT];

                const Icon = meta.icon;
                const isEditing = editingId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="cc-xinji-item"
                  >
                    <div className="cc-xinji-item-icon">
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="cc-xinji-item-body">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            className="cc-xinji-edit-input"
                            value={editDraft.title}
                            onChange={(event) => {
                              setEditDraft((previous) => ({
                                ...previous,
                                title: event.target.value,
                              }));
                            }}
                          />

                          <textarea
                            className="cc-xinji-edit-textarea"
                            value={editDraft.content}
                            onChange={(event) => {
                              setEditDraft((previous) => ({
                                ...previous,
                                content: event.target.value,
                              }));
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="cc-xinji-item-head">
                            <span className="cc-xinji-item-title">
                              {entry.title}
                            </span>

                            <span className="cc-xinji-item-date">
                              {entry.date}
                              {entry.isRecurringYearly
                                ? '（每年）'
                                : ''}
                            </span>
                          </div>

                          <div className="cc-xinji-item-content">
                            {entry.content}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="cc-xinji-item-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(entry.id)}
                            title="保存"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={cancelEdit}
                            title="取消"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatCalendarModal;

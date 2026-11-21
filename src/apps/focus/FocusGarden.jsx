// src/apps/focus/FocusGarden.jsx
//
// 花园日历：一个月一屏，每天一格，格子里放当天最好的一株小图标；
// 枯萎的（放弃的）也有位置，颜色更淡。点某一天，下面列出那天的全部专注。
// 数据来自 focusSessions 表，用 dayKey 索引按月读取，不含进行中的。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import db from '../../db';
import { toDayKey } from './focusSessionService';
import GrowthIcon from './GrowthIcon';
import {
  GARDEN_WEEKDAYS,
  buildMonthGrid,
  getSessionKindLabel,
  getSessionVisual,
  groupSessionsByDay,
  pickDayBest,
  shiftMonth,
  summarizeMonth,
  toMonthPrefix,
} from './focusGardenModel';
import './focusGarden.css';

const loadMonthSessions = async (year, month) => {
  const prefix = toMonthPrefix(year, month);

  const rows = await db.focusSessions
    .where('dayKey')
    .between(`${prefix}-00`, `${prefix}-99`, true, true)
    .toArray();

  return rows.filter((row) => row.status === 'completed' || row.status === 'abandoned');
};

const formatTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const FocusGarden = ({ growthStyle }) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDayKey(today);

  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(todayKey);

  const isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  useEffect(() => {
    let active = true;
    setLoading(true);

    loadMonthSessions(view.year, view.month)
      .then((rows) => {
        if (active) setSessions(rows);
      })
      .catch((error) => {
        console.warn('[focus] 读取花园记录失败:', error);
        if (active) setSessions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [view.year, view.month]);

  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view.year, view.month]);
  const byDay = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const summary = useMemo(() => summarizeMonth(sessions), [sessions]);

  const goMonth = useCallback((delta) => {
    setView((prev) => shiftMonth(prev.year, prev.month, delta));
    setSelected('');
  }, []);

  const selectedList = selected ? byDay.get(selected) || [] : [];

  return (
    <div className="focus-garden">
      <div className="focus-garden-nav">
        <button type="button" className="focus-back" aria-label="上个月" onClick={() => goMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="focus-garden-title">
          {view.year} 年 {view.month + 1} 月
        </div>
        <button
          type="button"
          className="focus-back"
          aria-label="下个月"
          disabled={isCurrentMonth}
          onClick={() => goMonth(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <section className="focus-block focus-garden-card">
        <div className="focus-garden-week">
          {GARDEN_WEEKDAYS.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>

        <div className="focus-garden-grid">
          {cells.map((cell, index) => {
            if (!cell) return <span key={`empty-${index}`} className="focus-garden-cell is-empty" />;

            const list = byDay.get(cell.dayKey) || [];
            const best = pickDayBest(list);
            const visual = best ? getSessionVisual(best) : null;
            const classes = ['focus-garden-cell'];

            if (cell.dayKey === todayKey) classes.push('is-today');
            if (cell.dayKey === selected) classes.push('is-selected');
            if (cell.dayKey > todayKey) classes.push('is-future');
            if (visual?.withered) classes.push('is-withered');

            return (
              <button
                key={cell.dayKey}
                type="button"
                className={classes.join(' ')}
                aria-label={`${view.month + 1} 月 ${cell.day} 日，${list.length} 次专注`}
                aria-pressed={cell.dayKey === selected}
                onClick={() => setSelected(cell.dayKey === selected ? '' : cell.dayKey)}
              >
                <span className="focus-garden-day">{cell.day}</span>
                {visual && (
                  <span className="focus-garden-icon">
                    <GrowthIcon style={growthStyle} stage={visual.stage} withered={visual.withered} />
                  </span>
                )}
                {list.length > 1 && <span className="focus-garden-count">{list.length}</span>}
              </button>
            );
          })}
        </div>

        <p className="focus-hint focus-hint--center focus-garden-sum">
          {loading
            ? '正在翻开这个月…'
            : summary.count > 0
              ? `这个月专注了 ${summary.count} 次，共 ${summary.minutes} 分钟`
              : '这个月还没有记录'}
        </p>
      </section>

      {selected && (
        <section className="focus-block focus-garden-detail">
          <div className="focus-label">
            {Number(selected.slice(5, 7))} 月 {Number(selected.slice(8, 10))} 日
          </div>

          {selectedList.length === 0 && <p className="focus-muted">这一天没有专注记录。</p>}

          {selectedList.map((session) => {
            const visual = getSessionVisual(session);

            return (
              <div
                key={session.id}
                className={`focus-garden-row${visual.withered ? ' is-withered' : ''}`}
              >
                <span className="focus-garden-row-icon">
                  <GrowthIcon style={growthStyle} stage={visual.stage} withered={visual.withered} />
                </span>
                <div className="focus-garden-row-body">
                  <div className="focus-garden-row-task">{session.task || '一次专注'}</div>
                  <div className="focus-muted">
                    {getSessionKindLabel(session)}
                    {session.place ? ` · ${session.place}` : ''}
                    {` · ${Math.max(0, session.actualMinutes || 0)} 分钟`}
                    {formatTime(session.startedAt) ? ` · ${formatTime(session.startedAt)}` : ''}
                  </div>
                  {visual.withered && session.abandonReason && (
                    <div className="focus-muted">原因：{session.abandonReason}</div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default FocusGarden;
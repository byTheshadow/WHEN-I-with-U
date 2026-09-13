import React, { useMemo } from 'react';

// 精密 Apple 风格极细矢量图标组件 (拒绝 Emoji)
const Icons = {
  Pin: () => (
    <svg className="w-3.5 h-3.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-4.35-7-10a7 7 0 0 1 14 0c0 5.65-7 10-7 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-3.5 h-3.5 opacity-60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  ),
  Check: () => (
    <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-3.5 h-3.5 text-rose-500 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Users: () => (
    <svg className="w-3.5 h-3.5 opacity-50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
};

// 时间格式化辅助
function formatAppleTime(isoStr) {
  if (!isoStr) return { dateStr: '', timeStr: '', month: 'CAL', day: '—', weekDay: '' };
  try {
    const d = new Date(isoStr);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const weekDay = weeks[d.getDay()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return {
      month,
      day,
      weekDay,
      timeStr: `${hours}:${mins}`,
      raw: d
    };
  } catch {
    return { dateStr: '', timeStr: '', month: 'CAL', day: '—', weekDay: '' };
  }
}

export default function AppleCalendarCard({ card }) {
  if (!card) return null;
  const { action } = card;

  // 1. 日程列表视图 (search_events)
  if (action === 'search') {
    const events = card.events || [];
    return (
      <div className="relative my-2.5 max-w-sm select-none overflow-hidden rounded-2xl bg-neutral-100/60 p-4 font-sans text-neutral-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 dark:bg-neutral-900/60 dark:text-neutral-100 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
        {/* 背景微环境光 */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-[#FF3B30]/10 blur-2xl dark:bg-[#FF453A]/15" />
        
        {/* 标题栏 */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3B30] opacity-75 duration-1000" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3B30] dark:bg-[#FF453A]" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FF3B30] dark:text-[#FF453A]">
              Calendar
            </span>
          </div>
          <span className="text-[11px] tracking-tight text-neutral-400 dark:text-neutral-500">
            {events.length} 个日程
          </span>
        </div>

        {/* 日程项序列 */}
        <div className="divide-y divide-neutral-200/40 dark:divide-neutral-800/60">
          {events.length === 0 ? (
            <p className="py-4 text-center text-xs tracking-wide text-neutral-400">暂无日程安排</p>
          ) : (
            events.map((ev, idx) => {
              const start = formatAppleTime(ev.startTime);
              const end = formatAppleTime(ev.endTime);
              return (
                <div key={ev.id || idx} className="group relative flex items-start space-x-3.5 py-3 transition-colors first:pt-1 last:pb-1">
                  {/* Apple 经典日历日期角标 */}
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 px-2.5 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-md dark:bg-neutral-800/80 dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                    <span className="text-[9px] font-bold tracking-tight text-[#FF3B30] dark:text-[#FF453A]">{start.month}</span>
                    <span className="text-base font-light tracking-tighter text-neutral-900 dark:text-white leading-none pt-0.5">{start.day}</span>
                  </div>

                  {/* 详细信息与微标 */}
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate text-[13px] font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
                      {ev.title}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <div className="flex items-center space-x-1">
                        <Icons.Clock />
                        <span className="font-mono tracking-tighter">
                          {start.timeStr} {end.timeStr ? `– ${end.timeStr}` : ''}
                        </span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center space-x-1 truncate">
                          <Icons.Pin />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                      {ev.attendeesCount > 0 && (
                        <div className="flex items-center space-x-1">
                          <Icons.Users />
                          <span>{ev.attendeesCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 2. 日程创建/更新成功视图 (create_event / update_event)
  if (action === 'create' || action === 'update') {
    const ev = card.event || {};
    const start = formatAppleTime(ev.startTime);
    const end = formatAppleTime(ev.endTime);

    return (
      <div className="relative my-2.5 max-w-sm select-none overflow-hidden rounded-2xl bg-neutral-100/70 p-4 font-sans text-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.03)] backdrop-blur-xl dark:bg-neutral-900/70 dark:text-neutral-100 dark:shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        {/* Apple 状态动效条 */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 dark:bg-emerald-400/15">
              <Icons.Check />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300">
              {card.message}
            </span>
          </div>
          <span className="text-[10px] tracking-widest text-[#FF3B30] uppercase font-bold dark:text-[#FF453A]">
            iCloud
          </span>
        </div>

        {/* 核心日程胶囊 */}
        <div className="flex items-center space-x-3.5 rounded-xl bg-white/75 p-3 shadow-[0_1px_4px_rgba(0,0,0,0.02)] backdrop-blur-md dark:bg-neutral-800/75">
          <div className="flex flex-col items-center justify-center rounded-lg bg-neutral-100/80 px-2.5 py-1 dark:bg-neutral-700/60">
            <span className="text-[8px] font-bold uppercase text-[#FF3B30] dark:text-[#FF453A]">{start.month}</span>
            <span className="text-base font-light tracking-tight text-neutral-800 dark:text-white leading-none">{start.day}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
              {ev.title}
            </div>
            <div className="mt-0.5 flex items-center space-x-2 text-[11px] font-mono text-neutral-400 dark:text-neutral-400">
              <span>{start.weekDay}</span>
              <span>•</span>
              <span>{start.timeStr} {end.timeStr ? `– ${end.timeStr}` : ''}</span>
            </div>
            {ev.location && (
              <div className="mt-1 flex items-center space-x-1 text-[11px] text-neutral-400 dark:text-neutral-400 truncate">
                <Icons.Pin />
                <span className="truncate">{ev.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. 删除事件视图 (delete_event)
  if (action === 'delete') {
    return (
      <div className="relative my-2 max-w-xs select-none rounded-xl bg-neutral-100/50 px-3.5 py-2.5 backdrop-blur-lg dark:bg-neutral-900/50">
        <div className="flex items-center space-x-2.5">
          <Icons.Trash />
          <div className="flex-1 text-[12px] font-medium tracking-tight text-neutral-600 dark:text-neutral-300">
            {card.message}
          </div>
          <span className="text-[9px] uppercase font-bold text-neutral-400">Removed</span>
        </div>
      </div>
    );
  }

  // 4. 日历列表视图 (list_calendars)
  if (action === 'list') {
    return (
      <div className="relative my-2.5 max-w-xs select-none rounded-2xl bg-neutral-100/60 p-3.5 backdrop-blur-xl dark:bg-neutral-900/60">
        <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider mb-2">
          iCloud Calendars
        </div>
        <div className="space-y-1.5">
          {(card.calendars || []).map((c, i) => (
            <div key={i} className="flex items-center space-x-2 text-[12px] text-neutral-700 dark:text-neutral-200">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="truncate font-medium">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

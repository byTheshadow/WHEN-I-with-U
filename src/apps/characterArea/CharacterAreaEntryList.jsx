import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAreaEntries, rollEntryAccess } from './characterAreaEntryService';
import { AREA_UPDATED_EVENT } from './privateAreaSession';

// ============================================================
// 角色专属区域的条目列表（切片 B）。
//
// 用户只能看到每一条的标题和日期。点标题：
//   - 角色同意：展开正文；再点一次收起（收起不掷概率）。
//   - 角色不同意：在这一条下面显示一句拒绝话术，正文不展开。
// 每次点一条"没展开的"，都会重新掷一次概率，没有冷却。展开状态只存在于这个
// 组件里，退出页面再进来就又都是收起的，需要重新点。
// ============================================================

const softBorder = 'color-mix(in srgb, var(--text-main) 14%, transparent)';

const formatEntryDate = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

export default function CharacterAreaEntryList({ chatId, area }) {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openEntryId, setOpenEntryId] = useState(null);
  const [refusal, setRefusal] = useState({ entryId: null, line: '' });
  const [reloadTick, setReloadTick] = useState(0);

  // 角色整理写入新条目后，privateAreaSession.js 会发这个事件，列表自己重新读一次。
  useEffect(() => {
    const handleUpdated = (event) => {
      if (event?.detail?.chatId === chatId) setReloadTick((tick) => tick + 1);
    };

    window.addEventListener(AREA_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(AREA_UPDATED_EVENT, handleUpdated);
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const rows = await getAreaEntries(chatId);
        if (!cancelled) setEntries(rows);
      } catch (error) {
        console.warn('[CharacterAreaEntryList] 读取条目失败：', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
   }, [chatId, area?.id, reloadTick]);

  const handleTapEntry = (entry) => {
    if (openEntryId === entry.id) {
      setOpenEntryId(null);
      return;
    }

    const result = rollEntryAccess(area, { lastRefusalLine: refusal.line });

    if (result.agreed) {
      setOpenEntryId(entry.id);
      setRefusal({ entryId: null, line: '' });
    } else {
      setRefusal({ entryId: entry.id, line: result.refusalLine });
    }
  };

  if (isLoading) return null;

  if (entries.length === 0) {
    return (
      <section
        className="rounded-3xl border px-5 py-6 text-center text-sm"
        style={{
          background: 'var(--card-bg)',
          borderColor: softBorder,
          color: 'var(--text-muted)',
        }}
      >
        这里暂时还是空的，TA 想写的时候会自己放进来。
      </section>
    );
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-3xl border px-3 py-4"
      style={{ background: 'var(--card-bg)', borderColor: softBorder }}
    >
      <div className="px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        目录
      </div>

      {entries.map((entry) => {
        const isOpen = openEntryId === entry.id;
        const isRefused = refusal.entryId === entry.id;

        return (
          <div key={entry.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => handleTapEntry(entry)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:scale-[0.99]"
              style={{ background: isOpen ? 'var(--bg-surface)' : 'transparent' }}
            >
              <span className="flex-1 truncate text-sm font-medium">{entry.title}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatEntryDate(entry.createdAt)}
              </span>
              <ChevronDown
                className="h-4 w-4 transition-transform"
                style={{
                  color: 'var(--text-muted)',
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {isRefused ? (
              <p
                className="animate-fade-in-up px-3 pb-2 text-xs"
                style={{ color: 'var(--text-sub)' }}
              >
                {refusal.line}
              </p>
            ) : null}

            {isOpen ? (
              <div
                className="animate-fade-in-up mx-1 mb-2 whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}
              >
                {entry.aboutWho ? (
                  <div className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    关于：{entry.aboutWho}
                  </div>
                ) : null}
                {entry.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAreaEntries, rollEntryAccess } from './characterAreaEntryService';
import { AREA_UPDATED_EVENT } from './privateAreaSession';
import { CharacterAreaEntryBody, CharacterAreaEntryMark } from './CharacterAreaEntryBody';
import { filterEntriesBySection, getSections } from './characterAreaSections';

// ============================================================
// 角色专属区域的条目列表，带栏目标签页（切片 F3）。取代 CharacterAreaEntryList.jsx。
//
// 区域上方一排标签：第一个固定是"全部"，之后每个栏目一个。点标签只看那个栏目的
// 条目；栏目有自己的排列方式：
//   - 列表：每条一行，跟以前一样
//   - 格子：两列并排的小卡片，只显示标题；点开的那一条会占满一整行
//   - 时间线：左边日期，中间一根竖线加圆点，右边标题
// "全部"这一页永远是列表。没有任何栏目时不显示标签，样子和以前一样。
//
// 点标题的同意/拒绝机制没变：每次点一条没展开的，都按护食程度掷一次；同意就展开
// 正文，不同意就在这条下面显示一句拒绝话术。展开状态只存在于这个组件里，切换标签
// 或退出页面都会收起。
//
// 拆成两层：下面的 SectionedListView 只负责画（所有数据和状态从 props 来，方便
// 单独测试和预览），默认导出的 CharacterAreaSectionedList 负责读数据和掷骰子。
// ============================================================

const softBorder = 'color-mix(in srgb, var(--text-main) 14%, transparent)';
const ACCENT = 'var(--area-accent, var(--text-main))';

const formatEntryDate = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

function SectionTabs({ sections, activeSectionId, onChangeSection }) {
  const tabs = [{ id: '', name: '全部' }, ...sections];

  return (
    <div
      className="flex gap-2 overflow-x-auto px-1 pb-1"
      style={{ scrollbarWidth: 'none' }}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === (activeSectionId || '');

        return (
          <button
            key={tab.id || 'all'}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChangeSection(tab.id)}
            className="shrink-0 rounded-full border px-4 py-1.5 text-xs transition-colors"
            style={{
              color: isActive ? 'var(--bg-main)' : 'var(--text-sub)',
              background: isActive ? 'var(--text-main)' : 'transparent',
              borderColor: isActive ? 'var(--text-main)' : softBorder,
            }}
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}

function EntryDetails({ entry, isOpen, isRefused, refusalLine }) {
  return (
    <>
      {isRefused ? (
        <p className="animate-fade-in-up px-3 pb-2 text-xs" style={{ color: 'var(--text-sub)' }}>
          {refusalLine}
        </p>
      ) : null}

      {isOpen ? (
        <div className="animate-fade-in-up mx-1 mb-2" style={{ color: 'var(--text-main)' }}>
          {entry.aboutWho ? (
            <div className="mb-1 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              关于：{entry.aboutWho}
            </div>
          ) : null}
          <CharacterAreaEntryBody entry={entry} />
        </div>
      ) : null}
    </>
  );
}

// 一行标题（列表和时间线用）。showDate 为 false 时日期交给时间线左边那一列。
function EntryRow({ entry, isOpen, onTap, showDate }) {
  return (
    <button
      type="button"
      onClick={() => onTap(entry)}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors active:scale-[0.99]"
      style={{ background: isOpen ? 'var(--bg-surface)' : 'transparent' }}
    >
      <CharacterAreaEntryMark format={entry.format} />
      <span className="flex-1 truncate text-sm font-medium">{entry.title}</span>
      {showDate ? (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatEntryDate(entry.createdAt)}
        </span>
      ) : null}
      <ChevronDown
        className="h-4 w-4 transition-transform"
        style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none' }}
      />
    </button>
  );
}

// 格子里的一张小卡片：只有标记、标题、日期。
function EntryCard({ entry, isOpen, onTap }) {
  return (
    <button
      type="button"
      onClick={() => onTap(entry)}
      className="flex w-full flex-col gap-2 rounded-2xl border px-3 py-3 text-left transition-transform active:scale-[0.98]"
      style={{
        background: isOpen ? 'var(--bg-surface)' : 'var(--card-bg)',
        borderColor: isOpen ? ACCENT : softBorder,
        minHeight: 78,
      }}
    >
      <span className="flex items-center justify-between gap-2">
        <CharacterAreaEntryMark format={entry.format} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatEntryDate(entry.createdAt)}
        </span>
      </span>
      <span
        className="text-sm font-medium"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {entry.title}
      </span>
    </button>
  );
}

export function SectionedListView({
  area,
  entries,
  activeSectionId,
  onChangeSection,
  openEntryId,
  refusal,
  onTapEntry,
}) {
  const sections = getSections(area);
  const activeSection = sections.find((section) => section.id === activeSectionId) || null;
  const layout = activeSection ? activeSection.layout : 'list';
  const visibleEntries = filterEntriesBySection(entries, activeSection ? activeSection.id : '');

  const renderDetails = (entry) => (
    <EntryDetails
      entry={entry}
      isOpen={openEntryId === entry.id}
      isRefused={refusal.entryId === entry.id}
      refusalLine={refusal.line}
    />
  );

  let content;

  if (visibleEntries.length === 0) {
    content = (
      <p className="px-2 py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {activeSection ? '这一栏暂时还是空的。' : '这里暂时还是空的，TA 想写的时候会自己放进来。'}
      </p>
    );
  } else if (layout === 'grid') {
    content = (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gridAutoFlow: 'row dense',
          gap: 8,
        }}
      >
        {visibleEntries.map((entry) => {
          const isOpen = openEntryId === entry.id;

          return (
            <div
              key={entry.id}
              className="flex flex-col"
              style={isOpen ? { gridColumn: '1 / -1' } : undefined}
            >
              <EntryCard entry={entry} isOpen={isOpen} onTap={onTapEntry} />
              {renderDetails(entry)}
            </div>
          );
        })}
      </div>
    );
  } else if (layout === 'timeline') {
    content = (
      <div className="flex flex-col">
        {visibleEntries.map((entry) => {
          const isOpen = openEntryId === entry.id;

          return (
            <div
              key={entry.id}
              style={{ display: 'grid', gridTemplateColumns: '44px 14px minmax(0, 1fr)', columnGap: 4 }}
            >
              <span
                className="text-right text-xs"
                style={{ paddingTop: 16, color: 'var(--text-muted)' }}
              >
                {formatEntryDate(entry.createdAt)}
              </span>
              <span
                aria-hidden="true"
                style={{ position: 'relative', borderLeft: `1.5px solid ${softBorder}`, marginLeft: 6 }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 18,
                    left: -6,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: isOpen ? ACCENT : 'var(--card-bg)',
                    border: `2px solid ${ACCENT}`,
                  }}
                />
              </span>
              <div className="flex min-w-0 flex-col">
                <EntryRow entry={entry} isOpen={isOpen} onTap={onTapEntry} showDate={false} />
                {renderDetails(entry)}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col">
        {visibleEntries.map((entry) => (
          <div key={entry.id} className="flex flex-col">
            <EntryRow entry={entry} isOpen={openEntryId === entry.id} onTap={onTapEntry} showDate />
            {renderDetails(entry)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-3xl border px-3 py-4"
      style={{ background: 'var(--card-bg)', borderColor: softBorder }}
    >
      {sections.length > 0 ? (
        <SectionTabs
          sections={sections}
          activeSectionId={activeSection ? activeSection.id : ''}
          onChangeSection={onChangeSection}
        />
      ) : (
        <div className="px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          目录
        </div>
      )}

      {activeSection && activeSection.intro ? (
        <div className="px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {activeSection.intro}
        </div>
      ) : null}

      {content}
    </section>
  );
}

export default function CharacterAreaSectionedList({ chatId, area }) {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState('');
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
        console.warn('[CharacterAreaSectionedList] 读取条目失败：', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId, area?.id, reloadTick]);

  const handleChangeSection = (sectionId) => {
    setActiveSectionId(sectionId);
    setOpenEntryId(null);
    setRefusal({ entryId: null, line: '' });
  };

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

  return (
    <SectionedListView
      area={area}
      entries={entries}
      activeSectionId={activeSectionId}
      onChangeSection={handleChangeSection}
      openEntryId={openEntryId}
      refusal={refusal}
      onTapEntry={handleTapEntry}
    />
  );
}
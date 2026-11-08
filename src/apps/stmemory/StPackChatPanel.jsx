// src/apps/stmemory/StPackChatPanel.jsx
//
// 聊天里的"前尘"挂载面板（从聊天设置里的一个按钮打开，全屏）。
// 在这里把往事挂到当前聊天、选定位、开关、排顺序、选范围，并且能一眼看到
// 这些往事一共占用多少上下文。超预算的往事不会被注入，也不会被悄悄截断，
// 这里会明确标出来，由用户自己改成只带概览、缩小范围或调高预算。
//
// 本聊天的挂载数据存在 chats.stPackLinks / chats.stPackBudgetTokens（无索引字段）。
// 面板内部自己持有一份 links 状态，改完立刻写库，再通知外层重新拉取 chat。
//
// 这一版只换了外观和文案（冰下），逻辑全部沿用：概览注入模式（injectMode）、钉住原文
// （pinnedRange，上限 PINNED_MAX_TOKENS）、按总结条目或原文块选范围、预算计划都没有改。
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import QianchenBackdrop from './QianchenBackdrop';
import Snowflake, { litArmsFor, pickArm } from './Snowflake';
import {
  FRAMING_OPTIONS,
  INJECT_MODE_FULL,
  INJECT_MODE_OVERVIEW,
  PINNED_MAX_TOKENS,
  SOURCE_TYPE_ST_JSONL,
} from './stPackConstants';
import {
  getDefaultInjectMode,
  getInjectMode,
  getLinkTokens,
  getSummaryEntries,
  hasSummaryEntries,
  inspectPinnedRange,
  isOverviewLinkEmpty,
  normalizeRange,
  planStPackInjection,
} from './stPackBudget';
import {
  getChatBudget,
  getChatLinks,
  makeLink,
  renumberLinks,
  saveChatBudget,
  saveChatLinks,
} from './stPackLinkService';
import { getSummaryProgress } from './stPackProgress';
import { getAllPacks } from './stPackService';
import { loadSummarySettings } from './stSummaryConfig';

const STATUS_LABELS = {
  included: '会被注入',
  disabled: '已关闭',
  over_budget: '超出预算，不会注入',
  missing: '往事已不存在',
};

const ChevronDown = ({ open }) => (
  <svg
    className="ico mute"
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={open ? { transform: 'rotate(180deg)' } : undefined}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// 概览模式下的"翻阅原文"：钉住一段原文块，之后每条消息都会带上，直到取消。
// 块下标在界面上从 1 开始数，库里存 0 开始的下标。
const PinnedRangeEditor = ({ pack, link, onSave }) => {
  const chunkCount = Number(pack.chunkCount) || 0;
  const saved = link.pinnedRange ? inspectPinnedRange(pack, link.pinnedRange) : null;

  const [fromText, setFromText] = useState(saved?.range ? String(saved.range.from + 1) : '');
  const [toText, setToText] = useState(saved?.range ? String(saved.range.to + 1) : '');

  if (chunkCount <= 0) {
    return <p className="mute" style={{ margin: 0, fontSize: 11 }}>这片往事没有原文块，无法翻阅原文。</p>;
  }

  const from = Number.parseInt(fromText, 10);
  const to = Number.parseInt(toText, 10);
  const validNumbers = Number.isFinite(from) && Number.isFinite(to)
    && from >= 1 && to >= 1 && from <= chunkCount && to <= chunkCount && from <= to;
  const draft = validNumbers ? inspectPinnedRange(pack, { from: from - 1, to: to - 1 }) : null;

  let message = '';
  if (fromText || toText) {
    if (!validNumbers) message = `请填 1 到 ${chunkCount} 之间的块号，起点不能大于终点。`;
    else if (!draft.ok) message = `这一段估算 ${draft.tokens.toLocaleString()} token，超过上限 ${PINNED_MAX_TOKENS.toLocaleString()}，请缩小范围。`;
    else message = `这一段估算 ${draft.tokens.toLocaleString()} token（上限 ${PINNED_MAX_TOKENS.toLocaleString()}）。`;
  }
  const messageIsError = Boolean(message) && !(validNumbers && draft?.ok);

  // 预览条：优先显示正在输入的这一段，没有就显示已钉住的
  const previewTokens = draft?.ok ? draft.tokens : (saved?.ok ? saved.tokens : 0);
  const previewPercent = Math.min(100, Math.round((previewTokens / PINNED_MAX_TOKENS) * 100));

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 4 }}>翻阅原文（共 {chunkCount} 块）</div>
      <p className="mute" style={{ margin: '0 0 10px', fontSize: 12 }}>
        需要某段细节时，钉住那一段原文，角色之后每条回复都能看到它，直到你取消翻阅。注入的是原文，不是总结。
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="mute">第</span>
        <label className="vh" htmlFor={`st-pin-from-${link.packId}`}>起始块</label>
        <input
          id={`st-pin-from-${link.packId}`}
          className="inp blk-inp"
          type="number"
          min="1"
          max={chunkCount}
          value={fromText}
          onChange={(e) => setFromText(e.target.value)}
        />
        <span className="mute">块 到 第</span>
        <label className="vh" htmlFor={`st-pin-to-${link.packId}`}>结束块</label>
        <input
          id={`st-pin-to-${link.packId}`}
          className="inp blk-inp"
          type="number"
          min="1"
          max={chunkCount}
          value={toText}
          onChange={(e) => setToText(e.target.value)}
        />
        <span className="mute">块</span>
        <button
          type="button"
          className="btn btn-pri"
          style={{ marginLeft: 'auto', flex: 'none' }}
          disabled={!draft?.ok}
          onClick={() => onSave({ from: from - 1, to: to - 1 })}
        >
          钉住
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div
          className="bar"
          role="img"
          aria-label={`钉住的原文 ${previewTokens.toLocaleString()}，上限 ${PINNED_MAX_TOKENS.toLocaleString()}`}
        >
          <i style={{ width: `${previewPercent}%` }} />
        </div>
        <div className="mute" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
          <span>这一段估算 {previewTokens.toLocaleString()} token</span>
          <span>上限 {PINNED_MAX_TOKENS.toLocaleString()}</span>
        </div>
      </div>

      {message && (
        <p
          role={messageIsError ? 'alert' : undefined}
          style={{ margin: '8px 0 0', fontSize: 11, color: messageIsError ? 'var(--bad)' : 'var(--sub)', fontWeight: messageIsError ? 700 : 400 }}
        >
          {message}
        </p>
      )}

      {link.pinnedRange && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            background: saved?.ok ? 'var(--okbg)' : 'var(--warnbg)',
            color: saved?.ok ? 'var(--ok)' : 'var(--bad)',
          }}
        >
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
          </svg>
          <span style={{ flex: 1, fontWeight: 700 }}>
            {saved?.ok
              ? `正在翻阅第 ${saved.range.from + 1}–${saved.range.to + 1} 块`
              : '之前钉住的范围已超出上限或失效，目前不会注入。'}
          </span>
          <button
            type="button"
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid currentColor', background: 'none', fontWeight: 700, color: 'inherit', flex: 'none' }}
            onClick={() => {
              setFromText('');
              setToText('');
              onSave(null);
            }}
          >
            取消翻阅
          </button>
        </div>
      )}
    </div>
  );
};

const StPackChatPanel = ({ chat, onClose, onUpdated }) => {
  const [packs, setPacks] = useState([]);
  const [links, setLinks] = useState(() => renumberLinks(getChatLinks(chat)));
  const [budget, setBudget] = useState(() => getChatBudget(chat));
  const [batchMessages, setBatchMessages] = useState(0); // 只用来算雪花亮几条臂
  const [editingBudget, setEditingBudget] = useState(false);
  const [framingOpen, setFramingOpen] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    getAllPacks().then((rows) => {
      if (!cancelled) setPacks(rows);
    });
    loadSummarySettings().then((settings) => {
      if (!cancelled) setBatchMessages(settings.batchMessages);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const packsById = useMemo(() => {
    const map = {};
    packs.forEach((pack) => {
      map[pack.id] = pack;
    });
    return map;
  }, [packs]);

  const plan = useMemo(
    () => planStPackInjection({ links, packsById, budget }),
    [links, packsById, budget],
  );

  const mountedIds = useMemo(() => new Set(links.map((link) => link.packId)), [links]);
  const availablePacks = packs.filter((pack) => !mountedIds.has(pack.id));

  const commitLinks = async (nextLinks) => {
    const normalized = renumberLinks(nextLinks);
    setLinks(normalized);
    await saveChatLinks(chat.id, normalized);
    onUpdated?.({ stPackLinks: normalized });
  };

  const patchLink = (packId, patch) => (
    commitLinks(links.map((link) => (link.packId === packId ? { ...link, ...patch } : link)))
  );

  // 新挂载的默认模式：有总结条目的往事默认只带概览，没有就沿用原文。
  const handleMount = (packId) => commitLinks([
    ...links,
    makeLink(packId, links.length, getDefaultInjectMode(packsById[packId])),
  ]);

  const handleRemove = (packId) => commitLinks(links.filter((link) => link.packId !== packId));

  const handleMove = (packId, direction) => {
    const sorted = renumberLinks(links);
    const index = sorted.findIndex((link) => link.packId === packId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    [next[index], next[target]] = [next[target], next[index]];
    return commitLinks(next);
  };

  // 往事里有总结条目时，范围按条目选（存 entryRange）；否则按原文块选（存 range）。
  const handleRangeCommit = (link, pack, rawFrom, rawTo) => {
    const useSummary = hasSummaryEntries(pack);
    const count = useSummary ? getSummaryEntries(pack).length : pack.chunkCount;
    const from = Number.parseInt(rawFrom, 10);
    const to = Number.parseInt(rawTo, 10);
    const last = count - 1;

    // 界面上是从 1 开始数的，库里存的是 0 开始的下标。
    const normalized = normalizeRange(
      {
        from: Number.isFinite(from) ? from - 1 : 0,
        to: Number.isFinite(to) ? to - 1 : last,
      },
      count,
    );

    const isWhole = !normalized || (normalized.from === 0 && normalized.to === last);
    return patchLink(link.packId, { [useSummary ? 'entryRange' : 'range']: isWhole ? null : normalized });
  };

  const handleBudgetCommit = async (input) => {
    const value = Number.parseInt(input.value, 10);
    if (!Number.isFinite(value) || value <= 0) {
      // 输入不合法：把输入框恢复成当前生效的预算。
      input.value = String(budget);
      return;
    }
    setBudget(value);
    await saveChatBudget(chat.id, value);
    onUpdated?.({ stPackBudgetTokens: value });
  };

  const toggleFraming = (packId) => {
    setFramingOpen((current) => {
      const next = new Set(current);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  // "缩小总结范围"：范围输入框就在这张卡片里，直接带到那里。
  const focusRange = (packId) => {
    const el = document.getElementById(`st-range-from-${packId}`);
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  };

  const usedPercent = Math.min(100, Math.round((plan.usedTokens / Math.max(budget, 1)) * 100));
  const remaining = Math.max(0, budget - plan.usedTokens);
  const includedItems = plan.items.filter((item) => item.status === 'included');

  return createPortal(
    <QianchenBackdrop label="前尘 · 挂载" zIndex={90}>
      <div className="qc-scroll">
        <div className="qc-col">
          <div className="top">
            <h1
              className="serif"
              style={{ margin: 0, paddingLeft: 8, fontSize: 28, fontWeight: 300, letterSpacing: '.36em', textShadow: '0 0 18px var(--glow)' }}
            >
              前尘
            </h1>
            <button
              type="button"
              className="iconbtn"
              aria-label="关闭"
              onClick={onClose}
            >
              <svg className="ico" style={{ width: 20, height: 20 }} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mute" style={{ margin: '0 20px 18px', position: 'relative' }}>
            把导入的往事挂到这个聊天，角色就会知道这些事。
          </p>

          {/* 主角：预算 */}
          <section className="qc-budget" aria-label="预算">
            <div className="bloom" aria-hidden="true" />
            <div className="mute" style={{ fontSize: 12 }}>这个聊天里前尘占用（估算）</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                <span
                  className="serif"
                  style={{ fontSize: 64, fontWeight: 300, lineHeight: 1.1, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 24px var(--glow)' }}
                >
                  {plan.usedTokens.toLocaleString()}
                </span>
                <span className="mute" style={{ fontSize: 14 }}>/ {budget.toLocaleString()} token</span>
              </div>
              <button
                type="button"
                className="btn btn-out"
                style={{ fontSize: 12, marginBottom: 8, flex: 'none' }}
                aria-expanded={editingBudget}
                onClick={() => setEditingBudget((value) => !value)}
              >
                调预算
              </button>
            </div>

            {editingBudget && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <label htmlFor="st-budget-input" className="mute">预算（估算 token）</label>
                <input
                  id="st-budget-input"
                  key={budget}
                  className="inp"
                  style={{ width: 120, textAlign: 'right' }}
                  type="number"
                  min="1"
                  defaultValue={budget}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  onBlur={(e) => {
                    void handleBudgetCommit(e.target);
                    setEditingBudget(false);
                  }}
                />
              </div>
            )}

            <div
              className="bar"
              style={{ margin: '10px 0 8px' }}
              role="img"
              aria-label={`已占用 ${usedPercent}%`}
            >
              <i style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="mute" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {includedItems.length > 0
                  ? includedItems.map((item) => `${item.pack.title}　${item.tokens.toLocaleString()}`).join(' · ')
                  : '还没有往事被注入'}
              </span>
              <span style={{ flex: 'none' }}>还剩 {remaining.toLocaleString()}</span>
            </div>

            {plan.overBudgetCount > 0 && (
              <div
                role="alert"
                style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, padding: '10px 12px', borderRadius: 14, background: 'var(--warnbg)', color: 'var(--bad)', fontWeight: 700, fontSize: 12 }}
              >
                <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                </svg>
                有 {plan.overBudgetCount} 片往事超出预算，目前不会注入
              </div>
            )}
            <p className="mute" style={{ margin: '8px 0 0', fontSize: 11 }}>
              只统计前尘，不含聊天本身和其他提示词。token 是粗略估算，不同模型的分词不一样，只用来判断大概的量级。
            </p>
          </section>

          <div className="qc-panel">
            {/* 已挂载 */}
            {plan.items.length === 0 && (
              <p className="mute" style={{ margin: 0, padding: '12px 0', textAlign: 'center' }}>
                这个聊天还没有挂载往事
              </p>
            )}

            {plan.items.map((item, index) => {
              const { link, pack, tokens, status } = item;
              const useSummary = pack ? hasSummaryEntries(pack) : false;
              const unitCount = pack ? (useSummary ? getSummaryEntries(pack).length : pack.chunkCount) : 0;
              const unitName = useSummary ? '条' : '块';
              const rawRange = useSummary ? link.entryRange : link.range;
              const range = pack ? normalizeRange(rawRange, unitCount) : null;
              const overviewMode = pack ? getInjectMode(link) === INJECT_MODE_OVERVIEW : false;
              const overviewEmpty = pack ? isOverviewLinkEmpty(pack, link) : false;
              const framingIsOpen = framingOpen.has(link.packId);
              const framingLabel = FRAMING_OPTIONS.find((option) => option.id === link.framing)?.label || '';
              const title = pack ? pack.title : '（已删除的往事）';

              const isJsonl = pack?.sourceType === SOURCE_TYPE_ST_JSONL;
              const progress = pack && isJsonl && batchMessages > 0
                ? getSummaryProgress(pack, batchMessages)
                : null;
              const lit = progress ? litArmsFor(progress.done, progress.total) : 0;

              // 两种带法各自要多少（估算），写在选项的说明里
              const fullTokens = pack ? getLinkTokens(pack, { ...link, injectMode: INJECT_MODE_FULL }) : 0;
              const overviewTokens = pack ? getLinkTokens(pack, { ...link, injectMode: INJECT_MODE_OVERVIEW }) : 0;
              const selectedCount = range ? range.to - range.from + 1 : 0;

              const chipClass = status === 'included'
                ? 'chip chip-ok'
                : status === 'disabled' ? 'chip' : 'chip chip-bad';

              return (
                <section
                  key={link.packId}
                  className="glass"
                  style={{
                    padding: '16px 16px 16px',
                    borderColor: status === 'over_budget' ? 'var(--bad)' : undefined,
                    opacity: status === 'disabled' ? 0.75 : 1,
                  }}
                  aria-label={title}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Snowflake
                      size={64}
                      arm={pack && isJsonl ? pickArm(pack.id) : 'c'}
                      lit={lit}
                      deep={!pack || !isJsonl}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="serif" style={{ fontSize: 20, fontWeight: 400, letterSpacing: '.06em', overflowWrap: 'anywhere' }}>
                        {title}
                      </div>
                      <span className={chipClass} style={{ marginTop: 4 }}>
                        {STATUS_LABELS[status]}
                        {pack ? ` · 估算 ${tokens.toLocaleString()}` : ''}
                      </span>
                    </div>
                    {pack && (
                      <button
                        type="button"
                        className="swb"
                        role="switch"
                        aria-checked={link.enabled}
                        aria-label={`${title} ${link.enabled ? '已开启' : '已关闭'}`}
                        onClick={() => void patchLink(link.packId, { enabled: !link.enabled })}
                      >
                        <span className={`sw${link.enabled ? ' sw-on' : ''}`} />
                      </button>
                    )}
                  </div>

                  {pack && status === 'over_budget' && (
                    <div style={{ marginTop: 12 }}>
                      <p className="mute" style={{ margin: '0 0 8px', fontSize: 12 }}>
                        加上它会超出 {budget.toLocaleString()}。可以这样处理：
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {!overviewMode && (
                          <button
                            type="button"
                            className="btn btn-pri"
                            style={{ justifyContent: 'space-between' }}
                            onClick={() => void patchLink(link.packId, { injectMode: INJECT_MODE_OVERVIEW })}
                          >
                            <span>改成「只带概览」</span>
                            <span style={{ fontWeight: 500, opacity: 0.85 }}>约 {overviewTokens.toLocaleString()}</span>
                          </button>
                        )}
                        {!overviewMode && (
                          <button
                            type="button"
                            className="btn btn-out"
                            style={{ justifyContent: 'space-between' }}
                            onClick={() => focusRange(link.packId)}
                          >
                            <span>缩小{useSummary ? '总结' : '原文'}范围</span>
                            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                          </button>
                        )}
                        {overviewMode && (
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--bad)', fontWeight: 700 }}>
                            概览加上钉住的原文已经超出预算。可以取消翻阅，或在上面调高预算。
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {pack && (
                    <>
                      <div className="sec" style={{ marginTop: 14 }}>
                        <div className="lbl" style={{ marginBottom: 8 }}>注入内容</div>
                        <div className="mode">
                          {[
                            {
                              id: INJECT_MODE_FULL,
                              label: useSummary ? '总结全文' : '原文',
                              hint: useSummary
                                ? `带上 ${selectedCount} 条总结，约 ${fullTokens.toLocaleString()}`
                                : `带上 ${selectedCount} 块原文，约 ${fullTokens.toLocaleString()}`,
                            },
                            {
                              id: INJECT_MODE_OVERVIEW,
                              label: '只带概览',
                              hint: `只带概览和说明，约 ${overviewTokens.toLocaleString()}`,
                            },
                          ].map((option) => {
                            const active = getInjectMode(link) === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  if (!active) void patchLink(link.packId, { injectMode: option.id });
                                }}
                              >
                                <b>{option.label}</b>
                                <span>{option.hint}</span>
                              </button>
                            );
                          })}
                        </div>
                        {overviewMode && (
                          <p className="mute" style={{ margin: '8px 0 0', fontSize: 11 }}>
                            只带概览时，总结和原文都不会自动注入，角色只知道概览里写的脉络。概览可以在「前尘」里编辑。
                          </p>
                        )}
                        {overviewEmpty && (
                          <p role="alert" style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 700, color: 'var(--bad)' }}>
                            这片往事的概览是空的，又没有钉住原文，目前不会注入任何内容。请先写一段概览，或钉住一段原文。
                          </p>
                        )}
                      </div>

                      {overviewMode ? (
                        <div className="sec">
                          <PinnedRangeEditor
                            key={`pin-${link.packId}`}
                            pack={pack}
                            link={link}
                            onSave={(pinnedRange) => void patchLink(link.packId, { pinnedRange })}
                          />
                        </div>
                      ) : (
                        <div className="sec">
                          <div className="lbl" style={{ marginBottom: 4 }}>
                            范围（共 {unitCount} {unitName}{useSummary ? '总结' : ''}）
                          </div>
                          {useSummary && (
                            <p className="mute" style={{ margin: '0 0 8px', fontSize: 11 }}>
                              这片往事有总结条目，注入的是总结，不是原文。
                            </p>
                          )}
                          <div
                            key={`range-${link.packId}-${useSummary}-${range?.from}-${range?.to}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                          >
                            <span className="mute">第</span>
                            <label className="vh" htmlFor={`st-range-from-${link.packId}`}>起始</label>
                            <input
                              id={`st-range-from-${link.packId}`}
                              className="inp blk-inp"
                              type="number"
                              min="1"
                              max={unitCount}
                              defaultValue={range ? range.from + 1 : 1}
                              onBlur={(e) => {
                                const toEl = document.getElementById(`st-range-to-${link.packId}`);
                                void handleRangeCommit(link, pack, e.target.value, toEl?.value);
                              }}
                            />
                            <span className="mute">{unitName} 到 第</span>
                            <label className="vh" htmlFor={`st-range-to-${link.packId}`}>结束</label>
                            <input
                              id={`st-range-to-${link.packId}`}
                              className="inp blk-inp"
                              type="number"
                              min="1"
                              max={unitCount}
                              defaultValue={range ? range.to + 1 : unitCount}
                              onBlur={(e) => {
                                const fromEl = document.getElementById(`st-range-from-${link.packId}`);
                                void handleRangeCommit(link, pack, fromEl?.value, e.target.value);
                              }}
                            />
                            <span className="mute">{unitName}</span>
                            {rawRange && (
                              <button
                                type="button"
                                className="btn btn-out"
                                style={{ marginLeft: 'auto', fontSize: 12 }}
                                onClick={() => void patchLink(link.packId, { [useSummary ? 'entryRange' : 'range']: null })}
                              >
                                用全部
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="sec">
                        <button
                          type="button"
                          style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                          aria-expanded={framingIsOpen}
                          aria-controls={`st-framing-${link.packId}`}
                          onClick={() => toggleFraming(link.packId)}
                        >
                          <span style={{ flex: 1 }}>
                            <b>定位与补充说明</b>　<span className="mute">{framingLabel}</span>
                          </span>
                          <ChevronDown open={framingIsOpen} />
                        </button>
                        {framingIsOpen && (
                          <div id={`st-framing-${link.packId}`} style={{ marginTop: 8 }}>
                            <div className="mode">
                              {FRAMING_OPTIONS.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  aria-pressed={link.framing === option.id}
                                  onClick={() => void patchLink(link.packId, { framing: option.id })}
                                >
                                  <b>{option.label}</b>
                                  <span>{option.hint}</span>
                                </button>
                              ))}
                            </div>
                            <label className="vh" htmlFor={`st-note-${link.packId}`}>这次挂载的补充说明</label>
                            <textarea
                              id={`st-note-${link.packId}`}
                              key={`note-${link.packId}`}
                              className="ta"
                              style={{ minHeight: 72, marginTop: 8 }}
                              defaultValue={link.framingText || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (link.framingText || '')) {
                                  void patchLink(link.packId, { framingText: e.target.value });
                                }
                              }}
                              placeholder="这次挂载的补充说明（可选），会接在定位说明后面"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="sec" style={{ display: 'flex', gap: 8, paddingBottom: 0 }}>
                    <button
                      type="button"
                      className="btn btn-out"
                      style={{ flex: 1, fontSize: 12 }}
                      disabled={index === 0}
                      onClick={() => void handleMove(link.packId, -1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="btn btn-out"
                      style={{ flex: 1, fontSize: 12 }}
                      disabled={index === plan.items.length - 1}
                      onClick={() => void handleMove(link.packId, 1)}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="btn btn-out btn-danger"
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => void handleRemove(link.packId)}
                    >
                      移除挂载
                    </button>
                  </div>
                </section>
              );
            })}

            {/* 往事库：可以挂载的 */}
            <section style={{ marginTop: 4 }}>
              <div className="lbl" style={{ margin: '0 4px 10px' }}>往事库</div>
              {packs.length === 0 ? (
                <p className="mute" style={{ margin: '0 4px' }}>
                  库里还没有往事。先到首页的「前尘」导入一份。
                </p>
              ) : availablePacks.length === 0 ? (
                <p className="mute" style={{ margin: '0 4px' }}>库里的往事都已经挂在这个聊天上了。</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {availablePacks.map((pack) => {
                    const isJsonl = pack.sourceType === SOURCE_TYPE_ST_JSONL;
                    const progress = isJsonl && batchMessages > 0 ? getSummaryProgress(pack, batchMessages) : null;
                    return (
                      <div
                        key={pack.id}
                        className="glass"
                        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'none' }}
                      >
                        <Snowflake
                          size={44}
                          arm={isJsonl ? pickArm(pack.id) : 'c'}
                          lit={progress ? litArmsFor(progress.done, progress.total) : 0}
                          deep={!isJsonl}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{pack.title}</div>
                          <div className="mute" style={{ fontSize: 12 }}>
                            {isJsonl ? 'ST 聊天' : '文本'} · {pack.chunkCount} 块 · 估算 {(pack.tokenEstimate || 0).toLocaleString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-out"
                          style={{ gap: 6, flex: 'none' }}
                          onClick={() => void handleMount(pack.id)}
                        >
                          <svg className="ico" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 5v14" /><path d="M5 12h14" />
                          </svg>
                          挂载
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </QianchenBackdrop>,
    document.body,
  );
};

export default StPackChatPanel;
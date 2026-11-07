// src/apps/stmemory/StPackChatPanel.jsx
//
// 聊天里的"剧情记忆包"管理面板（从聊天设置里的一个按钮打开，全屏）。
// 在这里把记忆包挂到当前聊天、选定位、开关、排顺序、选范围，并且能一眼看到
// 这些包一共占用多少上下文。超预算的包不会被注入，也不会被悄悄截断，
// 这里会明确标出来，由用户自己缩小范围或调高预算。
//
// 本聊天的挂载数据存在 chats.stPackLinks / chats.stPackBudgetTokens（无索引字段）。
// 面板内部自己持有一份 links 状态，改完立刻写库，再通知外层重新拉取 chat。
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Library, Plus, Trash2, X } from 'lucide-react';

import { FRAMING_OPTIONS } from './stPackConstants';
import {
  getSummaryEntries,
  hasSummaryEntries,
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
import { getAllPacks } from './stPackService';

const STATUS_LABELS = {
  included: '会被注入',
  disabled: '已关闭',
  over_budget: '超出预算，不会注入',
  missing: '记忆包已不存在',
};

const fieldStyle = {
  background: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const StPackChatPanel = ({ chat, onClose, onUpdated }) => {
  const [packs, setPacks] = useState([]);
  const [links, setLinks] = useState(() => renumberLinks(getChatLinks(chat)));
  const [budget, setBudget] = useState(() => getChatBudget(chat));

  useEffect(() => {
    let cancelled = false;
    getAllPacks().then((rows) => {
      if (!cancelled) setPacks(rows);
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

  const handleMount = (packId) => commitLinks([...links, makeLink(packId, links.length)]);

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

  // 包里有总结条目时，范围按条目选（存 entryRange）；否则按原文块选（存 range）。
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

  const usedPercent = Math.min(100, Math.round((plan.usedTokens / Math.max(budget, 1)) * 100));

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
        <h2 className="font-serif text-base font-bold">剧情记忆包</h2>
        <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-16 text-xs">
        <p className="leading-relaxed opacity-60">
          把导入的剧情记录挂到这个聊天里，角色就会知道这些事。每个包可以单独设定位、开关、顺序和范围；关掉的包从下一条消息起就不再注入。
        </p>

        {/* 总占用与预算 */}
        <div
          className="space-y-2 rounded-2xl border p-3.5"
          style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              已占用 {plan.usedTokens.toLocaleString()} / {budget.toLocaleString()} token（估算）
            </span>
            <label className="flex items-center gap-1.5">
              <span className="opacity-60">预算</span>
              <input
                key={budget}
                type="number"
                min="1"
                defaultValue={budget}
                onBlur={(e) => void handleBudgetCommit(e.target)}
                className="w-20 rounded-lg border px-2 py-1 text-right outline-none"
                style={fieldStyle}
              />
            </label>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--divider)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${usedPercent}%`, background: 'var(--accent-color)' }}
            />
          </div>
          {plan.overBudgetCount > 0 && (
            <p className="font-semibold text-rose-500">
              有 {plan.overBudgetCount} 个包超出预算，目前不会被注入。请缩小它的范围，或调高预算。
            </p>
          )}
          <p className="text-[10px] opacity-50">
            token 是粗略估算，不同模型的分词不一样，只用来判断大概的量级。这个占用只算记忆包，不含聊天本身和其他提示词。
          </p>
        </div>

        {/* 已挂载 */}
        {plan.items.length === 0 ? (
          <p className="py-6 text-center opacity-50">这个聊天还没有挂载记忆包</p>
        ) : (
          plan.items.map((item, index) => {
            const { link, pack, tokens, status } = item;
            const useSummary = pack ? hasSummaryEntries(pack) : false;
            const unitCount = pack ? (useSummary ? getSummaryEntries(pack).length : pack.chunkCount) : 0;
            const unitName = useSummary ? '条' : '块';
            const rawRange = useSummary ? link.entryRange : link.range;
            const range = pack ? normalizeRange(rawRange, unitCount) : null;

            return (
              <div
                key={link.packId}
                className="space-y-2.5 rounded-2xl border p-3.5"
                style={{
                  background: 'var(--card-bg)',
                  borderColor: status === 'over_budget' ? '#f43f5e' : 'var(--card-border)',
                  opacity: status === 'disabled' ? 0.65 : 1,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">
                      {pack ? pack.title : '（已删除的记忆包）'}
                    </h3>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: status === 'over_budget' ? '#f43f5e' : undefined, opacity: status === 'over_budget' ? 1 : 0.6 }}
                    >
                      {STATUS_LABELS[status]}
                      {pack ? ` / 估算 ${tokens.toLocaleString()} token` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="上移"
                    disabled={index === 0}
                    onClick={() => void handleMove(link.packId, -1)}
                    className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="下移"
                    disabled={index === plan.items.length - 1}
                    onClick={() => void handleMove(link.packId, 1)}
                    className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="取消挂载"
                    onClick={() => void handleRemove(link.packId)}
                    className="p-1 opacity-50 hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {pack && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">注入到这个聊天</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={link.enabled}
                        onClick={() => void patchLink(link.packId, { enabled: !link.enabled })}
                        className="relative h-5 w-9 rounded-full transition-colors"
                        style={{ background: link.enabled ? 'var(--accent-color)' : 'var(--divider)' }}
                      >
                        <span
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                          style={{ left: link.enabled ? '18px' : '2px' }}
                        />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold">定位</span>
                      <div className="grid grid-cols-2 gap-2">
                        {FRAMING_OPTIONS.map((option) => {
                          const active = link.framing === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => void patchLink(link.packId, { framing: option.id })}
                              className="rounded-xl border px-2 py-2 text-left"
                              style={{
                                ...fieldStyle,
                                borderColor: active ? 'var(--accent-color)' : 'var(--card-border)',
                                outline: active ? '1px solid var(--accent-color)' : 'none',
                              }}
                            >
                              <div className="font-semibold">{option.label}</div>
                              <div className="text-[10px] opacity-60">{option.hint}</div>
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        key={`note-${link.packId}`}
                        defaultValue={link.framingText || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (link.framingText || '')) {
                            void patchLink(link.packId, { framingText: e.target.value });
                          }
                        }}
                        placeholder="这次挂载的补充说明（可选），会接在定位说明后面"
                        className="min-h-[52px] w-full resize-y rounded-xl border px-3 py-2 outline-none"
                        style={fieldStyle}
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold">
                        范围（共 {unitCount} {unitName}{useSummary ? '总结' : ''}）
                      </span>
                      {useSummary && (
                        <p className="text-[10px] opacity-50">
                          这个包有总结条目，注入的是总结，不是原文。
                        </p>
                      )}
                      <div
                        key={`range-${link.packId}-${useSummary}-${range?.from}-${range?.to}`}
                        className="flex items-center gap-1.5"
                      >
                        <span className="opacity-60">第</span>
                        <input
                          id={`st-range-from-${link.packId}`}
                          type="number"
                          min="1"
                          max={unitCount}
                          defaultValue={range ? range.from + 1 : 1}
                          onBlur={(e) => {
                            const toEl = document.getElementById(`st-range-to-${link.packId}`);
                            void handleRangeCommit(link, pack, e.target.value, toEl?.value);
                          }}
                          className="w-16 rounded-lg border px-2 py-1 text-center outline-none"
                          style={fieldStyle}
                        />
                        <span className="opacity-60">{unitName} 到 第</span>
                        <input
                          id={`st-range-to-${link.packId}`}
                          type="number"
                          min="1"
                          max={unitCount}
                          defaultValue={range ? range.to + 1 : unitCount}
                          onBlur={(e) => {
                            const fromEl = document.getElementById(`st-range-from-${link.packId}`);
                            void handleRangeCommit(link, pack, fromEl?.value, e.target.value);
                          }}
                          className="w-16 rounded-lg border px-2 py-1 text-center outline-none"
                          style={fieldStyle}
                        />
                        <span className="opacity-60">{unitName}</span>
                        {rawRange && (
                          <button
                            type="button"
                            onClick={() => void patchLink(link.packId, { [useSummary ? 'entryRange' : 'range']: null })}
                            className="ml-auto rounded-lg border px-2 py-1"
                            style={fieldStyle}
                          >
                            用全部
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}

        {/* 可挂载的包 */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Library className="h-3.5 w-3.5" /> 记忆包库
          </h3>
          {packs.length === 0 ? (
            <p className="opacity-55">
              库里还没有记忆包。先到首页的「记忆包」应用导入一份。
            </p>
          ) : availablePacks.length === 0 ? (
            <p className="opacity-55">库里的包都已经挂在这个聊天上了。</p>
          ) : (
            availablePacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{pack.title}</div>
                  <div className="text-[11px] opacity-55">
                    {pack.chunkCount} 块 / 估算 {(pack.tokenEstimate || 0).toLocaleString()} token
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleMount(pack.id)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  <Plus className="h-3.5 w-3.5" /> 挂载
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default StPackChatPanel;
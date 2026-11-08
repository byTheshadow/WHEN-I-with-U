// src/apps/stmemory/StSummaryEntriesEditor.jsx
//
// 往事详情「总结」标签里的"总结条目"区：每条总结独立显示、独立编辑、独立删除，
// 也可以手写加一条。改动立刻写库（不跟详情页的"保存"按钮绑在一起）。
//
// 最新的在最上面，默认只露出最新三条，其余点"展开更早的"。
// 删除用"点两下"的行内确认（第一下变成"再点一次确认删除"），不弹窗。
import React, { useState } from 'react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import { estimateTokens } from './stPackBudget';
import { getPack } from './stPackService';
import {
  addSummaryEntry,
  deleteSummaryEntry,
  updateSummaryEntryText,
} from './stSummaryService';

const VISIBLE_COUNT = 3;

const PencilIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
);

const StSummaryEntriesEditor = ({ packId, entries, onEntriesChange }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newText, setNewText] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (task, failTitle) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await task();
      if (Array.isArray(next)) onEntriesChange(next);
    } catch (error) {
      console.error('[stmemory] 总结条目操作失败：', error);
      triggerGlobalToast({ title: failTitle, content: error?.message || '请稍后再试。' });
    } finally {
      setBusy(false);
    }
  };

  const handleBlur = (entry, value) => {
    if (value.trim() === String(entry.text || '').trim()) return;
    void run(() => updateSummaryEntryText(packId, entry.id, value), '保存失败');
  };

  const handleDelete = (entry) => {
    if (confirmingId !== entry.id) {
      setConfirmingId(entry.id);
      return;
    }
    setConfirmingId(null);
    void run(() => deleteSummaryEntry(packId, entry.id), '删除失败');
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    void run(async () => {
      await addSummaryEntry(packId, { text: newText });
      setNewText('');
      setShowAdd(false);
      // 重新读一遍最新的条目列表，交给外层。
      const pack = await getPack(packId);
      return Array.isArray(pack?.summaryEntries) ? pack.summaryEntries : [];
    }, '添加失败');
  };

  // 最新的在最上面；序号仍然是它在时间线上的第几条。
  const ordered = entries.map((entry, index) => ({ entry, number: index + 1 })).reverse();
  const shown = showAll ? ordered : ordered.slice(0, VISIBLE_COUNT);
  const hiddenCount = ordered.length - shown.length;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="lbl">总结条目　{entries.length}</span>
        <button
          type="button"
          className="btn btn-out"
          style={{ padding: '0 14px', fontSize: 12 }}
          aria-expanded={showAdd}
          onClick={() => setShowAdd((value) => !value)}
        >
          <svg className="ico" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          手写一条
        </button>
      </div>

      {showAdd && (
        <div className="glass" style={{ padding: 16, marginBottom: 10 }}>
          <label className="vh" htmlFor="qc-new-entry">新的总结</label>
          <textarea
            id="qc-new-entry"
            className="ta"
            style={{ minHeight: 100 }}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="写一条总结。名字占位符会在注入时换成当前聊天里的名字。"
          />
          <button
            type="button"
            className="btn btn-out"
            style={{ marginTop: 10 }}
            onClick={handleAdd}
            disabled={busy || !newText.trim()}
          >
            添加
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="glass" style={{ padding: 16 }}>
          <p className="mute" style={{ margin: 0 }}>还没有总结条目。</p>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {shown.map(({ entry, number }, position) => {
            const editing = editingId === entry.id;
            const confirming = confirmingId === entry.id;
            const tokens = entry.tokenEstimate ?? estimateTokens(entry.text || '');
            const covered = Number.isFinite(entry.coveredFrom) && Number.isFinite(entry.coveredThrough)
              ? `消息 ${entry.coveredFrom + 1}–${entry.coveredThrough + 1} · `
              : '手写 · ';
            return (
              <div
                key={entry.id}
                style={{ padding: '14px 16px', borderTop: position === 0 ? 0 : '1px solid var(--div)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>第 {number} 条</b>
                  <span className="mute" style={{ fontSize: 12, flex: 1 }}>
                    {covered}估算 {tokens.toLocaleString()} token
                  </span>
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={editing ? `完成编辑第 ${number} 条` : `编辑第 ${number} 条`}
                    aria-pressed={editing}
                    onClick={() => setEditingId(editing ? null : entry.id)}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    style={confirming ? { color: 'var(--bad)', width: 'auto', padding: '0 6px', fontWeight: 600, fontSize: 12 } : undefined}
                    aria-label={confirming ? `再点一次确认删除第 ${number} 条` : `删除第 ${number} 条`}
                    onClick={() => handleDelete(entry)}
                    onBlur={() => setConfirmingId((id) => (id === entry.id ? null : id))}
                  >
                    {confirming ? '再点一次确认删除' : <TrashIcon />}
                  </button>
                </div>
                {editing ? (
                  <>
                    <label className="vh" htmlFor={`qc-entry-${entry.id}`}>第 {number} 条的内容</label>
                    <textarea
                      id={`qc-entry-${entry.id}`}
                      key={entry.id}
                      className="ta"
                      style={{ minHeight: 110, marginTop: 8 }}
                      defaultValue={entry.text}
                      autoFocus
                      onBlur={(e) => handleBlur(entry, e.target.value)}
                    />
                  </>
                ) : (
                  <p
                    className="clamp3"
                    style={{ margin: '6px 0 0', color: 'var(--sub)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {entry.text}
                  </p>
                )}
              </div>
            );
          })}
          {(hiddenCount > 0 || showAll) && ordered.length > VISIBLE_COUNT && (
            <button
              type="button"
              style={{ width: '100%', minHeight: 48, background: 'var(--soft)', border: 0, borderTop: '1px solid var(--div)', fontWeight: 600, color: 'var(--sub)' }}
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? '收起，只看最新的' : `展开更早的 ${hiddenCount} 条`}
            </button>
          )}
        </div>
      )}
      <p className="mute" style={{ margin: '10px 2px 0', fontSize: 11 }}>
        改动自动保存。往事里有总结条目时，挂到聊天里注入的是这些总结，不是原文。
        删除最后一条，进度会退回去，那一段之后会被重新总结。
      </p>
    </section>
  );
};

export default StSummaryEntriesEditor;
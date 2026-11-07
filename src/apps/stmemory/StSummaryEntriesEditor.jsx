// src/apps/stmemory/StSummaryEntriesEditor.jsx
//
// 记忆包详情里的"总结条目"编辑区：每条总结独立显示、独立编辑、独立删除，
// 也可以手写加一条。改动立刻写库（不跟详情里的"保存"按钮绑在一起）。
//
// 详情弹窗是 portal 到 z-[90] 的，ConfirmModal 的层级更低会被盖住，
// 所以这里的删除用"点两下"的行内确认，不弹 ConfirmModal。
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import { estimateTokens } from './stPackBudget';
import { getPack } from './stPackService';
import {
  addSummaryEntry,
  deleteSummaryEntry,
  updateSummaryEntryText,
} from './stSummaryService';

const fieldStyle = {
  background: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const StSummaryEntriesEditor = ({ packId, entries, onEntriesChange }) => {
  const [confirmingId, setConfirmingId] = useState(null);
  const [newText, setNewText] = useState('');
  const [showAdd, setShowAdd] = useState(false);
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

  return (
    <div className="space-y-2 rounded-xl border px-3 py-2.5" style={fieldStyle}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">总结条目（{entries.length} 条）</p>
        <button
          type="button"
          onClick={() => setShowAdd((value) => !value)}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 font-semibold"
          style={fieldStyle}
        >
          <Plus className="h-3 w-3" /> 手写一条
        </button>
      </div>

      <p className="text-[10px] leading-relaxed opacity-55">
        包里有总结条目时，挂到聊天里注入的是这些总结，不是原文。改动立刻保存。
      </p>

      {showAdd && (
        <div className="space-y-1.5">
          <textarea
            className="min-h-[70px] w-full resize-y rounded-lg border px-2.5 py-2 outline-none"
            style={fieldStyle}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="写一条总结。{{char}} 和 {{user}} 会在注入时换成当前聊天里的名字。"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !newText.trim()}
            className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40"
            style={fieldStyle}
          >
            添加
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="opacity-50">还没有总结条目。</p>
      ) : (
        entries.map((entry, index) => (
          <div key={entry.id} className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">第 {index + 1} 条</span>
              <span className="flex-1 text-[10px] opacity-50">
                估算 {(entry.tokenEstimate ?? estimateTokens(entry.text || '')).toLocaleString()} token
                {Number.isFinite(entry.coveredFrom) && Number.isFinite(entry.coveredThrough)
                  ? ` / 覆盖第 ${entry.coveredFrom + 1}-${entry.coveredThrough + 1} 条消息`
                  : ''}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(entry)}
                onBlur={() => setConfirmingId((id) => (id === entry.id ? null : id))}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 font-semibold"
                style={{ color: confirmingId === entry.id ? '#f43f5e' : undefined, opacity: confirmingId === entry.id ? 1 : 0.55 }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmingId === entry.id ? '再点一次确认删除' : ''}
              </button>
            </div>
            <textarea
              key={`${entry.id}-${entry.updatedAt}`}
              className="min-h-[70px] w-full resize-y rounded-lg border px-2.5 py-2 outline-none"
              style={fieldStyle}
              defaultValue={entry.text}
              onBlur={(e) => handleBlur(entry, e.target.value)}
            />
          </div>
        ))
      )}
    </div>
  );
};

export default StSummaryEntriesEditor;
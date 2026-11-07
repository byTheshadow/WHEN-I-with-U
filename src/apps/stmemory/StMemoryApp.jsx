// src/apps/stmemory/StMemoryApp.jsx
//
// ST 记忆桥子应用：记忆包库。列出所有导入的包，可以导入新包、改名和写概览、
// 删除。包挂到哪个聊天，在那个聊天的「聊天设置 -> 剧情记忆包」里操作。
//
// 这个应用从一开始就是懒加载的（见 App.jsx）。
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Library, Plus, Trash2, X } from 'lucide-react';

import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import StPackImportModal from './StPackImportModal';
import { deletePack, getAllPacks, updatePackMeta } from './stPackService';

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const PackDetailModal = ({ pack, onClose, onSaved }) => {
  const [title, setTitle] = useState(pack.title || '');
  const [overview, setOverview] = useState(pack.overview || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updatePackMeta(pack.id, { title, overview });
      onSaved();
      onClose();
    } catch (error) {
      console.error('[stmemory] 保存失败：', error);
      triggerGlobalToast({ title: '保存失败', content: '请稍后再试。' });
      setIsSaving(false);
    }
  };

  const fieldStyle = {
    background: 'var(--control-soft-bg)',
    borderColor: 'var(--card-border)',
    color: 'var(--text-main)',
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(0,0,0,0.25)' }}
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[2rem] border p-5 text-xs sm:rounded-[2rem]"
        style={{
          background: 'var(--card-bg-gradient)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm font-bold">记忆包详情</h3>
          <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          className="w-full rounded-xl border px-3 py-2 outline-none"
          style={fieldStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="记忆包名称"
        />

        <p className="opacity-60">
          {pack.chunkCount} 块 / 约 {(pack.charCount || 0).toLocaleString()} 字 / 估算{' '}
          {(pack.tokenEstimate || 0).toLocaleString()} token
        </p>

        <div className="space-y-1">
          <label className="font-semibold">概览（可选）</label>
          <textarea
            className="min-h-[110px] w-full resize-y rounded-xl border px-3 py-2 outline-none"
            style={fieldStyle}
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="用几句话写下这份记录讲了什么。填了之后，每次注入都会带上这段概览。"
          />
          <p className="text-[10px] leading-relaxed opacity-55">
            概览会占用上下文，所以也计入这个包的 token 估算。
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl py-2.5 text-xs font-bold disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          保存
        </button>
      </div>
    </div>,
    document.body,
  );
};

const StMemoryApp = ({ onBackHub }) => {
  const [packs, setPacks] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [detailPack, setDetailPack] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadPacks = useCallback(async () => {
    setPacks(await getAllPacks());
  }, []);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  const handleConfirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;

    try {
      await deletePack(target.id);
      await loadPacks();
      triggerGlobalToast({ title: '已删除', content: '记忆包已经删除。' });
    } catch (error) {
      console.error('[stmemory] 删除失败：', error);
      triggerGlobalToast({ title: '删除失败', content: '请稍后再试。' });
    }
  };

  return (
    <div className="animate-fade-in pb-16">
      <div className="flex items-center justify-between pb-2 pt-1">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1 text-xs font-semibold opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="h-4 w-4" /> 主页
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" /> 导入
        </button>
      </div>

      <div className="pb-5 pt-3 text-center">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{
            color: 'var(--text-main)',
            fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif',
          }}
        >
          记忆包
        </h1>
        <p className="mt-1 text-[11px] opacity-50">
          把别处的剧情记录带进聊天，让角色知道这些事
        </p>
      </div>

      {packs.length === 0 ? (
        <div
          className="rounded-3xl border py-16 text-center opacity-60"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <Library className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-xs">还没有记忆包，点击右上角导入</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {packs.map((pack) => (
            <div
              key={pack.id}
              onClick={() => setDetailPack(pack)}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)',
              }}
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{pack.title}</h3>
                <p className="mt-0.5 text-[11px] opacity-55">
                  {pack.chunkCount} 块 / 估算 {(pack.tokenEstimate || 0).toLocaleString()} token
                  {formatDate(pack.createdAt) ? ` / ${formatDate(pack.createdAt)}` : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label="删除记忆包"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(pack);
                }}
                className="shrink-0 p-1.5 opacity-45 transition-opacity hover:opacity-100 active:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <StPackImportModal
          onClose={() => setShowImport(false)}
          onImported={() => void loadPacks()}
        />
      )}

      {detailPack && (
        <PackDetailModal
          pack={detailPack}
          onClose={() => setDetailPack(null)}
          onSaved={() => void loadPacks()}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="删除记忆包"
        message={`确定删除「${deleteTarget?.title || ''}」吗？它的原文会被一并删除，所有挂着它的聊天也会取消挂载。此操作不可恢复。`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default StMemoryApp;

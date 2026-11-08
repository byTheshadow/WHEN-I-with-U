// src/apps/stmemory/StMemoryApp.jsx
//
// 前尘（ST 记忆桥）：往事库首页。列出所有导入的往事，可以导入新往事、改名和写概览、
// 删除。往事挂到哪个聊天，在那个聊天的「聊天设置 -> 剧情记忆包」里操作。
//
// 这个应用从一开始就是懒加载的（见 App.jsx）。
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import QianchenBackdrop from './QianchenBackdrop';
import Snowflake, { litArmsFor, pickArm } from './Snowflake';
import StSourcePicker from './StSourcePicker';
import StTextImport from './StTextImport';
import StJsonlImportModal from './StJsonlImportModal';
import { SOURCE_TYPE_ST_JSONL } from './stPackConstants';
import { loadSummarySettings } from './stSummaryConfig';
import { getSummaryCursor } from './stSummaryEngine';
import StSummaryEntriesEditor from './StSummaryEntriesEditor';
import StSummaryGenerator from './StSummaryGenerator';
import {
  deletePack,
  getAllPacks,
  undoLastImport,
  updatePackMeta,
} from './stPackService';

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const PackDetailModal = ({ pack, onClose, onSaved, onRequestUndo, onRequestDelete }) => {
  const [title, setTitle] = useState(pack.title || '');
  const [overview, setOverview] = useState(pack.overview || '');
  const [isSaving, setIsSaving] = useState(false);
  const [summaryEntries, setSummaryEntries] = useState(
    Array.isArray(pack.summaryEntries) ? pack.summaryEntries : [],
  );

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
          <h3 className="font-serif text-sm font-bold">往事详情</h3>
          <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          className="w-full rounded-xl border px-3 py-2 outline-none"
          style={fieldStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="往事名称"
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
            概览会占用上下文，所以也计入这条往事的 token 估算。
          </p>
        </div>

        {pack.sourceType === 'st-jsonl' && (
          <StSummaryGenerator
            pack={pack}
            entries={summaryEntries}
            onEntriesChange={(next) => {
              setSummaryEntries(next);
              onSaved();
            }}
          />
        )}

        <StSummaryEntriesEditor
          packId={pack.id}
          entries={summaryEntries}
          onEntriesChange={(next) => {
            setSummaryEntries(next);
            onSaved();
          }}
        />

        {Array.isArray(pack.imports) && pack.imports.length > 1 && (
          <div className="space-y-1.5 rounded-xl border px-3 py-2.5" style={fieldStyle}>
            <p className="font-semibold">导入记录（{pack.imports.length} 次）</p>
            {pack.imports.map((record) => (
              <p key={record.importId} className="opacity-65">
                {record.label} / {record.chunkCount} 块 / {formatDate(record.createdAt)}
              </p>
            ))}
            <button
              type="button"
              onClick={() => onRequestUndo(pack)}
              className="mt-1 w-full rounded-lg border py-1.5 font-semibold"
              style={fieldStyle}
            >
              撤销最近一次导入
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onRequestDelete(pack)}
          className="rounded-xl border py-2 text-xs font-semibold"
          style={{ ...fieldStyle, color: 'var(--text-main)' }}
        >
          删除这片往事
        </button>

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

/** 总结进度：已总结几批 / 一共几批。只有 ST 聊天往事有；批大小取总结设置里的"每批条数"。 */
const getSummaryProgress = (pack, batchMessages) => {
  if (pack.sourceType !== SOURCE_TYPE_ST_JSONL) return null;
  const totalMessages = pack.source?.messageCount || 0;
  const total = batchMessages > 0 ? Math.ceil(totalMessages / batchMessages) : 0;
  if (!total) return { done: 0, total: 0 };
  const cursor = getSummaryCursor(pack.summaryEntries);
  return { done: Math.min(total, Math.ceil(cursor / batchMessages)), total };
};

const BackIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
);

const StMemoryApp = ({ onBackHub }) => {
  const [packs, setPacks] = useState([]);
  const [batchMessages, setBatchMessages] = useState(0);
  const [view, setView] = useState('home'); // 'home' | 'text'
  const [showPicker, setShowPicker] = useState(false);
  const [detailPack, setDetailPack] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoTarget, setUndoTarget] = useState(null);
  const [jsonlFile, setJsonlFile] = useState(null);

  const loadPacks = useCallback(async () => {
    const [list, settings] = await Promise.all([getAllPacks(), loadSummarySettings()]);
    setBatchMessages(settings.batchMessages);
    setPacks(list);
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
      triggerGlobalToast({ title: '已删除', content: '这片往事已经删除。' });
    } catch (error) {
      console.error('[stmemory] 删除失败：', error);
      triggerGlobalToast({ title: '删除失败', content: '请稍后再试。' });
    }
  };

  const handleConfirmUndo = async () => {
    const target = undoTarget;
    setUndoTarget(null);
    if (!target) return;

    try {
      await undoLastImport(target.id);
      await loadPacks();
      triggerGlobalToast({ title: '已撤销', content: '最近一次导入已经撤销。' });
    } catch (error) {
      console.error('[stmemory] 撤销失败：', error);
      triggerGlobalToast({ title: '撤销失败', content: error?.message || '请稍后再试。' });
    }
  };

  const pickJsonl = (picked) => {
    setShowPicker(false);
    setView('home');
    setJsonlFile(picked);
  };

  const hero = packs[0] || null;
  const rest = packs.slice(1);

  const renderHero = (pack) => {
    const progress = getSummaryProgress(pack, batchMessages);
    const isJsonl = pack.sourceType === SOURCE_TYPE_ST_JSONL;
    const lit = progress ? litArmsFor(progress.done, progress.total) : 0;
    const hasProgress = Boolean(progress && progress.total > 0);
    const finished = hasProgress && progress.done >= progress.total;
    const caption = progress?.done === 0 ? '尚未总结' : finished ? '总结已完成' : '总结进行中';
    const goText = !hasProgress ? '查看往事' : progress.done === 0 ? '开始总结' : finished ? '查看往事' : '继续总结';

    return (
      <div className="qc-hero">
        <div className="bloom" aria-hidden="true" />
        <Snowflake size={210} arm={isJsonl ? pickArm(pack.id) : 'c'} lit={lit} hero />
        <h2 className="hname serif">{pack.title}</h2>
        <div className="hmeta">
          {isJsonl
            ? `ST 聊天记录 · ${(pack.source?.messageCount || 0).toLocaleString()} 条`
            : `文本 · ${pack.chunkCount} 块`}
        </div>
        {hasProgress && (
          <>
            <div className="pcap">{caption}</div>
            <div className="pnum"><b className="serif">{progress.done}</b><span>/ {progress.total} 批</span></div>
            <div className="prog" role="img" aria-label={`总结进度 ${progress.done} / ${progress.total} 批`}>
              <i style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
          </>
        )}
        <div className="hgo">
          <button type="button" className="btn-link" onClick={() => setDetailPack(pack)}>
            {goText}
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    );
  };

  const renderMini = (pack) => {
    const progress = getSummaryProgress(pack, batchMessages);
    const isJsonl = pack.sourceType === SOURCE_TYPE_ST_JSONL;
    const entryCount = Array.isArray(pack.summaryEntries) ? pack.summaryEntries.length : 0;
    const lit = progress ? litArmsFor(progress.done, progress.total) : 0;
    const meta = isJsonl
      ? (entryCount > 0 ? `已总结 ${entryCount} 条` : '尚未总结')
      : `纯文本 · ${pack.chunkCount} 块`;

    return (
      <button
        key={pack.id}
        type="button"
        className="mini"
        aria-label={`${pack.title}，${meta}`}
        onClick={() => setDetailPack(pack)}
      >
        <span className="fw">
          <span className="ring" />
          <Snowflake size={76} arm={isJsonl ? pickArm(pack.id) : 'c'} lit={lit} deep={!isJsonl} />
        </span>
        <span className="n serif">{pack.title}</span>
        <span className="m">{meta}</span>
      </button>
    );
  };

  return (
    <QianchenBackdrop label="前尘">
      {view === 'text' ? (
        <StTextImport
          onBack={() => setView('home')}
          onImported={() => {
            setView('home');
            void loadPacks();
          }}
          onPickJsonl={pickJsonl}
        />
      ) : (
        <>
          <div className="qc-scroll">
            <div className="qc-col qc-main">
              <button type="button" className="back" onClick={onBackHub}>
                <BackIcon />主页
              </button>
              <h1 className="mark serif">前尘</h1>
              <div className="tag serif">记忆塑造灵魂</div>
              <div className="flow">导入　总结　挂载</div>

              {hero ? (
                <>
                  {renderHero(hero)}
                  {rest.length > 0 && (
                    <>
                      <div className="qc-cap">沉在冰下的其他往事</div>
                      <div className="qc-row">{rest.map(renderMini)}</div>
                    </>
                  )}
                </>
              ) : (
                <div className="qc-empty">
                  <Snowflake size={110} arm="c" lit={0} deep />
                  <p>冰面还很干净，导入第一段往事吧。</p>
                </div>
              )}
            </div>
          </div>

          <div className="foot">
            <div className="foot-in">
              <button
                type="button"
                className="btn btn-pri btn-big"
                onClick={() => setShowPicker(true)}
              >
                导入往事
              </button>
              <div className="mute" style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>
                SillyTavern 聊天记录 / 文本 / Markdown
              </div>
            </div>
          </div>
        </>
      )}

      {showPicker && (
        <StSourcePicker
          onClose={() => setShowPicker(false)}
          onPickJsonl={pickJsonl}
          onPickText={() => {
            setShowPicker(false);
            setView('text');
          }}
        />
      )}

      {jsonlFile && (
        <StJsonlImportModal
          file={jsonlFile}
          onClose={() => setJsonlFile(null)}
          onImported={() => void loadPacks()}
        />
      )}

      {detailPack && (
        <PackDetailModal
          pack={detailPack}
          onClose={() => setDetailPack(null)}
          onSaved={() => void loadPacks()}
          onRequestUndo={(target) => {
            setDetailPack(null);
            setUndoTarget(target);
          }}
          onRequestDelete={(target) => {
            setDetailPack(null);
            setDeleteTarget(target);
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(undoTarget)}
        title="撤销最近一次导入"
        message="确定撤销最近一次导入吗？这一次导入的内容会从这条往事里移除，之前的内容不受影响。此操作不可恢复。"
        onConfirm={handleConfirmUndo}
        onCancel={() => setUndoTarget(null)}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="删除往事"
        message={`确定删除「${deleteTarget?.title || ''}」吗？它的原文会被一并删除，所有挂着它的聊天也会取消挂载。此操作不可恢复。`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </QianchenBackdrop>
  );
};

export default StMemoryApp;

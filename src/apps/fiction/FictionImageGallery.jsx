// src/apps/fiction/FictionImageGallery.jsx
//
// 「本存档的图片」页：盖在游玩页上面的一层，两列缩略图，新的在前，一次先显示 24 张，
// 点「显示更多」再往后。整个存档的图都在这里（包括其他分支、旧版本留下的），
// 每张带「第 N 段」，不在当前剧情路径上的写「其他分支」。
//   - 点图片：打开大图（保存、删除都在大图里）
//   - 点生成中的格子：提示还在生成；点失败的格子：弹出原因，可以重试或删除
//   - 右上「选择」：进入多选，可以点选，也可以「全选」整个存档（不只是已经显示出来的），
//     再批量删除，删除前会确认
// 缩略图用生成时存的小图，不读原图；只有点开大图才读原图。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

import FictionImageViewer from './FictionImageViewer';
import FictionImageWarning from './FictionImageWarning';
import {
  FICTION_IMAGE_CHANGED_EVENT,
  FICTION_IMAGE_STATUS,
  deleteImage,
  getImageBlob,
  retryImage,
} from './fictionImageService';
import {
  GALLERY_PAGE_SIZE,
  deleteImages,
  describeNodes,
  listImageIds,
  listImagesPage,
  loadPathIds,
} from './fictionImageGallery';
import './fictionGallery.css';

const NOTE_MS = 3500;

const FictionImageGallery = ({ save, onClose }) => {
  const saveId = save.id;

  const [limit, setLimit] = useState(GALLERY_PAGE_SIZE);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [labels, setLabels] = useState(new Map());
  const [loaded, setLoaded] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sheet, setSheet] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const aliveRef = useRef(true);
  const timerRef = useRef(null);
  const pathIdsRef = useRef(null);
  const labelCacheRef = useRef(new Map());
  const viewerUrlRef = useRef('');

  const showNote = useCallback((text) => {
    setNote(text);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setNote(''), NOTE_MS);
  }, []);

  const releaseViewerUrl = () => {
    if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);

    viewerUrlRef.current = '';
  };

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      window.clearTimeout(timerRef.current);
      releaseViewerUrl();
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      if (!pathIdsRef.current) pathIdsRef.current = await loadPathIds(save.currentNodeId);

      const page = await listImagesPage(saveId, { limit });
      const missing = [...new Set(page.items.map((row) => row.nodeId))]
        .filter((nodeId) => !labelCacheRef.current.has(nodeId));

      if (missing.length > 0) {
        const found = await describeNodes({ nodeIds: missing, pathIds: pathIdsRef.current });

        found.forEach((value, key) => labelCacheRef.current.set(key, value));
      }

      if (!aliveRef.current) return;

      setItems(page.items);
      setTotal(page.total);
      setLabels(new Map(labelCacheRef.current));
    } catch (error) {
      console.warn('[Fiction] 读取本存档的图片失败：', error);

      if (aliveRef.current) showNote('读取图片失败，请关闭后再试一次。');
    } finally {
      if (aliveRef.current) setLoaded(true);
    }
  }, [saveId, save.currentNodeId, limit, showNote]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.saveId === saveId) void reload();
    };

    window.addEventListener(FICTION_IMAGE_CHANGED_EVENT, handler);

    return () => window.removeEventListener(FICTION_IMAGE_CHANGED_EVENT, handler);
  }, [saveId, reload]);

  // ---------- 选择 ----------

  const toggleSelected = (imageId) => {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);

      return next;
    });
  };

  const toggleSelecting = () => {
    setSelecting((value) => !value);
    setSelected(new Set());
  };

  const allSelected = total > 0 && selected.size >= total;

  const handleSelectAll = async () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }

    try {
      setSelected(new Set(await listImageIds(saveId)));
    } catch (error) {
      console.warn('[Fiction] 全选失败：', error);
      showNote('全选失败，请再试一次。');
    }
  };

  const handleDeleteSelected = async () => {
    if (busy || selected.size === 0) return;

    setBusy(true);

    try {
      const count = await deleteImages(saveId, [...selected]);

      setSheet(null);
      setSelected(new Set());
      setSelecting(false);
      showNote(`已删除 ${count} 张图。`);
      await reload();
    } catch (error) {
      console.warn('[Fiction] 批量删除配图失败：', error);
      setSheet(null);
      showNote('删除失败，请再试一次。');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  // ---------- 点格子 ----------

  const openViewer = async (row) => {
    let url = '';
    let blobUrl = '';

    if (row.fileId != null) {
      const blob = await getImageBlob(row.id);

      if (blob) {
        blobUrl = URL.createObjectURL(blob);
        url = blobUrl;
      }
    } else {
      url = row.remoteUrl || '';
    }

    if (!url) {
      showNote('这张图的原图已经不在了（图片不会随备份恢复回来）。');
      return;
    }

    if (!aliveRef.current) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return;
    }

    releaseViewerUrl();
    viewerUrlRef.current = blobUrl;
    setViewer({ ...row, url });
  };

  const closeViewer = () => {
    releaseViewerUrl();
    setViewer(null);
  };

  const handleTile = (row) => {
    if (selecting) {
      toggleSelected(row.id);
      return;
    }

    if (row.status === FICTION_IMAGE_STATUS.PENDING) {
      showNote('这张图还在生成中。');
      return;
    }

    if (row.status === FICTION_IMAGE_STATUS.ERROR) {
      setSheet({ type: 'failed', imageId: row.id });
      return;
    }

    void openViewer(row);
  };

  const handleRetry = async (imageId) => {
    setSheet(null);
    await retryImage(imageId);
  };

  const handleDeleteOne = async (imageId) => {
    setSheet(null);

    try {
      await deleteImage(imageId);
    } catch (error) {
      console.warn('[Fiction] 删除配图失败：', error);
      showNote('删除失败，请再试一次。');
    }
  };

  // ---------- 渲染 ----------

  const renderTile = (row) => {
    const label = labels.get(row.nodeId);
    const isSelected = selected.has(row.id);
    const isDone = row.status === FICTION_IMAGE_STATUS.DONE;
    const isError = row.status === FICTION_IMAGE_STATUS.ERROR;

    return (
      <button
        key={row.id}
        type="button"
        className={`fic-btn-reset fic-ig-tile ${isError ? 'is-error' : ''} ${isDone ? '' : 'is-ph'} ${isSelected ? 'is-selected' : ''}`}
        aria-label={`第 ${label?.number ?? '?'} 段的图`}
        aria-pressed={selecting ? isSelected : undefined}
        onClick={() => handleTile(row)}
      >
        {isDone && row.thumbnail
          ? <img src={row.thumbnail} alt="" loading="lazy" decoding="async" />
          : (
            <span className="fic-ig-ph">
              {row.status === FICTION_IMAGE_STATUS.PENDING && '正在配图…'}
              {isError && <>没有生成出来<small>点开看原因</small></>}
              {isDone && !row.thumbnail && '图片'}
            </span>
          )}
        {label && (
          <span className={`fic-ig-tag ${label.onPath ? '' : 'is-branch'}`}>
            第 {label.number} 段{label.onPath ? '' : ' · 其他分支'}
          </span>
        )}
        {selecting && (
          <span className="fic-ig-check" aria-hidden="true">
            {isSelected && <Check size={14} strokeWidth={2.2} />}
          </span>
        )}
      </button>
    );
  };

  const failedRow = sheet?.type === 'failed' ? items.find((row) => row.id === sheet.imageId) : null;

  return (
    <div className="fic-s-layer fic-ig-layer">
      <button
        type="button"
        className="fic-btn-reset fic-round-btn fic-back"
        aria-label="关闭图片页"
        disabled={busy}
        onClick={onClose}
      >
        <ArrowLeft size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>

      <div className="fic-s-head">
        <div className="fic-s-eyebrow">Gallery</div>
        <div className="fic-s-title">图片</div>
        <div className="fic-s-sub">{save.title}</div>
      </div>

      <div className="fic-ig-bar">
        <span className="fic-ig-count">
          {selecting ? `已选 ${selected.size} 张` : `共 ${total} 张`}
        </span>
        {total > 0 && (
          <button type="button" className="fic-btn-reset fic-ig-link" disabled={busy} onClick={toggleSelecting}>
            {selecting ? '完成' : '选择'}
          </button>
        )}
      </div>

         {note ? <p className="fic-ig-note" role="status">{note}</p> : null}

      <FictionImageWarning saveId={saveId} selecting={selecting} onSelect={toggleSelecting} />

      <div className="fic-ig-scroll">
        {!loaded && <p className="fic-ig-empty">读取中……</p>}

        {loaded && total === 0 && (
          <p className="fic-ig-empty">
            还没有图片。<br />在设定里打开文生图后，生成的图会收在这里。
          </p>
        )}

        {items.length > 0 && <div className="fic-ig-grid">{items.map(renderTile)}</div>}

        {items.length < total && (
          <button
            type="button"
            className="fic-btn-reset fic-sheet-btn fic-ig-more"
            onClick={() => setLimit((value) => value + GALLERY_PAGE_SIZE)}
          >
            显示更多（还有 {total - items.length} 张）
          </button>
        )}
      </div>

      {selecting && (
        <div className="fic-ig-selbar">
          <button type="button" className="fic-btn-reset fic-ig-selbtn" disabled={busy} onClick={handleSelectAll}>
            {allSelected ? '取消全选' : `全选（${total} 张）`}
          </button>
          <button
            type="button"
            className="fic-btn-reset fic-ig-selbtn is-danger"
            disabled={busy || selected.size === 0}
            onClick={() => setSheet({ type: 'confirm' })}
          >
            删除{selected.size > 0 ? `（${selected.size}）` : ''}
          </button>
        </div>
      )}

      {sheet?.type === 'confirm' && (
        <>
          <button
            type="button"
            className="fic-btn-reset fic-mask"
            aria-label="关闭"
            onClick={() => !busy && setSheet(null)}
          />
          <div className="fic-sheet" role="dialog" aria-label="删除选中的图片">
            <div className="fic-sheet-grab" />
            <div className="fic-sheet-name">删除选中的 {selected.size} 张图？</div>
            <p className="fic-sheet-warn">删除后无法恢复，剧情文字不受影响。</p>
            <div className="fic-sheet-actions">
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn is-danger-solid"
                disabled={busy}
                onClick={handleDeleteSelected}
              >
                {busy ? '正在删除' : '确认删除'}
              </button>
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn"
                disabled={busy}
                onClick={() => setSheet(null)}
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}

      {failedRow && (
        <>
          <button
            type="button"
            className="fic-btn-reset fic-mask"
            aria-label="关闭"
            onClick={() => setSheet(null)}
          />
          <div className="fic-sheet" role="dialog" aria-label="这张图没有生成出来">
            <div className="fic-sheet-grab" />
            <div className="fic-sheet-name">这张图没有生成出来</div>
            <p className="fic-sheet-warn">{failedRow.errorMessage || '生成失败，请重试。'}</p>
            <div className="fic-sheet-actions">
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn"
                onClick={() => handleRetry(failedRow.id)}
              >
                重试
              </button>
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn is-danger"
                onClick={() => handleDeleteOne(failedRow.id)}
              >
                删除这张图
              </button>
              <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={() => setSheet(null)}>
                关闭
              </button>
            </div>
          </div>
        </>
      )}

      {viewer && (
        <FictionImageViewer
          image={viewer}
          onClose={closeViewer}
          onDelete={async (image) => {
            await deleteImage(image.id);
            closeViewer();
          }}
        />
      )}
    </div>
  );
};

export default FictionImageGallery;
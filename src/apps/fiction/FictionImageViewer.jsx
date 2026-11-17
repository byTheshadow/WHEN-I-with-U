// src/apps/fiction/FictionImageViewer.jsx
//
// 配图大图：全屏黑底，图片按比例完整显示，下面是画面描述（只读）、「保存到设备」、
// 「删除这张图」。删除要点两次（先出确认，再确认删除）。点图片外的黑色区域或右上角的叉关闭。
// 改描述重新生成放在后面的轮次，会加在这个界面里。
// 渲染在游玩页根节点里（和回看、编辑抽屉同一层），盖住底部抽屉。

import React, { useEffect, useRef, useState } from 'react';
import { Download, Trash2, X } from 'lucide-react';

import { saveBlobToDevice } from '../imagestudio/imageGenMedia';
import { getImageBlob } from './fictionImageService';
import './fictionImages.css';

const NOTE_MS = 3000;

const extensionOf = (blob) => {
  const type = String(blob?.type || '');

  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('webp')) return 'webp';

  return 'png';
};

const FictionImageViewer = ({ image, onClose, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  if (!image || !image.url) return null;

  const showNote = (text) => {
    setNote(text);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setNote(''), NOTE_MS);
  };

  const hasFile = image.fileId != null;

  const handleSave = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const blob = await getImageBlob(image.id);

      if (!blob) {
        showNote('原图找不到了，没法保存。');
        return;
      }

      const result = await saveBlobToDevice(blob, `fiction-${image.saveId}-${image.id}.${extensionOf(blob)}`);

      if (result === 'downloaded') showNote('已下载到设备。');
    } catch (error) {
      console.warn('[Fiction] 保存配图失败：', error);
      showNote('保存失败，请再试一次。');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await onDelete(image);
    } catch (error) {
      console.warn('[Fiction] 删除配图失败：', error);

      if (aliveRef.current) {
        setBusy(false);
        setConfirming(false);
        showNote('删除失败，请再试一次。');
      }
    }
  };

  return (
    <div className="fic-iv" role="dialog" aria-modal="true" aria-label="查看配图">
      <div className="fic-iv-stage" onClick={onClose} role="presentation">
        <img src={image.url} alt="" onClick={(event) => event.stopPropagation()} />
      </div>

      <button
        type="button"
        className="fic-btn-reset fic-iv-close"
        aria-label="关闭"
        disabled={busy}
        onClick={onClose}
      >
        <X size={20} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <div className="fic-iv-panel">
        {image.description ? (
          <div className="fic-iv-desc">
            <span className="fic-iv-label">画面描述</span>
            <p>{image.description}</p>
          </div>
        ) : null}

        {note ? <p className="fic-iv-note" role="status">{note}</p> : null}

        {confirming ? (
          <>
            <p className="fic-iv-warn">删除这张图？删除后无法恢复，剧情文字不受影响。</p>
            <div className="fic-iv-actions">
              <button
                type="button"
                className="fic-btn-reset fic-iv-btn is-danger-solid"
                disabled={busy}
                onClick={handleDelete}
              >
                {busy ? '正在删除' : '确认删除'}
              </button>
              <button
                type="button"
                className="fic-btn-reset fic-iv-btn"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <div className="fic-iv-actions">
            {hasFile && (
              <button
                type="button"
                className="fic-btn-reset fic-iv-btn"
                disabled={busy}
                onClick={handleSave}
              >
                <Download size={16} strokeWidth={1.8} aria-hidden="true" />
                保存到设备
              </button>
            )}
            <button
              type="button"
              className="fic-btn-reset fic-iv-btn is-danger"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
              删除这张图
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FictionImageViewer;
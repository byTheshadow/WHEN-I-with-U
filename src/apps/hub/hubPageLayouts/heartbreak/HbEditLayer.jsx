// src/apps/hub/hubPageLayouts/heartbreak/HbEditLayer.jsx
//
// 编辑模式的浮层：顶部的「编辑中」提示条（含完成、全部还原），以及点了
// 某个装饰之后从底部升起的编辑面板（改文字，或换图片）。
// 通过 portal 挂到 document.body，不受版式内部层级影响；样式写在
// heartbreak.css 的 .hb-overlay 下（主题变量同样在 .hb-overlay 上定义）。
// 保存时才写入 db.settings；取消、点遮罩、按 Esc 都不会改任何东西。

import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ImagePlus, RotateCcw, X } from 'lucide-react';
import {
  HbCustomContext,
  fileToHbImage,
  resetHbCustom,
  setHbCustomImage,
  setHbCustomText,
} from './useHbCustom';

const TextSheet = ({ target, onClose }) => {
  const { texts } = useContext(HbCustomContext);
  const [value, setValue] = useState(() => texts[target.id] || target.fallback);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    setSaving(true);
    const ok = await setHbCustomText(
      target.id,
      trimmed && trimmed !== target.fallback ? trimmed : ''
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <>
      <div className="hb-sheet-head">
        <b>改{target.label}</b>
        <button type="button" aria-label="关闭" onClick={onClose}>
          <X className="hb-i" />
        </button>
      </div>
      <input
        className="hb-sheet-input"
        value={value}
        maxLength={target.maxLength}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
        }}
      />
      <p className="hb-sheet-note">
        最多 {target.maxLength} 个字符，默认是「{target.fallback}」。留空保存会回到默认。
      </p>
      <div className="hb-sheet-row">
        <button type="button" className="hb-btn" onClick={() => setValue(target.fallback)}>
          <RotateCcw className="hb-i" /> 恢复默认
        </button>
      </div>
      <div className="hb-sheet-row end">
        <button type="button" className="hb-btn" onClick={onClose}>取消</button>
        <button type="button" className="hb-btn main" disabled={saving} onClick={save}>
          保存
        </button>
      </div>
    </>
  );
};

const ImageSheet = ({ target, onClose }) => {
  const { images } = useContext(HbCustomContext);
  const fileRef = useRef(null);
  // undefined：没改；null：恢复占位；字符串：新图片。
  const [draft, setDraft] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const shown = draft === undefined ? images[target.id] || '' : draft || '';

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setDraft(await fileToHbImage(file));
    } catch (err) {
      setError(err?.message || '处理图片失败');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (draft === undefined) {
      onClose();
      return;
    }
    setBusy(true);
    const ok = await setHbCustomImage(target.id, draft);
    setBusy(false);
    if (ok) onClose();
    else setError('保存失败，可能是存储空间不够，换一张小一点的图试试');
  };

  return (
    <>
      <div className="hb-sheet-head">
        <b>换{target.label}</b>
        <button type="button" aria-label="关闭" onClick={onClose}>
          <X className="hb-i" />
        </button>
      </div>
      <div className="hb-sheet-preview">
        {shown ? <img src={shown} alt="" /> : <span>现在是占位图</span>}
      </div>
      <div className="hb-sheet-row">
        <button type="button" className="hb-btn main" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="hb-i" /> {busy ? '处理中' : '选择图片'}
        </button>
        <button
          type="button"
          className="hb-btn"
          disabled={busy || !shown}
          onClick={() => setDraft(null)}
        >
          <RotateCcw className="hb-i" /> 恢复占位
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      <p className="hb-sheet-note">
        {error || '图片会缩小后只存在这台设备里，不会上传。人物图用透明背景的 PNG 效果最好。'}
      </p>
      <div className="hb-sheet-row end">
        <button type="button" className="hb-btn" onClick={onClose}>取消</button>
        <button type="button" className="hb-btn main" disabled={busy} onClick={save}>
          <Check className="hb-i" /> 保存
        </button>
      </div>
    </>
  );
};

export const HbEditLayer = ({ editing, onDone, target, onCloseTarget }) => {
  const { texts, images } = useContext(HbCustomContext);
  const [confirmReset, setConfirmReset] = useState(false);
  const hasCustom = Object.keys(texts).length > 0 || Object.keys(images).length > 0;

  useEffect(() => {
    if (!confirmReset) return undefined;
    const timer = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseTarget();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target, onCloseTarget]);

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    await resetHbCustom();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="hb-overlay">
      <div className={`hb-edit-banner ${editing ? 'show' : ''}`} role="status" aria-hidden={!editing}>
        <span>编辑中：点虚线框里的内容来改</span>
        {hasCustom && (
          <button type="button" className="ghost" onClick={handleReset}>
            {confirmReset ? '再点一次确认' : '全部还原'}
          </button>
        )}
        <button type="button" onClick={onDone}>完成</button>
      </div>

      {target && (
        <div
          className="hb-sheet"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onCloseTarget();
          }}
        >
          <div className="hb-sheet-card" role="dialog" aria-modal="true" aria-label="编辑装饰">
            {/* key 保证换一个目标时面板内部状态重置 */}
            {target.kind === 'image' ? (
              <ImageSheet key={`img-${target.id}`} target={target} onClose={onCloseTarget} />
            ) : (
              <TextSheet key={`txt-${target.id}`} target={target} onClose={onCloseTarget} />
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default HbEditLayer;
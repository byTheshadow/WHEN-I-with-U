// src/apps/fiction/FictionTextEditor.jsx
//
// 手动编辑某一段已生成的正文。底部抽屉：标题 + 可滚动的文本框 + 固定在底部的「保存 / 取消」。
// 只改这一段的文字，不重新生成；选项、数值、总结都不动（已生成的总结不会跟着更新）。
// 写库在 fictionService.updateNodeText，成功后把更新后的节点交给 onSaved。
//
// 有未保存的改动时，点遮罩不会关闭，避免长文改到一半被误触丢掉，只能点「取消」放弃。

import React, { useEffect, useRef, useState } from 'react';

import { updateNodeText } from './fictionService';

const TEXT_MAX = 20000;

const countChars = (text) => Array.from(String(text || '')).length;

const FictionTextEditor = ({ node, number, onClose, onSaved }) => {
  const original = String(node?.text || '');
  const [draft, setDraft] = useState(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const changed = draft.trim() !== original.trim();
  const empty = !draft.trim();

  const handleSave = async () => {
    if (saving || empty) return;

    // 没改动就直接关，不写库。
    if (!changed) {
      onClose?.();
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updated = await updateNodeText(node.id, draft);

      if (mountedRef.current) onSaved?.(updated);
    } catch (saveError) {
      console.warn('[Fiction] 保存正文失败：', saveError);

      if (mountedRef.current) {
        setError(saveError?.message || '保存失败，请再试一次。');
        setSaving(false);
      }
    }
  };

  const handleMask = () => {
    if (saving || changed) return;

    onClose?.();
  };

  return (
    <>
      <button type="button" className="fic-btn-reset fic-mask" aria-label="关闭" onClick={handleMask} />
      <div className="fic-sheet fic-w-sheet" role="dialog" aria-label={`编辑第 ${number} 段`}>
        <div className="fic-sheet-grab" />
        <div className="fic-sheet-name">编辑第 {number} 段</div>
        <div className="fic-sheet-meta">只改这一段的文字，不会重新生成；已生成的总结不会跟着更新</div>

        <div className="fic-w-sheet-scroll">
          <textarea
            className="fic-te-textarea"
            value={draft}
            maxLength={TEXT_MAX}
            disabled={saving}
            aria-label={`第 ${number} 段正文`}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="fic-te-count">{countChars(draft)} / {TEXT_MAX}</div>
          {error && <p className="fic-te-error" role="alert">{error}</p>}
        </div>

        <div className="fic-sheet-actions">
          <button
            type="button"
            className="fic-btn-reset fic-sheet-btn is-solid"
            disabled={saving || empty}
            onClick={handleSave}
          >
            {saving ? '正在保存' : '保存'}
          </button>
          <button
            type="button"
            className="fic-btn-reset fic-sheet-btn"
            disabled={saving}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    </>
  );
};

export default FictionTextEditor;
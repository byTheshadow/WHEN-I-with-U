// src/apps/fiction/FictionImageRegenPanel.jsx
//
// 大图里的「改描述重新生成」面板：文本框预填这张图现在的画面描述，可以直接改
// （比如把 1boy 改成 1girl）；「重新生成」会新增一张图，旧图保留，
// 然后调用 onDone 让大图关掉，回到正文就能看到「正在配图…」。「返回」回到大图。

import React, { useState } from 'react';

import { DESCRIPTION_MAX, regenerateImage } from './fictionImageService';
import './fictionImageRegen.css';

const FictionImageRegenPanel = ({ image, onBack, onDone }) => {
  const [text, setText] = useState(image.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (busy) return;

    const description = text.trim();

    if (!description) {
      setError('画面描述不能是空的。');

      return;
    }

    setBusy(true);
    setError('');

    try {
      await regenerateImage(image.id, { description });
      onDone();
    } catch (submitError) {
      console.warn('[Fiction] 重新生成没能开始：', submitError);
      setError(submitError?.message || '没能开始生成，请再试一次。');
      setBusy(false);
    }
  };

  return (
    <div className="fic-rg">
      <label className="fic-rg-label" htmlFor="fic-rg-text">画面描述</label>
      <textarea
        id="fic-rg-text"
        className="fic-rg-text"
        rows={4}
        value={text}
        maxLength={DESCRIPTION_MAX}
        disabled={busy}
        placeholder="写一写想画什么"
        onChange={(event) => {
          setText(event.target.value);
          setError('');
        }}
      />
      <p className="fic-rg-hint">会新增一张图，现在这张先保留。</p>
      {error ? <p className="fic-rg-error" role="alert">{error}</p> : null}
      <div className="fic-rg-actions">
        <button
          type="button"
          className="fic-btn-reset fic-rg-btn"
          disabled={busy}
          onClick={onBack}
        >
          返回
        </button>
        <button
          type="button"
          className="fic-btn-reset fic-rg-btn is-go"
          disabled={busy}
          onClick={handleSubmit}
        >
          {busy ? '请稍等' : '重新生成'}
        </button>
      </div>
    </div>
  );
};

export default FictionImageRegenPanel;
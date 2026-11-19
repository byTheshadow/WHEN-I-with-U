// src/apps/fiction/AppearanceField.jsx
//
// 向导里的「外貌特征」输入框：说明文字 + 文本框 + 「让 AI 写」按钮。
// 用在四个地方：我的设定、新建主角色、导入角色的副本、存档专属 NPC。
//   - variant="sheet"    抽屉里：带小标题「外貌特征」，说明放在标题和文本框之间
//   - variant="persona"  「我的设定」里：各个框都没有标题，所以只在文本框上方放一行灰字
// 点「让 AI 写」：AI 读这个角色的人设，把已写的外貌整理好、没写的合理补全，写进框里。
// 框里已经有内容时，第一次点会变成「会覆盖现在的内容，再点一次」，4 秒内再点才会写。

import React, { useEffect, useRef, useState } from 'react';

import { APPEARANCE_MAX } from './fictionAppearance';
import { writeAppearance } from './fictionAppearanceWriter';
import './fictionAppearance.css';

const SHEET_NOTE = '用于文生图配图。不打算配图可以不填。配图时 AI 只会写这一幕看得见的部分。';
const PERSONA_NOTE = '外貌特征：用于文生图配图，不打算配图可以不填。';
const CONFIRM_MS = 4000;

const str = (value) => String(value ?? '').trim();

const AppearanceField = ({
  id,
  value,
  onChange,
  name = '',
  setting = '',
  background = '',
  variant = 'sheet',
  rows = 3,
  placeholder = '发色发型、瞳色、肤色、体型、常穿的衣服……',
}) => {
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      controllerRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleWrite = async () => {
    if (busy) return;

    if (str(value) && !armed) {
      setArmed(true);
      setError('');

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => setArmed(false), CONFIRM_MS);

      return;
    }

    if (!str(name) && !str(setting)) {
      setError('先写一点这个角色的人设，AI 才知道他是谁。');
      setArmed(false);

      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const controller = new AbortController();

    controllerRef.current = controller;
    setArmed(false);
    setError('');
    setBusy(true);

    try {
      const text = await writeAppearance({
        name,
        setting,
        existing: value,
        background,
        signal: controller.signal,
      });

      if (aliveRef.current) onChange(text);
    } catch (writeError) {
      if (!aliveRef.current || controller.signal.aborted) return;

      console.warn('[Fiction] AI 写外貌特征失败：', writeError);
      setError('AI 没能写出来，可以自己写，或者稍后再试。');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const isPersona = variant === 'persona';
  let buttonText = '让 AI 写';

  if (busy) buttonText = '正在写…';
  else if (armed) buttonText = '会覆盖现在的内容，再点一次';

  return (
    <div className={`fic-ap ${isPersona ? 'is-persona' : ''}`}>
      {isPersona ? (
        <div className="fic-w-hint fic-ap-note">{PERSONA_NOTE}</div>
      ) : (
        <>
          <label className="fic-w-sub-label" htmlFor={id}>外貌特征</label>
          <div className="fic-w-hint fic-ap-note">{SHEET_NOTE}</div>
        </>
      )}
      <textarea
        id={id}
        className="fic-w-textarea fic-ap-textarea"
        rows={rows}
        value={value}
        maxLength={APPEARANCE_MAX}
        readOnly={busy}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className={`fic-btn-reset fic-w-file-btn fic-ap-btn ${armed ? 'is-armed' : ''}`}
        disabled={busy}
        onClick={handleWrite}
      >
        {buttonText}
      </button>
      {error ? <div className="fic-w-hint fic-ap-error" role="status">{error}</div> : null}
    </div>
  );
};

export default AppearanceField;
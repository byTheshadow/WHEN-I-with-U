// src/apps/layoutstudio/LayoutStepFinish.jsx
// 第 4 步：成品 + 角色的话 + 接下来做什么。
// 切片 B：角色的话、把成品和摘要发回聊天室。
// 切片 C：存进相册（存完可以直接去相册看）。

import React, { useEffect, useState } from 'react';
import { Download, Images, RotateCcw, Send } from 'lucide-react';

import { charInitial } from './LayoutStepCharacter';

const LayoutStepFinish = ({
  character,
  resultUrl,
  charName,
  saved,
  notes,
  notesLoading,
  sending,
  sent,
  albumSaving,
  albumSaved,
  onSave,
  onSend,
  onSaveAlbum,
  onOpenAlbum,
  onRestart,
}) => {
  const [shown, setShown] = useState(0);

  // 两句话依次浮现。
  useEffect(() => {
    setShown(0);
    if (!notes) return undefined;
    const t1 = window.setTimeout(() => setShown(1), 200);
    const t2 = window.setTimeout(() => setShown(2), 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [notes]);

  const initial = charInitial(character);

  return (
    <>
      <h2 className="ls-q">{charName} 有话想说</h2>
      <p className="ls-g">看完 TA 的想法，再决定保存、放进相册，或者把成品和摘要发回聊天室。</p>

      <div className="ls-res">{resultUrl && <img src={resultUrl} alt="修好的图片" />}</div>

      <div className="ls-notes">
        {notes?.why && (
          <div className={`ls-nb${shown >= 1 ? ' ls-show' : ''}`}>
            <div className="ls-mini">{initial}</div>
            <div className="ls-bub ls-ink">
              <small>为什么这样修</small>
              <span>{notes.why}</span>
            </div>
          </div>
        )}
        {notes?.praise && (
          <div className={`ls-nb${shown >= 2 || (shown >= 1 && !notes.why) ? ' ls-show' : ''}`}>
            <div className="ls-mini">{initial}</div>
            <div className="ls-bub">
              <small>对你照片的评价</small>
              <span>{notes.praise}</span>
            </div>
          </div>
        )}
        {notesLoading && <div className="ls-sys">{charName} 正在写下想法...</div>}
        {!notesLoading && !notes && (
          <div className="ls-sys">{charName} 这次没留下话，不影响保存和发送。</div>
        )}
      </div>

      <div className="ls-sect">接下来</div>
      <button
        type="button"
        className={`ls-card ls-act${saved ? ' ls-done' : ''}`}
        onClick={onSave}
      >
        <span className="ls-ic">
          <Download size={19} />
        </span>
        <span>
          <b>{saved ? '已保存，可以再存一次' : '保存到设备'}</b>
          <small>导出为一张 PNG 图片</small>
        </span>
      </button>
      <button
        type="button"
        className={`ls-card ls-act${albumSaved ? ' ls-done' : ''}`}
        disabled={albumSaving || notesLoading || !character}
        onClick={albumSaved ? onOpenAlbum : onSaveAlbum}
      >
        <span className="ls-ic">
          <Images size={19} />
        </span>
        <span>
          <b>{albumSaved ? '已存进相册，点这里去看看' : albumSaving ? '正在存...' : '存进相册'}</b>
          <small>只存成品图和 {charName} 的话，不存原照片</small>
        </span>
      </button>
      <button
        type="button"
        className={`ls-card ls-act ls-hl${sent ? ' ls-done' : ''}`}
        disabled={sending || sent || !character}
        onClick={onSend}
      >
        <span className="ls-ic">
          <Send size={19} />
        </span>
        <span>
          <b>{sent ? '已发回聊天室' : sending ? '正在发送...' : '把成品和摘要发回聊天室'}</b>
          <small>{charName} 会收到这张图和一段摘要，并记住它</small>
        </span>
      </button>
      <button type="button" className="ls-card ls-act" onClick={onRestart}>
        <span className="ls-ic">
          <RotateCcw size={19} />
        </span>
        <span>
          <b>再修一张</b>
          <small>回到第一步，换照片或换角色</small>
        </span>
      </button>
    </>
  );
};

export default LayoutStepFinish;
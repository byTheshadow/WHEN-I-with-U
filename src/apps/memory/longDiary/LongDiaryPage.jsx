// src/apps/memory/longDiary/LongDiaryPage.jsx
//
// 长期日记页面（全屏浮层，从记忆系统页的工具按钮打开）。
// 视觉沿用记忆页的黑白杂志版式；左上角是悬浮返回按钮，没有顶栏。
// 挂到 document.body（portal），避免被带 transform 的祖先影响 fixed 定位。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';

import {
  MAX_RANGE_DAYS,
  deleteLongDiary,
  downloadDiaryTxt,
  generateLongDiary,
  listLongDiaries,
  toDateStr,
  validateRange,
} from './longDiaryService';
import './longDiary.css';

const defaultRange = () => {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: toDateStr(start), end: toDateStr(end) };
};

const formatShort = (dateStr) => String(dateStr || '').slice(5).replace('-', '.');

const formatStamp = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const LongDiaryPage = ({ chat, chatLabel, onClose }) => {
  const initial = defaultRange();
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [saved, setSaved] = useState([]);
  const [active, setActive] = useState(null);
  const [progress, setProgress] = useState('');
  const [errorText, setErrorText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cancelRef = useRef(false);
  const isGenerating = Boolean(progress);

  const refresh = useCallback(async () => {
    if (!chat?.id) return [];
    const rows = await listLongDiaries(chat.id);
    setSaved(rows);
    return rows;
  }, [chat?.id]);

  useEffect(() => {
    refresh().then((rows) => {
      if (rows.length > 0) setActive(rows[0]);
    });
  }, [refresh]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelRef.current = true;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleGenerate = async () => {
    if (isGenerating) return;

    const rangeError = validateRange(startDate, endDate);
    if (rangeError) {
      setErrorText(rangeError);
      return;
    }

    setErrorText('');
    cancelRef.current = false;
    setProgress('准备中……');

    try {
      const diary = await generateLongDiary({
        chatId: chat.id,
        startDate,
        endDate,
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      });

      setActive(diary);
      setConfirmDelete(false);
      await refresh();
    } catch (error) {
      setErrorText(error?.message || '生成失败，请稍后再试。');
    } finally {
      setProgress('');
    }
  };

  const handleDelete = async () => {
    if (!active?.id) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    await deleteLongDiary(active.id);
    setConfirmDelete(false);
    const rows = await refresh();
    setActive(rows[0] || null);
  };

  const handleSelect = (diary) => {
    setActive(diary);
    setConfirmDelete(false);
    setErrorText('');
  };

  const body = (
    <div className="ld-root" role="dialog" aria-modal="true" aria-label="长期日记">
      <button type="button" className="ld-back" onClick={onClose} aria-label="返回">
        <ArrowLeft size={16} />
      </button>

      <div className="ld-scroll">
        <div className="ld-wrap">
          <header className="ld-masthead">
            <div>
              <p className="ld-eyebrow">Memory Archive / Long Diary</p>
              <h1>长期日记</h1>
            </div>
            <span className="ld-badge">{String(saved.length).padStart(2, '0')}</span>
          </header>

          <section className="ld-compose">
            <p className="ld-compose-for">{chatLabel || '当前聊天'}</p>

            <div className="ld-range">
              <label htmlFor="ld-start">
                <span>开始</span>
                <input
                  id="ld-start"
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={isGenerating}
                />
              </label>
              <label htmlFor="ld-end">
                <span>结束</span>
                <input
                  id="ld-end"
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={toDateStr(new Date())}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={isGenerating}
                />
              </label>
            </div>

            <div className="ld-compose-row">
              <span className="ld-hint">
                结合这段时间的聊天记录、记忆和心情打卡，一次最多 {MAX_RANGE_DAYS} 天。
              </span>

              {isGenerating ? (
                <button
                  type="button"
                  className="ld-btn"
                  onClick={() => { cancelRef.current = true; }}
                >
                  取消
                </button>
              ) : (
                <button type="button" className="ld-btn ld-btn--solid" onClick={handleGenerate}>
                  {active ? '再写一篇' : '开始写'}
                </button>
              )}
            </div>

            {isGenerating && <p className="ld-progress" aria-live="polite">{progress}</p>}
            {errorText && <p className="ld-error" role="alert">{errorText}</p>}
          </section>

          {saved.length > 0 && (
            <nav className="ld-saved" aria-label="已保存的日记">
              {saved.map((diary) => (
                <button
                  key={diary.id}
                  type="button"
                  className={`ld-chip${active?.id === diary.id ? ' is-active' : ''}`}
                  onClick={() => handleSelect(diary)}
                >
                  {formatShort(diary.startDate)} — {formatShort(diary.endDate)}
                </button>
              ))}
            </nav>
          )}

          {active ? (
            <>
              <div className="ld-meta">
                <div className="ld-meta-range">
                  <strong>{active.startDate.replace(/-/g, '.')} — {active.endDate.replace(/-/g, '.')}</strong>
                  <span>{active.characterName} · 共 {active.dayCount} 天</span>
                </div>
                <div className="ld-meta-actions">
                  <button type="button" className="ld-btn" onClick={handleDelete}>
                    <Trash2 size={12} />
                    {confirmDelete ? '再点一次删除' : '删除'}
                  </button>
                  <button
                    type="button"
                    className="ld-btn ld-btn--solid"
                    onClick={() => downloadDiaryTxt(active)}
                  >
                    <Download size={12} />
                    导出 TXT
                  </button>
                </div>
              </div>

              <article className="ld-article">
                {active.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className={paragraph.who === 'user' ? 'ld-voice-user' : undefined}
                  >
                    {paragraph.text}
                  </p>
                ))}
              </article>

              <footer className="ld-foot">
                <span>生成于 {formatStamp(active.createdAt)}</span>
                <span>共 {active.charCount} 字</span>
              </footer>
            </>
          ) : (
            !isGenerating && (
              <p className="ld-empty">
                选好日期范围，点“开始写”。角色会翻一遍这段时间的聊天和记忆，写下它眼中的你，和它自己。
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
};

export default LongDiaryPage;
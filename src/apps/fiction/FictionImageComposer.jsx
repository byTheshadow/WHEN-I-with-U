// src/apps/fiction/FictionImageComposer.jsx
//
// 手动配图：每一段末尾「编辑这一段」右边的一个小圆图标。
// 点开后，图标上方原地展开一张圆角面板：
//   画面描述  文本框（可以直接改）
//   让 AI 重写   让 AI 读这一段，重新写一份描述
//   生成         用这份描述生成一张新图，面板收回成小图标，图的位置出现「正在配图…」
// 第一次展开、文本框还是空的时候，会自动让 AI 读一遍这一段。AI 失败时文本框留空，自己写。
//
// 这个组件渲染在「编辑这一段」所在的那一行（.fic-p-seg-foot）里面：面板靠 CSS 的 order
// 排到这一行的最上面，图标跟在「编辑这一段」后面。存档的文生图是「关闭」时什么都不渲染。

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ChevronDown, Image as ImageIcon, Sparkles,
} from 'lucide-react';

import { describeSegment } from './fictionImageDescribe';
import {
  DESCRIPTION_MAX,
  FICTION_IMAGE_SOURCE,
  FICTION_IMAGE_STATUS,
  createImage,
} from './fictionImageService';
import { FICTION_IMAGE_MODES } from './fictionService';
import './fictionImageComposer.css';

const NOTE_MS = 4000;
const SCROLL_DELAY_MS = 320;

const FictionImageComposer = ({ save, node, images }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const abortRef = useRef(null);
  const aliveRef = useRef(true);
  const panelRef = useRef(null);
  const noteTimerRef = useRef(null);
  const scrollTimerRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      window.clearTimeout(noteTimerRef.current);
      window.clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const showNote = useCallback((message) => {
    setNote(message);
    window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => setNote(''), NOTE_MS);
  }, []);

  const readSegment = useCallback(async () => {
    abortRef.current?.abort();

    const controller = new AbortController();

    abortRef.current = controller;
    setReading(true);
    setNote('');

    try {
      const description = await describeSegment({ save, node, signal: controller.signal });

      if (controller.signal.aborted || !aliveRef.current) return;

      setText(description);
    } catch (error) {
      if (controller.signal.aborted || !aliveRef.current) return;

      console.warn('[Fiction] AI 写画面描述失败：', error);
      showNote('AI 没能写出描述，可以自己写。');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;

        if (aliveRef.current) setReading(false);
      }
    }
  }, [save, node, showNote]);

  const closePanel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setReading(false);
    setOpen(false);
  }, []);

  const handleToggle = () => {
    if (open) {
      closePanel();

      return;
    }

    setOpen(true);
    window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, SCROLL_DELAY_MS);

    if (!text.trim()) readSegment();
  };

  const handleGenerate = async () => {
    if (reading || submitting) return;

    const description = text.trim();

    if (!description) {
      showNote('先写一下想画什么。');

      return;
    }

    setSubmitting(true);

    try {
      await createImage({
        saveId: node.saveId,
        nodeId: node.id,
        description,
        source: FICTION_IMAGE_SOURCE.MANUAL,
      });

      if (aliveRef.current) setOpen(false);
    } catch (error) {
      console.warn('[Fiction] 手动配图没能开始：', error);
      showNote(error?.message || '没能开始生成，请再试一次。');
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  };

  if (!save || !save.imageMode || save.imageMode === FICTION_IMAGE_MODES.OFF) return null;

  const generating = Array.isArray(images)
    && images.some((image) => image.status === FICTION_IMAGE_STATUS.PENDING);

  const iconClass = [
    'fic-btn-reset',
    'fic-ic-mini',
    open ? 'is-open' : '',
    generating && !open ? 'is-busy' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={`fic-ic-wrap ${open ? 'is-open' : ''}`}>
        <div className="fic-ic-clip">
          <div className="fic-ic-panel" ref={panelRef} id={`fic-ic-${node.id}`}>
            <div className="fic-ic-label">画面描述</div>

            {reading ? (
              <div className="fic-ic-skeleton" role="status" aria-live="polite">
                <i style={{ width: '92%' }} />
                <i style={{ width: '78%' }} />
                <i style={{ width: '55%' }} />
                <span>AI 正在读这一段…</span>
              </div>
            ) : (
              <textarea
                className="fic-ic-text"
                rows={4}
                value={text}
                maxLength={DESCRIPTION_MAX}
                placeholder="写一写这一幕想画什么，比如：雨夜的窗边，男人背对镜头，女人站在门口。"
                aria-label="画面描述"
                onChange={(event) => setText(event.target.value)}
              />
            )}

            {note ? <p className="fic-ic-note" role="status">{note}</p> : null}

            <div className="fic-ic-actions">
              <button
                type="button"
                className="fic-btn-reset fic-ic-act"
                disabled={reading || submitting}
                onClick={readSegment}
              >
                <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
                让 AI 重写
              </button>
              <span className="fic-ic-grow" />
              <button
                type="button"
                className="fic-btn-reset fic-ic-act is-go"
                disabled={reading || submitting}
                onClick={handleGenerate}
              >
                {submitting ? '请稍等' : '生成'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={iconClass}
        aria-label={open ? '收起配图' : '给这一段配图'}
        aria-expanded={open}
        aria-controls={`fic-ic-${node.id}`}
        onClick={handleToggle}
      >
        <ImageIcon className="fic-ic-i-photo" size={15} strokeWidth={1.7} aria-hidden="true" />
        <ChevronDown className="fic-ic-i-close" size={15} strokeWidth={1.7} aria-hidden="true" />
      </button>
    </>
  );
};

export default FictionImageComposer;
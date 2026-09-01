// src/apps/margin-notes/MarginNotesArchive.jsx

import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Trash2,
  X
} from 'lucide-react';

import db from '../../db';

function getExcerpt(text = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 150) {
    return normalized;
  }

  return `${normalized.slice(0, 150)}…`;
}

export default function MarginNotesArchive({
  archiveList = [],
  onSelectPage,
  onDeletePage
}) {
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const handleDelete = async (event, id) => {
    event.stopPropagation();

    try {
      await db.marginNotes.delete(id);
      setDeleteTargetId(null);
      onDeletePage?.(id);
    } catch (error) {
      console.error('删除归档书页失败:', error);
    }
  };

  if (!archiveList || archiveList.length === 0) {
    return (
      <section className="mn-archive-empty">
        <BookOpen size={28} strokeWidth={1} />

        <h2>书架还是空的</h2>

        <p>
          翻阅第一篇名著，或生成一页共读内容。
          <br />
          你的阅读记录会留在这里。
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="mn-archive">
        <div className="mn-archive__intro">
          <span className="mn-archive__eyebrow">
            Personal reading archive
          </span>

          <span className="mn-archive__count">
            {archiveList.length} {archiveList.length === 1 ? 'PAGE' : 'PAGES'}
          </span>
        </div>

        <div className="mn-archive__list">
          {archiveList.map((item, index) => (
            <article
              key={item.id || `${item.createdAt}-${index}`}
              className="mn-archive-item"
              onClick={() => onSelectPage?.(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectPage?.(item);
                }
              }}
            >
              <div className="mn-archive-item__topline">
                <span>
                  {item.targetLanguageLabel ||
                    item.language?.toUpperCase() ||
                    'READING'}
                </span>

                <span className="mn-archive-item__date">
                  <Calendar size={11} strokeWidth={1.5} />
                  {item.date || '—'}
                </span>
              </div>

              <h2 className="mn-archive-item__title">
                {item.source?.workTitle || 'Untitled passage'}
              </h2>

              <p className="mn-archive-item__author">
                {item.source?.author
                  ? `by ${item.source.author}`
                  : 'Unknown author'}
              </p>

              <p className="mn-archive-item__excerpt">
                “{getExcerpt(item.originalText)}”
              </p>

              <div className="mn-archive-item__footer">
                <span className="mn-archive-item__companion">
                  {item.characterName
                    ? `与 ${item.characterName} 共读`
                    : '共读记录'}
                </span>

                <div className="mn-archive-item__actions">
                  <button
                    type="button"
                    className="mn-archive-item__delete"
                    title="删除书页"
                    aria-label="删除书页"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTargetId(item.id);
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>

                  <span className="mn-archive-item__open">
                    翻开
                    <ArrowRight size={14} strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {deleteTargetId && (
        <div
          className="mn-confirm-backdrop"
          onClick={() => setDeleteTargetId(null)}
        >
          <section
            className="mn-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mn-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="mn-confirm__close"
              onClick={() => setDeleteTargetId(null)}
              aria-label="关闭"
            >
              <X size={16} strokeWidth={1.5} />
            </button>

            <span className="mn-confirm__eyebrow">
              Remove from archive
            </span>

            <h2 id="mn-delete-title">确认移出书架？</h2>

            <p>
              该书页及其批注将被永久删除。
              <br />
              此操作无法撤销。
            </p>

            <div className="mn-confirm__actions">
              <button
                type="button"
                className="mn-confirm__cancel"
                onClick={() => setDeleteTargetId(null)}
              >
                取消
              </button>

              <button
                type="button"
                className="mn-confirm__delete"
                onClick={(event) => handleDelete(event, deleteTargetId)}
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';

import db from '../../db';
import { generateCharacterResonance } from './marginNotesAiService';

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitParagraphs(text = '') {
  return String(text)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getParagraphNotes(paragraph, notes = []) {
  const normalizedParagraph = paragraph.toLocaleLowerCase();

  return notes.filter((note) => {
    const anchor = String(note?.anchorPhrase || '').trim();

    return anchor && normalizedParagraph.includes(anchor.toLocaleLowerCase());
  });
}

/*
 * 按照 vocabulary 在原数组中的 index 保存索引。
 * 这样点击单词后，能稳定找到正确的释义。
 */
function getVocabularyMatches(paragraph, vocabulary = []) {
  const normalizedParagraph = paragraph.toLocaleLowerCase();

  return vocabulary
    .map((item, index) => ({
      ...item,
      originalIndex: index,
      term: String(item?.term || '').trim()
    }))
    .filter((item) => item.term)
    .filter((item) =>
      normalizedParagraph.includes(item.term.toLocaleLowerCase())
    )
    .sort((a, b) => {
      const aPosition = normalizedParagraph.indexOf(
        a.term.toLocaleLowerCase()
      );
      const bPosition = normalizedParagraph.indexOf(
        b.term.toLocaleLowerCase()
      );

      return aPosition - bPosition;
    });
}

function renderParagraphWithVocabulary(
  paragraph,
  matches,
  activeVocab,
  onVocabularyClick
) {
  if (!matches.length) return paragraph;

  const output = [];
  const lowerParagraph = paragraph.toLocaleLowerCase();
  let cursor = 0;

  matches.forEach((item) => {
    const lowerTerm = item.term.toLocaleLowerCase();
    const position = lowerParagraph.indexOf(lowerTerm, cursor);

    if (position < 0) return;

    if (position > cursor) {
      output.push(
        <React.Fragment key={`text-${cursor}`}>
          {paragraph.slice(cursor, position)}
        </React.Fragment>
      );
    }

    output.push(
      <button
        key={`word-${item.originalIndex}-${position}`}
        type="button"
        className={`mn-word ${
          activeVocab === item.originalIndex ? 'is-active' : ''
        }`}
        onClick={() => onVocabularyClick(item.originalIndex)}
      >
        {paragraph.slice(position, position + item.term.length)}
      </button>
    );

    cursor = position + item.term.length;
  });

  if (cursor < paragraph.length) {
    output.push(
      <React.Fragment key={`text-end-${cursor}`}>
        {paragraph.slice(cursor)}
      </React.Fragment>
    );
  }

  return output;
}

export default function MarginNotesPage({
  page,
  character,
  onPageUpdated,
  onOpenCompanionPicker,
  onOpenMenu
}) {
  const [activeVocab, setActiveVocab] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const paragraphs = useMemo(
    () => splitParagraphs(page?.originalText),
    [page?.originalText]
  );

  if (!page) {
    return (
      <div className="mn-empty">
        <div className="mn-empty__title">这本书还没有翻开。</div>
        <div className="mn-empty__text">
          从书架里选择一页，或翻开一篇新的共读文章。
        </div>
      </div>
    );
  }

  const vocabulary = Array.isArray(page.vocabulary)
    ? page.vocabulary
    : [];

  const characterNotes = Array.isArray(page.characterNotes)
    ? page.characterNotes
    : [];

  const userNotes = Array.isArray(page.userNotes)
    ? page.userNotes
    : [];

  const displayCharacterName =
    page.characterName || character?.name || 'Companion';

  const handleSubmitNote = async (event) => {
    event.preventDefault();

    const content = noteInput.trim();

    if (!content || isReplying) return;

    const newNote = {
      id: `user-note-${Date.now()}`,
      content,
      createdAt: Date.now(),
      characterReply: null,
      characterReplyAt: null
    };

    const optimisticNotes = [...userNotes, newNote];
    const optimisticPage = {
      ...page,
      userNotes: optimisticNotes
    };

    setNoteInput('');
    setIsReplying(true);
    onPageUpdated?.(optimisticPage);

    try {
      if (page.id) {
        await db.marginNotes.update(page.id, {
          userNotes: optimisticNotes
        });
      }

      /*
       * 历史页应优先使用它保存时对应的角色。
       * 但当前数据库角色对象可能已更新，因此这里仍传当前 selected character。
       */
      if (!character) return;

      const characterReply = await generateCharacterResonance({
        character,
        pageData: page,
        userNoteContent: content
      });

      if (!characterReply) return;

      const completedNote = {
        ...newNote,
        characterReply,
        characterReplyAt: Date.now()
      };

      const completedNotes = optimisticNotes.map((item) =>
        item.id === completedNote.id ? completedNote : item
      );

      if (page.id) {
        await db.marginNotes.update(page.id, {
          userNotes: completedNotes
        });
      }

      onPageUpdated?.({
        ...page,
        userNotes: completedNotes
      });
    } catch (error) {
      console.error('[MarginNotes] 保存页边回注失败：', error);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="mn-reading-page">
      <article className="mn-article">
        <header className="mn-frontmatter">
          <p className="mn-frontmatter__eyebrow">
            A passage kept for today
          </p>

          <h1>{page.source?.workTitle || 'Untitled passage'}</h1>

          <p className="mn-frontmatter__meta">
            {page.source?.author || 'Unknown author'}
            {page.source?.year ? ` · ${page.source.year}` : ''}
          </p>

          {page.source?.section && (
            <p className="mn-frontmatter__section">
              {page.source.section}
            </p>
          )}

          <button
            type="button"
            className="mn-companion"
            onClick={onOpenCompanionPicker}
            data-export-ignore="true"
          >
            <span>with {displayCharacterName}</span>
            <span style={{ opacity: 0.42 }}>·</span>
            <span>change</span>
          </button>
        </header>

        <section className="mn-text">
          {paragraphs.map((paragraph, paragraphIndex) => {
            const notesInParagraph = getParagraphNotes(
              paragraph,
              characterNotes
            );

            const vocabularyMatches = getVocabularyMatches(
              paragraph,
              vocabulary
            );

            return (
              <React.Fragment key={`paragraph-${paragraphIndex}`}>
                <p className="mn-paragraph">
                  {renderParagraphWithVocabulary(
                    paragraph,
                    vocabularyMatches,
                    activeVocab,
                    setActiveVocab
                  )}
                </p>

                {notesInParagraph.map((note, noteIndex) => (
                  <aside
                    key={note.id || `${paragraphIndex}-${noteIndex}`}
                    className={`mn-note ${
                      (paragraphIndex + noteIndex) % 3 === 2
                        ? 'is-left'
                        : ''
                    }`}
                  >
                    <span className="mn-note__anchor">
                      {note.anchorPhrase}
                    </span>

                    <p className="mn-note__text">{note.note}</p>

                    <span className="mn-note__signature">
                      — {displayCharacterName}
                    </span>
                  </aside>
                ))}
              </React.Fragment>
            );
          })}
        </section>

        {activeVocab !== null && vocabulary[activeVocab] && (
          <section className="mn-vocab">
            <div className="mn-section-label">Word note</div>

            <div className="mn-vocab-card">
              <div className="mn-vocab-card__head">
                <strong>{vocabulary[activeVocab].term}</strong>

                {vocabulary[activeVocab].phonetic && (
                  <span className="mn-vocab-card__phonetic">
                    {vocabulary[activeVocab].phonetic}
                  </span>
                )}
              </div>

              <div className="mn-vocab-card__meaning">
                {vocabulary[activeVocab].meaning}
              </div>

              {vocabulary[activeVocab].nuance && (
                <div className="mn-vocab-card__nuance">
                  {vocabulary[activeVocab].nuance}
                </div>
              )}
            </div>
          </section>
        )}

        {page.translation && (
          <section className="mn-translation">
            <button
              type="button"
              className="mn-translation__toggle"
              onClick={() => setShowTranslation((value) => !value)}
              data-export-ignore="true"
            >
              {showTranslation ? '收起参考译文' : '查看参考译文'}
              {showTranslation ? (
                <ChevronUp size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
            </button>

            {showTranslation && (
              <p className="mn-translation__text">
                {page.translation}
              </p>
            )}
          </section>
        )}

        {userNotes.length > 0 && (
          <section className="mn-notes">
            <div className="mn-section-label">
              Notes in the margin
            </div>

            {userNotes.map((item) => (
              <div
                className="mn-note-line"
                key={item.id || item.createdAt}
              >
                <div className="mn-note-line__user">
                  ✎ {item.content}
                </div>

                {item.characterReply && (
                  <div className="mn-note-line__reply">
                    <span className="mn-note-line__name">
                      {displayCharacterName.toUpperCase()}
                    </span>
                    {item.characterReply}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="mn-write" data-export-ignore="true">
          <div className="mn-write__hint">
            在这里留下你对这一页的回注。
          </div>

          <form className="mn-write__form" onSubmit={handleSubmitNote}>
            <textarea
              className="mn-write__input"
              rows={1}
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
              placeholder={
                isReplying
                  ? '角色正在读你的字……'
                  : '写下一句，不必完整。'
              }
              disabled={isReplying}
            />

            <button
              className="mn-submit"
              type="submit"
              disabled={!noteInput.trim() || isReplying}
              aria-label="保存回注"
            >
              <Send size={14} />
            </button>
          </form>
        </section>

        <footer className="mn-footer" data-export-ignore="true">
          {page.source?.sourceUrl ? (
            <a
              className="mn-source-link"
              href={page.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              查看原始出处
            </a>
          ) : (
            <span>来源链接未保存</span>
          )}

          <button type="button" onClick={onOpenMenu}>
            此页操作
          </button>
        </footer>
      </article>
    </div>
  );
}

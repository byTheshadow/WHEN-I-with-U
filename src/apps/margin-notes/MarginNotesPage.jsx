import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Send
} from 'lucide-react';

import db from '../../db';
import { generateCharacterResonance } from './marginNotesAiService';

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitParagraphs(text = '') {
  return text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findVocabularyInParagraph(paragraph, vocabulary = []) {
  return vocabulary.filter((item) => {
    if (!item?.term) return false;

    const term = item.term.trim();
    if (!term) return false;

    return new RegExp(escapeRegExp(term), 'i').test(paragraph);
  });
}

function renderParagraphWithVocabulary(
  paragraph,
  vocabulary,
  activeVocab,
  onVocabularyClick
) {
  const matched = vocabulary
    .filter((item) => item?.term)
    .map((item) => ({
      ...item,
      index: vocabulary.indexOf(item)
    }))
    .filter((item) => {
      const index = paragraph
        .toLocaleLowerCase()
        .indexOf(item.term.toLocaleLowerCase());

      return index >= 0;
    })
    .sort((a, b) => {
      const aIndex = paragraph
        .toLocaleLowerCase()
        .indexOf(a.term.toLocaleLowerCase());

      const bIndex = paragraph
        .toLocaleLowerCase()
        .indexOf(b.term.toLocaleLowerCase());

      return aIndex - bIndex;
    });

  if (matched.length === 0) {
    return paragraph;
  }

  const result = [];
  let cursor = 0;

  matched.forEach((item) => {
    const start = paragraph
      .toLocaleLowerCase()
      .indexOf(item.term.toLocaleLowerCase(), cursor);

    if (start < 0) return;

    if (start > cursor) {
      result.push(
        <React.Fragment key={`plain-${cursor}`}>
          {paragraph.slice(cursor, start)}
        </React.Fragment>
      );
    }

    result.push(
      <button
        key={`vocab-${item.index}-${start}`}
        type="button"
        className={`mn-vocab-mark ${
          activeVocab === item.index ? 'is-active' : ''
        }`}
        onClick={() => onVocabularyClick(item.index)}
      >
        {paragraph.slice(start, start + item.term.length)}
      </button>
    );

    cursor = start + item.term.length;
  });

  if (cursor < paragraph.length) {
    result.push(
      <React.Fragment key={`plain-end-${cursor}`}>
        {paragraph.slice(cursor)}
      </React.Fragment>
    );
  }

  return result;
}

function getNotesForParagraph(paragraph, notes = []) {
  return notes.filter((note) => {
    const anchor = note?.anchorPhrase?.trim();

    if (!anchor) return false;

    return paragraph
      .toLocaleLowerCase()
      .includes(anchor.toLocaleLowerCase());
  });
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
    () => splitParagraphs(page?.originalText || ''),
    [page?.originalText]
  );

  if (!page) {
    return (
      <div className="mn-empty">
        <div className="mn-empty__title">这本书还没有翻开。</div>
        <div className="mn-empty__text">
          从书架中选择一页，或翻开一篇新的共读文章。
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

  const handleVocabularyClick = (index) => {
    setActiveVocab(activeVocab === index ? null : index);
  };

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

    const updatedNotes = [...userNotes, newNote];
    const optimisticPage = {
      ...page,
      userNotes: updatedNotes
    };

    setNoteInput('');
    setIsReplying(true);
    onPageUpdated?.(optimisticPage);

    try {
      if (page.id) {
        await db.marginNotes.update(page.id, {
          userNotes: updatedNotes
        });
      }

      if (!character) return;

      const reply = await generateCharacterResonance({
        character,
        pageData: page,
        userNoteContent: content
      });

      if (!reply) return;

      const completedNote = {
        ...newNote,
        characterReply: reply,
        characterReplyAt: Date.now()
      };

      const completedNotes = updatedNotes.map((item) =>
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
      console.error('[MarginNotes] 保存回注失败：', error);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="mn-content">
      <div className="mn-running-head">
        <span>
          THE MARGIN NOTES
        </span>

        <span className="mn-running-head__right">
          {page.targetLanguageLabel || page.language?.toUpperCase() || 'READING'}
        </span>
      </div>

      <section className="mn-source">
        <div className="mn-source__eyebrow">
          A passage kept for today
        </div>

        <h1 className="mn-source__title">
          {page.source?.workTitle || 'Untitled passage'}
        </h1>

        <div className="mn-source__meta">
          {page.source?.author || 'Unknown author'}
          {page.source?.year ? ` · ${page.source.year}` : ''}
        </div>

        {page.source?.section && (
          <div className="mn-source__section">
            {page.source.section}
          </div>
        )}

        <button
          type="button"
          className="mn-companion-line"
          onClick={onOpenCompanionPicker}
          data-export-ignore="true"
        >
          {character?.avatar || page.characterAvatar ? (
            <img
              className="mn-companion-line__avatar"
              src={character?.avatar || page.characterAvatar}
              alt=""
            />
          ) : (
            <span className="mn-companion-line__placeholder" />
          )}

          <span>
            with {character?.name || page.characterName || 'Companion'}
          </span>

          <span aria-hidden="true">·</span>
          <span>change</span>
        </button>
      </section>

      <section className="mn-reading">
        {paragraphs.map((paragraph, paragraphIndex) => {
          const paragraphNotes = getNotesForParagraph(
            paragraph,
            characterNotes
          );

          const paragraphVocabulary = findVocabularyInParagraph(
            paragraph,
            vocabulary
          );

          return (
            <React.Fragment key={`paragraph-${paragraphIndex}`}>
              <p className="mn-paragraph">
                {renderParagraphWithVocabulary(
                  paragraph,
                  paragraphVocabulary,
                  activeVocab,
                  handleVocabularyClick
                )}
              </p>

              {paragraphNotes.map((note, noteIndex) => (
                <aside
                  key={note.id || `${paragraphIndex}-${noteIndex}`}
                  className={`mn-inline-bookmark ${
                    (paragraphIndex + noteIndex) % 3 === 2
                      ? 'is-left'
                      : ''
                  }`}
                >
                  <span className="mn-inline-bookmark__anchor">
                    {note.anchorPhrase}
                  </span>

                  <p className="mn-inline-bookmark__text">
                    {note.note}
                  </p>

                  <span className="mn-inline-bookmark__signature">
                    — {page.characterName || character?.name || 'Companion'}
                  </span>
                </aside>
              ))}
            </React.Fragment>
          );
        })}
      </section>

      {activeVocab !== null && vocabulary[activeVocab] && (
        <section className="mn-vocabulary">
          <div className="mn-section-label">
            Word note
          </div>

          <div className="mn-word">
            <div className="mn-word__head">
              <strong>{vocabulary[activeVocab].term}</strong>

              {vocabulary[activeVocab].phonetic && (
                <span className="mn-word__phonetic">
                  {vocabulary[activeVocab].phonetic}
                </span>
              )}
            </div>

            <div className="mn-word__meaning">
              {vocabulary[activeVocab].meaning}
            </div>

            {vocabulary[activeVocab].nuance && (
              <div className="mn-word__nuance">
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
        <section className="mn-responses">
          <div className="mn-section-label">
            Notes left in the margin
          </div>

          {userNotes.map((item) => (
            <div
              className="mn-response"
              key={item.id || item.createdAt}
            >
              <div className="mn-response__user">
                <span className="mn-response__name">
                  YOU
                </span>
                {item.content}
              </div>

              {item.characterReply && (
                <div className="mn-response__character">
                  <span className="mn-response__name">
                    {page.characterName || character?.name || 'COMPANION'}
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

        <form
          className="mn-write__form"
          onSubmit={handleSubmitNote}
        >
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

      <footer className="mn-footer-actions" data-export-ignore="true">
        <button
          type="button"
          className="mn-footer-action"
          onClick={() => onOpenMenu?.()}
        >
          <span>这页的出处与操作</span>
        </button>
      </footer>
    </div>
  );
}

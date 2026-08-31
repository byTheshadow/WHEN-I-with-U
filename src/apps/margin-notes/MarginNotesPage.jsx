// src/apps/margin-notes/MarginNotesPage.jsx
import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { generateCharacterResonance } from './marginNotesAiService';
import db from '../../db';

export default function MarginNotesPage({
  page,
  character,
  pageRef,
  onPageUpdated,
  onOpenCompanionPicker
}) {
  const [activeVocab, setActiveVocab] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [userNoteInput, setUserNoteInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  if (!page) return null;

  // 提交读者回注
  const handleAddUserNote = async (e) => {
    e.preventDefault();
    if (!userNoteInput.trim() || isReplying) return;

    const content = userNoteInput.trim();
    setUserNoteInput('');
    setIsReplying(true);

    const newNote = {
      id: `un-${Date.now()}`,
      content,
      createdAt: Date.now(),
      characterReply: null,
      characterReplyAt: null
    };

    const updatedNotes = [...(page.userNotes || []), newNote];
    const updatedPage = { ...page, userNotes: updatedNotes };

    try {
      if (page.id) {
        await db.marginNotes.update(page.id, { userNotes: updatedNotes });
      }
      onPageUpdated?.(updatedPage);

      // 请求伴读角色生成回响
      if (character) {
        const resonance = await generateCharacterResonance({
          character,
          pageData: page,
          userNoteContent: content
        });

        if (resonance) {
          newNote.characterReply = resonance;
          newNote.characterReplyAt = Date.now();
          const finalNotes = updatedNotes.map((n) =>
            n.id === newNote.id ? newNote : n
          );
          if (page.id) {
            await db.marginNotes.update(page.id, { userNotes: finalNotes });
          }
          onPageUpdated?.({ ...page, userNotes: finalNotes });
        }
      }
    } catch (err) {
      console.error('提交回注失败:', err);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div ref={pageRef} className="margin-notes-sheet text-left">
      {/* 1. 书眉 Running Head */}
      <div className="mn-running-head">
        The Margin Notes · {page.targetLanguageLabel || page.language?.toUpperCase()}
      </div>

      {/* 2. 扉页与出处元数据 */}
      <div className="mn-front-matter">
        <h2 className="mn-work-title">{page.source?.workTitle || 'Untitled'}</h2>
        <div className="mn-author-meta">
          {page.source?.author}
          {page.source?.year ? ` · ${page.source.year}` : ''}
          {page.source?.section ? ` · ${page.source.section}` : ''}
        </div>

        {/* 伴读签名徽章 (点击可切换伴读) */}
        <div>
          <button
            type="button"
            data-export-ignore="true"
            onClick={onOpenCompanionPicker}
            className="mn-companion-badge"
          >
            <span>with {page.characterName || character?.name || 'Companion'}</span>
            <span className="opacity-50">✎</span>
          </button>
        </div>
      </div>

      {/* 3. 正文排版 */}
      <div className="mn-reading-text select-text whitespace-pre-line">
        {page.originalText}
      </div>

      {/* 4. 译文小折叠 */}
      {page.translation && (
        <div className="mt-6 pt-3 border-t border-dashed" style={{ borderColor: 'var(--card-border)' }}>
          <button
            type="button"
            data-export-ignore="true"
            onClick={() => setShowTranslation(!showTranslation)}
            className="flex items-center gap-1 text-[11px] opacity-40 hover:opacity-75 transition-opacity mb-2"
          >
            <span>{showTranslation ? '收起译文' : '查看参考译文'}</span>
            {showTranslation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showTranslation && (
            <p className="text-xs leading-relaxed opacity-70 font-serif whitespace-pre-line animate-in fade-in duration-200">
              {page.translation}
            </p>
          )}
        </div>
      )}

      {/* 5. 角色的页边批注 */}
      {page.characterNotes && page.characterNotes.length > 0 && (
        <div className="mt-8 space-y-4">
          {page.characterNotes.map((cn, idx) => (
            <div key={cn.id || idx} className="mn-character-pencil">
              {cn.anchorPhrase && (
                <div className="mn-pencil-anchor">
                  § {cn.anchorPhrase}
                </div>
              )}
              <div>{cn.note}</div>
              <div className="mn-character-sig">
                — {page.characterName || character?.name || 'Companion'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. 生词轻触标签条 */}
      {page.vocabulary && page.vocabulary.length > 0 && (
        <div className="mt-6 pt-3" data-export-ignore="true">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase font-mono tracking-widest opacity-35 mr-1">
              Words
            </span>
            {page.vocabulary.map((vocab, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveVocab(activeVocab === i ? null : i)}
                className={`text-xs px-2 py-0.5 rounded transition-all font-serif ${
                  activeVocab === i ? 'bg-[var(--control-soft-bg)] font-bold' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ border: '1px solid var(--card-border)' }}
              >
                {vocab.term}
              </button>
            ))}
          </div>

          {/* 生词极简释义条 */}
          {activeVocab !== null && page.vocabulary[activeVocab] && (
            <div
              className="mt-2.5 p-3 rounded-lg text-xs space-y-1 relative animate-in fade-in duration-150"
              style={{ backgroundColor: 'var(--control-soft-bg)' }}
            >
              <button
                onClick={() => setActiveVocab(null)}
                className="absolute right-2 top-2 opacity-40 hover:opacity-80"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="font-bold flex items-center gap-2">
                <span>{page.vocabulary[activeVocab].term}</span>
                {page.vocabulary[activeVocab].phonetic && (
                  <span className="font-mono text-[10px] opacity-40">
                    {page.vocabulary[activeVocab].phonetic}
                  </span>
                )}
              </div>
              <div className="opacity-80">{page.vocabulary[activeVocab].meaning}</div>
              {page.vocabulary[activeVocab].nuance && (
                <div className="opacity-50 text-[11px] italic pt-0.5">
                  {page.vocabulary[activeVocab].nuance}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. 读者与伴读的历史回注流 */}
      {page.userNotes && page.userNotes.length > 0 && (
        <div className="mt-8 space-y-4">
          {page.userNotes.map((un) => (
            <div key={un.id} className="space-y-2 text-xs">
              <div className="flex items-start gap-2 italic opacity-85 font-serif">
                <span className="opacity-40">✎</span>
                <span>{un.content}</span>
              </div>
              {un.characterReply && (
                <div
                  className="ml-4 pl-3 py-1 border-l text-xs italic opacity-75 font-serif"
                  style={{ borderColor: 'var(--card-border)' }}
                >
                  <span className="not-italic opacity-45 mr-1.5 text-[10px]">
                    {page.characterName || 'Companion'}:
                  </span>
                  {un.characterReply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 8. 读者手写回注输入 */}
      <div className="mn-reader-note-area" data-export-ignore="true">
        <form onSubmit={handleAddUserNote} className="space-y-2">
          <textarea
            rows={1}
            value={userNoteInput}
            onChange={(e) => setUserNoteInput(e.target.value)}
            placeholder="在页边留下一句手写注..."
            className="mn-handwritten-input"
          />
          {userNoteInput.trim() && (
            <div className="flex justify-end items-center gap-2 pt-1 animate-in fade-in">
              <span className="text-[10px] opacity-40">
                {isReplying ? '回想中...' : 'Enter 记下'}
              </span>
              <button
                type="submit"
                disabled={isReplying}
                className="p-1.5 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] opacity-90 hover:opacity-100"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

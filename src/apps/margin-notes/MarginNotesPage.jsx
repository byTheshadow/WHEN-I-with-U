// src/apps/margin-notes/MarginNotesPage.jsx
import React, { useState, useRef } from 'react';
import {
  Download,
  Trash2,
  Send,
  MessageSquare,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { exportPageToImage } from './marginNotesExportService';
import { generateCharacterResonance } from './marginNotesAiService';
import db from '../../db';

export default function MarginNotesPage({
  page,
  character,
  onPageUpdated,
  onDeletePage
}) {
  const [activeVocab, setActiveVocab] = useState(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [userReplyText, setUserReplyText] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const pageRef = useRef(null);

  if (!page) return null;

  // 导出书页图片
  const handleExport = async () => {
    if (!pageRef.current || isExporting) return;
    try {
      setIsExporting(true);
      const filename = `margin-note-${page.source?.workTitle || 'page'}-${page.date || 'today'}.png`;
      await exportPageToImage(pageRef.current, filename);
    } catch (err) {
      alert('导出图片失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // 读者提交回注并触发角色回响
  const handleSubmitUserNote = async (e) => {
    e.preventDefault();
    if (!userReplyText.trim() || isResponding) return;

    const noteContent = userReplyText.trim();
    setUserReplyText('');
    setIsResponding(true);

    const newUserNote = {
      id: `user-note-${Date.now()}`,
      content: noteContent,
      createdAt: Date.now(),
      characterReply: null,
      characterReplyAt: null
    };

    const updatedUserNotes = [...(page.userNotes || []), newUserNote];
    const updatedPage = { ...page, userNotes: updatedUserNotes };

    try {
      if (page.id) {
        await db.marginNotes.update(page.id, { userNotes: updatedUserNotes });
      }
      onPageUpdated?.(updatedPage);

      // 请求角色生成回响
      if (character) {
        const resonance = await generateCharacterResonance({
          character,
          pageData: page,
          userNoteContent: noteContent
        });

        if (resonance) {
          newUserNote.characterReply = resonance;
          newUserNote.characterReplyAt = Date.now();
          const finalUserNotes = updatedUserNotes.map((un) =>
            un.id === newUserNote.id ? newUserNote : un
          );
          if (page.id) {
            await db.marginNotes.update(page.id, { userNotes: finalUserNotes });
          }
          onPageUpdated?.({ ...page, userNotes: finalUserNotes });
        }
      }
    } catch (err) {
      console.error('提交回注或生成回响失败:', err);
    } finally {
      setIsResponding(false);
    }
  };

  // 确认删除当前页
  const handleConfirmDelete = async () => {
    if (!page.id) return;
    try {
      await db.marginNotes.delete(page.id);
      setShowDeleteConfirm(false);
      onDeletePage?.(page.id);
    } catch (err) {
      console.error('删除书页失败:', err);
    }
  };

  return (
    <div className="book-page-container px-3.5 py-2">
      {/* 操作工具栏 */}
      <div className="flex items-center justify-between px-1 mb-2.5 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1 opacity-70">
          <BookOpen className="h-3.5 w-3.5" />
          {page.targetLanguageLabel || page.language?.toUpperCase() || 'READING'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
            title="导出书页为图片"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? '导出中' : '存为书签'}</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 rounded-md opacity-50 hover:opacity-90 hover:text-red-500 transition-colors"
            title="删除此书页"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 书籍实体纸页 */}
      <div ref={pageRef} className="book-paper text-left">
        {/* 顶部 Running Head 出处信息 */}
        <div className="book-running-head">
          <div className="truncate max-w-[240px]">
            <span className="font-semibold">{page.source?.workTitle || 'Untitled'}</span>
            {page.source?.author && ` · ${page.source.author}`}
          </div>
          <div className="opacity-60 text-[10px]">
            {page.source?.year || page.date || ''}
          </div>
        </div>

        {/* 篇章小节标 */}
        {page.source?.section && (
          <div className="px-5 pt-3 text-[11px] font-mono uppercase tracking-widest opacity-40">
            {page.source.section}
          </div>
        )}

        {/* 原文排版区 */}
        <div className="p-5 pb-4">
          <div className="book-typography select-text whitespace-pre-line">
            {page.originalText}
          </div>

          {/* 译文折叠区 */}
          {page.translation && (
            <div className="mt-4 pt-3 border-t border-dashed" style={{ borderColor: 'var(--card-border)' }}>
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                data-export-ignore="true"
                className="flex items-center gap-1 text-[11px] opacity-50 hover:opacity-80 transition-opacity mb-2"
              >
                <span>{page.auxiliaryLanguageLabel || '辅助译文'}</span>
                {showTranslation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showTranslation && (
                <p className="text-xs leading-relaxed opacity-75 whitespace-pre-line">
                  {page.translation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 生词/短语注解条 */}
        {page.vocabulary && page.vocabulary.length > 0 && (
          <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--bg-soft, transparent)' }}>
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-50 mb-2 flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>Vocabulary & Nuances</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2" data-export-ignore="true">
              {page.vocabulary.map((v, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveVocab(activeVocab === idx ? null : idx)}
                  className={`text-xs px-2 py-0.5 rounded-full transition-all ${
                    activeVocab === idx ? 'font-bold ring-1 ring-current' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: 'var(--control-soft-bg)' }}
                >
                  {v.term}
                </button>
              ))}
            </div>

            {/* 展开的生词详解 */}
            {activeVocab !== null && page.vocabulary[activeVocab] && (
              <div className="p-2.5 rounded-lg text-xs space-y-1 animate-in fade-in duration-150" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold">{page.vocabulary[activeVocab].term}</span>
                  {page.vocabulary[activeVocab].phonetic && (
                    <span className="font-mono opacity-50 text-[10px]">
                      {page.vocabulary[activeVocab].phonetic}
                    </span>
                  )}
                </div>
                <div className="opacity-90">{page.vocabulary[activeVocab].meaning}</div>
                {page.vocabulary[activeVocab].nuance && (
                  <div className="opacity-60 text-[11px] italic">
                    {page.vocabulary[activeVocab].nuance}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 角色的页边铅笔批注 */}
        {page.characterNotes && page.characterNotes.length > 0 && (
          <div className="px-5 py-3 space-y-2.5 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <div className="text-[10px] uppercase font-mono tracking-wider opacity-50 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>{page.characterName || 'Companion'}’s Margin Notes</span>
            </div>
            {page.characterNotes.map((cn, idx) => (
              <div key={cn.id || idx} className="character-pencil-note">
                {cn.anchorPhrase && (
                  <div className="text-[10px] font-serif font-bold uppercase tracking-wider opacity-60 mb-0.5">
                    「 {cn.anchorPhrase} 」
                  </div>
                )}
                <div className="font-serif italic">{cn.note}</div>
              </div>
            ))}
          </div>
        )}

        {/* 读者的回注与角色回响列表 */}
        {page.userNotes && page.userNotes.length > 0 && (
          <div className="px-5 py-3 space-y-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
            {page.userNotes.map((un) => (
              <div key={un.id} className="space-y-1.5 text-xs">
                {/* 读者自己的铅笔注 */}
                <div className="flex items-start gap-2 opacity-85">
                  <div className="h-1.5 w-1.5 rounded-full mt-1.5 bg-current opacity-40 shrink-0" />
                  <div className="font-serif">{un.content}</div>
                </div>
                {/* 角色的回响 */}
                {un.characterReply && (
                  <div
                    className="ml-3.5 pl-2.5 py-1 border-l-2 text-xs italic opacity-80"
                    style={{ borderColor: 'var(--text-muted)' }}
                  >
                    <span className="font-semibold not-italic opacity-60 mr-1.5">
                      {page.characterName || 'Reply'}:
                    </span>
                    {un.characterReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 底部读者书写回注输入框 */}
        <div className="reader-response-block" data-export-ignore="true">
          <form onSubmit={handleSubmitUserNote} className="space-y-2">
            <textarea
              rows={2}
              value={userReplyText}
              onChange={(e) => setUserReplyText(e.target.value)}
              placeholder="在此写下你在页边的铅笔注，与对方交换心绪..."
              className="pencil-input"
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] opacity-40">
                {isResponding ? '伴读回想中...' : '回注将保存于此页'}
              </span>
              <button
                type="submit"
                disabled={!userReplyText.trim() || isResponding}
                className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium opacity-80 hover:opacity-100 disabled:opacity-30 transition-all"
                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
              >
                <Send className="h-3 w-3" />
                <span>记下</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div
            className="w-full max-w-xs rounded-xl p-4 shadow-xl text-left space-y-3"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <h4 className="text-sm font-bold">撕下此书页？</h4>
            <p className="text-xs opacity-70">
              删除后，此页的文学摘录、伴读批注与你的手写回注都将从书架中移除。
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 rounded text-xs opacity-70 hover:opacity-100"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1 rounded text-xs font-medium bg-red-500/20 text-red-500 hover:bg-red-500/30"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

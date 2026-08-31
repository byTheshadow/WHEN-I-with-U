// src/apps/margin-notes/MarginNotesArchive.jsx
import React, { useState } from 'react';
import { BookOpen, Calendar, Trash2, ArrowRight } from 'lucide-react';
import db from '../../db';

export default function MarginNotesArchive({
  archiveList = [],
  onSelectPage,
  onDeletePage
}) {
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await db.marginNotes.delete(id);
      setDeleteTargetId(null);
      onDeletePage?.(id);
    } catch (err) {
      console.error('删除归档书页失败:', err);
    }
  };

  if (!archiveList || archiveList.length === 0) {
    return (
      <div className="py-16 px-4 text-center space-y-2 opacity-50">
        <BookOpen className="h-8 w-8 mx-auto stroke-1" />
        <p className="text-xs">书架暂无归档书页</p>
        <p className="text-[10px]">翻阅第一篇名著或生成共读页后，将在此陈列。</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px] mx-auto px-3.5 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-widest opacity-40 px-1 text-left">
        Bookshelf Archive ({archiveList.length})
      </div>

      <div className="space-y-2.5">
        {archiveList.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectPage(item)}
            className="group p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between text-left relative overflow-hidden"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)'
            }}
          >
            {/* Header info */}
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
              <span className="font-mono uppercase">{item.targetLanguageLabel || item.language}</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 opacity-60" />
                <span>{item.date || ''}</span>
              </div>
            </div>

            {/* Title and Author */}
            <div className="font-serif font-bold text-sm line-clamp-1 mb-1">
              {item.source?.workTitle || 'Untitled Excerpt'}
            </div>
            <div className="text-xs opacity-60 line-clamp-1 mb-2">
              {item.source?.author ? `by ${item.source.author}` : ''}
            </div>

            {/* Excerpt snippet */}
            <p className="text-xs opacity-70 line-clamp-2 italic font-serif leading-relaxed">
              "{item.originalText}"
            </p>

            {/* Footer */}
            <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--card-border)' }}>
              <span className="opacity-60 text-[10px]">
                {item.characterName ? `与 ${item.characterName} 共读` : '共读记录'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(item.id);
                  }}
                  className="p-1 opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-0.5 font-medium opacity-80 group-hover:translate-x-0.5 transition-transform">
                  <span>翻开</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 删除确认弹窗 */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div
            className="w-full max-w-xs rounded-xl p-4 shadow-xl text-left space-y-3"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <h4 className="text-sm font-bold">确认移出书架？</h4>
            <p className="text-xs opacity-70">该书页及其批注将被永久删除。</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-3 py-1 rounded text-xs opacity-70 hover:opacity-100"
              >
                取消
              </button>
              <button
                onClick={(e) => handleDelete(e, deleteTargetId)}
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

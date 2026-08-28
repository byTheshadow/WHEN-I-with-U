import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

import {
  buildMemoryExport,
  downloadMemoryExport
} from './memoryImportExport';

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const MemoryExportModal = ({
  currentChat,
  onClose,
  onCompleted,
  onError
}) => {
  const [scope, setScope] = useState('current_chat');
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState(null);

  const handlePreview = async () => {
    try {
      const exportScope = scope === 'current_chat'
        ? { type: 'chat', chatId: currentChat?.id }
        : { type: 'all' };

      const payload = await buildMemoryExport(exportScope);

      setPreview({
        chatCount: payload.chatReferences?.length || 0,
        memoryCount: payload.memories?.length || 0,
        candidateCount: payload.candidates?.length || 0,
        revisionCount: payload.revisions?.length || 0,
        exportedAt: payload.exportedAt
      });
    } catch (error) {
      onError?.(error?.message || '生成导出预览失败。');
    }
  };

  const handleExport = async () => {
    if (scope === 'current_chat' && !currentChat?.id) {
      onError?.('请先选择一个消息框。');
      return;
    }

    setIsExporting(true);

    try {
      const exportScope = scope === 'current_chat'
        ? { type: 'chat', chatId: currentChat.id }
        : { type: 'all' };

      const payload = await downloadMemoryExport(exportScope);

      onCompleted?.(
        scope === 'current_chat'
          ? `已导出“${currentChat.title || '当前消息框'}”的 ${payload.memories?.length || 0} 条记忆。`
          : `已导出全部消息框的 ${payload.memories?.length || 0} 条记忆。`
      );

      onClose?.();
    } catch (error) {
      onError?.(error?.message || '导出记忆失败。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="memory-modal-backdrop">
      <section
        className="memory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-export-title"
      >
        <div className="memory-modal-header">
          <div>
            <p className="memory-eyebrow">TAKE A COPY</p>
            <h2 id="memory-export-title">带走一份记忆副本</h2>
          </div>

          <button
            type="button"
            className="memory-modal-close"
            onClick={onClose}
            aria-label="关闭导出窗口"
          >
            <X className="memory-icon" />
          </button>
        </div>

        <div className="memory-export-copy">
          <p>
            导出的 JSON 可用于之后恢复记忆。它不包含聊天原文、API Key
            或运行中的任务状态。
          </p>
          <p>
            导出文件会保留记忆、待确认片段、修订记录，以及原始消息依据的状态。
          </p>
        </div>

        <div className="memory-choice-list">
          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportScope"
              value="current_chat"
              checked={scope === 'current_chat'}
              onChange={() => {
                setScope('current_chat');
                setPreview(null);
              }}
              disabled={!currentChat}
            />
            <span>
              <strong>导出当前消息框</strong>
              <small>
                {currentChat
                  ? `仅导出“${currentChat.title || '当前消息框'}”的记忆。`
                  : '请先选择一个消息框。'}
              </small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportScope"
              value="all"
              checked={scope === 'all'}
              onChange={() => {
                setScope('all');
                setPreview(null);
              }}
            />
            <span>
              <strong>导出全部记忆</strong>
              <small>导出所有消息框中已保存的记忆档案。</small>
            </span>
          </label>
        </div>

        <button
          type="button"
          className="memory-preview-button"
          onClick={handlePreview}
        >
          查看导出内容概览
        </button>

        {preview && (
          <div className="memory-export-preview">
            <div>
              <span>涉及消息框</span>
              <strong>{preview.chatCount}</strong>
            </div>
            <div>
              <span>正式记忆</span>
              <strong>{preview.memoryCount}</strong>
            </div>
            <div>
              <span>待确认片段</span>
              <strong>{preview.candidateCount}</strong>
            </div>
            <div>
              <span>修订记录</span>
              <strong>{preview.revisionCount}</strong>
            </div>
            <small>预览生成时间：{formatDate(preview.exportedAt)}</small>
          </div>
        )}

        <div className="memory-modal-actions">
          <button
            type="button"
            className="memory-secondary-button"
            onClick={onClose}
            disabled={isExporting}
          >
            取消
          </button>

          <button
            type="button"
            className="memory-primary-button"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="memory-action-icon" />
            {isExporting ? '正在导出' : '导出 JSON'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default MemoryExportModal;

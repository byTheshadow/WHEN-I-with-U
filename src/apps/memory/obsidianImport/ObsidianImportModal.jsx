import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Upload,
  X
} from 'lucide-react';

import ConfirmModal from '../../../components/ConfirmModal';
import {
  MEMORY_STATUSES,
  MEMORY_TYPE_OPTIONS,
  MEMORY_TYPES
} from '../memoryConstants';
import {
  importObsidianEntries,
  parseObsidianFiles
} from './obsidianImportService';
import './obsidianImport.css';

const getChatLabel = (chat) => (
  chat?.title || `消息框 ${chat?.id || ''}`
);

export const ObsidianImportModal = ({
  chats = [],
  initialChatId = null,
  onClose,
  onCompleted,
  onError
}) => {
  const fileInputRef = useRef(null);

  const [parseResult, setParseResult] = useState(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState(() => new Set());
  const [targetChatId, setTargetChatId] = useState(initialChatId || '');
  const [defaultType, setDefaultType] = useState(MEMORY_TYPES.FACT);
  const [defaultImportance, setDefaultImportance] = useState(3);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(targetChatId)) || null,
    [chats, targetChatId]
  );

  const selectedCount = selectedEntryIds.size;

  const handleFileChange = async (event) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    setIsParsing(true);
    setLocalError('');

    try {
      const result = await parseObsidianFiles(files);

      setParseResult(result);
      setSelectedEntryIds(new Set(
        result.notes
          .filter((note) => !note.error)
          .flatMap((note) => note.entries.map((entry) => entry.clientEntryId))
      ));
    } catch (error) {
      const message = error?.message || '读取 Obsidian 笔记失败。';

      setLocalError(message);
      onError?.(message);
      setParseResult(null);
    } finally {
      setIsParsing(false);

      // 允许再次选择同一批文件（例如改完笔记后重新导入）。
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleEntry = (clientEntryId) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);

      if (next.has(clientEntryId)) {
        next.delete(clientEntryId);
      } else {
        next.add(clientEntryId);
      }

      return next;
    });
  };

  const setAllEntries = (checked) => {
    if (!parseResult) return;

    if (!checked) {
      setSelectedEntryIds(new Set());
      return;
    }

    setSelectedEntryIds(new Set(
      parseResult.notes
        .filter((note) => !note.error)
        .flatMap((note) => note.entries.map((entry) => entry.clientEntryId))
    ));
  };

  const handleStartImport = () => {
    if (!parseResult) {
      setLocalError('请先选择一个或多个 .md 文件。');
      return;
    }

    if (!selectedChat) {
      setLocalError('请选择记忆要进入的消息框。');
      return;
    }

    if (selectedCount === 0) {
      setLocalError('请至少勾选一条要导入的内容。');
      return;
    }

    setLocalError('');
    setShowConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !selectedChat) return;

    setShowConfirm(false);
    setIsImporting(true);
    setLocalError('');

    try {
      const result = await importObsidianEntries({
        chatId: selectedChat.id,
        notes: parseResult.notes,
        selectedEntryIds: Array.from(selectedEntryIds),
        defaultType,
        defaultImportance,
        defaultStatus: MEMORY_STATUSES.ACTIVE
      });

      const failedNote = result.failedCount > 0
        ? `，${result.failedCount} 条导入失败`
        : '';

      onCompleted?.(
        `Obsidian 导入完成：新增 ${result.insertedCount} 条记忆，`
        + `更新 ${result.updatedCount} 条${failedNote}。`
      );

      onClose?.();
    } catch (error) {
      const message = error?.message || '导入 Obsidian 笔记失败。';

      setLocalError(message);
      onError?.(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="memory-modal-backdrop">
        <section
          className="memory-modal obsidian-import-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="obsidian-import-title"
        >
          <div className="memory-modal-header">
            <div>
              <p className="memory-eyebrow">OBSIDIAN INTAKE</p>
              <h2 id="obsidian-import-title">导入 Obsidian 笔记</h2>
            </div>

            <button
              type="button"
              className="memory-modal-close"
              onClick={onClose}
              aria-label="关闭导入窗口"
              disabled={isImporting}
            >
              <X className="memory-icon" />
            </button>
          </div>

          <div className="memory-import-copy">
            <p>
              选择一个或多个 Obsidian 的 .md 文件，每个标题下的内容会拆分成
              一条独立的记忆。笔记不会自动按角色归属，导入到哪个消息框由你在
              下面手动选择。
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            multiple
            className="memory-hidden-file-input"
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="memory-file-picker"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || isImporting}
          >
            <FileText className="memory-file-picker-icon" />
            <span>
              <strong>
                {isParsing
                  ? '正在阅读笔记'
                  : parseResult
                    ? '已读取笔记文件'
                    : '选择 .md 笔记文件'}
              </strong>
              <small>
                {parseResult
                  ? `共 ${parseResult.summary.noteCount} 篇笔记，`
                    + `解析出 ${parseResult.summary.totalEntryCount} 条内容`
                  : '支持一次选择多个文件'}
              </small>
            </span>
            <Upload className="memory-icon" />
          </button>

          {localError && (
            <div className="memory-message memory-message-error">
              <span>{localError}</span>
            </div>
          )}

          {parseResult && (
            <>
              {parseResult.summary.failedNoteCount > 0 && (
                <div className="memory-import-warning">
                  <AlertTriangle className="memory-action-icon" />
                  有 {parseResult.summary.failedNoteCount} 篇笔记读取失败，
                  已跳过，不影响其余笔记导入。
                </div>
              )}

              <label className="memory-form-label">
                <span>导入到哪一个消息框</span>
                <select
                  value={targetChatId}
                  onChange={(event) => setTargetChatId(event.target.value)}
                  disabled={isImporting}
                >
                  <option value="">请选择消息框</option>
                  {chats.map((chat) => (
                    <option key={chat.id} value={chat.id}>
                      {getChatLabel(chat)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="obsidian-default-fields">
                <label className="memory-form-label">
                  <span>默认记忆类型（笔记未指定时使用）</span>
                  <select
                    value={defaultType}
                    onChange={(event) => setDefaultType(event.target.value)}
                    disabled={isImporting}
                  >
                    {MEMORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="memory-form-label">
                  <span>默认重要度（1-5，笔记未指定时使用）</span>
                  <select
                    value={defaultImportance}
                    onChange={(event) => setDefaultImportance(
                      Number(event.target.value)
                    )}
                    disabled={isImporting}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="obsidian-select-actions">
                <span className="memory-form-label-title">
                  已选择 {selectedCount} / {parseResult.summary.totalEntryCount} 条
                </span>
                <button
                  type="button"
                  onClick={() => setAllEntries(true)}
                  disabled={isImporting}
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setAllEntries(false)}
                  disabled={isImporting}
                >
                  全不选
                </button>
              </div>

              <div className="obsidian-entry-list">
                {parseResult.notes.map((note) => (
                  <div key={note.fileName} className="obsidian-note-group">
                    <p className="obsidian-note-group-title">
                      {note.noteTitle}
                      {note.tags?.length > 0 && ` · ${note.tags.join(', ')}`}
                    </p>

                    {note.error && (
                      <p className="obsidian-note-error">{note.error}</p>
                    )}

                    {!note.error && note.entries.length === 0 && (
                      <p className="obsidian-note-error">
                        这篇笔记没有可导入的内容。
                      </p>
                    )}

                    {note.entries.map((entry) => (
                      <label
                        key={entry.clientEntryId}
                        className={[
                          'memory-choice-item',
                          selectedEntryIds.has(entry.clientEntryId)
                            ? 'memory-choice-item-active'
                            : ''
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.has(entry.clientEntryId)}
                          onChange={() => toggleEntry(entry.clientEntryId)}
                          disabled={isImporting}
                        />
                        <span>
                          <strong>{entry.title}</strong>
                          <small>{entry.content}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="memory-modal-actions">
            <button
              type="button"
              className="memory-secondary-button"
              onClick={onClose}
              disabled={isImporting}
            >
              取消
            </button>

            <button
              type="button"
              className="memory-primary-button"
              onClick={handleStartImport}
              disabled={
                !parseResult
                || !selectedChat
                || selectedCount === 0
                || isImporting
              }
            >
              {isImporting ? '正在写入档案' : '继续导入'}
            </button>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="确认导入 Obsidian 笔记"
        message={
          `确定要把选中的 ${selectedCount} 条内容导入`
          + `“${selectedChat?.title || '当前消息框'}”吗？`
          + '与之前导入过、标题和文件都相同的内容会被覆盖更新，其余内容将新增为记忆。'
        }
        confirmText="确认导入"
        cancelText="返回检查"
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmImport}
      />
    </>
  );
};

export default ObsidianImportModal;
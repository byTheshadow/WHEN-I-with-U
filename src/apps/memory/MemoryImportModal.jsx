import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileJson2,
  Upload,
  X
} from 'lucide-react';

import ConfirmModal from '../../components/ConfirmModal';
import {
  MEMORY_IMPORT_MODE_OPTIONS,
  MEMORY_IMPORT_MODES,
  MEMORY_TYPE_OPTIONS
} from './memoryConstants';
import {
  createMemoryImportPreview,
  importMemoryData,
  parseMemoryImportFile
} from './memoryImportExport';

const formatDate = (value) => {
  if (!value) return '未记录';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '未记录';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const getChatLabel = (chat) => (
  chat?.title || `消息框 ${chat?.id || ''}`
);

export const MemoryImportModal = ({
  chats = [],
  initialChatId = null,
  onClose,
  onCompleted,
  onError
}) => {
  const fileInputRef = useRef(null);

  const [parsedImport, setParsedImport] = useState(null);
  const [preview, setPreview] = useState(null);
  const [targetChatId, setTargetChatId] = useState(initialChatId || '');
  const [mode, setMode] = useState(MEMORY_IMPORT_MODES.MERGE);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(targetChatId)) || null,
    [chats, targetChatId]
  );

  const refreshPreview = async (
    nextParsedImport = parsedImport,
    nextTargetChatId = targetChatId
  ) => {
    if (!nextParsedImport || nextTargetChatId === '') {
      setPreview(null);
      return;
    }

    const result = await createMemoryImportPreview({
      parsedImport: nextParsedImport,
      targetChatId: Number(nextTargetChatId)
    });

    setPreview(result);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsParsing(true);
    setLocalError('');
    setPreview(null);

    try {
      const parsed = await parseMemoryImportFile(file);

      setParsedImport(parsed);

      if (targetChatId !== '') {
        await refreshPreview(parsed, targetChatId);
      }
    } catch (error) {
      const message = error?.message || '读取记忆文件失败。';
      setLocalError(message);
      onError?.(message);
      setParsedImport(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleTargetChatChange = async (event) => {
    const nextTargetChatId = event.target.value;

    setTargetChatId(nextTargetChatId);
    setLocalError('');

    try {
      await refreshPreview(parsedImport, nextTargetChatId);
    } catch (error) {
      const message = error?.message || '生成导入预览失败。';
      setLocalError(message);
      onError?.(message);
    }
  };

  const handleStartImport = () => {
    if (!parsedImport) {
      setLocalError('请先选择一个记忆 JSON 文件。');
      return;
    }

    if (!selectedChat) {
      setLocalError('请选择记忆要进入的消息框。');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!parsedImport || !selectedChat) return;

    setShowConfirm(false);
    setIsImporting(true);
    setLocalError('');

    try {
      const result = await importMemoryData({
        parsedImport,
        targetChatId: selectedChat.id,
        mode
      });

      onCompleted?.(
        `导入完成：新增 ${result.insertedMemories} 条记忆，更新 ${result.updatedMemories} 条，跳过 ${result.skippedMemories} 条。`
      );

      onClose?.();
    } catch (error) {
      const message = error?.message || '导入记忆失败。';
      setLocalError(message);
      onError?.(message);
    } finally {
      setIsImporting(false);
    }
  };

  const replaceMode = mode === MEMORY_IMPORT_MODES.REPLACE_CHAT;

  return (
    <>
      <div className="memory-modal-backdrop">
        <section
          className="memory-modal memory-import-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-import-title"
        >
          <div className="memory-modal-header">
            <div>
              <p className="memory-eyebrow">EDITORIAL INTAKE</p>
              <h2 id="memory-import-title">审阅一份记忆来稿</h2>
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
              导入的记忆只会绑定到你选择的消息框，不会依据角色名称自动归属。
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="memory-hidden-file-input"
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="memory-file-picker"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || isImporting}
          >
            <FileJson2 className="memory-file-picker-icon" />
            <span>
              <strong>
                {isParsing
                  ? '正在阅读文件'
                  : parsedImport
                    ? '已读取记忆文件'
                    : '选择 JSON 记忆文件'}
              </strong>
              <small>
                {parsedImport
                  ? `包含 ${parsedImport.summary.memoryCount} 条正式记忆`
                  : '仅支持 WHEN I with U 导出的 JSON 文件'}
              </small>
            </span>
            <Upload className="memory-icon" />
          </button>

          {localError && (
            <div className="memory-message memory-message-error">
              <span>{localError}</span>
            </div>
          )}

          {parsedImport && (
            <>
              <div className="memory-import-file-summary">
                <div>
                  <span>文件导出时间</span>
                  <strong>{formatDate(parsedImport.summary.exportedAt)}</strong>
                </div>
                <div>
                  <span>来源消息框</span>
                  <strong>{parsedImport.summary.sourceChatCount}</strong>
                </div>
                <div>
                  <span>正式记忆</span>
                  <strong>{parsedImport.summary.memoryCount}</strong>
                </div>
                <div>
                  <span>待确认片段</span>
                  <strong>{parsedImport.summary.candidateCount}</strong>
                </div>
                <div>
                  <span>修订记录</span>
                  <strong>{parsedImport.summary.revisionCount}</strong>
                </div>
              </div>

              {parsedImport.summary.invalidMemoryCount > 0 && (
                <div className="memory-import-warning">
                  <AlertTriangle className="memory-action-icon" />
                  文件中有 {parsedImport.summary.invalidMemoryCount} 条无效记忆，
                  它们不会被导入。
                </div>
              )}

              {parsedImport.summary.duplicateMemoryCount > 0 && (
                <div className="memory-import-warning">
                  <AlertTriangle className="memory-action-icon" />
                  文件中有 {parsedImport.summary.duplicateMemoryCount} 条重复记忆，
                  解析时已按稳定标识保留第一条。
                </div>
              )}

              <label className="memory-form-label">
                <span>导入到哪一个消息框</span>
                <select
                  value={targetChatId}
                  onChange={handleTargetChatChange}
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

              <div className="memory-import-mode-list">
                <span className="memory-form-label-title">导入方式</span>

                {MEMORY_IMPORT_MODE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={[
                      'memory-choice-item',
                      mode === option.id ? 'memory-choice-item-active' : ''
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="memoryImportMode"
                      value={option.id}
                      checked={mode === option.id}
                      onChange={() => setMode(option.id)}
                      disabled={isImporting}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>

              {preview && (
                <div className="memory-import-preview">
                  <p className="memory-eyebrow">IMPORT PREVIEW</p>

                  <div className="memory-import-preview-grid">
                    <div>
                      <span>目标消息框现有记忆</span>
                      <strong>{preview.existingMemoryCount}</strong>
                    </div>
                    <div>
                      <span>预计可新增</span>
                      <strong>{preview.newMemoryCount}</strong>
                    </div>
                    <div>
                      <span>来源无法对应</span>
                      <strong>{preview.unavailableSourceCount}</strong>
                    </div>
                    <div>
                      <span>文件内修订记录</span>
                      <strong>{preview.revisionCount}</strong>
                    </div>
                  </div>

                  {Object.keys(preview.typeCounts || {}).length > 0 && (
                    <div className="memory-import-type-summary">
                      {Object.entries(preview.typeCounts).map(([type, count]) => (
                        <span key={type}>
                          {MEMORY_TYPE_OPTIONS.find(
                            (item) => item.id === type
                          )?.label || type}：
                          {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {replaceMode && (
                <div className="memory-import-danger-note">
                  <AlertTriangle className="memory-action-icon" />
                  <span>
                    替换模式会删除目标消息框中已有的全部正式记忆、待确认片段和修订记录。
                    它不会删除原始聊天消息，也不会修改阶段性总结。
                  </span>
                </div>
              )}
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
              disabled={!parsedImport || !selectedChat || isImporting}
            >
              {isImporting ? '正在写入档案' : '继续导入'}
            </button>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title={replaceMode ? '替换此消息框的记忆' : '确认导入记忆'}
        message={
          replaceMode
            ? `确定要替换“${selectedChat?.title || '当前消息框'}”的全部记忆吗？原有正式记忆、待确认片段和修订记录都会永久删除，再写入这份文件中的内容。原始聊天消息与阶段性总结不会受到影响。`
            : `确定要将这份记忆档案导入“${selectedChat?.title || '当前消息框'}”吗？导入后，只有该消息框会在聊天回复中使用这些记忆。`
        }
        confirmText={replaceMode ? '替换并导入' : '确认导入'}
        cancelText="返回检查"
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmImport}
      />
    </>
  );
};

export default MemoryImportModal;

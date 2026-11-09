import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

import {
  buildMemoryExport,
  downloadMemoryExport
} from './memoryImportExport';
import { downloadObsidianMarkdownExport } from './obsidianImport/obsidianMarkdownExporter';
import { downloadOperitArchive } from './operitImport/operitExportService';
import {
  ST_EXPORT_DEFAULT_TYPE_IDS,
  ST_EXPORT_SUMMARY_DEFAULT_COUNT,
  ST_EXPORT_SUMMARY_MAX_COUNT,
  ST_EXPORT_TYPE_OPTIONS,
  copyStPlainText,
  downloadStLorebook
} from './stExport/stLorebookExport';

const EXPORT_FORMATS = {
  JSON: 'json',
  OBSIDIAN_MARKDOWN: 'obsidian_markdown',
  OPERIT_JSON: 'operit_json',
  ST_LOREBOOK: 'st_lorebook',
  ST_TEXT: 'st_text'
};

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
  const [format, setFormat] = useState(EXPORT_FORMATS.JSON);
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  // 导出到 ST：前情总结取最近几条（0 = 不要）、要带的记忆类型。
  const [stSummaryCount, setStSummaryCount] = useState(ST_EXPORT_SUMMARY_DEFAULT_COUNT);
  const [stTypes, setStTypes] = useState(ST_EXPORT_DEFAULT_TYPE_IDS);

  const isStFormat = format === EXPORT_FORMATS.ST_LOREBOOK
    || format === EXPORT_FORMATS.ST_TEXT;

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
    if ((scope === 'current_chat' || isStFormat) && !currentChat?.id) {
      onError?.('请先选择一个消息框。');
      return;
    }

    setIsExporting(true);

    try {
      const exportScope = scope === 'current_chat'
        ? { type: 'chat', chatId: currentChat.id }
        : { type: 'all' };

      if (format === EXPORT_FORMATS.ST_LOREBOOK) {
        const result = await downloadStLorebook(currentChat.id, {
          summaryCount: stSummaryCount,
          types: stTypes
        });

        onCompleted?.(
          `已导出“${currentChat.title || '当前消息框'}”的 ${result.sectionCount} 条常驻条目（共 ${result.itemCount} 项内容）为 ST 世界书。`
        );
      } else if (format === EXPORT_FORMATS.ST_TEXT) {
        const result = await copyStPlainText(currentChat.id, {
          summaryCount: stSummaryCount,
          types: stTypes
        });

        onCompleted?.(
          `已复制 ${result.itemCount} 项内容（约 ${result.charCount} 字）到剪贴板。`
        );
      } else if (format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN) {
        const result = await downloadObsidianMarkdownExport(exportScope);

        onCompleted?.(
          result.fileCount > 1
            ? `已导出 ${result.fileCount} 个消息框、共 ${result.memoryCount} 条记忆的 .md 文件（打包为 zip）。`
            : `已导出“${currentChat?.title || '当前消息框'}”的 ${result.memoryCount} 条记忆为 .md 文件。`
        );
      } else if (format === EXPORT_FORMATS.OPERIT_JSON) {
        const result = await downloadOperitArchive(exportScope);

        onCompleted?.(
          scope === 'current_chat'
            ? `已导出“${currentChat?.title || '当前消息框'}”的 ${result.memoryCount} 条记忆为 Operit 归档。`
            : `已导出全部消息框的 ${result.memoryCount} 条记忆为 Operit 归档。`
        );
      } else {
        const payload = await downloadMemoryExport(exportScope);

        onCompleted?.(
          scope === 'current_chat'
            ? `已导出“${currentChat.title || '当前消息框'}”的 ${payload.memories?.length || 0} 条记忆。`
            : `已导出全部消息框的 ${payload.memories?.length || 0} 条记忆。`
        );
      }

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
          {format === EXPORT_FORMATS.ST_LOREBOOK ? (
            <>
              <p>
                导出为 SillyTavern 能导入的世界书（.json）：前情总结和每一类记忆
                各是一条常驻条目，放在角色定义之后，可以在 ST 里单独关闭或改字。
              </p>
              <p>
                只导出生效中的记忆，名字保持原样，不带聊天原文。只支持单个消息框。
              </p>
            </>
          ) : format === EXPORT_FORMATS.ST_TEXT ? (
            <>
              <p>
                把同样的内容复制成一段纯文本，可以直接贴进 ST 的角色备注、
                作者注释或任何你想放的地方。只支持单个消息框。
              </p>
            </>
          ) : format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN ? (
            <>
              <p>
                导出为 Obsidian 可用的 .md 文件：每个消息框一个文件，每条
                记忆是一个二级标题，标题下会带一行类型和重要度的标注，方便
                以后重新导入时认出来。
              </p>
              <p>
                只导出正式记忆本身，不包含待确认片段、修订记录和原始聊天。
              </p>
            </>
          ) : format === EXPORT_FORMATS.OPERIT_JSON ? (
            <>
              <p>
                导出为 Operit 能识别的记忆归档（.json），用于把这边的记忆
                带去 Operit。只导出正式记忆本身，不包含待确认片段和修订记录。
              </p>
              <p>
                本项目没有 Operit 的 source/标签/文件夹这几个概念，导出时
                会按类型、所属消息框等信息尽量还原成接近的值，不是逐字段
                精确对应。
              </p>
            </>
          ) : (
            <>
              <p>
                导出的 JSON 可用于之后恢复记忆。它不包含聊天原文、API Key
                或运行中的任务状态。
              </p>
              <p>
                导出文件会保留记忆、待确认片段、修订记录，以及原始消息依据的状态。
              </p>
            </>
          )}
        </div>

        <div className="memory-choice-list">
          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.JSON}
              checked={format === EXPORT_FORMATS.JSON}
              onChange={() => {
                setFormat(EXPORT_FORMATS.JSON);
                setPreview(null);
              }}
            />
            <span>
              <strong>JSON（可以导回本项目）</strong>
              <small>用于之后恢复记忆，包含待确认片段和修订记录。</small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.OBSIDIAN_MARKDOWN}
              checked={format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN}
              onChange={() => {
                setFormat(EXPORT_FORMATS.OBSIDIAN_MARKDOWN);
                setPreview(null);
              }}
            />
            <span>
              <strong>Obsidian Markdown（.md）</strong>
              <small>只包含正式记忆，方便放进 Obsidian 库里查看和编辑。</small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.OPERIT_JSON}
              checked={format === EXPORT_FORMATS.OPERIT_JSON}
              onChange={() => {
                setFormat(EXPORT_FORMATS.OPERIT_JSON);
                setPreview(null);
              }}
            />
            <span>
              <strong>Operit 归档（.json）</strong>
              <small>用于导入到 Operit，不能再导回本项目。</small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.ST_LOREBOOK}
              checked={format === EXPORT_FORMATS.ST_LOREBOOK}
              onChange={() => {
                setFormat(EXPORT_FORMATS.ST_LOREBOOK);
                setScope('current_chat');
                setPreview(null);
              }}
              disabled={!currentChat}
            />
            <span>
              <strong>ST 世界书（.json）</strong>
              <small>前情总结和稳定记忆，做成 SillyTavern 的常驻条目。</small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.ST_TEXT}
              checked={format === EXPORT_FORMATS.ST_TEXT}
              onChange={() => {
                setFormat(EXPORT_FORMATS.ST_TEXT);
                setScope('current_chat');
                setPreview(null);
              }}
              disabled={!currentChat}
            />
            <span>
              <strong>复制为纯文本</strong>
              <small>同样的内容，复制到剪贴板，不生成文件。</small>
            </span>
          </label>
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
              disabled={isStFormat}
            />
            <span>
              <strong>导出全部记忆</strong>
              <small>
                {isStFormat
                  ? 'ST 世界书只支持单个消息框。'
                  : format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN
                  ? '每个消息框导出一个 .md 文件，打包成一个 zip。'
                  : '导出所有消息框中已保存的记忆档案。'}
              </small>
            </span>
          </label>
        </div>

        {isStFormat && (
          <div className="memory-choice-list">
            <label className="memory-choice-item">
              <input
                type="checkbox"
                checked={stSummaryCount > 0}
                onChange={(event) => setStSummaryCount(
                  event.target.checked ? ST_EXPORT_SUMMARY_DEFAULT_COUNT : 0
                )}
              />
              <span>
                <strong>前情总结</strong>
                <small>带上最近的几条阶段性总结。</small>
              </span>
            </label>

            {stSummaryCount > 0 && (
              <label className="memory-choice-item">
                <span>
                  <strong>前情总结条数</strong>
                  <small>
                    最近
                    {' '}
                    <input
                      type="number"
                      min="1"
                      max={ST_EXPORT_SUMMARY_MAX_COUNT}
                      value={stSummaryCount}
                      style={{ width: '4.5rem' }}
                      onChange={(event) => {
                        const next = Math.floor(Number(event.target.value));
                        if (Number.isFinite(next)) {
                          setStSummaryCount(
                            Math.min(Math.max(next, 1), ST_EXPORT_SUMMARY_MAX_COUNT)
                          );
                        }
                      }}
                    />
                    {' '}
                    条
                  </small>
                </span>
              </label>
            )}

            {ST_EXPORT_TYPE_OPTIONS.map((option) => (
              <label className="memory-choice-item" key={option.id}>
                <input
                  type="checkbox"
                  checked={stTypes.includes(option.id)}
                  onChange={(event) => setStTypes((previous) => (
                    event.target.checked
                      ? [...previous, option.id]
                      : previous.filter((id) => id !== option.id)
                  ))}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>只带生效中的记忆。</small>
                </span>
              </label>
            ))}
          </div>
        )}

        {format === EXPORT_FORMATS.JSON && (
          <button
            type="button"
            className="memory-preview-button"
            onClick={handlePreview}
          >
            查看导出内容概览
          </button>
        )}

        {format === EXPORT_FORMATS.JSON && preview && (
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
            {isExporting
              ? '正在导出'
              : format === EXPORT_FORMATS.ST_LOREBOOK
                ? '导出 ST 世界书'
              : format === EXPORT_FORMATS.ST_TEXT
                ? '复制纯文本'
              : format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN
                ? '导出 Markdown'
                : format === EXPORT_FORMATS.OPERIT_JSON
                  ? '导出 Operit 归档'
                  : '导出 JSON'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default MemoryExportModal;
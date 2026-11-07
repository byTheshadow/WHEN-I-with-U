import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Download,
  Loader2,
  Play,
  Trash2,
  X,
  Pencil
} from 'lucide-react';

import {
  deleteArchivedFolder,
  deleteArchivedMessage,
  getArchivedMessageFolders,
  setArchiveFolderCoverImage,
  setArchiveFolderNote
} from '../archiveService';
import {
  clearArchivedMediaForChat,
  downloadArchivedMediaForChat
} from '../archiveMediaCleanupService';
import { triggerGlobalToast } from '../../../components/NotificationToast';
import ArchiveOrganizerModal from './ArchiveOrganizerModal';
import ChatExportModal from '../../messages/export/ChatExportModal';
import '../archive.css';
import '../archive-cabinet-visual.css';

const formatDisplayDate = (dayKey) => {
  if (!dayKey) return '未知日期';
  const parts = dayKey.split('-');
  if (parts.length === 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return dayKey;
};

const formatDayNumber = (dayKey) => {
  if (!dayKey) return '--';
  const parts = dayKey.split('-');
  return parts.length === 3 ? parts[2] : dayKey.slice(-2);
};

const formatTimeOnly = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const ArchiveCabinetView = ({ chatOverview, onBack, onStatsChanged }) => {
  const { chatId, characterName } = chatOverview;

  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');

  const [isClearingMedia, setIsClearingMedia] = useState(false);
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);
  const [showOrganizer, setShowOrganizer] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const coverInputRef = useRef(null);

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getArchivedMessageFolders(chatId);
      setFolders(result);
      setSelectedGroupKey((prev) => prev || result[0]?.groupKey || null);
    } catch (error) {
      console.error('[ArchiveCabinet] 获取归档文件夹失败：', error);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.groupKey === selectedGroupKey) || null,
    [folders, selectedGroupKey]
  );

  const handleRowClick = (folder) => {
    if (selectedGroupKey === folder.groupKey) {
      setIsFullscreen(true);
    } else {
      setSelectedGroupKey(folder.groupKey);
      setEditingNote(false);
    }
  };

  const handleSaveNote = async () => {
    if (!activeFolder) return;
    await setArchiveFolderNote(chatId, activeFolder.groupKey, noteInput.trim());
    setEditingNote(false);
    await loadFolders();
  };

  const handleDeleteFolder = async () => {
    if (!activeFolder) return;
    const confirm = window.confirm(`确认永久销毁该卷宗（${activeFolder.dayKey}）的全部档案吗？`);
    if (!confirm) return;

    await deleteArchivedFolder(chatId, activeFolder.groupKey);
    setSelectedGroupKey(null);
    setIsFullscreen(false);
    await loadFolders();
    onStatsChanged?.();
  };

  const handleDeleteSingleMessage = async (messageId) => {
    const confirm = window.confirm('确认抹去这条记录吗？');
    if (!confirm) return;

    await deleteArchivedMessage(chatId, messageId);
    await loadFolders();
    onStatsChanged?.();
  };

  // ArchiveOrganizerModal 原来是个写好了但没接入口的孤儿组件，2026-09 在
  // 这里补上入口——它需要的 chatOverview 正好是这个页面本来就有的 prop。
  const handleCloseOrganizer = async (didArchiveAnything) => {
    setShowOrganizer(false);

    if (didArchiveAnything) {
      await loadFolders();
      onStatsChanged?.();
    }
  };

  // 清理和下载是两件完全独立的事——清理前不会强制走一遍下载，
  // 下载也不会顺带触发清理，用户自己决定要不要在清理前先下载一份。
  const handleClearMedia = async () => {
    if (isClearingMedia) return;

    const confirmed = window.confirm(
      `确认清空「${characterName}」存档室里的全部语音和图片本体吗？\n\n文字记录会保留，但语音听不了、图片也看不了了，且无法恢复。如果想留个备份，可以先用"打包下载"。`
    );
    if (!confirmed) return;

    setIsClearingMedia(true);

    try {
      const { clearedCount } = await clearArchivedMediaForChat(chatId);

      triggerGlobalToast({
        title: clearedCount > 0 ? '清理完成' : '没有需要清理的内容',
        content: clearedCount > 0
          ? `已清空 ${clearedCount} 条记录里的语音/图片本体，文字记录已保留。`
          : '这个聊天的存档室里目前没有语音或图片消息。',
        iconType: 'bell',
        duration: 5000
      });

      await loadFolders();
      onStatsChanged?.();
    } catch (error) {
      console.error('[ArchiveCabinet] 清理语音/图片失败：', error);
      triggerGlobalToast({
        title: '清理失败',
        content: '清理过程中出了点问题，请稍后重试。',
        iconType: 'bell',
        duration: 5000
      });
    } finally {
      setIsClearingMedia(false);
    }
  };

  const handleDownloadMedia = async () => {
    if (isDownloadingMedia) return;

    setIsDownloadingMedia(true);

    try {
      const { successCount, failCount, totalCount } =
        await downloadArchivedMediaForChat(chatId, characterName);

      if (totalCount === 0) {
        triggerGlobalToast({
          title: '没有可下载的内容',
          content: '这个聊天的存档室里目前没有语音或图片消息。',
          iconType: 'bell',
          duration: 4000
        });
      } else {
        triggerGlobalToast({
          title: '打包下载完成',
          content: `成功 ${successCount} 个，失败 ${failCount} 个，共 ${totalCount} 个文件。`,
          iconType: 'bell',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('[ArchiveCabinet] 打包下载失败：', error);
      triggerGlobalToast({
        title: '下载失败',
        content: '下载过程中出了点问题，请稍后重试。',
        iconType: 'bell',
        duration: 5000
      });
    } finally {
      setIsDownloadingMedia(false);
    }
  };

  const handlePickCoverImage = () => {
    coverInputRef.current?.click();
  };

  const handleCoverImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !activeFolder) {
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await setArchiveFolderCoverImage(chatId, activeFolder.groupKey, dataUrl);
    await loadFolders();
  };

  const content = (
    <div className="cabinet-viewport">
      <header className="cabinet-hud">
        <button
          type="button"
          className="cabinet-hud-btn"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回唱片架</span>
        </button>

        <div className="cabinet-title-stamp">
          <span className="stamp-box">CONFIDENTIAL</span>
          <span className="cabinet-char-name">{characterName} 档案室</span>
        </div>

        <div className="cabinet-stat-pill">
          {folders.length} 卷封存
        </div>
      </header>

      <div className="cabinet-action-row">
        <button
          type="button"
          className="cabinet-action-btn"
          onClick={() => setShowOrganizer(true)}
          title="手动挑选还没归档的旧消息，提前收进档案柜"
        >
          <Archive className="h-3.5 w-3.5" />
                   <span>整理归档</span>
        </button>

        <button
          type="button"
          className="cabinet-action-btn"
          onClick={() => setShowExport(true)}
          title="把这个聊天存档室里的文字记录导出成 Markdown / JSON"
        >
          <Download className="h-3.5 w-3.5" />
          <span>导出存档记录</span>
        </button>

        <button
          type="button"
          className="cabinet-action-btn"
          onClick={handleDownloadMedia}
          disabled={isDownloadingMedia}
          title="把这个聊天存档室里现存的语音和图片逐个下载到本地"
        >
          {isDownloadingMedia
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />}
          <span>{isDownloadingMedia ? '下载中…' : '打包下载语音/图片'}</span>
        </button>

        <button
          type="button"
          className="cabinet-action-btn is-danger"
          onClick={handleClearMedia}
          disabled={isClearingMedia}
          title="清空这个聊天存档室里的语音/图片本体，保留文字记录"
        >
          {isClearingMedia
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          <span>{isClearingMedia ? '清理中…' : '清空语音/图片'}</span>
        </button>
      </div>

      <main className="cabinet-stage">
        {isLoading && (
          <div className="cabinet-loading">
            <div className="cabinet-loading-box" />
            <p>正在拉开档案抽屉...</p>
          </div>
        )}

        {!isLoading && folders.length === 0 && (
          <div className="cabinet-empty">
            <div className="cabinet-empty-folder">
              <span className="empty-tab">EMPTY</span>
              <p>当前档案盒内尚无归档卷宗</p>
            </div>
          </div>
        )}

        {!isLoading && folders.length > 0 && (
          <div className="player-scroll">
            {activeFolder && (
              <div className="player-hero">
                <div
                  className={['player-hero-cover', activeFolder.coverImage ? 'has-cover' : ''].join(' ')}
                  style={
                    activeFolder.coverImage
                      ? { backgroundImage: `url(${activeFolder.coverImage})` }
                      : { '--tone': folders.indexOf(activeFolder) % 4 }
                  }
                >
                  {!activeFolder.coverImage && (
                    <span className="player-hero-daynum">
                      {formatDayNumber(activeFolder.dayKey)}
                    </span>
                  )}

                  <button
                    type="button"
                    className="player-cover-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePickCoverImage();
                    }}
                    title="更换封面"
                    aria-label="更换封面"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>

                <div className="player-hero-info">
                  <div className="player-hero-title">{formatDisplayDate(activeFolder.dayKey)}</div>
                  <div className="player-hero-sub">
                    与 {characterName} · {activeFolder.messages.length} 条记录
                  </div>

                  <button
                    type="button"
                    className="player-hero-play"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    展开阅读
                  </button>
                </div>
              </div>
            )}

            <div className="player-list-head">全部卷宗</div>

            <div className="player-list">
              {folders.map((folder, index) => {
                const isSelected = folder.groupKey === selectedGroupKey;

                return (
                  <button
                    key={folder.groupKey}
                    type="button"
                    className={['player-row', isSelected ? 'is-active' : ''].join(' ')}
                    onClick={() => handleRowClick(folder)}
                  >
                    <span
                      className={['player-row-cover', folder.coverImage ? 'has-cover' : ''].join(' ')}
                      style={
                        folder.coverImage
                          ? { backgroundImage: `url(${folder.coverImage})` }
                          : { '--tone': index % 4 }
                      }
                    >
                      {!folder.coverImage && formatDayNumber(folder.dayKey)}
                    </span>

                    <span className="player-row-info">
                      <span className="player-row-title">{formatDisplayDate(folder.dayKey)}</span>
                      <span className="player-row-sub">
                        {folder.messages.length} 条{folder.note ? ` · ${folder.note}` : ''}
                      </span>
                    </span>

                    <ChevronRight className="h-4 w-4 player-row-chevron" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <input
        type="file"
        accept="image/*"
        ref={coverInputRef}
        style={{ display: 'none' }}
        onChange={handleCoverImageChange}
      />

      {isFullscreen && activeFolder && (
        <div className="player-fullscreen">
          <div className="player-fs-topbar">
            <button
              type="button"
              className="player-fs-icon-btn"
              onClick={() => setIsFullscreen(false)}
              title="收起播放器"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="player-fs-serial">
              ARCHIVE DEPT. // CHAT-{String(chatId).slice(0, 6).toUpperCase()}
            </span>
            <button
              type="button"
              className="player-fs-icon-btn danger"
              onClick={handleDeleteFolder}
              title="销毁整份卷宗"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div
            className={['player-fs-cover', activeFolder.coverImage ? 'has-cover' : ''].join(' ')}
            style={
              activeFolder.coverImage
                ? { backgroundImage: `url(${activeFolder.coverImage})` }
                : { '--tone': folders.indexOf(activeFolder) % 4 }
            }
          >
            {!activeFolder.coverImage && (
              <span className="player-fs-daynum">
                {formatDayNumber(activeFolder.dayKey)}
              </span>
            )}

            <button
              type="button"
              className="player-cover-edit-btn"
              onClick={handlePickCoverImage}
              title="更换封面"
              aria-label="更换封面"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>

          <div className="player-fs-title">{formatDisplayDate(activeFolder.dayKey)}</div>
          <div className="player-fs-sub">
            与 {characterName} · TOTAL {activeFolder.messages.length} MESSAGES
          </div>

          <div
            className="player-fs-note"
            onClick={() => {
              setEditingNote(true);
              setNoteInput(activeFolder.note || '');
            }}
          >
            {editingNote ? (
              <div className="note-input-row" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={noteInput}
                  placeholder="为此段封存记录输入简注..."
                  autoFocus
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSaveNote()}
                />
                <button type="button" onClick={handleSaveNote}>保存</button>
              </div>
            ) : (
              <span>
                {activeFolder.note || '点击添加备注...'}
                <Pencil className="h-2.5 w-2.5 ml-1 inline opacity-60" />
              </span>
            )}
          </div>

          <div className="player-fs-queue-head">
            <span>TRANSCRIPT</span>
            <span>{activeFolder.messages.length} 条</span>
          </div>

          <div className="player-fs-queue">
            {activeFolder.messages.map((msg, i) => (
              <div key={msg.id || i} className="player-fs-line">
                <span className="player-fs-line-seq">{String(i + 1).padStart(2, '0')}</span>
                <div className="player-fs-line-body">
                  <div className="player-fs-line-meta">
                    <span>{msg.role === 'user' ? 'YOU' : characterName.toUpperCase()}</span>
                    <span>{formatTimeOnly(msg.timestamp)}</span>
                  </div>
                  <div className="player-fs-line-text">{msg.content}</div>
                </div>
                <button
                  type="button"
                  className="player-fs-line-del"
                  onClick={() => void handleDeleteSingleMessage(msg.id)}
                  title="抹去该条消息"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOrganizer && (
        <ArchiveOrganizerModal
          chatOverview={chatOverview}
          onClose={handleCloseOrganizer}
        />
      )}
            {showExport && (
        <ChatExportModal
          chatId={chatId}
          source="archived"
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default ArchiveCabinetView;
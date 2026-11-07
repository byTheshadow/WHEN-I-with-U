// src/apps/messages/export/ChatExportModal.jsx
//
// 聊天记录导出弹窗（2026-11 新增）。
// 用 portal 挂到 body 上，所以聊天设置里和存档室里都能直接用，
// 互相不受对方容器样式/层级的影响。
//
// props:
//   chatId   - 要导出的聊天 id
//   source   - 'live'（聊天里的消息）或 'archived'（存档室里的消息）
//   onClose  - 关闭弹窗

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, X } from 'lucide-react';

import { triggerGlobalToast } from '../../../components/NotificationToast';
import {
  EXPORT_SOURCES,
  exportChatRecords,
  getMessagesForExport,
  toLocalDayKey,
} from './chatExportService';

const PRESETS = [
  { id: 'all', label: '全部' },
  { id: '7', label: '最近 7 天' },
  { id: '30', label: '最近 30 天' },
];

const FORMAT_OPTIONS = [
  { id: 'markdown', label: 'Markdown', hint: '好读，适合存档、贴进笔记' },
  { id: 'json', label: 'JSON', hint: '保留完整结构，以后可以用来导入' },
];

const dayKeyDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalDayKey(date);
};

const ChatExportModal = ({ chatId, source = EXPORT_SOURCES.LIVE, onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formats, setFormats] = useState(['markdown']);
  const [matchCount, setMatchCount] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const isArchived = source === EXPORT_SOURCES.ARCHIVED;
  const title = isArchived ? '导出存档室记录' : '导出聊天记录';

  const rangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  // 日期一变就重新数一下"这个范围里有多少条"，让用户导出前心里有数。
  useEffect(() => {
    let cancelled = false;

    if (rangeInvalid) {
      setMatchCount(0);
      return undefined;
    }

    setMatchCount(null);

    getMessagesForExport({ chatId, source, startDate, endDate })
      .then((rows) => {
        if (!cancelled) setMatchCount(rows.length);
      })
      .catch((error) => {
        console.warn('[ChatExport] 统计消息数量失败：', error);
        if (!cancelled) setMatchCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, source, startDate, endDate, rangeInvalid]);

  const activePreset = useMemo(() => {
    if (!startDate && !endDate) return 'all';
    const today = toLocalDayKey(new Date());
    if (endDate !== today) return '';
    if (startDate === dayKeyDaysAgo(7)) return '7';
    if (startDate === dayKeyDaysAgo(30)) return '30';
    return '';
  }, [startDate, endDate]);

  const applyPreset = (presetId) => {
    if (presetId === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    setStartDate(dayKeyDaysAgo(Number(presetId)));
    setEndDate(toLocalDayKey(new Date()));
  };

  const toggleFormat = (formatId) => {
    setFormats((prev) => (
      prev.includes(formatId)
        ? prev.filter((id) => id !== formatId)
        : [...prev, formatId]
    ));
  };

  const canExport = !isExporting
    && !rangeInvalid
    && formats.length > 0
    && matchCount !== 0;

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);
    try {
      const { messageCount, files } = await exportChatRecords({
        chatId,
        source,
        startDate,
        endDate,
        formats,
      });

      if (messageCount === 0) {
        triggerGlobalToast({ title: '没有可导出的消息', content: '这个范围里没有消息。' });
      } else {
        triggerGlobalToast({
          title: '导出完成',
          content: `已导出 ${messageCount} 条消息（${files.length} 个文件）。`,
        });
        onClose?.();
      }
    } catch (error) {
      console.error('[ChatExport] 导出失败：', error);
      triggerGlobalToast({ title: '导出失败', content: '可以稍后再试一次。' });
    } finally {
      setIsExporting(false);
    }
  };

  const countText = (() => {
    if (rangeInvalid) return '开始日期不能晚于结束日期';
    if (matchCount === null) return '正在统计...';
    if (matchCount === 0) return '这个范围里没有消息';
    return `这个范围里共 ${matchCount} 条消息`;
  })();

  const surface = {
    background: 'var(--bg-main, #ffffff)',
    color: 'var(--text-main, #111111)',
    border: '1px solid var(--card-border, rgba(0,0,0,0.12))',
  };

  const softControl = {
    background: 'var(--control-soft-bg, rgba(0,0,0,0.05))',
    color: 'var(--text-main, #111111)',
    border: '1px solid var(--card-border, rgba(0,0,0,0.12))',
  };

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-4 space-y-4 text-xs"
        style={{ ...surface, maxHeight: '90dvh', overflowY: 'auto' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full opacity-70 active:scale-95"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="font-semibold opacity-80">时间范围</div>

          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="flex-1 py-1.5 rounded-lg active:scale-95 transition-all"
                style={{
                  ...softControl,
                  fontWeight: activePreset === preset.id ? 700 : 400,
                  borderColor: activePreset === preset.id
                    ? 'var(--text-main, #111111)'
                    : 'var(--card-border, rgba(0,0,0,0.12))',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg"
              style={softControl}
              aria-label="开始日期"
            />
            <span className="opacity-60">至</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg"
              style={softControl}
              aria-label="结束日期"
            />
          </div>

          <div className="opacity-60">
            两个日期都留空就是导出全部。{countText}。
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-semibold opacity-80">导出格式（可多选）</div>

          {FORMAT_OPTIONS.map((option) => {
            const checked = formats.includes(option.id);

            return (
              <label
                key={option.id}
                className="flex items-start gap-2 p-2 rounded-lg cursor-pointer"
                style={softControl}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFormat(option.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold">{option.label}</span>
                  <span className="block opacity-60">{option.hint}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="opacity-60 leading-relaxed">
          图片、语音、转账、卡片等会转成文字标注，不会打包图片和语音本体。
          {isArchived ? '这里导出的是存档室里的消息，不包含还在聊天里的消息。' : '这里导出的是还在聊天里的消息，已归档的消息请到存档室里导出。'}
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport}
          className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
          style={{
            background: 'var(--text-main, #111111)',
            color: 'var(--bg-main, #ffffff)',
          }}
        >
          {isExporting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />}
          <span>{isExporting ? '导出中...' : '开始导出'}</span>
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ChatExportModal;
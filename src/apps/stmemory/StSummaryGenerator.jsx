// src/apps/stmemory/StSummaryGenerator.jsx
//
// 记忆包详情里的"生成总结"区（只对 ST 聊天包显示）。
//   - 选提示词模板（剧情 / 关系变化 / 设定事实）或自己写，设每批取多少条消息
//   - 试跑下一批：只看结果，不保存；满意了可以保存成一条
//   - 开始 / 继续 / 暂停：分批生成，每批一条独立的总结条目；失败会自动重试，
//     仍失败就停在这一批，已生成的保留，点继续从这一批重来
//
// 关闭详情窗口会让生成在"当前这一批做完后"暂停。
// 这个文件 import 了生成引擎（它会引用 aiService），只能放在界面层。
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import { getPack } from './stPackService';
import { addSummaryEntry } from './stSummaryService';
import {
  CUSTOM_TEMPLATE_ID,
  DEFAULT_SUMMARY_SETTINGS,
  MAX_BATCH_MESSAGES,
  MIN_BATCH_MESSAGES,
  SUMMARY_TEMPLATES,
  clampBatchMessages,
  getEffectivePromptText,
  loadSummarySettings,
  saveSummarySettings,
} from './stSummaryConfig';
import {
  countStoredMessages,
  getSummaryCursor,
  isSummarizing,
  previewNextBatch,
  runSummarization,
} from './stSummaryEngine';

const fieldStyle = {
  background: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const StSummaryGenerator = ({ pack, entries, onEntriesChange }) => {
  const [settings, setSettings] = useState(DEFAULT_SUMMARY_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [totalMessages, setTotalMessages] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const controlRef = useRef({ stopped: false });
  const mountedRef = useRef(true);

  const cursor = useMemo(() => getSummaryCursor(entries), [entries]);
  const busy = isRunning || isPreviewing;
  const alreadyRunning = isSummarizing(pack.id) && !isRunning;

  useEffect(() => {
    mountedRef.current = true;
    const control = controlRef.current;
    return () => {
      mountedRef.current = false;
      control.stopped = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSummarySettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
      setSettingsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    countStoredMessages(pack.id, pack.chunkCount || 0)
      .then((count) => {
        if (!cancelled) setTotalMessages(count);
      })
      .catch((error) => {
        console.warn('[stmemory] 统计消息数失败：', error);
      });
    return () => {
      cancelled = true;
    };
  }, [pack.id, pack.chunkCount]);

  const commitSettings = (next) => {
    setSettings(next);
    void saveSummarySettings(next).catch((error) => {
      console.warn('[stmemory] 保存总结设置失败：', error);
    });
  };

  const handleTemplateClick = (templateId) => {
    setPreview(null);
    commitSettings({ ...settings, templateId });
  };

  const handlePromptChange = (value) => {
    setPreview(null);
    // 改了模板的文字就变成"自定义"，原模板不会被改掉。
    setSettings((current) => ({ ...current, templateId: CUSTOM_TEMPLATE_ID, customText: value }));
  };

  const refreshEntries = async () => {
    const latest = await getPack(pack.id);
    if (mountedRef.current) onEntriesChange(latest?.summaryEntries || []);
  };

  const effectivePrompt = getEffectivePromptText(settings);
  const promptEmpty = !effectivePrompt.trim();

  const handlePreview = async () => {
    if (busy || promptEmpty) return;
    setErrorText('');
    setMessage('');
    setPreview(null);
    setIsPreviewing(true);
    try {
      const result = await previewNextBatch({ packId: pack.id, settings });
      if (!mountedRef.current) return;
      if (!result) setMessage('已经没有需要总结的内容了。');
      else setPreview(result);
    } catch (error) {
      if (mountedRef.current) setErrorText(error?.message || '试跑失败');
    } finally {
      if (mountedRef.current) setIsPreviewing(false);
    }
  };

  const handleSavePreview = async () => {
    if (!preview || busy) return;
    // 试跑之后如果游标变了（比如又删了条目），这份结果对不上了，不保存。
    if (preview.draft.coveredFrom !== cursor) {
      setPreview(null);
      setErrorText('总结进度在试跑之后变了，这份结果已作废，请重新试跑。');
      return;
    }
    try {
      await addSummaryEntry(pack.id, preview.draft);
      setPreview(null);
      setMessage('已保存为一条总结。');
      await refreshEntries();
    } catch (error) {
      setErrorText(error?.message || '保存失败');
    }
  };

  const handleStart = async () => {
    if (busy || promptEmpty) return;
    setErrorText('');
    setMessage('');
    setPreview(null);
    controlRef.current.stopped = false;
    setIsRunning(true);
    try {
      const result = await runSummarization({
        packId: pack.id,
        settings,
        control: controlRef.current,
        onProgress: ({ entries: latest }) => {
          if (mountedRef.current) onEntriesChange(latest);
        },
      });
      if (!mountedRef.current) return;
      if (result.status === 'done') setMessage('全部消息都已经总结完了。');
      else if (result.status === 'paused') setMessage('已暂停。点"继续"会接着往下总结。');
      else setErrorText(`停在这一批了：${result.error}。已生成的条目都保留着，点"继续"会从这一批重来。`);
    } catch (error) {
      console.error('[stmemory] 生成总结出错：', error);
      if (mountedRef.current) setErrorText(error?.message || '生成总结出错');
      triggerGlobalToast({ title: '生成总结出错', content: error?.message || '请稍后再试。' });
    } finally {
      if (mountedRef.current) {
        setIsRunning(false);
        await refreshEntries();
      }
    }
  };

  const handlePause = () => {
    controlRef.current.stopped = true;
    setMessage('正在暂停：当前这一批做完后会停下。');
  };

  const remainingBatches = totalMessages == null
    ? null
    : Math.max(0, Math.ceil((totalMessages - cursor) / settings.batchMessages));

  return (
    <div className="space-y-2.5 rounded-xl border px-3 py-2.5" style={fieldStyle}>
      <p className="font-semibold">生成总结</p>
      <p className="text-[10px] leading-relaxed opacity-55">
        把聊天按每批若干条消息交给 AI 总结，每批生成一条独立的总结条目，下面的总结条目里可以逐条改、逐条删。
        会消耗你配置的 AI 的额度。
      </p>

      <div className="space-y-1">
        <span className="font-semibold">提示词</span>
        <div className="flex flex-wrap gap-1.5">
          {SUMMARY_TEMPLATES.map((template) => {
            const active = settings.templateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                disabled={busy}
                onClick={() => handleTemplateClick(template.id)}
                className="rounded-full border px-2.5 py-1 disabled:opacity-50"
                style={{
                  ...fieldStyle,
                  borderColor: active ? 'var(--accent-color)' : 'var(--card-border)',
                  outline: active ? '1px solid var(--accent-color)' : 'none',
                }}
              >
                {template.label}
              </button>
            );
          })}
          {settings.templateId === CUSTOM_TEMPLATE_ID && (
            <span className="rounded-full border px-2.5 py-1" style={{ ...fieldStyle, borderColor: 'var(--accent-color)' }}>
              自定义
            </span>
          )}
        </div>
        <textarea
          className="min-h-[110px] w-full resize-y rounded-lg border px-2.5 py-2 outline-none"
          style={fieldStyle}
          value={effectivePrompt}
          disabled={!settingsLoaded || busy}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={() => void saveSummarySettings(settings).catch(() => {})}
        />
        <p className="text-[10px] leading-relaxed opacity-50">
          直接改上面的文字就会变成"自定义"，原模板不受影响。聊天记录和"名字占位符原样保留"的输出要求会由系统自动接在后面，不用自己写。
        </p>
      </div>

      <label className="flex items-center gap-2">
        <span className="font-semibold">每批取</span>
        <input
          key={settings.batchMessages}
          type="number"
          min={MIN_BATCH_MESSAGES}
          max={MAX_BATCH_MESSAGES}
          defaultValue={settings.batchMessages}
          disabled={busy}
          onBlur={(e) => commitSettings({ ...settings, batchMessages: clampBatchMessages(e.target.value) })}
          className="w-16 rounded-lg border px-2 py-1 text-center outline-none"
          style={fieldStyle}
        />
        <span className="opacity-60">条消息（{MIN_BATCH_MESSAGES}-{MAX_BATCH_MESSAGES}）</span>
      </label>

      <p className="opacity-70">
        已总结到第 {cursor} 条消息 / 共 {totalMessages == null ? '统计中' : totalMessages} 条
        {remainingBatches != null && remainingBatches > 0 ? `，还需约 ${remainingBatches} 批` : ''}
      </p>
      <p className="text-[10px] leading-relaxed opacity-50">
        这里的"第几条消息"指包里实际存着的消息，清洗后变空被丢掉的不算。
        删掉最后一条总结，进度会退回去，那一段之后会被重新总结。
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || promptEmpty || alreadyRunning}
          className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40"
          style={fieldStyle}
        >
          {isPreviewing ? '试跑中...' : '试跑下一批'}
        </button>
        {isRunning ? (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-lg px-3 py-1.5 font-bold"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            暂停
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={busy || promptEmpty || alreadyRunning}
            className="rounded-lg px-3 py-1.5 font-bold disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            {cursor > 0 ? '继续生成' : '开始生成'}
          </button>
        )}
      </div>

      {isRunning && (
        <p className="opacity-70">
          正在生成，已有 {entries.length} 条总结。关闭这个窗口会在当前这一批做完后暂停。
        </p>
      )}
      {alreadyRunning && (
        <p className="opacity-70">上一次的生成还在收尾，稍等一下再操作。</p>
      )}
      {message && <p className="opacity-80">{message}</p>}
      {errorText && <p className="font-semibold text-rose-500">{errorText}</p>}

      {preview && (
        <div className="space-y-1.5 rounded-lg border p-2.5" style={fieldStyle}>
          <p className="font-semibold">
            试跑结果（这一批 {preview.messageCount} 条消息，输入约 {preview.inputTokens.toLocaleString()} token 估算）
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{preview.draft.text}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSavePreview}
              className="rounded-lg border px-3 py-1.5 font-semibold"
              style={fieldStyle}
            >
              保存为一条总结
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg border px-3 py-1.5"
              style={fieldStyle}
            >
              放弃
            </button>
          </div>
          <p className="text-[10px] opacity-50">
            不满意就改上面的提示词再试跑。这份结果不保存的话，不会留下任何东西。
          </p>
        </div>
      )}
    </div>
  );
};

export default StSummaryGenerator;
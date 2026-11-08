// src/apps/stmemory/StSummaryGenerator.jsx
//
// 往事详情「总结」标签里的生成区（只对 ST 聊天往事显示）：进度卡、生成设置、试跑结果。
//   - 选提示词模板（剧情 / 关系变化 / 设定事实）或自己写，设每批取多少条消息
//   - 试跑下一批：只看结果，不保存；满意了可以保存成一条
//   - 开始 / 继续 / 暂停：分批生成，每批一条独立的总结条目；失败会自动重试，
//     仍失败就停在这一批，已生成的保留，点继续从这一批重来
//
// 离开详情页会让生成在"当前这一批做完后"暂停。
// 这个文件 import 了生成引擎（它会引用 aiService），只能放在界面层。
//
// 逻辑沿用原来的版本，只换了外观和文案。额外通过 onBatchMessagesChange / onTotalMessagesChange
// 把"每批条数"和"消息总数"告诉外层，详情页顶部的雪花要用它们算亮几条臂。
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

const StSummaryGenerator = ({
  pack,
  entries,
  onEntriesChange,
  onBatchMessagesChange,
  onTotalMessagesChange,
}) => {
  const [settings, setSettings] = useState(DEFAULT_SUMMARY_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  useEffect(() => {
    if (settingsLoaded) onBatchMessagesChange?.(settings.batchMessages);
  }, [settingsLoaded, settings.batchMessages, onBatchMessagesChange]);

  useEffect(() => {
    if (totalMessages != null) onTotalMessagesChange?.(totalMessages);
  }, [totalMessages, onTotalMessagesChange]);

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
      else if (result.status === 'paused') setMessage('已暂停。点"继续生成"会接着往下总结。');
      else setErrorText(`停在这一批了：${result.error}。已生成的条目都保留着，点"继续生成"会从这一批重来。`);
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

  const batch = settings.batchMessages;
  const totalBatches = totalMessages == null ? null : Math.ceil(totalMessages / batch);
  const doneBatches = totalBatches == null ? null : Math.min(totalBatches, Math.ceil(cursor / batch));
  const remainingBatches = totalMessages == null
    ? null
    : Math.max(0, Math.ceil((totalMessages - cursor) / batch));
  const finished = totalMessages != null && totalMessages > 0 && cursor >= totalMessages;
  const percent = totalBatches ? Math.round((doneBatches / totalBatches) * 100) : 0;

  let statusChip;
  if (isRunning) statusChip = <span className="chip chip-ink">生成中</span>;
  else if (errorText) statusChip = <span className="chip chip-bad">已停下</span>;
  else if (finished) statusChip = <span className="chip chip-ok">已完成</span>;
  else if (cursor > 0) statusChip = <span className="chip chip-warn">已暂停</span>;
  else statusChip = <span className="chip">尚未开始</span>;

  const templateName = settings.templateId === CUSTOM_TEMPLATE_ID
    ? '自定义提示词'
    : `${SUMMARY_TEMPLATES.find((template) => template.id === settings.templateId)?.label || ''}总结`;

  return (
    <>
      <section className="glass" style={{ padding: '20px 18px 18px' }} aria-label="总结进度">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mute" style={{ fontSize: 12, letterSpacing: '.2em' }}>总结进度</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                className="serif"
                style={{ fontSize: 52, fontWeight: 300, lineHeight: 1.15, textShadow: '0 0 22px var(--glow)', fontVariantNumeric: 'tabular-nums' }}
              >
                {doneBatches ?? '—'}
              </span>
              <span className="mute" style={{ fontSize: 14 }}>/ {totalBatches ?? '—'} 批</span>
            </div>
          </div>
          {statusChip}
        </div>

        <div
          className="bar"
          style={{ margin: '12px 0 8px' }}
          role="img"
          aria-label={totalBatches == null ? '总结进度统计中' : `总结进度 ${doneBatches} / ${totalBatches} 批`}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="mute" style={{ fontSize: 12 }}>
          已总结到第 {cursor} 条消息，共 {totalMessages == null ? '统计中' : totalMessages} 条
          {remainingBatches != null && remainingBatches > 0 ? `，还剩约 ${remainingBatches} 批。` : '。'}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {isRunning ? (
            <button type="button" className="btn btn-pri" style={{ flex: 1, minHeight: 48 }} onClick={handlePause}>
              暂停
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-pri"
              style={{ flex: 1, minHeight: 48 }}
              onClick={handleStart}
              disabled={busy || promptEmpty || alreadyRunning || finished}
            >
              {cursor > 0 ? '继续生成' : '开始生成'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-out"
            style={{ flex: 1, minHeight: 48 }}
            onClick={handlePreview}
            disabled={busy || promptEmpty || alreadyRunning}
          >
            {isPreviewing ? '试跑中……' : '试跑下一批'}
          </button>
        </div>
        <p className="mute" style={{ margin: '10px 0 0', fontSize: 11 }}>
          每批生成一条独立的总结，会消耗你配置的 AI 的额度。已生成的都会保留。
          {isRunning ? '离开这一页会在当前这一批做完后暂停。' : ''}
        </p>

        <div aria-live="polite">
          {isRunning && (
            <p style={{ margin: '10px 0 0' }}>正在生成，已有 {entries.length} 条总结。</p>
          )}
          {alreadyRunning && (
            <p style={{ margin: '10px 0 0' }}>上一次的生成还在收尾，稍等一下再操作。</p>
          )}
          {message && <p style={{ margin: '10px 0 0' }}>{message}</p>}
          {errorText && (
            <p role="alert" style={{ margin: '10px 0 0', fontWeight: 600, color: 'var(--bad)' }}>{errorText}</p>
          )}
        </div>
      </section>

      {preview && (
        <section>
          <div className="lbl" style={{ marginBottom: 10 }}>试跑结果</div>
          <div className="glass" style={{ padding: 16 }}>
            <div className="mute" style={{ fontSize: 12, marginBottom: 8 }}>
              这一批 {preview.messageCount} 条消息，输入约 {preview.inputTokens.toLocaleString()} token（估算）
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, overflowWrap: 'anywhere' }}>
              {preview.draft.text}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" className="btn btn-out" style={{ flex: 1 }} onClick={handleSavePreview}>
                保存为一条总结
              </button>
              <button type="button" className="btn btn-out" onClick={() => setPreview(null)}>放弃</button>
            </div>
            <p className="mute" style={{ margin: '10px 0 0', fontSize: 11 }}>
              不满意就改生成设置里的提示词再试跑。这份结果不保存的话，不会留下任何东西。
            </p>
          </div>
        </section>
      )}

      <section>
        <div className="lbl" style={{ marginBottom: 10 }}>生成设置</div>
        <button
          type="button"
          className="glass"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textAlign: 'left', minHeight: 64 }}
          aria-expanded={settingsOpen}
          aria-controls="qc-gen-settings"
          onClick={() => setSettingsOpen((value) => !value)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{templateName}　·　每批 {batch} 条</div>
            <div className="mute" style={{ fontSize: 12 }}>点开可以换提示词模板、自己改提示词、调批大小</div>
          </div>
          <svg
            className="ico mute"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={settingsOpen ? { transform: 'rotate(180deg)' } : undefined}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {settingsOpen && (
          <div id="qc-gen-settings" className="glass" style={{ padding: 16, marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>提示词</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUMMARY_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="pill"
                  aria-pressed={settings.templateId === template.id}
                  disabled={busy}
                  onClick={() => handleTemplateClick(template.id)}
                >
                  {template.label}
                </button>
              ))}
              {settings.templateId === CUSTOM_TEMPLATE_ID && (
                <span className="pill" aria-pressed="true" style={{ display: 'inline-flex', alignItems: 'center' }}>自定义</span>
              )}
            </div>
            <label className="vh" htmlFor="qc-gen-prompt">提示词正文</label>
            <textarea
              id="qc-gen-prompt"
              className="ta"
              style={{ minHeight: 140, marginTop: 10 }}
              value={effectivePrompt}
              disabled={!settingsLoaded || busy}
              onChange={(e) => handlePromptChange(e.target.value)}
              onBlur={() => void saveSummarySettings(settings).catch(() => {})}
            />
            <p className="mute" style={{ margin: '8px 0 0', fontSize: 11 }}>
              直接改上面的文字就会变成"自定义"，原模板不受影响。聊天记录和"名字占位符原样保留"的输出要求会由系统自动接在后面，不用自己写。
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <label htmlFor="qc-gen-batch" style={{ fontWeight: 700 }}>每批取</label>
              <input
                id="qc-gen-batch"
                key={settings.batchMessages}
                className="inp num-inp"
                type="number"
                min={MIN_BATCH_MESSAGES}
                max={MAX_BATCH_MESSAGES}
                defaultValue={settings.batchMessages}
                disabled={busy}
                onBlur={(e) => commitSettings({ ...settings, batchMessages: clampBatchMessages(e.target.value) })}
              />
              <span className="mute">条消息（{MIN_BATCH_MESSAGES}-{MAX_BATCH_MESSAGES}）</span>
            </div>
            <p className="mute" style={{ margin: '10px 0 0', fontSize: 11 }}>
              这里的"第几条消息"指往事里实际存着的消息，清洗后变空被丢掉的不算。
              删掉最后一条总结，进度会退回去，那一段之后会被重新总结。
            </p>
          </div>
        )}
      </section>
    </>
  );
};

export default StSummaryGenerator;
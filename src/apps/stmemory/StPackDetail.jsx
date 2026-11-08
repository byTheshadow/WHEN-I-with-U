// src/apps/stmemory/StPackDetail.jsx
//
// 往事详情页（全屏，替换原来的详情弹窗）。三个标签：
//   概览  三种带法各占多少 token + 写概览（保存按钮在顶栏）
//   总结  进度卡 / 生成设置 / 总结条目（ST 聊天往事）；纯文本往事只有条目列表和手写
//   信息  往事名称、统计、导入记录与撤销、删除
//
// 三个标签的内容始终都挂在页面上，只是隐藏。这样在生成总结的时候切到别的标签，
// 生成不会被打断；离开详情页才会在"当前这一批做完后"暂停。
import React, { useCallback, useMemo, useState } from 'react';

import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import Snowflake, { litArmsFor, pickArm } from './Snowflake';
import StSummaryEntriesEditor from './StSummaryEntriesEditor';
import StSummaryGenerator from './StSummaryGenerator';
import { estimateTokens, getEntryRangeTokens, getRangeTokens } from './stPackBudget';
import { SOURCE_TYPE_ST_JSONL } from './stPackConstants';
import { getSummaryProgress } from './stPackProgress';
import { updatePackMeta } from './stPackService';
import { DEFAULT_BATCH_MESSAGES } from './stSummaryConfig';

const TABS = [
  ['overview', '概览'],
  ['summary', '总结'],
  ['info', '信息'],
];

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const TokenRow = ({ label, value, max }) => {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr auto', alignItems: 'center', gap: 10, minHeight: 34 }}>
      <span>{label}</span>
      <div className="bar" aria-hidden="true">
        <i style={{ width: `${Math.max(percent, 1)}%`, minWidth: 4 }} />
      </div>
      <span className="mute" style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</span>
    </div>
  );
};

const StPackDetail = ({
  pack,
  initialTab = 'overview',
  onClose,
  onSaved,
  onRequestUndo,
  onRequestDelete,
}) => {
  const isJsonl = pack.sourceType === SOURCE_TYPE_ST_JSONL;

  const [tab, setTab] = useState(initialTab);
  const [title, setTitle] = useState(pack.title || '');
  const [overview, setOverview] = useState(pack.overview || '');
  const [saved, setSaved] = useState({ title: pack.title || '', overview: pack.overview || '' });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [summaryEntries, setSummaryEntries] = useState(
    Array.isArray(pack.summaryEntries) ? pack.summaryEntries : [],
  );
  const [batchMessages, setBatchMessages] = useState(DEFAULT_BATCH_MESSAGES);
  const [countedMessages, setCountedMessages] = useState(null);

  const dirty = title !== saved.title || overview !== saved.overview;

  const handleEntriesChange = useCallback((next) => {
    setSummaryEntries(next);
    onSaved();
  }, [onSaved]);

  const handleSave = async () => {
    if (isSaving || !dirty) return;
    setIsSaving(true);
    try {
      await updatePackMeta(pack.id, { title, overview });
      const nextTitle = title.trim() || '未命名往事';
      setTitle(nextTitle);
      setSaved({ title: nextTitle, overview });
      onSaved();
      triggerGlobalToast({ title: '已保存', content: '这片往事的改动已经保存。' });
    } catch (error) {
      console.error('[stmemory] 保存失败：', error);
      triggerGlobalToast({ title: '保存失败', content: '请稍后再试。' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty) setConfirmLeave(true);
    else onClose();
  };

  // 头部雪花：亮几条臂跟总结进度走
  const progress = useMemo(
    () => getSummaryProgress(pack, batchMessages, summaryEntries, countedMessages ?? undefined),
    [pack, batchMessages, summaryEntries, countedMessages],
  );
  const lit = progress ? litArmsFor(progress.done, progress.total) : 0;

  // 概览页：三种带法各占多少（估算 token）
  const entryPack = { summaryEntries };
  const rawTokens = getRangeTokens(pack, null);
  const summaryTokens = getEntryRangeTokens(entryPack, null);
  const overviewTokens = estimateTokens(overview);
  const maxTokens = Math.max(rawTokens, summaryTokens, overviewTokens, 1);

  const bytesNote = [
    summaryEntries.length > 0
      ? `总结按已生成的 ${summaryEntries.length} 条算`
      : '还没有总结条目，所以总结是 0',
    overview.trim() ? '' : '概览为空，所以是 0',
  ].filter(Boolean).join('；');

  const overviewChip = overview.trim()
    ? <span className="chip chip-ok">已填写</span>
    : <span className="chip chip-warn">还是空的</span>;

  const imports = Array.isArray(pack.imports) ? pack.imports : [];

  return (
    <>
      <div className="qc-scroll">
        <div className="qc-col">
          <div className="top">
            <button type="button" className="bk" onClick={handleBack}>
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              前尘
            </button>
            {tab !== 'summary' ? (
              <button
                type="button"
                className="btn btn-pri"
                style={{ padding: '0 18px' }}
                onClick={handleSave}
                disabled={!dirty || isSaving}
              >
                {isSaving ? '保存中……' : '保存'}
              </button>
            ) : <span className="sp" />}
          </div>

          <div className="qc-detail-head">
            <Snowflake
              size={64}
              arm={isJsonl ? pickArm(pack.id) : 'c'}
              lit={lit}
              deep={!isJsonl}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="hd serif">{saved.title || pack.title}</h1>
              <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>
                {isJsonl
                  ? `ST 聊天记录 · ${(pack.source?.messageCount || 0).toLocaleString()} 条消息`
                  : `文本 · ${pack.chunkCount} 块`}
              </div>
            </div>
          </div>

          <div className="tabs" role="tablist" aria-label="往事详情">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`qc-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`qc-panel-${id}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ---------- 概览 ---------- */}
          <div
            id="qc-panel-overview"
            role="tabpanel"
            aria-labelledby="qc-tab-overview"
            hidden={tab !== 'overview'}
            className="qc-detail"
          >
            <section>
              <div className="lbl" style={{ marginBottom: 10 }}>挂到聊天时，三种带法各占多少</div>
              <div className="glass" style={{ padding: '14px 16px' }}>
                <TokenRow label="原文" value={rawTokens} max={maxTokens} />
                <TokenRow label="总结全文" value={summaryTokens} max={maxTokens} />
                <TokenRow label="只带概览" value={overviewTokens} max={maxTokens} />
                <p className="mute" style={{ margin: '8px 0 0', fontSize: 11 }}>
                  单位：估算 token。{bytesNote}。
                </p>
              </div>
            </section>

            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span className="lbl">概览</span>
                {overviewChip}
              </div>
              <div className="glass" style={{ padding: 16 }}>
                <p style={{ margin: '0 0 10px', color: 'var(--sub)' }}>
                  用几句话写下这份记录讲了什么。选「只带概览」时，角色只靠这段话了解这段往事，所以写得越准越好。
                </p>
                <label className="vh" htmlFor="qc-overview">概览</label>
                <textarea
                  id="qc-overview"
                  className="ta"
                  style={{ minHeight: 160 }}
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="例如：两人从高一同班到毕业的一年。前半年互相看不顺眼，运动会之后关系缓和，期末前夜第一次说出真心话。"
                />
                <div className="mute" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                  <span>每次聊天都会带上这段</span>
                  <span>估算 {overviewTokens.toLocaleString()} token</span>
                </div>
              </div>
            </section>

            <section>
              <div className="lbl" style={{ marginBottom: 10 }}>写什么比较有用</div>
              <div className="glass" style={{ padding: '4px 16px' }}>
                <div style={{ padding: '10px 0', borderBottom: '1px solid var(--div)' }}>
                  <b>谁和谁</b><span className="mute">　各自的身份和关系现状</span>
                </div>
                <div style={{ padding: '10px 0', borderBottom: '1px solid var(--div)' }}>
                  <b>发生过什么</b><span className="mute">　按时间线写几个关键节点</span>
                </div>
                <div style={{ padding: '10px 0' }}>
                  <b>角色该记得的设定</b><span className="mute">　称呼、口头禅、禁忌</span>
                </div>
              </div>
            </section>
          </div>

          {/* ---------- 总结 ---------- */}
          <div
            id="qc-panel-summary"
            role="tabpanel"
            aria-labelledby="qc-tab-summary"
            hidden={tab !== 'summary'}
            className="qc-detail"
          >
            {isJsonl && (
              <StSummaryGenerator
                pack={pack}
                entries={summaryEntries}
                onEntriesChange={handleEntriesChange}
                onBatchMessagesChange={setBatchMessages}
                onTotalMessagesChange={setCountedMessages}
              />
            )}
            <StSummaryEntriesEditor
              packId={pack.id}
              entries={summaryEntries}
              onEntriesChange={handleEntriesChange}
            />
          </div>

          {/* ---------- 信息 ---------- */}
          <div
            id="qc-panel-info"
            role="tabpanel"
            aria-labelledby="qc-tab-info"
            hidden={tab !== 'info'}
            className="qc-detail"
          >
            <section>
              <div className="lbl" style={{ marginBottom: 10 }}>往事名称</div>
              <label className="vh" htmlFor="qc-pack-title">往事名称</label>
              <input
                id="qc-pack-title"
                className="inp"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="往事名称"
              />
            </section>

            <section>
              <div className="lbl" style={{ marginBottom: 10 }}>这片往事有多大</div>
              <div className="glass" style={{ padding: '4px 16px' }}>
                <div className="row"><span className="mute">来源</span><b>{isJsonl ? 'ST 聊天记录' : '文本 / Markdown'}</b></div>
                {isJsonl && (
                  <div className="row" style={{ borderTop: '1px solid var(--div)' }}>
                    <span className="mute">消息</span><b>{(pack.source?.messageCount || 0).toLocaleString()} 条</b>
                  </div>
                )}
                <div className="row" style={{ borderTop: '1px solid var(--div)' }}>
                  <span className="mute">原文</span><b>{pack.chunkCount} 块 / 约 {(pack.charCount || 0).toLocaleString()} 字</b>
                </div>
                <div className="row" style={{ borderTop: '1px solid var(--div)' }}>
                  <span className="mute">体量（估算）</span><b>{(pack.tokenEstimate || 0).toLocaleString()} token</b>
                </div>
              </div>
            </section>

            {imports.length > 1 && (
              <section>
                <div className="lbl" style={{ marginBottom: 10 }}>导入记录　{imports.length} 次</div>
                <div className="glass" style={{ padding: '4px 16px' }}>
                  {imports.map((record, index) => (
                    <div
                      key={record.importId}
                      className="row"
                      style={{ borderTop: index === 0 ? 0 : '1px solid var(--div)', gap: 12 }}
                    >
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{record.label}</span>
                      <span className="mute" style={{ fontSize: 12, flex: 'none' }}>
                        {record.chunkCount} 块{formatDate(record.createdAt) ? ` · ${formatDate(record.createdAt)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-out"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={() => onRequestUndo(pack)}
                >
                  撤销最近一次导入
                </button>
              </section>
            )}

            <section>
              <button
                type="button"
                className="btn-text btn-danger"
                onClick={() => onRequestDelete(pack)}
              >
                删除这片往事
              </button>
              <p className="mute" style={{ margin: '0 2px', fontSize: 11, textAlign: 'center' }}>
                删除后原文也会一起删掉，所有挂着它的聊天会取消挂载。
              </p>
            </section>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmLeave}
        title="放弃修改"
        message="名称或概览有还没保存的改动，确定放弃吗？"
        onConfirm={() => {
          setConfirmLeave(false);
          onClose();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </>
  );
};

export default StPackDetail;
// src/apps/stmemory/StJsonlImportModal.jsx
//
// 导入 SillyTavern 聊天记录（.jsonl）的全屏向导，三步：识别、清洗、确认；导入完成后进入封存页。
// 选文件后自动"试跑"一遍，显示识别到的说话人、消息数、清洗后的字数和 token 估算，以及套用
// 清洗规则前后的对比示例；满意了再导入。同一份聊天以前导过的话，可以选择只追加新增的部分。
//
// 群聊（角色一方不止一个名字）第一版不支持，会明确提示并禁止导入。
//
// 逻辑沿用原来的弹窗，只换了外观和文案。文件名保留 StJsonlImportModal.jsx 以减少改动面，
// 但它现在不是弹窗了：直接渲染在 QianchenBackdrop 里面，由 StMemoryApp 代替首页显示。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import Snowflake, { pickArm } from './Snowflake';
import StCleaningRulesEditor from './StCleaningRulesEditor';
import StSealPage from './StSealPage';
import { loadCleaningRules, saveCleaningRules } from './stCleaningStore';
import {
  APPEND_STATUS,
  importStJsonl,
  previewStJsonl,
} from './stJsonlImportService';
import { getPack } from './stPackService';

const MACRO_NAMES = new Set(['{{user}}', '{{char}}', 'unused']);

const parseNameList = (text) => (
  String(text || '').split(/[,，、]/).map((name) => name.trim()).filter(Boolean)
);

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** 把"前"文本里被规则删掉的那一段标出来（取首尾相同的部分，中间就是被改动的）。 */
const splitRemoved = (before, after) => {
  if (!after) return { head: '', cut: before, tail: '' };
  const max = Math.min(before.length, after.length);
  let i = 0;
  while (i < max && before[i] === after[i]) i += 1;
  let j = 0;
  while (j < max - i && before[before.length - 1 - j] === after[after.length - 1 - j]) j += 1;
  return {
    head: before.slice(0, i),
    cut: before.slice(i, before.length - j),
    tail: before.slice(before.length - j),
  };
};

const CheckIcon = ({ size = 16 }) => (
  <svg className="ico" style={{ width: size, height: size }} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

const Stepper = ({ step }) => {
  const items = ['识别', '清洗', '确认'];
  return (
    <ol className="stepper" aria-label="导入步骤" style={{ listStyle: 'none', margin: 0 }}>
      {items.map((label, index) => {
        const n = index + 1;
        const state = n < step ? 'step-done' : n === step ? 'step-on' : '';
        return (
          <React.Fragment key={label}>
            {index > 0 && <li className={`rail${n <= step ? ' rail-on' : ''}`} aria-hidden="true" style={{ listStyle: 'none' }} />}
            <li className={`step ${state}`} aria-current={n === step ? 'step' : undefined} style={{ listStyle: 'none' }}>
              <div className="dot">{n < step ? <CheckIcon size={14} /> : n}</div>
              {label}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
};

/** 向导每一步共用的外壳：顶栏 + 步骤条 + 可滚动内容 + 底部固定区。 */
const Shell = ({ step, backLabel, backIcon, onBack, backDisabled, footer, children }) => (
  <>
    <div className="qc-scroll">
      <div className="qc-col">
        <div className="top">
          <button type="button" className="bk" onClick={onBack} disabled={backDisabled}>
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">{backIcon}</svg>
            {backLabel}
          </button>
          <h1 className="tt serif" style={{ margin: 0 }}>导入聊天记录</h1>
          <span className="sp" />
        </div>
        <Stepper step={step} />
        {children}
      </div>
    </div>
    <div className="foot"><div className="foot-in">{footer}</div></div>
  </>
);

const ICON_BACK = (<><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>);
const ICON_CLOSE = (<><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>);

const StJsonlImportModal = ({ file, onClose, onImported, onOpenSummary }) => {
  const [step, setStep] = useState(1); // 1 识别 / 2 清洗 / 3 确认 / 'seal' 封存
  const [rules, setRules] = useState([]);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesDirty, setRulesDirty] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [title, setTitle] = useState(() => file.name.replace(/\.[^.]+$/, ''));
  const [charName, setCharName] = useState('');
  const [userNamesText, setUserNamesText] = useState('');
  const [mode, setMode] = useState('new');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [sealInfo, setSealInfo] = useState(null);
  const defaultsAppliedRef = useRef(false);

  const runPreview = useCallback(async (currentRules) => {
    setIsScanning(true);
    setScanError('');
    try {
      const result = await previewStJsonl(file, currentRules);
      setPreview(result);
      setRulesDirty(false);

      // 名字、模式的默认值只在第一次扫描时填，之后不覆盖用户改过的内容。
      if (!defaultsAppliedRef.current) {
        defaultsAppliedRef.current = true;
        setCharName(result.charName || '');
        setUserNamesText(
          result.userNames.filter((name) => !MACRO_NAMES.has(name)).join('，'),
        );
        setMode(result.appendStatus === APPEND_STATUS.OK ? 'append' : 'new');
      }
    } catch (error) {
      console.error('[stmemory] 试跑失败：', error);
      setScanError(error?.message || '这个文件读不出来');
    } finally {
      setIsScanning(false);
    }
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    loadCleaningRules().then((loaded) => {
      if (cancelled) return;
      setRules(loaded);
      setRulesLoaded(true);
      void runPreview(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [runPreview]);

  const handleRulesChange = (nextRules) => {
    setRules(nextRules);
    setRulesDirty(true);
    void saveCleaningRules(nextRules);
  };

  const existingPack = preview?.existingPack || null;
  const appendStatus = preview?.appendStatus || null;
  const canAppend = appendStatus === APPEND_STATUS.OK;
  const isAppend = mode === 'append' && canAppend;
  const stats = preview?.stats;
  const enabledRuleCount = rules.filter((rule) => rule.enabled).length;

  const shown = stats && (isAppend
    ? {
      messages: stats.tailMessages,
      user: stats.tailUserMessages,
      char: stats.tailCharMessages,
      chars: stats.tailChars,
      tokens: stats.tailTokens,
    }
    : {
      messages: stats.totalKept - stats.droppedEmpty,
      user: stats.userMessages,
      char: stats.charMessages,
      chars: stats.cleanedChars,
      tokens: stats.cleanedTokens,
    });

  const newMessageCount = existingPack && stats
    ? stats.totalKept - (existingPack.source?.messageCount || 0)
    : 0;

  const blocked = !preview || preview.isGroupChat || isScanning || isImporting
    || (mode === 'append' && !canAppend && Boolean(existingPack));

  const handleImport = async () => {
    if (blocked) return;
    setIsImporting(true);
    setProgress({ chunks: 0, chars: 0 });

    try {
      const result = await importStJsonl(file, {
        title,
        charName,
        userNames: parseNameList(userNamesText),
        rules,
        mode: isAppend ? 'append' : 'new',
        existingPackId: existingPack?.id,
        onProgress: setProgress,
      });

      let packTitle = isAppend ? existingPack?.title : title;
      try {
        packTitle = (await getPack(result.packId))?.title || packTitle;
      } catch (error) {
        console.warn('[stmemory] 读取封存后的往事失败：', error);
      }

      setSealInfo({
        packId: result.packId,
        title: packTitle || '',
        appended: isAppend,
        added: result.addedMessages,
        tokens: shown?.tokens || 0,
      });
      setIsImporting(false);
      setProgress(null);
      setStep('seal');
      onImported?.(result.packId);
    } catch (error) {
      console.error('[stmemory] 导入失败：', error);
      triggerGlobalToast({ title: '导入失败', content: error?.message || '未知错误' });
      setIsImporting(false);
      setProgress(null);
    }
  };

  // ---------- 封存页 ----------
  if (step === 'seal' && sealInfo) {
    return (
      <StSealPage
        info={sealInfo}
        onSummary={() => onOpenSummary?.(sealInfo.packId)}
        onClose={onClose}
      />
    );
  }

  // ---------- 第一步：识别 ----------
  if (step === 1) {
    const ready = Boolean(preview) && !scanError;
    return (
      <Shell
        key="s1"
        step={1}
        backLabel="退出"
        backIcon={ICON_CLOSE}
        onBack={onClose}
        footer={(
          <button
            type="button"
            className="btn btn-pri btn-big"
            disabled={!ready || preview.isGroupChat || isScanning}
            onClick={() => setStep(2)}
          >
            下一步：清洗内容
          </button>
        )}
      >
        <div className="qc-wiz">
          <div className="glass" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Snowflake size={48} arm="b" lit={0} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
              <div className="mute" style={{ fontSize: 12 }}>{formatSize(file.size)}</div>
            </div>
            {scanError ? (
              <span className="chip chip-bad">读取失败</span>
            ) : ready ? (
              <span className="chip chip-ok"><CheckIcon size={14} />读取完成</span>
            ) : (
              <span className="chip"><Loader2 className="ico animate-spin" style={{ width: 14, height: 14 }} aria-hidden="true" />读取中</span>
            )}
          </div>

          {scanError && <p className="qc-warn" role="alert" style={{ margin: 0 }}>{scanError}</p>}

          {preview?.isGroupChat && (
            <p className="qc-warn" role="alert" style={{ margin: 0 }}>
              这看起来是群聊：角色一方出现了多个名字（{preview.charNames.join('、')}）。
              第一版只支持一对一聊天，暂时不能导入。
            </p>
          )}

          <section>
            <div className="lbl" style={{ marginBottom: 10 }}>识别结果</div>
            <div className="glass" style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
                <div>
                  <div className="mute" style={{ fontSize: 12 }}>消息总数</div>
                  <div className="num serif">{stats ? stats.totalKept.toLocaleString() : '—'}</div>
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 12 }}>全文体量（估算）</div>
                  <div className="num serif">
                    {stats ? stats.rawTokens.toLocaleString() : '—'}{' '}
                    <span className="mute" style={{ fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>token</span>
                  </div>
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 12 }}>用户发言</div>
                  <div className="num serif">{stats ? stats.userMessages.toLocaleString() : '—'}</div>
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 12 }}>角色发言</div>
                  <div className="num serif">{stats ? stats.charMessages.toLocaleString() : '—'}</div>
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--div)', margin: '14px 0 4px' }} />
              <div className="row">
                <span className="mute">识别到的角色名</span>
                <span style={{ fontWeight: 700 }}>{preview ? (charName || '未识别') : '—'}</span>
              </div>
              <div className="row">
                <span className="mute">识别到的用户名</span>
                <span style={{ fontWeight: 700 }}>{preview ? (userNamesText || '未识别') : '—'}</span>
              </div>
              <p className="mute" style={{ margin: '2px 0 0', fontSize: 11 }}>
                这两个名字会在第三步换成占位符，挂到别的聊天时自动变成那里的名字。
              </p>
              {preview?.skippedLines > 0 && (
                <p className="mute" style={{ margin: '8px 0 0', fontSize: 11 }}>
                  有 {preview.skippedLines} 行无法解析，已跳过。
                </p>
              )}
            </div>
          </section>

          {existingPack && (
            <section>
              <div className="lbl" style={{ marginBottom: 10 }}>导入方式</div>
              <div className="glass" style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: canAppend ? 12 : 0 }}>
                  <svg className="ico" style={{ marginTop: 3 }} viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 700 }}>这份聊天以前导入过</div>
                    <div className="mute" style={{ fontSize: 12 }}>
                      {canAppend
                        ? `「${existingPack.title}」上次导到第 ${(existingPack.source?.messageCount || 0).toLocaleString()} 条，现在多了 ${newMessageCount.toLocaleString()} 条新消息。`
                        : appendStatus === APPEND_STATUS.NONE
                          ? `「${existingPack.title}」已经是最新的，没有新增的消息，不需要再导入。你仍然可以塑造一片新的雪花。`
                          : `「${existingPack.title}」前面已导入的部分和上次不一样了（可能删改过消息），不能追加，只能塑造一片新的雪花。`}
                    </div>
                  </div>
                </div>
                {canAppend && (
                  <>
                    <div className="seg" role="tablist" aria-label="导入方式">
                      <button type="button" role="tab" aria-selected={mode === 'append'} onClick={() => setMode('append')}>
                        只追加新增部分
                      </button>
                      <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}>
                        塑造一片新的雪花
                      </button>
                    </div>
                    <p className="mute" style={{ margin: '10px 2px 0', fontSize: 11 }}>
                      {mode === 'append'
                        ? `追加只处理新增的 ${newMessageCount.toLocaleString()} 条，已有的总结条目不受影响。`
                        : '塑造一片新的雪花会另存为一条新的往事，原来那条不受影响。'}
                    </p>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </Shell>
    );
  }

  // ---------- 第二步：清洗 ----------
  if (step === 2) {
    const saved = stats && stats.rawTokens > 0 && stats.cleanedTokens < stats.rawTokens
      ? Math.round((1 - stats.cleanedTokens / stats.rawTokens) * 100)
      : 0;

    return (
      <Shell
        key="s2"
        step={2}
        backLabel="上一步"
        backIcon={ICON_BACK}
        onBack={() => setStep(1)}
        footer={(
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div aria-live="polite">
                <div className="mute" style={{ fontSize: 12 }}>清洗后（估算）</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {stats ? stats.cleanedTokens.toLocaleString() : '—'} token
                  {saved > 0 && !rulesDirty && <span className="chip chip-ok" style={{ marginLeft: 6 }}>少了 {saved}%</span>}
                </div>
                {rulesDirty && <div className="mute" style={{ fontSize: 11 }}>规则改过了，数字还没更新</div>}
              </div>
              <button
                type="button"
                className="btn btn-out"
                style={rulesDirty ? { borderColor: 'var(--acc)' } : undefined}
                disabled={isScanning}
                onClick={() => void runPreview(rules)}
              >
                <RefreshCw className={`ico${isScanning ? ' animate-spin' : ''}`} aria-hidden="true" />
                重新统计
              </button>
            </div>
            <button
              type="button"
              className="btn btn-pri btn-big"
              disabled={isScanning || !preview}
              onClick={() => setStep(3)}
            >
              下一步：确认导入
            </button>
          </>
        )}
      >
        <div className="qc-wiz-head">
          <h2 className="hd serif">清掉不想让角色看到的内容</h2>
          <p className="mute" style={{ margin: '6px 0 0' }}>
            比如状态栏、思维链。规则对每条消息单独生效，所有往事共用这一份。
          </p>
        </div>
        <div className="qc-wiz" style={{ paddingTop: 20 }}>
          {rulesLoaded && (
            <StCleaningRulesEditor
              rules={rules}
              onChange={handleRulesChange}
              tagStats={preview?.tagStats || []}
            />
          )}

          <section>
            <div className="lbl" style={{ marginBottom: 10 }}>效果对比</div>
            <div className="glass" style={{ padding: 16 }}>
              {preview && preview.samples.length > 0 ? (
                preview.samples.map((sample, index) => {
                  const { head, cut, tail } = splitRemoved(sample.before, sample.after);
                  return (
                    <div key={index}>
                      {index > 0 && <div style={{ height: 1, background: 'var(--div)', margin: '14px 0' }} />}
                      <div className="mute" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>清洗前</div>
                      <div style={{ color: 'var(--sub)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {head}{cut && <span className="del">{cut}</span>}{tail}
                      </div>
                      <div style={{ height: 1, background: 'var(--div)', margin: '12px 0' }} />
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--ok)' }}>清洗后</div>
                      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {sample.after || '（整条被清空）'}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="mute" style={{ margin: 0 }}>现在的规则没有改动任何消息。</p>
              )}
              <p className="mute" style={{ margin: '10px 0 0', fontSize: 11 }}>只列被规则改动的消息。</p>
            </div>
          </section>
        </div>
      </Shell>
    );
  }

  // ---------- 第三步：确认 ----------
  const confirmLabel = isAppend
    ? `追加 ${shown?.messages ?? 0} 条消息`
    : `导入 ${shown?.messages ?? 0} 条消息`;

  return (
    <Shell
      key="s3"
      step={3}
      backLabel="上一步"
      backIcon={ICON_BACK}
      backDisabled={isImporting}
      onBack={() => setStep(2)}
      footer={(
        <>
          <div className="mute" style={{ minHeight: 18, marginBottom: 10, fontSize: 12, textAlign: 'center' }} aria-live="polite">
            {isImporting && progress
              ? `已处理 ${progress.chunks} 块 / ${progress.chars.toLocaleString()} 字`
              : ''}
          </div>
          <button type="button" className="btn btn-pri btn-big" disabled={blocked} onClick={handleImport}>
            {isImporting ? '导入中……' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className="qc-wiz-head">
        <h2 className="hd serif">确认导入</h2>
        <p className="mute" style={{ margin: '6px 0 0' }}>再看一眼，没问题就导入。</p>
      </div>
      <div className="qc-wiz" style={{ paddingTop: 20 }}>
        <section>
          <div className="lbl" style={{ marginBottom: 10 }}>导入到</div>
          <div className="glass" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Snowflake
                size={48}
                arm={isAppend ? pickArm(existingPack?.id) : 'b'}
                lit={isAppend ? 6 : 0}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mute" style={{ fontSize: 12 }}>
                  {isAppend ? '追加到现有往事' : '塑造一片新的雪花'}
                </div>
                {isAppend && (
                  <div className="serif" style={{ fontSize: 19, fontWeight: 400, letterSpacing: '.04em', overflowWrap: 'anywhere' }}>
                    {existingPack?.title}
                  </div>
                )}
              </div>
              {isAppend && <span className="chip">只追加新增部分</span>}
            </div>
            {!isAppend && (
              <div style={{ marginTop: 12 }}>
                <label className="field" htmlFor="qc-jsonl-title">往事名称</label>
                <input
                  id="qc-jsonl-title"
                  className="inp"
                  placeholder="给这段往事起个名字"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isImporting}
                />
              </div>
            )}
            {isAppend && (
              <button
                type="button"
                className="btn-underline"
                style={{ marginTop: 6 }}
                disabled={isImporting}
                onClick={() => setMode('new')}
              >
                改成塑造一片新的雪花
              </button>
            )}
          </div>
        </section>

        <section>
          <div className="lbl" style={{ marginBottom: 10 }}>名字占位符</div>
          <div className="glass" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
              <div>
                <label className="field" htmlFor="qc-jsonl-char">角色名</label>
                <input
                  id="qc-jsonl-char"
                  className="inp"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  disabled={isImporting}
                />
              </div>
              <div>
                <label className="field" htmlFor="qc-jsonl-user">用户名</label>
                <input
                  id="qc-jsonl-user"
                  className="inp"
                  placeholder="多个用逗号分隔"
                  value={userNamesText}
                  onChange={(e) => setUserNamesText(e.target.value)}
                  disabled={isImporting}
                />
              </div>
            </div>
            <p className="mute" style={{ margin: '10px 0 0', fontSize: 11 }}>
              已按识别结果填好。正文里的这些名字会换成占位符，挂到哪个聊天就变成那里的名字。
              如果用户名在 ST 里本来就是占位符，留空即可。名字太短（比如一个字）容易误伤正文，请酌情清空。
            </p>
          </div>
        </section>

        <section>
          <div className="lbl" style={{ marginBottom: 10 }}>本次导入一览</div>
          <div className="glass" style={{ padding: '4px 16px' }}>
            <div className="row"><span className="mute">{isAppend ? '新增消息' : '消息'}</span><b>{shown?.messages ?? 0} 条</b></div>
            <div className="row" style={{ borderTop: '1px solid var(--div)' }}><span className="mute">其中用户 / 角色</span><b>{shown?.user ?? 0} / {shown?.char ?? 0}</b></div>
            <div className="row" style={{ borderTop: '1px solid var(--div)' }}><span className="mute">启用的清洗规则</span><b>{enabledRuleCount} 条</b></div>
            <div className="row" style={{ borderTop: '1px solid var(--div)' }}><span className="mute">清洗后变空、被丢弃</span><b>{stats?.droppedEmpty ?? 0} 条</b></div>
            <div className="row" style={{ borderTop: '1px solid var(--div)' }}><span className="mute">体量（估算）</span><b>约 {(shown?.tokens ?? 0).toLocaleString()} token</b></div>
          </div>
          <p className="mute" style={{ margin: '10px 2px 0', fontSize: 12 }}>
            导入后，可以接着为这 {shown?.messages ?? 0} 条生成总结。
          </p>
        </section>
      </div>
    </Shell>
  );
};

export default StJsonlImportModal;
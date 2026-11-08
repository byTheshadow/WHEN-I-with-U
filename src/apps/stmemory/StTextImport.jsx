// src/apps/stmemory/StTextImport.jsx
//
// 导入文本 / Markdown 成一条往事。支持粘贴文字或选择文件；文件分块流式读，
// 导入前先显示字数和 token 估算。选到 ST 聊天记录（.jsonl）时不在这里处理，
// 交给父组件打开 ST 导入向导（onPickJsonl）。
//
// 逻辑沿用原来的 StPackImportModal，只换了外观和文案。
import React, { useMemo, useRef, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import { estimateTokens } from './stPackBudget';
import { estimateSource, importTextAsPack } from './stPackService';

const StTextImport = ({ onBack, onImported, onPickJsonl }) => {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('paste'); // 'paste' | 'file'
  const [title, setTitle] = useState('');
  const [charName, setCharName] = useState('');
  const [userName, setUserName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);

  const pastedTokens = useMemo(() => estimateTokens(pastedText), [pastedText]);

  const usingFile = mode === 'file' && Boolean(file);
  const hasSource = usingFile ? true : (mode === 'paste' && pastedText.trim().length > 0);
  const stats = usingFile
    ? fileStats
    : (mode === 'paste' && pastedText ? { chars: pastedText.length, tokens: pastedTokens } : null);

  const handlePickFile = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;

    if (/\.jsonl$/i.test(picked.name)) {
      onPickJsonl?.(picked);
      return;
    }

    setFile(picked);
    setFileStats(null);
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ''));
    setIsEstimating(true);
    try {
      setFileStats(await estimateSource({ file: picked }));
    } catch (error) {
      console.warn('[stmemory] 估算文件失败：', error);
      triggerGlobalToast({ title: '读取失败', content: '这个文件读不出来，换一个再试。' });
      setFile(null);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setFileStats(null);
  };

  const handleImport = async () => {
    if (!hasSource || isImporting || isEstimating) return;

    setIsImporting(true);
    setProgress({ chunks: 0, chars: 0 });

    try {
      const packId = await importTextAsPack(
        usingFile ? { file } : { text: pastedText },
        {
          title,
          charName,
          userName,
          onProgress: setProgress,
        },
      );
      triggerGlobalToast({ title: '导入完成', content: '这段往事已经沉进冰下了。' });
      onImported?.(packId);
    } catch (error) {
      console.error('[stmemory] 导入失败：', error);
      triggerGlobalToast({ title: '导入失败', content: error?.message || '未知错误' });
      setIsImporting(false);
      setProgress(null);
    }
  };

  const busy = isImporting || isEstimating;

  return (
    <>
      <div className="qc-scroll">
      <div className="qc-col">
        <div className="top">
          <button type="button" className="bk" onClick={onBack} disabled={isImporting}>
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            返回
          </button>
          <h1 className="tt serif" style={{ margin: 0 }}>导入文本</h1>
          <span className="sp" />
        </div>

        <div className="qc-form">
          <section>
            <div className="lbl" style={{ marginBottom: 10 }}>1　内容</div>
            <div className="seg" role="tablist" aria-label="内容来源" style={{ marginBottom: 10 }}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'paste'}
                disabled={isImporting}
                onClick={() => setMode('paste')}
              >
                粘贴文字
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'file'}
                disabled={isImporting}
                onClick={() => setMode('file')}
              >
                选择文件
              </button>
            </div>

            {mode === 'paste' ? (
              <>
                <label className="vh" htmlFor="qc-body-text">正文</label>
                <textarea
                  id="qc-body-text"
                  className="ta"
                  style={{ minHeight: 180 }}
                  placeholder="把文字粘贴在这里"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={isImporting}
                />
              </>
            ) : file ? (
              <div className="qc-file">
                <FileText className="ico mute" aria-hidden="true" />
                <span>{file.name}</span>
                <button type="button" aria-label="移除文件" onClick={handleClearFile} disabled={isImporting}>
                  <X className="ico" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-out"
                style={{ width: '100%', minHeight: 120, flexDirection: 'column', fontWeight: 600 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                选择 .txt / .md 文件
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,.jsonl,text/plain,text/markdown"
              className="vh"
              tabIndex={-1}
              onChange={handlePickFile}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, minHeight: 26 }}>
              {isEstimating ? (
                <span className="mute" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 className="ico animate-spin" aria-hidden="true" /> 正在统计字数……
                </span>
              ) : stats ? (
                <>
                  <span className="chip">约 {stats.chars.toLocaleString()} 字</span>
                  <span className="chip">估算 {stats.tokens.toLocaleString()} token</span>
                </>
              ) : null}
            </div>
            <p className="mute" style={{ margin: '8px 2px 0', fontSize: 11 }}>
              SillyTavern 的 .jsonl 请回到上一步选「SillyTavern 聊天记录」。
            </p>
          </section>

          <section>
            <div className="lbl" style={{ marginBottom: 10 }}>2　名称</div>
            <label className="field" htmlFor="qc-pack-name">往事名称</label>
            <input
              id="qc-pack-name"
              className="inp"
              placeholder="给这段往事起个名字"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isImporting}
            />
          </section>

          <section>
            <div className="lbl" style={{ marginBottom: 10 }}>3　名字占位符（可选）</div>
            <div className="glass" style={{ padding: 16 }}>
              <p style={{ margin: '0 0 12px', color: 'var(--sub)' }}>
                文中如果写了角色名或用户名，填在这里，导入时会换成占位符。之后挂到哪个聊天，就自动变成那个聊天里的名字。
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                <div>
                  <label className="field" htmlFor="qc-char-name">文中的角色名</label>
                  <input
                    id="qc-char-name"
                    className="inp"
                    placeholder="例如 小雪"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    disabled={isImporting}
                  />
                </div>
                <div>
                  <label className="field" htmlFor="qc-user-name">文中的用户名</label>
                  <input
                    id="qc-user-name"
                    className="inp"
                    placeholder="例如 阿明"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={isImporting}
                  />
                </div>
              </div>
              <p className="mute" style={{ margin: '10px 0 0', fontSize: 11 }}>
                不确定就留空，之后不能自动替换，但不影响使用。
              </p>
            </div>
          </section>
        </div>
      </div>
      </div>

      <div className="foot">
        <div className="foot-in">
          <div
            className="mute"
            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, minHeight: 18 }}
            aria-live="polite"
          >
            {isImporting && progress ? (
              <span>已处理 {progress.chunks} 块 / {progress.chars.toLocaleString()} 字</span>
            ) : stats && !isEstimating ? (
              <>
                <span>将导入　约 {stats.chars.toLocaleString()} 字</span>
                <span>估算 {stats.tokens.toLocaleString()} token</span>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-pri btn-big"
            onClick={handleImport}
            disabled={!hasSource || busy}
          >
            {isImporting ? '导入中……' : '导入'}
          </button>
        </div>
      </div>
    </>
  );
};

export default StTextImport;

// src/apps/stmemory/StPackImportModal.jsx
//
// 导入纯文本 / Markdown 成记忆包。支持粘贴文字或选择文件；文件分块流式读，
// 导入前先显示字数和 token 估算。ST 聊天记录（.jsonl）的解析是后面的切片，
// 现在选到会明确提示，不会把它当普通文本误导入。
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, X } from 'lucide-react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import { estimateTokens } from './stPackBudget';
import { estimateSource, importTextAsPack } from './stPackService';

const inputClass = 'w-full rounded-xl border px-3 py-2 text-xs outline-none';
const inputStyle = {
  background: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const StPackImportModal = ({ onClose, onImported }) => {
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [charName, setCharName] = useState('');
  const [userName, setUserName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);

  const isJsonl = Boolean(file && /\.jsonl$/i.test(file.name));

  const pastedTokens = useMemo(() => estimateTokens(pastedText), [pastedText]);

  const hasSource = file ? !isJsonl : pastedText.trim().length > 0;
  const stats = file
    ? fileStats
    : (pastedText ? { chars: pastedText.length, tokens: pastedTokens } : null);

  const handlePickFile = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;

    setFile(picked);
    setFileStats(null);
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ''));
    if (/\.jsonl$/i.test(picked.name)) return;

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
        file ? { file } : { text: pastedText },
        {
          title,
          charName,
          userName,
          onProgress: setProgress,
        },
      );
      triggerGlobalToast({ title: '导入完成', content: '记忆包已经加进库里了。' });
      onImported?.(packId);
      onClose();
    } catch (error) {
      console.error('[stmemory] 导入失败：', error);
      triggerGlobalToast({ title: '导入失败', content: error?.message || '未知错误' });
      setIsImporting(false);
      setProgress(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(0,0,0,0.25)' }}
        onClick={isImporting ? undefined : onClose}
      />

      <div
        className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[2rem] border p-5 text-xs sm:rounded-[2rem]"
        style={{
          background: 'var(--card-bg-gradient)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm font-bold">导入文本记忆包</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="opacity-60 hover:opacity-100 disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          className={inputClass}
          style={inputStyle}
          placeholder="记忆包名称"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isImporting}
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="文中的角色名（可选）"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            disabled={isImporting}
          />
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="文中的用户名（可选）"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={isImporting}
          />
        </div>
        <p className="-mt-1 text-[10px] leading-relaxed opacity-55">
          填了名字，导入时会把它们换成占位符，之后这个包挂到哪个聊天，就会自动换成那个聊天里的角色名和用户名。
        </p>

        {file ? (
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={inputStyle}
          >
            <FileText className="h-4 w-4 shrink-0 opacity-60" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button
              type="button"
              onClick={handleClearFile}
              disabled={isImporting}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <textarea
              className={`${inputClass} min-h-[120px] resize-y`}
              style={inputStyle}
              placeholder="把文字粘贴在这里，或者选择一个 .txt / .md 文件"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              disabled={isImporting}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="rounded-xl border py-2 font-semibold"
              style={inputStyle}
            >
              选择文件
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.jsonl,text/plain,text/markdown"
          className="hidden"
          onChange={handlePickFile}
        />

        {isJsonl && (
          <p className="rounded-xl border px-3 py-2 leading-relaxed" style={inputStyle}>
            这是 SillyTavern 的聊天记录（.jsonl）。它的解析还没有做进来，下一步会加上，这里先不导入，避免被当成普通文字乱导。
          </p>
        )}

        {isEstimating && (
          <p className="flex items-center gap-1.5 opacity-60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在统计字数……
          </p>
        )}

        {stats && !isEstimating && !isJsonl && (
          <p className="opacity-70">
            约 {stats.chars.toLocaleString()} 字，估算 {stats.tokens.toLocaleString()} token
            （估算值，真实用量因模型而异）
          </p>
        )}

        {isImporting && progress && (
          <p className="flex items-center gap-1.5 opacity-70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            已处理 {progress.chunks} 块 / {progress.chars.toLocaleString()} 字
          </p>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={!hasSource || isImporting || isEstimating}
          className="rounded-xl py-2.5 text-xs font-bold disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          {isImporting ? '导入中……' : '导入'}
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default StPackImportModal;

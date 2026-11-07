// src/apps/stmemory/StJsonlImportModal.jsx
//
// 导入 SillyTavern 聊天记录（.jsonl）。流程：选文件后自动"试跑"一遍，显示识别到的
// 说话人、消息数、清洗后的字数和 token 估算，以及套用清洗规则前后的对比示例；
// 满意了再导入。同一份聊天以前导过的话，可以选择只追加新增的部分。
//
// 群聊（角色一方不止一个名字）第一版不支持，会明确提示并禁止导入。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, X } from 'lucide-react';

import { triggerGlobalToast } from '../../components/NotificationToast';
import StCleaningRulesEditor from './StCleaningRulesEditor';
import { loadCleaningRules, saveCleaningRules } from './stCleaningStore';
import {
  APPEND_STATUS,
  importStJsonl,
  previewStJsonl,
} from './stJsonlImportService';

const fieldStyle = {
  background: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const MACRO_NAMES = new Set(['{{user}}', '{{char}}', 'unused']);

const parseNameList = (text) => (
  String(text || '').split(/[,，、]/).map((name) => name.trim()).filter(Boolean)
);

const StJsonlImportModal = ({ file, onClose, onImported }) => {
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

  const shown = stats && (isAppend
    ? { messages: stats.tailMessages, chars: stats.tailChars, tokens: stats.tailTokens }
    : { messages: stats.totalKept - stats.droppedEmpty, chars: stats.cleanedChars, tokens: stats.cleanedTokens });

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
      triggerGlobalToast({
        title: isAppend ? '已追加' : '导入完成',
        content: `${isAppend ? '新增' : '共'} ${result.addedMessages} 条消息进入记忆包。`,
      });
      onImported?.(result.packId);
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
        className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-[2rem] border p-5 text-xs sm:rounded-[2rem]"
        style={{
          background: 'var(--card-bg-gradient)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm font-bold">导入 ST 聊天记录</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="opacity-60 hover:opacity-100 disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="truncate opacity-60">{file.name}</p>

        {scanError && <p className="text-rose-500">{scanError}</p>}

        {isScanning && !preview && (
          <p className="flex items-center gap-1.5 opacity-60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在读取这份聊天……
          </p>
        )}

        {preview && preview.isGroupChat && (
          <p className="rounded-xl border border-rose-400 px-3 py-2 leading-relaxed text-rose-500">
            这看起来是群聊：角色一方出现了多个名字（{preview.charNames.join('、')}）。
            第一版只支持一对一聊天，暂时不能导入。
          </p>
        )}

        {preview && existingPack && (
          <div className="space-y-1.5 rounded-xl border px-3 py-2.5" style={fieldStyle}>
            <p className="font-semibold">这份聊天以前导入过：「{existingPack.title}」</p>
            {appendStatus === APPEND_STATUS.OK && (
              <>
                <p className="opacity-70">
                  上次导入到第 {existingPack.source?.messageCount} 条，现在多了
                  {' '}{preview.stats.totalKept - (existingPack.source?.messageCount || 0)} 条新消息。
                </p>
                <div className="flex gap-2">
                  {[['append', '只追加新增部分'], ['new', '新建一个包']].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMode(id)}
                      className="flex-1 rounded-lg border px-2 py-1.5 font-semibold"
                      style={{
                        ...fieldStyle,
                        borderColor: mode === id ? 'var(--accent-color)' : 'var(--card-border)',
                        outline: mode === id ? '1px solid var(--accent-color)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {appendStatus === APPEND_STATUS.NONE && (
              <p className="opacity-70">没有新增的消息，不需要再导入。你仍然可以新建一个包。</p>
            )}
            {appendStatus === APPEND_STATUS.CHANGED && (
              <p className="opacity-70">
                这份聊天前面已导入的部分和上次不一样了（可能删改过消息），不能追加，只能新建一个包。
              </p>
            )}
          </div>
        )}

        {preview && !isAppend && (
          <input
            className="w-full rounded-xl border px-3 py-2 outline-none"
            style={fieldStyle}
            placeholder="记忆包名称"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isImporting}
          />
        )}

        {preview && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-xl border px-3 py-2 outline-none"
                style={fieldStyle}
                placeholder="角色名"
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                disabled={isImporting}
              />
              <input
                className="rounded-xl border px-3 py-2 outline-none"
                style={fieldStyle}
                placeholder="用户名（可多个，逗号分隔）"
                value={userNamesText}
                onChange={(e) => setUserNamesText(e.target.value)}
                disabled={isImporting}
              />
            </div>
            <p className="text-[10px] leading-relaxed opacity-55">
              这里的名字在正文里会被换成占位符，挂到哪个聊天就变成那个聊天里的名字。
              如果用户名在 ST 里就是 {'{{user}}'}，留空即可。名字太短（比如一个字）容易误伤正文，请酌情清空。
            </p>
          </div>
        )}

        {rulesLoaded && (
          <div className="space-y-2 rounded-2xl border p-3" style={fieldStyle}>
            <h4 className="font-semibold">清洗规则</h4>
            <StCleaningRulesEditor rules={rules} onChange={handleRulesChange} />
          </div>
        )}

        {preview && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void runPreview(rules)}
              disabled={isScanning || isImporting}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 font-semibold disabled:opacity-50"
              style={{
                ...fieldStyle,
                borderColor: rulesDirty ? 'var(--accent-color)' : 'var(--card-border)',
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              {rulesDirty ? '规则改过了，重新统计' : '重新统计'}
            </button>

            <p className="opacity-75">
              {isAppend ? '本次将追加' : '将导入'} {shown.messages} 条消息
              （用户 {stats.userMessages} / 角色 {stats.charMessages}
              {isAppend ? '，这是整份聊天的数字' : ''}），
              约 {shown.chars.toLocaleString()} 字，估算 {shown.tokens.toLocaleString()} token
              （估算值，真实用量因模型而异）。
              {stats.droppedEmpty > 0 && ` 另有 ${stats.droppedEmpty} 条清洗后变成空的，会被丢弃。`}
              {preview.skippedLines > 0 && ` 有 ${preview.skippedLines} 行无法解析，已跳过。`}
            </p>

            {preview.samples.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-semibold">清洗前后对比（只列被规则改动的）</p>
                {preview.samples.map((sample, index) => (
                  <div key={index} className="space-y-1 rounded-xl border p-2" style={fieldStyle}>
                    <p className="whitespace-pre-wrap break-words opacity-60">前：{sample.before}</p>
                    <p className="whitespace-pre-wrap break-words">
                      后：{sample.after || '（整条被清空）'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          disabled={blocked}
          className="rounded-xl py-2.5 text-xs font-bold disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          {isImporting ? '导入中……' : (isAppend ? '追加新增部分' : '导入')}
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default StJsonlImportModal;

// src/apps/layoutstudio/LayoutStudioApp.jsx
//
// 修图室（Layout Studio）顶层 app：四步向导，每一步一个小页面。
//   1 选角色  2 放照片  3 出图  4 保存
// 切片 A：模板、渲染、手动改字、保存到设备。
// 角色 AI 选模板 / 写字 / 点评、存相册、摘要发回聊天室在后续切片接上。
//
// 这不是聊天室类 app，只需要一个返回首页的回调。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

import db from '../../db';
import { getVisionApiConfig, isVisionConfigured } from '../../services/visionService';
import LayoutStepCharacter from './LayoutStepCharacter';
import LayoutStepCompose from './LayoutStepCompose';
import LayoutStepFinish from './LayoutStepFinish';
import LayoutStepPhotos from './LayoutStepPhotos';
import LayoutTemplateSheet from './LayoutTemplateSheet';
import { MAX_PHOTOS } from './layoutConstants';
import { filesToPhotos } from './layoutPhotoService';
import { createDefaultSpec, pickTemplateId } from './layoutSpec';
import './layoutStudio.css';

const STEPS = [
  { n: 1, name: '角色', sub: '先选一位修图师' },
  { n: 2, name: '照片', sub: '把照片放进来' },
  { n: 3, name: '出图', sub: '开始修图' },
  { n: 4, name: '保存', sub: '修好了' },
];

const THINK_MS = 900;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const newSeed = () => 1 + Math.floor(Math.random() * 99999);

const canvasToBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));

const LayoutStudioApp = ({ onBackHub }) => {
  const [step, setStep] = useState(1);
  const [characters, setCharacters] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [charId, setCharId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [visionReady, setVisionReady] = useState(false);
  const [spec, setSpec] = useState(null);
  const [playKey, setPlayKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  const canvasRef = useRef(null);
  const toastTimer = useRef(0);
  const aliveRef = useRef(true);

  const showToast = useCallback((text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await db.characters.toArray();
        if (!cancelled) setCharacters(list);
      } catch (error) {
        console.warn('[LayoutStudio] 读取角色失败：', error);
      }
      if (!cancelled) setLoadingChars(false);
      try {
        const config = await getVisionApiConfig();
        if (!cancelled) setVisionReady(isVisionConfigured(config));
      } catch (error) {
        console.warn('[LayoutStudio] 读取视觉模型配置失败：', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 结果图的 blob 地址用完要释放。
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const character = useMemo(
    () => characters.find((item) => item.id === charId) || null,
    [characters, charId]
  );
  const charName = character?.name || 'TA';

  const resetResult = useCallback(() => {
    setSpec(null);
    setSaved(false);
    setResultUrl('');
  }, []);

  /* ---------- 照片 ---------- */

  const handleAddFiles = async (files) => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      showToast(`最多放 ${MAX_PHOTOS} 张`);
      return;
    }
    setBusy(true);
    try {
      const { photos: added, failed } = await filesToPhotos(files, room);
      if (!aliveRef.current) return;
      if (added.length) {
        setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
        resetResult();
      }
      if (failed > 0) showToast(`有 ${failed} 张读取失败，已跳过`);
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    resetResult();
  };

  const handleMakeMain = (index) => {
    setPhotos((prev) => {
      const next = prev.slice();
      const [picked] = next.splice(index, 1);
      next.unshift(picked);
      return next;
    });
    resetResult();
  };

  /* ---------- 出图 ---------- */

  const runCompose = useCallback(
    async (templateId, { think = false } = {}) => {
      if (photos.length === 0) return;
      setBusy(true);
      setSaved(false);
      if (think) {
        setThinking(true);
        await sleep(THINK_MS);
        if (!aliveRef.current) return;
        setThinking(false);
      }
      setSpec(createDefaultSpec(templateId, { photoCount: photos.length, seed: newSeed() }));
      setPlayKey((key) => key + 1);
    },
    [photos.length]
  );

  const handleDecide = () => runCompose(pickTemplateId(spec?.templateId), { think: true });

  const handlePickTemplate = (templateId) => {
    setSheetOpen(false);
    void runCompose(templateId);
  };

  const handleReroll = () => {
    if (spec) void runCompose(spec.templateId);
  };

  const handleSpecChange = (next) => {
    setSpec(next);
    setSaved(false);
  };

  const handlePlayEnd = useCallback(() => setBusy(false), []);

  /* ---------- 保存 ---------- */

  const handleSave = async () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      showToast('导出失败，请再试一次');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `修图室-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    setSaved(true);
    showToast('已保存');
  };

  /* ---------- 步骤切换 ---------- */

  const canProceed = (n) => {
    if (n === 1) return Boolean(character);
    if (n === 2) return photos.length > 0 && !busy;
    if (n === 3) return Boolean(spec) && !busy;
    return true;
  };

  const goTo = async (n) => {
    if (n === 4) {
      const canvas = canvasRef.current?.getCanvas();
      const blob = canvas ? await canvasToBlob(canvas) : null;
      if (!aliveRef.current) return;
      setResultUrl(blob ? URL.createObjectURL(blob) : '');
    }
    setStep(n);
  };

  const handleNext = () => {
    if (step < 4 && canProceed(step)) void goTo(step + 1);
  };

  const handleBack = () => {
    if (busy) return;
    if (step > 1) setStep(step - 1);
    else if (onBackHub) onBackHub();
  };

  const handleRestart = () => {
    setPhotos([]);
    resetResult();
    setStep(1);
  };

  const hint = (() => {
    if (step === 1) return character ? `${charName} 准备好了` : '先点一位角色';
    if (step === 2) return photos.length ? `已放 ${photos.length} 张，可以继续` : '至少放一张照片';
    if (step === 3) {
      if (busy) return '出图中...';
      return spec ? '满意了就往下走' : '先让 TA 出一版';
    }
    return '';
  })();

  const nextLabel = ['', '下一步：放照片', '下一步：开始修图', '看看成品'][step];
  const ready = canProceed(step);

  return (
    <div className="ls-root">
      <div className="ls-app">
        <i className="ls-blob ls-b1" />
        <i className="ls-blob ls-b2" />

        <header className="ls-top">
          <button type="button" className="ls-back" onClick={handleBack}>
            <ArrowLeft size={17} />
            <span>{step > 1 ? '上一步' : '主页'}</span>
          </button>
          <div className="ls-ttl">
            <h1>修图室</h1>
            <p>{STEPS[step - 1].sub}</p>
          </div>
          <div />
        </header>

        <nav className="ls-stepper">
          {STEPS.map((s) => {
            const cls = s.n < step ? 'ls-done ls-can' : s.n === step ? 'ls-cur' : '';
            return (
              <div
                key={s.n}
                className={`ls-st ${cls}`}
                onClick={() => s.n < step && !busy && setStep(s.n)}
              >
                <i>{s.n < step ? <Check size={14} /> : s.n}</i>
                <span>{s.name}</span>
              </div>
            );
          })}
        </nav>

        <main className="ls-pages">
          {[1, 2, 3, 4].map((n) => (
            <section
              key={n}
              className={`ls-page${n === step ? ' ls-active' : ''}${n < step ? ' ls-past' : ''}`}
            >
              {n === 1 && (
                <LayoutStepCharacter
                  characters={characters}
                  loading={loadingChars}
                  selectedId={charId}
                  onSelect={setCharId}
                />
              )}
              {n === 2 && (
                <LayoutStepPhotos
                  photos={photos}
                  charName={charName}
                  visionReady={visionReady}
                  busy={busy}
                  onAddFiles={handleAddFiles}
                  onRemove={handleRemovePhoto}
                  onMakeMain={handleMakeMain}
                />
              )}
              {n === 3 && (
                <LayoutStepCompose
                  canvasRef={canvasRef}
                  photos={photos}
                  spec={spec}
                  playKey={playKey}
                  busy={busy}
                  thinking={thinking}
                  charName={charName}
                  onDecide={handleDecide}
                  onPick={() => setSheetOpen(true)}
                  onPlayEnd={handlePlayEnd}
                  onSpecChange={handleSpecChange}
                  onReroll={handleReroll}
                />
              )}
              {n === 4 && (
                <LayoutStepFinish
                  resultUrl={resultUrl}
                  charName={charName}
                  saved={saved}
                  onSave={handleSave}
                  onRestart={handleRestart}
                />
              )}
            </section>
          ))}
        </main>

        {step < 4 && (
          <footer className="ls-dock">
            <p className={`ls-hint${ready ? ' ls-ready' : ''}`}>{hint}</p>
            <button
              type="button"
              className={`ls-go${ready ? ' ls-ready' : ''}`}
              disabled={!ready}
              onClick={handleNext}
            >
              {nextLabel}
            </button>
          </footer>
        )}

        <LayoutTemplateSheet
          open={sheetOpen}
          photos={photos}
          onClose={() => setSheetOpen(false)}
          onPick={handlePickTemplate}
        />
        <div className={`ls-toast${toast ? ' ls-in' : ''}`}>{toast}</div>
      </div>
    </div>
  );
};

export default LayoutStudioApp;

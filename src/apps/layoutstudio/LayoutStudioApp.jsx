// src/apps/layoutstudio/LayoutStudioApp.jsx
//
// 修图室（Layout Studio）顶层 app：四步向导，每一步一个小页面。
//   1 选角色  2 放照片  3 出图  4 保存
// 切片 A：模板、渲染、手动改字、保存到设备。
// 切片 B：角色 AI 选模板 / 写字 / 点评、摘要发回聊天室。
// 切片 C：存进相册、相册页（第 1 步右上角和第 4 步都能进）。
//
// 这不是聊天室类 app，只需要一个返回首页的回调。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Images } from 'lucide-react';

import db from '../../db';
import { getVisionApiConfig, isVisionConfigured } from '../../services/visionService';
import LayoutAlbumPage from './LayoutAlbumPage';
import LayoutStepCharacter from './LayoutStepCharacter';
import LayoutStepCompose from './LayoutStepCompose';
import LayoutStepFinish from './LayoutStepFinish';
import LayoutStepPhotos from './LayoutStepPhotos';
import LayoutTemplateSheet from './LayoutTemplateSheet';
import { MAX_PHOTOS } from './layoutConstants';
import { filesToPhotos } from './layoutPhotoService';
import {
  buildSummaryText,
  composeWithCharacter,
  describePhotos,
  sendResultToChat,
  writeNotes,
} from './layoutAiService';
import { createDefaultSpec } from './layoutSpec';
import { canvasToJpegBlob, saveLayoutWork } from './layoutWorksService';
import './layoutStudio.css';

const STEPS = [
  { n: 1, name: '角色', sub: '先选一位修图师' },
  { n: 2, name: '照片', sub: '把照片放进来' },
  { n: 3, name: '出图', sub: '开始修图' },
  { n: 4, name: '保存', sub: '修好了' },
];

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
  const [thinkText, setThinkText] = useState('');
  const [notes, setNotes] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [albumSaving, setAlbumSaving] = useState(false);
  const [albumSaved, setAlbumSaved] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  const canvasRef = useRef(null);
  const toastTimer = useRef(0);
  const aliveRef = useRef(true);
  const blobRef = useRef(null);
  const descCacheRef = useRef({ key: '', list: [] });

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
    setSent(false);
    setAlbumSaved(false);
    setNotes(null);
    setResultUrl('');
    blobRef.current = null;
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

  const getDescriptions = useCallback(async () => {
    const key = photos.map((photo) => photo.id).join(',');
    if (descCacheRef.current.key === key) return descCacheRef.current.list;
    const list = await describePhotos(photos);
    descCacheRef.current = { key, list };
    return list;
  }, [photos]);

  // 用户自己选 / 重新排布：直接用默认排布，不问角色。
  const runCompose = useCallback(
    (templateId) => {
      if (photos.length === 0) return;
      setBusy(true);
      setSaved(false);
      setSent(false);
      setAlbumSaved(false);
      setNotes(null);
      setSpec(createDefaultSpec(templateId, { photoCount: photos.length, seed: newSeed() }));
      setPlayKey((key) => key + 1);
    },
    [photos.length]
  );

  // 让角色决定：先看图（有视觉模型时），再挑模板、写字、写话。
  const handleDecide = async () => {
    if (photos.length === 0 || busy) return;
    setBusy(true);
    setSaved(false);
    setSent(false);
    setAlbumSaved(false);
    setNotes(null);
    setThinking(true);
    setThinkText(`${charName} 正在看照片`);
    const descriptions = await getDescriptions();
    if (!aliveRef.current) return;
    setThinkText(`${charName} 正在挑版式、写字`);
    const result = await composeWithCharacter({
      character,
      photos,
      descriptions,
      excludeId: spec?.templateId,
    });
    if (!aliveRef.current) return;
    setThinking(false);
    setSpec(result.spec);
    setNotes(result.why || result.praise ? { why: result.why, praise: result.praise } : null);
    if (!result.usedAi) showToast(`没能联系上 ${charName}，先用随机排布`);
    setPlayKey((key) => key + 1);
  };

  const handlePickTemplate = (templateId) => {
    setSheetOpen(false);
    runCompose(templateId);
  };

  const handleReroll = () => {
    if (spec) runCompose(spec.templateId);
  };

  const handleSpecChange = (next) => {
    setSpec(next);
    setSaved(false);
    setSent(false);
    setAlbumSaved(false);
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

  const handleSend = async () => {
    if (!blobRef.current || !character || !spec || sending || sent) return;
    setSending(true);
    try {
      const descriptions = await getDescriptions();
      const ok = await sendResultToChat({
        characterId: character.id,
        blob: blobRef.current,
        summary: buildSummaryText({ spec, notes, descriptions, photoCount: photos.length }),
      });
      if (!aliveRef.current) return;
      if (ok) {
        setSent(true);
        showToast(`已发给 ${charName}`);
      } else {
        showToast(`还没有和 ${charName} 的聊天，先去聊天室开个头`);
      }
    } catch (error) {
      console.warn('[LayoutStudio] 发送到聊天室失败：', error);
      if (aliveRef.current) showToast('发送失败，请再试一次');
    } finally {
      if (aliveRef.current) setSending(false);
    }
  };

  // 存进相册：只存成品图（JPEG）和版面信息，不存原图。
  const handleSaveAlbum = async () => {
    if (!character || !spec || albumSaving || albumSaved) return;
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    setAlbumSaving(true);
    try {
      const blob = await canvasToJpegBlob(canvas);
      if (!blob) {
        showToast('导出失败，请再试一次');
        return;
      }
      let summary = '';
      try {
        const descriptions = await getDescriptions();
        summary = buildSummaryText({ spec, notes, descriptions, photoCount: photos.length });
      } catch (error) {
        console.warn('[LayoutStudio] 生成摘要失败，相册里先不带摘要：', error);
      }
      await saveLayoutWork({
        characterId: character.id,
        templateId: spec.templateId,
        spec,
        blob,
        why: notes?.why || '',
        praise: notes?.praise || '',
        summary,
      });
      if (!aliveRef.current) return;
      setAlbumSaved(true);
      showToast('已存进相册');
    } catch (error) {
      console.warn('[LayoutStudio] 存进相册失败：', error);
      if (aliveRef.current) showToast('存进相册失败，请再试一次');
    } finally {
      if (aliveRef.current) setAlbumSaving(false);
    }
  };

  // 从相册里把一张旧作品发回聊天室：优先用已存的摘要，没有就用角色的两句话拼一条。
  const handleSendFromAlbum = async (work, blob) => {
    const fallback = [work.praise, work.why].filter(Boolean).join('\n');
    const ok = await sendResultToChat({
      characterId: work.characterId,
      blob,
      summary: work.summary || fallback || '我在修图室修好了一张图。',
    });
    if (!aliveRef.current) return;
    const name = characters.find((item) => item.id === work.characterId)?.name || 'TA';
    showToast(ok ? `已发给 ${name}` : `还没有和 ${name} 的聊天，先去聊天室开个头`);
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
      blobRef.current = blob;
      setResultUrl(blob ? URL.createObjectURL(blob) : '');
      setStep(4);
      if (!notes && character && spec) {
        setNotesLoading(true);
        const descriptions = await getDescriptions();
        const written = await writeNotes({ character, photos, descriptions, spec });
        if (!aliveRef.current) return;
        setNotes(written);
        setNotesLoading(false);
      }
      return;
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
          {step === 1 ? (
            <button type="button" className="ls-back ls-album-entry" onClick={() => setAlbumOpen(true)}>
              <Images size={16} />
              <span>相册</span>
            </button>
          ) : (
            <div />
          )}
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
                  thinkText={thinkText}
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
                  character={character}
                  resultUrl={resultUrl}
                  charName={charName}
                  saved={saved}
                  notes={notes}
                  notesLoading={notesLoading}
                  sending={sending}
                  sent={sent}
                  albumSaving={albumSaving}
                  albumSaved={albumSaved}
                  onSave={handleSave}
                  onSend={handleSend}
                  onSaveAlbum={handleSaveAlbum}
                  onOpenAlbum={() => setAlbumOpen(true)}
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
        {albumOpen && (
          <LayoutAlbumPage
            characters={characters}
            onBack={() => setAlbumOpen(false)}
            onSendToChat={handleSendFromAlbum}
            showToast={showToast}
          />
        )}
        <div className={`ls-toast${toast ? ' ls-in' : ''}`}>{toast}</div>
      </div>
    </div>
  );
};

export default LayoutStudioApp;
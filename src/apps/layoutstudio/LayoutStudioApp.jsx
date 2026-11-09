// src/apps/layoutstudio/LayoutStudioApp.jsx
//
// 修图室（Layout Studio）顶层 app：四步向导，相机造型。
//   1 选角色（装镜头）  2 放照片（装胶卷）  3 出图（按快门）  4 保存（拍立得）
// 切片 A：模板、渲染、手动改字、保存到设备。
// 切片 B：角色 AI 选模板 / 写字 / 点评、摘要发回聊天室。
// 切片 C：存进相册、相册页（相机右下角的相册键随时能进）。
// 相机造型改版：这个文件只管状态和操作，界面拆在
//   LayoutViewfinder（取景框）/ LayoutTray（托盘）/ LayoutDeck（底部操作区）。
//
// 这不是聊天室类 app，只需要一个返回首页的回调。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home } from 'lucide-react';

import db from '../../db';
import { getVisionApiConfig, isVisionConfigured } from '../../services/visionService';
import LayoutAlbumPage from './LayoutAlbumPage';
import LayoutDeck from './LayoutDeck';
import LayoutSheet from './LayoutSheet';
import LayoutTemplateSheet from './LayoutTemplateSheet';
import LayoutTray from './LayoutTray';
import LayoutTweakPanel from './LayoutTweakPanel';
import LayoutViewfinder from './LayoutViewfinder';
import { MAX_PHOTOS } from './layoutConstants';
import { charTint } from './layoutCharStyle';
import { filesToPhotos } from './layoutPhotoService';
import {
  buildSummaryText,
  composeWithCharacter,
  describePhotos,
  sendResultToChat,
  writeNotes,
} from './layoutAiService';
import { createDefaultSpec } from './layoutSpec';
import { getTemplate } from './templates';
import { canvasToJpegBlob, saveLayoutWork } from './layoutWorksService';
import './layoutStudio.css';
import './layoutCamera.css';

const STEPS = [
  { n: 1, name: '选人', sub: '先装一枚镜头' },
  { n: 2, name: '装片', sub: '把照片装进胶卷' },
  { n: 3, name: '拍摄', sub: '按快门出图' },
  { n: 4, name: '回看', sub: '翻过相纸看看' },
];
const STEP_NAMES = STEPS.map((s) => s.name);

const newSeed = () => 1 + Math.floor(Math.random() * 99999);

const canvasToBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));

// 取景框胶片颗粒：画一张小噪点图，作为 CSS 变量交给样式用。
const makeGrainUrl = () => {
  try {
    const c = document.createElement('canvas');
    c.width = 140;
    c.height = 140;
    const x = c.getContext('2d');
    const d = x.createImageData(140, 140);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = v;
      d.data[i + 1] = v;
      d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return `url(${c.toDataURL()})`;
  } catch (error) {
    return 'none';
  }
};

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
  const [tweakOpen, setTweakOpen] = useState(false);
  const [visionSheetOpen, setVisionSheetOpen] = useState(false);
  const [snap, setSnap] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  const canvasRef = useRef(null);
  const toastTimer = useRef(0);
  const snapTimer = useRef(0);
  const aliveRef = useRef(true);
  const blobRef = useRef(null);
  const fileRef = useRef(null);
  const prevPhotoCount = useRef(0);
  const descCacheRef = useRef({ key: '', list: [] });
  const grainUrl = useMemo(() => makeGrainUrl(), []);

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
      window.clearTimeout(snapTimer.current);
    };
  }, []);

  // 快门光圈 + 闪光：只是视觉效果，出图和装入照片时各闪一下。
  const triggerSnap = useCallback(() => {
    setSnap(false);
    window.clearTimeout(snapTimer.current);
    window.requestAnimationFrame(() => {
      if (!aliveRef.current) return;
      setSnap(true);
      snapTimer.current = window.setTimeout(() => setSnap(false), 600);
    });
  }, []);

  useEffect(() => {
    if (playKey > 0) triggerSnap();
  }, [playKey, triggerSnap]);

  useEffect(() => {
    if (photos.length > prevPhotoCount.current) triggerSnap();
    prevPhotoCount.current = photos.length;
  }, [photos.length, triggerSnap]);

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

  const openFilePicker = () => {
    if (!busy) fileRef.current?.click();
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

  // 快门：1、2 步是"往下走"，第 3 步是"让角色出图"，第 4 步是"再修一张"。
  const handleShutter = () => {
    if (step === 1 || step === 2) handleNext();
    else if (step === 3) void handleDecide();
    else handleRestart();
  };

  const handleGoStep = (n) => {
    if (n < step && !busy) setStep(n);
  };

  const shutterEnabled = (() => {
    if (step === 1) return canProceed(1);
    if (step === 2) return canProceed(2);
    if (step === 3) return photos.length > 0 && !busy;
    return true;
  })();
  const shutterLabel = ['', '选定', '装好', spec ? '重拍' : '拍', '再来'][step];

  const hint = (() => {
    if (step === 1) return character ? `镜头装好了：${charName}。按快门继续` : '在上面挑一枚镜头，每枚镜头是一位修图师';
    if (step === 2) return photos.length ? `已装 ${photos.length} 张。按快门开始拍摄` : '先装入至少一张照片';
    if (step === 3) {
      if (busy) return `${charName} 正在对焦，稍等`;
      return spec ? '不满意就按快门重拍，满意就点取景框里的按钮' : `按快门让 ${charName} 挑模板，也可以直接点下面的模板`;
    }
    return sent ? '摘要已发出。按快门再修一张' : '点相纸可以翻面。保存或发送后，按快门再修一张';
  })();

  const templateLabel = spec ? getTemplate(spec.templateId)?.label || '' : '';

  return (
    <div className="ls-root">
      <div className="ls-app" style={{ '--ls-grain': grainUrl }}>
        <header className="ls-ctop">
          <button type="button" className="ls-ib" onClick={onBackHub} aria-label="返回主页">
            <Home size={15} />
          </button>
          <div className="ls-ttl">
            <h1>修图室</h1>
            <p>{step === 3 ? `让 ${charName} 来修` : STEPS[step - 1].sub}</p>
          </div>
          <span className="ls-ib ls-ib-ghost" aria-hidden="true" />
        </header>

        <LayoutViewfinder
          step={step}
          character={character}
          charName={charName}
          tint={character ? charTint(character) : '#888'}
          photos={photos}
          spec={spec}
          templateLabel={templateLabel}
          canvasRef={canvasRef}
          playKey={playKey}
          onPlayEnd={handlePlayEnd}
          busy={busy}
          thinking={thinking}
          thinkText={thinkText}
          snap={snap}
          visionReady={visionReady}
          onVisionClick={() => setVisionSheetOpen(true)}
          onPickFile={openFilePicker}
          onAddFiles={handleAddFiles}
          onEdit={() => setTweakOpen(true)}
          onReroll={handleReroll}
          onFinish={handleNext}
          resultUrl={resultUrl}
          notes={notes}
          notesLoading={notesLoading}
        />

        <LayoutTray
          step={step}
          characters={characters}
          loadingChars={loadingChars}
          charId={charId}
          onSelectChar={setCharId}
          photos={photos}
          busy={busy}
          onPickFile={openFilePicker}
          onRemove={handleRemovePhoto}
          onMakeMain={handleMakeMain}
          spec={spec}
          charName={charName}
          onPickTemplate={handlePickTemplate}
          onOpenTemplateInfo={() => setSheetOpen(true)}
          character={character}
          saved={saved}
          albumSaving={albumSaving}
          albumSaved={albumSaved}
          sending={sending}
          sent={sent}
          notesLoading={notesLoading}
          onSave={handleSave}
          onSend={handleSend}
          onSaveAlbum={handleSaveAlbum}
          onOpenAlbum={() => setAlbumOpen(true)}
        />

        <LayoutDeck
          step={step}
          stepNames={STEP_NAMES}
          hint={hint}
          hintReady={shutterEnabled}
          shutterLabel={shutterLabel}
          shutterEnabled={shutterEnabled}
          canGoBack={step > 1 && !busy}
          onShutter={handleShutter}
          onBack={handleBack}
          onAlbum={() => setAlbumOpen(true)}
          onGoStep={handleGoStep}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleAddFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <LayoutTemplateSheet
          open={sheetOpen}
          photos={photos}
          onClose={() => setSheetOpen(false)}
          onPick={handlePickTemplate}
        />
        <LayoutSheet
          open={tweakOpen}
          title="改字和排布"
          sub={`这些字是 ${charName} 写的，你可以直接改，取景框里会实时变化。`}
          onClose={() => setTweakOpen(false)}
        >
          {spec && (
            <LayoutTweakPanel
              spec={spec}
              disabled={busy}
              defaultOpen
              onChange={handleSpecChange}
              onReroll={() => {
                setTweakOpen(false);
                handleReroll();
              }}
            />
          )}
        </LayoutSheet>
        <LayoutSheet
          open={visionSheetOpen}
          title={visionReady ? '视觉模型已就绪' : '还没配置视觉模型'}
          sub={
            visionReady
              ? `${charName} 会看着你的照片来写字和点评。`
              : `没配置时，${charName} 看不到照片，只能按人设来排版和写字，评价也会比较泛。`
          }
          onClose={() => setVisionSheetOpen(false)}
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

// src/apps/messages/secretCode/SecretCodeCabinet.jsx
//
// 悄悄话词典的全屏页（文件夹柜）。从聊天设置里的入口卡片打开：
//   1. 先看到"什么是悄悄话词典"的说明纸，可收起成角落的"? 说明"小票再展开
//   2. 下面是两列歪斜摆放的文件夹，每个文件夹有一行用途说明和暗号数
//   3. 点一个文件夹进入内页（SecretCodeFolderView）
//
// 词典属于角色（character.secretCodes / character.secretCodeFolders），同一个
// 角色的所有聊天窗共用同一本。样式见 secretCode.css（五套主题通用）。
// 用 createPortal 挂到 body，避免被聊天设置弹窗的层级和裁剪影响。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import './secretCode.css';
import {
  SECRET_CODE_LIMITS,
  addSecretCodeFolder,
  getSecretCodeBook,
  getSecretCodeProposalEnabled,
  setSecretCodeProposalEnabled,
} from './secretCodeService';
import { getFolderColorVar } from './secretCodeFolderStyle';
import { BigClip, FOLDER_TILTS, padTwo } from './SecretCodeDecor';
import SecretCodeFolderView from './SecretCodeFolderView';
import SecretCodeStatsStrip from './SecretCodeStatsStrip';

const UNCAT_DESC = '还没归类的暗号都放在这里';

export const SecretCodeCabinet = ({ character, onClose, onUpdated }) => {
  const characterId = character?.id;
  const characterName = character?.name || 'TA';

  const [book, setBook] = useState({ entries: [], folders: [] });
  const [loaded, setLoaded] = useState(false);
  const [viewId, setViewId] = useState(null);

  const [guideOpen, setGuideOpen] = useState(true);
  const [guideEnter, setGuideEnter] = useState(true);
  const [guideLeaving, setGuideLeaving] = useState(false);

  const [proposalEnabled, setProposalEnabled] = useState(true);
  const [namingFolder, setNamingFolder] = useState(false);
  const [freshFolderId, setFreshFolderId] = useState(null);
  const [bumpFolderId, setBumpFolderId] = useState(null);
  const [toast, setToast] = useState(null);

  const scrollRef = useRef(null);
  const toastTimerRef = useRef(null);
  const guideTimerRef = useRef(null);
  const namingDoneRef = useRef(false);

  // 首次打开从 db 读最新的词典
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await getSecretCodeBook(characterId);
      if (cancelled) return;
      const enabled = await getSecretCodeProposalEnabled(characterId);
      if (cancelled) return;
      setBook({ entries: next.entries, folders: next.folders });
      setProposalEnabled(enabled);
      setLoaded(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current);
      window.clearTimeout(guideTimerRef.current);
    },
    []
  );

  // 说明纸飞入动画只在刚出现时播一次
  useEffect(() => {
    if (!guideEnter) return undefined;
    guideTimerRef.current = window.setTimeout(() => setGuideEnter(false), 700);
    return () => window.clearTimeout(guideTimerRef.current);
  }, [guideEnter]);

  // 新建的文件夹、刚收到暗号的文件夹，动画播完后清掉标记
  useEffect(() => {
    if (!freshFolderId) return undefined;
    const timer = window.setTimeout(() => setFreshFolderId(null), 800);
    return () => window.clearTimeout(timer);
  }, [freshFolderId]);

  useEffect(() => {
    if (!bumpFolderId || viewId) return undefined;
    const timer = window.setTimeout(() => setBumpFolderId(null), 700);
    return () => window.clearTimeout(timer);
  }, [bumpFolderId, viewId]);

  // 切换视图时回到顶部
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [viewId]);

  // Esc：在内页就退回文件夹柜，在文件夹柜就关闭
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== 'Escape') return;
      if (event.target && event.target.tagName === 'INPUT') return;
      if (viewId) setViewId(null);
      else onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewId, onClose]);

  const showToast = useCallback((message) => {
    window.clearTimeout(toastTimerRef.current);
    setToast({ key: Date.now(), message });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2700);
  }, []);

  // 服务层每次返回最新的 { entries, folders }，成功失败都用它刷新界面
  const handleResult = useCallback(
    (result) => {
      if (!result || !Array.isArray(result.entries) || !Array.isArray(result.folders)) return;
      if (result.folders.length === 0) return;
      setBook({ entries: result.entries, folders: result.folders });
      if (onUpdated) {
        onUpdated({ secretCodes: result.entries, secretCodeFolders: result.folders });
      }
    },
    [onUpdated]
  );

  const toggleGuide = () => {
    window.clearTimeout(guideTimerRef.current);
    if (guideOpen) {
      setGuideLeaving(true);
      guideTimerRef.current = window.setTimeout(() => {
        setGuideOpen(false);
        setGuideLeaving(false);
      }, 440);
    } else {
      setGuideOpen(true);
      setGuideEnter(true);
    }
  };

  const toggleProposal = async () => {
    const next = !proposalEnabled;
    setProposalEnabled(next);
    try {
      await setSecretCodeProposalEnabled(characterId, next);
      if (onUpdated) onUpdated({ secretCodeProposalEnabled: next });
      showToast(
        next
          ? `${characterName}会在合适的时候提议新暗号。`
          : `${characterName}不会再提议新暗号了，已有的暗号照常能用。`
      );
    } catch (error) {
      console.warn('[SecretCodeCabinet] 保存提议开关失败：', error);
      setProposalEnabled(!next);
      showToast('没能保存，请稍后再试。');
    }
  };

  const commitNewFolder = async (rawName) => {
    if (namingDoneRef.current) return;
    namingDoneRef.current = true;
    setNamingFolder(false);

    const name = String(rawName || '').trim();
    if (!name) return;

    const result = await addSecretCodeFolder(characterId, { name });
    handleResult(result);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    if (result.merged) {
      showToast(`已经有「${result.folder.name}」这个文件夹了。`);
      return;
    }
    setFreshFolderId(result.folder.id);
  };

  const { entries, folders } = book;
  const countOf = (folderId) => entries.filter((entry) => entry.folderId === folderId).length;

  const userFolders = folders.filter((folder) => !folder.uncat);
  const uncatFolder = folders.find((folder) => folder.uncat);
  // 没有暗号的"未分类"不占位置，有暗号才出现在最后
  const shownFolders = [
    ...userFolders,
    ...(uncatFolder && countOf(uncatFolder.id) > 0 ? [uncatFolder] : []),
  ];
  const foldersFull = folders.length >= SECRET_CODE_LIMITS.MAX_FOLDERS;

  const openFolder = viewId ? folders.find((folder) => folder.id === viewId) : null;

  // 打开的文件夹被别处删掉了，就退回文件夹柜
  useEffect(() => {
    if (viewId && loaded && !openFolder) setViewId(null);
  }, [viewId, loaded, openFolder]);

  const shelf = (
    <>
      <div className="sc-cabinet-head">
        <span className="sc-count">{padTwo(entries.length)}</span>
        <h2>悄悄话词典</h2>
        <small>/ {SECRET_CODE_LIMITS.MAX_ENTRIES}</small>
        <span className="sc-head-end">
          {!guideOpen && (
            <button type="button" className="sc-tlabel" onClick={toggleGuide}>
              ? 说明
            </button>
          )}
          <button type="button" className="sc-closebtn" onClick={onClose} aria-label="关闭词典">
            <X />
          </button>
        </span>
      </div>

      {guideOpen && (
        <div
          className={`sc-guide sc-paper${guideEnter ? ' sc-enter' : ''}${guideLeaving ? ' sc-fold-away' : ''}`}
        >
          <span className="sc-tape" style={{ top: -8, left: 26, transform: 'rotate(-4deg)' }} />
          <span className="sc-tlabel">// GUIDE</span>
          <h3>什么是悄悄话词典？</h3>
          <p className="sc-guide__lead">
            你和{characterName}之间的专属约定：给一句话起一个很短的暗号，
            {characterName}会在聊天里用它代替长句。只有你们俩懂，聊得越久越有默契。
          </p>
          <ol className="sc-steps">
            <li>
              <span className="sc-outline-num">01</span>
              <div>
                <b>约定</b>
                <span>
                  {characterName}觉得合适时会提议一个新暗号，你点"收下"就会存到这里。你也可以自己写。
                </span>
              </div>
            </li>
            <li>
              <span className="sc-outline-num">02</span>
              <div>
                <b>使用</b>
                <span>聊天里出现的暗号带一道荧光笔底色，点一下就能看到含义。</span>
              </div>
            </li>
            <li>
              <span className="sc-outline-num">03</span>
              <div>
                <b>整理</b>
                <span>按类型放进不同的文件夹，随时改含义、换文件夹，或者撕掉。</span>
              </div>
            </li>
          </ol>
          <div className="sc-guide__foot">
            <span>
              最多 {SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符 · 一本最多 {SECRET_CODE_LIMITS.MAX_ENTRIES} 条
            </span>
            <button type="button" className="sc-ghost-btn" onClick={toggleGuide}>
              收起说明
            </button>
          </div>
        </div>
      )}

      <SecretCodeStatsStrip
        characterId={characterId}
        characterName={characterName}
        entries={entries}
        folders={folders}
        proposalEnabled={proposalEnabled}
        onUpdated={onUpdated}
        showToast={showToast}
      />

      <div className="sc-switchrow">
        <span>
          <b>允许{characterName}提议新暗号</b>
          关掉后不会再有提议卡片，已有的暗号照常能用。
        </span>
        <button
          type="button"
          className="sc-switch"
          role="switch"
          aria-checked={proposalEnabled}
          aria-label={`允许${characterName}提议新暗号`}
          onClick={() => void toggleProposal()}
        />
      </div>

      <div className="sc-grid">
        {shownFolders.map((folder, index) => (
          <button
            key={folder.id}
            type="button"
            className={`sc-fold${folder.id === freshFolderId ? ' sc-enter' : ''}`}
            style={{
              '--fc': getFolderColorVar(folder),
              '--r': `${FOLDER_TILTS[index % FOLDER_TILTS.length]}deg`,
            }}
            onClick={() => setViewId(folder.id)}
            aria-label={`打开文件夹 ${folder.name}，${countOf(folder.id)} 条暗号`}
          >
            <span className="sc-fold__sheet sc-fold__sheet--a" />
            <span className="sc-fold__sheet sc-fold__sheet--b" />
            <span className="sc-fold__back" />
            {index % 2 === 0 && <BigClip />}
            <span className="sc-fold__front" />
            <span className="sc-fold__label">
              <span className="sc-tlabel">{folder.name}</span>
              <small>{folder.desc || (folder.uncat ? UNCAT_DESC : '还没有用途说明')}</small>
            </span>
            <span className={`sc-fold__num${folder.id === bumpFolderId ? ' sc-bump' : ''}`}>
              {padTwo(countOf(folder.id))}
            </span>
          </button>
        ))}

        {!foldersFull &&
          (namingFolder ? (
            <div className="sc-fold sc-fold--new">
              <span className="sc-fold__ghost">
                <input
                  autoFocus
                  maxLength={SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH}
                  placeholder="文件夹名，回车确认"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitNewFolder(e.currentTarget.value);
                    if (e.key === 'Escape') {
                      namingDoneRef.current = true;
                      setNamingFolder(false);
                    }
                  }}
                  onBlur={(e) => void commitNewFolder(e.currentTarget.value)}
                />
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="sc-fold sc-fold--new"
              onClick={() => {
                namingDoneRef.current = false;
                setNamingFolder(true);
              }}
            >
              <span className="sc-fold__ghost">
                <Plus />
                新建文件夹
              </span>
            </button>
          ))}

        {foldersFull && (
          <div className="sc-empty-note">
            文件夹已经满 {SECRET_CODE_LIMITS.MAX_FOLDERS} 个了（含"未分类"），先删掉不用的再新建。
          </div>
        )}

        {loaded && shownFolders.length === 0 && (
          <div className="sc-empty-note">
            还没有文件夹。{characterName}提议暗号时会顺便起一个，你也可以先自己新建。
          </div>
        )}
      </div>
    </>
  );

  return createPortal(
    <div className="sc-overlay secret-code-scope" role="dialog" aria-label="悄悄话词典">
      <div className="sc-scroll" ref={scrollRef}>
        <div className="sc-page">
          {openFolder ? (
            <SecretCodeFolderView
              key={openFolder.id}
              characterId={characterId}
              folder={openFolder}
              folders={folders}
              entries={entries}
              onBack={() => setViewId(null)}
              onResult={handleResult}
              onMovedTo={setBumpFolderId}
              showToast={showToast}
            />
          ) : (
            shelf
          )}
        </div>
      </div>
      {toast && (
        <div key={toast.key} className="sc-toast" role="status">
          {toast.message}
        </div>
      )}
    </div>,
    document.body
  );
};

export default SecretCodeCabinet;
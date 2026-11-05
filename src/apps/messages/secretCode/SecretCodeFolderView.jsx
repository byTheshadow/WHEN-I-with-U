// src/apps/messages/secretCode/SecretCodeFolderView.jsx
//
// 悄悄话词典的文件夹内页："重力墙"。
//   - 顶部：返回、"?"（说明和用量）、文件夹名和破译进度、搜索、用途说明（可改名、删文件夹）
//   - 吸顶的解码窗：显示当前选中的暗号，可以改含义、换文件夹、撕掉
//   - 下面是一堆有重量的方块（见 gravityPit.js）：常用的更大更重，满 9 次变镭射，
//     从解码窗底下掉出来，落地并进入视野后才开始破译
//   - 做新暗号：底部弹层，明文先被加密，再掉进方块堆里
// 方块的材质跟着文件夹走（见 secretCodeLook.js）。
//
// 所有数据读写都走 secretCodeService；每次操作后把返回的 { entries, folders }
// 交给父组件（onResult）刷新，失败的原因用 showToast 明确告诉用户。
// 方块本身由 gravityPit 直接操作 DOM，这里不要给 .sw-pit 放任何 React 子节点。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Pencil, Trash2, X } from 'lucide-react';
import {
  SECRET_CODE_LIMITS,
  addSecretCode,
  deleteSecretCode,
  deleteSecretCodeFolder,
  moveSecretCode,
  updateSecretCode,
  updateSecretCodeFolder,
  validateSecretCode,
} from './secretCodeService';
import { getFolderLook } from './secretCodeLook';
import { HOLO_USES, createGravityPit } from './gravityPit';
import { cancelScramble, prefersReducedMotion, scramble } from './secretCodeScramble';
import './secretCodeWall.css';

const UNCAT_DESC = '还没归类的暗号都放在这里';

const charCount = (text) => Array.from(String(text)).length;

const sortEntries = (list) =>
  list
    .slice()
    .sort(
      (a, b) =>
        (b.useCount || 0) - (a.useCount || 0) ||
        String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );

// 解码窗里的大字号：字符越多缩得越小
const heroScale = (code) => {
  const n = charCount(code);
  if (n <= 1) return 1;
  if (n === 2) return 0.75;
  if (n === 3) return 0.55;
  return 0.45;
};

const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
};

// 一张材质卡（解码窗和做卡弹层里的大卡）
const Mat = ({ look, holo, children }) => (
  <span
    className={`sw-mat sw-m-${look.mat}${holo ? ' is-holo' : ''}`}
    style={{ '--fc': look.color, '--fi': look.ink }}
  >
    <span className="sw-mat__face">{children}</span>
  </span>
);

// ---------------------------------------------------------------------------
// 做新暗号的弹层：先加密，再掉进方块堆
// ---------------------------------------------------------------------------
const ComposeSheet = ({ look, entries, initial, onSubmit, onClose }) => {
  const [code, setCode] = useState(initial?.code || '');
  const [meaning, setMeaning] = useState(initial?.meaning || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [shaking, setShaking] = useState(false);

  const codeInputRef = useRef(null);
  const meaningInputRef = useRef(null);
  const pvCodeRef = useRef(null);
  const pvMeaningRef = useRef(null);
  const timersRef = useRef([]);

  const later = (fn, ms) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => {
    const first = window.setTimeout(() => {
      const target = initial?.code ? meaningInputRef.current : codeInputRef.current;
      if (target) target.focus({ preventScroll: true });
    }, 350);
    const timers = timersRef.current;
    return () => {
      window.clearTimeout(first);
      timers.forEach((id) => window.clearTimeout(id));
      cancelScramble(pvCodeRef.current);
      cancelScramble(pvMeaningRef.current);
    };
    // 只在弹层出现时聚焦一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 预览卡上的字：加密动画开始后由 scramble 接管，这里不再写
  useEffect(() => {
    if (busy) return;
    if (pvCodeRef.current) pvCodeRef.current.textContent = code.trim() || '暗号';
    if (pvMeaningRef.current) pvMeaningRef.current.textContent = meaning.trim() || '它的意思会写在这里';
  }, [code, meaning, busy]);

  const close = () => {
    if (busy) return;
    setLeaving(true);
    later(onClose, 280);
  };

  const submit = () => {
    if (busy) return;
    const cleanCode = code.trim();
    const cleanMeaning = meaning.trim();

    let reason = '';
    if (entries.length >= SECRET_CODE_LIMITS.MAX_ENTRIES) {
      reason = `词典最多 ${SECRET_CODE_LIMITS.MAX_ENTRIES} 条，先撕掉几张。`;
    } else {
      const check = validateSecretCode({ code: cleanCode, meaning: cleanMeaning }, entries);
      if (!check.ok) reason = check.reason;
    }
    if (reason) {
      setError(reason);
      setShaking(false);
      window.requestAnimationFrame(() => setShaking(true));
      vibrate([10, 30, 10]);
      return;
    }

    setBusy(true);
    setError('');
    scramble(pvCodeRef.current, cleanCode, { reverse: true, dur: 480 });
    scramble(pvMeaningRef.current, cleanMeaning, { reverse: true, dur: 620 });
    later(() => setSealing(true), 380);
    later(
      async () => {
        const failed = await onSubmit({ code: cleanCode, meaning: cleanMeaning });
        if (failed) {
          setBusy(false);
          setSealing(false);
          setError(failed);
          return;
        }
        setLeaving(true);
        later(onClose, 280);
      },
      prefersReducedMotion() ? 0 : 1050
    );
  };

  const empty = !code.trim();
  const emptyMeaning = !meaning.trim();
  const previewScale = charCount(code.trim()) <= 2 ? 1 : charCount(code.trim()) === 3 ? 0.8 : 0.66;

  return (
    <div
      className="sw-sheet-host"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className={`sw-sheet-back${leaving ? ' is-out' : ''}`} onClick={close} />
      <div
        className={`sw-sheet${leaving ? ' is-out' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="做一张新暗号卡"
      >
        <div className="sw-sheet__grab" />
        <button type="button" className="sw-sheet__x" onClick={close} aria-label="关闭">
          <X />
        </button>
        <h3>做一张新暗号卡</h3>
        <p className="sw-sheet__sub">做好后它会先被加密，掉进方块堆里再被破译出来。</p>

        <div className={`sw-preview${sealing ? ' is-sealing' : ''}`}>
          <Mat look={look}>
            <b
              ref={pvCodeRef}
              className={`sw-tile__code${empty ? ' is-empty' : ''}`}
              style={{ '--k': previewScale }}
            />
            <span ref={pvMeaningRef} className={`sw-tile__m${emptyMeaning ? ' is-empty' : ''}`} />
          </Mat>
        </div>

        <label className="sw-field sw-field--code">
          <span>暗号（最多 {SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符）</span>
          <input
            ref={codeInputRef}
            value={code}
            maxLength={12}
            autoComplete="off"
            placeholder="比如：∴"
            disabled={busy}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && meaningInputRef.current) meaningInputRef.current.focus();
            }}
          />
        </label>
        <label className="sw-field">
          <span>它的意思</span>
          <input
            ref={meaningInputRef}
            value={meaning}
            maxLength={SECRET_CODE_LIMITS.MAX_MEANING_LENGTH}
            autoComplete="off"
            placeholder="比如：我想你了"
            disabled={busy}
            onChange={(e) => {
              setMeaning(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>

        <div className="sw-comp-err" role="alert">
          {error}
        </div>
        <button
          type="button"
          className={`sw-pop-btn sw-comp-go${shaking ? ' is-shaking' : ''}`}
          disabled={busy}
          onClick={submit}
          onAnimationEnd={() => setShaking(false)}
        >
          {busy ? '加密中…' : '做成卡片'}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 文件夹内页
// ---------------------------------------------------------------------------
export const SecretCodeFolderView = ({
  characterId,
  folder,
  folders,
  entries,
  onBack,
  onResult,
  onMovedTo,
  onOpenHelp,
  showToast,
}) => {
  const look = useMemo(() => getFolderLook(folder), [folder]);
  const list = useMemo(
    () => sortEntries(entries.filter((entry) => entry.folderId === folder.id)),
    [entries, folder.id]
  );

  const [query, setQuery] = useState('');
  const [selId, setSelId] = useState(() => (list[0] ? list[0].id : null));
  const [heroTick, setHeroTick] = useState(0);
  const [decoding, setDecoding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [delArmed, setDelArmed] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState(null);
  const [openedCount, setOpenedCount] = useState(0);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [renameDesc, setRenameDesc] = useState(folder.desc || '');
  const [folderDelArmed, setFolderDelArmed] = useState(false);

  const pitRef = useRef(null);
  const pitCtrlRef = useRef(null);
  const codeRef = useRef(null);
  const meaningRef = useRef(null);
  const pctRef = useRef(null);
  const barRef = useRef(null);
  const handlersRef = useRef({});
  const delTimerRef = useRef(null);
  const folderDelTimerRef = useRef(null);

  const needle = query.trim().toLowerCase();
  const shownList = useMemo(
    () =>
      needle
        ? list.filter(
            (entry) =>
              entry.code.toLowerCase().includes(needle) ||
              entry.meaning.toLowerCase().includes(needle)
          )
        : list,
    [list, needle]
  );

  // 选中的暗号被删掉、搬走后，退回到当前最常用的那条
  const selEntry = list.find((entry) => entry.id === selId) || list[0] || null;
  const selectedId = selEntry ? selEntry.id : null;

  const isFull = entries.length >= SECRET_CODE_LIMITS.MAX_ENTRIES;
  const moveTargets = [
    ...folders.filter((item) => !item.uncat && item.id !== folder.id),
    ...folders.filter((item) => item.uncat && item.id !== folder.id),
  ];

  useEffect(
    () => () => {
      window.clearTimeout(delTimerRef.current);
      window.clearTimeout(folderDelTimerRef.current);
    },
    []
  );

  // ---- 方块堆 --------------------------------------------------------------

  useEffect(() => {
    const ctrl = createGravityPit({
      container: pitRef.current,
      getScrollRoot: () => (pitRef.current ? pitRef.current.closest('.sc-scroll') : null),
      onOpen: (id) => handlersRef.current.onOpen?.(id),
      onAdd: () => handlersRef.current.onAdd?.(),
      onOpenedChange: setOpenedCount,
    });
    pitCtrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      pitCtrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctrl = pitCtrlRef.current;
    if (!ctrl) return;
    ctrl.sync({
      entries: shownList,
      look,
      folderName: folder.name,
      query: needle ? query.trim() : '',
      selectedId,
      showAdd: !needle,
    });
    // selectedId 单独由下面的 effect 处理，这里不用重新对齐
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownList, look, folder.name, needle, query]);

  useEffect(() => {
    if (pitCtrlRef.current) pitCtrlRef.current.setSelected(selectedId);
  }, [selectedId]);

  // ---- 解码窗：选中的暗号先乱码再破译 ---------------------------------------

  useEffect(() => {
    const codeEl = codeRef.current;
    const meaningEl = meaningRef.current;
    const pct = pctRef.current;
    const bar = barRef.current;
    if (!selEntry || !codeEl || !meaningEl) {
      if (pct) pct.textContent = '没有信号';
      return undefined;
    }
    setDecoding(true);
    scramble(codeEl, selEntry.code, { dur: 650 });
    scramble(meaningEl, selEntry.meaning, {
      delay: 220,
      progress: (p) => {
        if (bar) bar.style.setProperty('--p', p);
        if (pct) {
          pct.textContent = p < 1 ? `破译中 ${String(Math.round(p * 99)).padStart(2, '0')}%` : '已破译';
        }
      },
      done: () => setDecoding(false),
    });
    return () => {
      cancelScramble(codeEl);
      cancelScramble(meaningEl);
    };
  }, [selEntry?.id, selEntry?.code, selEntry?.meaning, heroTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 改含义：直接在解码窗的文字上改
  useEffect(() => {
    if (!editing) return;
    const meaningEl = meaningRef.current;
    if (!meaningEl || !selEntry) return;
    cancelScramble(meaningEl);
    meaningEl.textContent = selEntry.meaning;
    meaningEl.focus();
    const selection = document.getSelection();
    if (selection) selection.selectAllChildren(meaningEl);
    // 只在进入编辑时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // ---- 操作 ----------------------------------------------------------------

  const resetHeroState = () => {
    setEditing(false);
    setMoving(false);
    setDelArmed(false);
  };

  const handleOpenTile = (id) => {
    const ctrl = pitCtrlRef.current;
    if (ctrl) {
      ctrl.hop(id);
      ctrl.crackNow(id);
    }
    if (id === selectedId && !editing && !moving) {
      setHeroTick((t) => t + 1);
    } else {
      setSelId(id);
      resetHeroState();
      setHeroTick((t) => t + 1);
    }
    vibrate(6);
  };

  const openCompose = (initial = null) => {
    if (isFull) {
      showToast(`词典最多 ${SECRET_CODE_LIMITS.MAX_ENTRIES} 条，先撕掉几张。`);
      return;
    }
    setComposeInitial(initial);
    setComposeOpen(true);
  };

  handlersRef.current = { onOpen: handleOpenTile, onAdd: () => openCompose() };

  const handleAdd = async ({ code, meaning }) => {
    const result = await addSecretCode(characterId, { code, meaning, folderId: folder.id });
    onResult(result);
    if (!result.ok) return result.reason || '没能保存，请稍后再试。';
    setQuery('');
    setSelId(result.entry.id);
    resetHeroState();
    setHeroTick((t) => t + 1);
    const scroller = pitRef.current ? pitRef.current.closest('.sc-scroll') : null;
    if (scroller) scroller.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    vibrate([14, 30, 8]);
    showToast(`“${result.entry.code}”加密好了，掉进了${folder.name}`);
    return '';
  };

  const saveEdit = async () => {
    if (!selEntry || !meaningRef.current) return;
    const text = meaningRef.current.textContent.trim();
    if (!text || text === selEntry.meaning) {
      meaningRef.current.textContent = selEntry.meaning;
      setEditing(false);
      if (!text) showToast('含义不能为空。');
      return;
    }
    const result = await updateSecretCode(characterId, selEntry.id, {
      code: selEntry.code,
      meaning: text,
    });
    onResult(result);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    setEditing(false);
    showToast('含义改好了，重新校验了一遍');
  };

  const cancelEdit = () => {
    if (meaningRef.current && selEntry) meaningRef.current.textContent = selEntry.meaning;
    setEditing(false);
  };

  const handleMoveTo = async (target) => {
    if (!selEntry) return;
    const entry = selEntry;
    setMoving(false);
    const result = await moveSecretCode(characterId, entry.id, target.id);
    if (result.ok && pitCtrlRef.current) pitCtrlRef.current.fling(entry.id);
    onResult(result);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    setHeroTick((t) => t + 1);
    onMovedTo(target.id);
    showToast(`已移到「${target.name}」，换成了它的材质`);
    vibrate(8);
  };

  const handleDeleteEntry = async () => {
    if (!selEntry) return;
    if (!delArmed) {
      setDelArmed(true);
      window.clearTimeout(delTimerRef.current);
      delTimerRef.current = window.setTimeout(() => setDelArmed(false), 2600);
      return;
    }
    window.clearTimeout(delTimerRef.current);
    const entry = selEntry;
    setDelArmed(false);
    vibrate([20, 20, 30]);
    if (pitCtrlRef.current) pitCtrlRef.current.fling(entry.id);
    const result = await deleteSecretCode(characterId, entry.id);
    onResult(result);
    setSelId(null);
    resetHeroState();
    setHeroTick((t) => t + 1);
    showToast(`撕掉了“${entry.code}”`);
  };

  const handleSaveRename = async () => {
    const result = await updateSecretCodeFolder(characterId, folder.id, {
      name: renameName,
      desc: renameDesc,
    });
    onResult(result);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    setRenaming(false);
  };

  const handleDeleteFolderClick = async () => {
    if (!folderDelArmed) {
      setFolderDelArmed(true);
      window.clearTimeout(folderDelTimerRef.current);
      folderDelTimerRef.current = window.setTimeout(() => setFolderDelArmed(false), 2800);
      return;
    }
    window.clearTimeout(folderDelTimerRef.current);
    const result = await deleteSecretCodeFolder(characterId, folder.id);
    onResult(result);
    if (!result.ok) {
      showToast(result.reason);
      setFolderDelArmed(false);
      return;
    }
    onBack();
    showToast(
      result.movedCount > 0
        ? `${result.movedCount} 条暗号已移到「未分类」，没有丢。`
        : '文件夹已删除。'
    );
  };

  const desc = folder.desc || (folder.uncat ? UNCAT_DESC : '这个文件夹还没有用途说明');
  const holo = selEntry ? (selEntry.useCount || 0) >= HOLO_USES : false;
  const used = selEntry ? selEntry.useCount || 0 : 0;

  // 墙上的空状态
  let wallMessage = null;
  if (needle && shownList.length === 0) {
    wallMessage = (
      <div className="sw-wall-msg sw-glass">
        <span>
          没找到“<b>{query.trim()}</b>”。
        </span>
        <button
          type="button"
          className="sw-pop-btn"
          onClick={() => {
            const text = query.trim();
            openCompose(charCount(text) <= SECRET_CODE_LIMITS.MAX_CODE_LENGTH ? { code: text } : { meaning: text });
          }}
        >
          把它做成新暗号
        </button>
      </div>
    );
  } else if (list.length === 0) {
    wallMessage = (
      <div className="sw-wall-msg sw-glass">
        <span>这个文件夹还是空的。TA 觉得合适时会提议放进来，你也可以点掉下来的“新暗号”自己写一个。</span>
      </div>
    );
  }

  return (
    <div className="sw-view" style={{ '--fc': look.color, '--fi': look.ink }}>
      <div className="sw-top">
        <button type="button" className="sw-back" onClick={onBack}>
          <ChevronLeft />
          全部文件夹
        </button>
        <span className="sw-spacer" />
        <button type="button" className="sw-qbtn" onClick={onOpenHelp} aria-label="怎么用，用量和设置">
          ?
        </button>
      </div>

      <div className="sw-title">
        <h2>{folder.name}</h2>
        <div className="sw-cap">
          {list.length > 0 ? (
            <>
              已破译 <b>{Math.min(openedCount, list.length)}</b> / {list.length}，词典还能放{' '}
              {Math.max(0, SECRET_CODE_LIMITS.MAX_ENTRIES - entries.length)} 个
            </>
          ) : (
            '还没有暗号'
          )}
        </div>
      </div>

      <label className="sw-search sw-glass">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          type="text"
          enterKeyHint="search"
          placeholder="搜暗号或它的意思"
          autoComplete="off"
          aria-label="搜索暗号"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="sw-search__x"
            aria-label="清空搜索"
            onClick={(e) => {
              e.preventDefault();
              setQuery('');
            }}
          >
            <X />
          </button>
        )}
      </label>

      <div className="sw-info sw-glass">
        <i className="sw-dot" />
        {renaming ? (
          <div className="sw-info__edit">
            <input
              value={renameName}
              maxLength={SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH}
              placeholder="文件夹名字"
              aria-label="文件夹名字"
              onChange={(e) => setRenameName(e.target.value)}
            />
            <input
              value={renameDesc}
              maxLength={SECRET_CODE_LIMITS.MAX_FOLDER_DESC_LENGTH}
              placeholder="一句用途说明（可不写）"
              aria-label="用途说明"
              onChange={(e) => setRenameDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveRename();
              }}
            />
          </div>
        ) : (
          <p>{desc}</p>
        )}
        {renaming ? (
          <>
            <button
              type="button"
              className="sw-ibtn"
              disabled={!renameName.trim()}
              onClick={() => void handleSaveRename()}
              aria-label="保存"
            >
              <Check />
            </button>
            <button type="button" className="sw-ibtn" onClick={() => setRenaming(false)} aria-label="取消">
              <X />
            </button>
          </>
        ) : (
          !folder.uncat && (
            <>
              <button
                type="button"
                className="sw-ibtn"
                onClick={() => {
                  setRenameName(folder.name);
                  setRenameDesc(folder.desc || '');
                  setRenaming(true);
                }}
                aria-label="改文件夹名和用途"
              >
                <Pencil />
              </button>
              <button
                type="button"
                className="sw-ibtn"
                data-armed={folderDelArmed ? 'true' : 'false'}
                onClick={() => void handleDeleteFolderClick()}
                aria-label="删除文件夹"
              >
                {folderDelArmed ? '删除文件夹？' : <Trash2 />}
              </button>
            </>
          )
        )}
      </div>

      <div className="sw-dec-wrap" aria-live="polite">
        <div className={`sw-dec sw-glass${decoding ? ' is-decoding' : ''}`}>
          <div className="sw-dec__top">
            <i className="sw-dec__led" />
            <b>解码窗</b>
            <span className="sw-dec__ch">{selEntry ? `${folder.name}频段` : '没有信号'}</span>
            <span className="sw-dec__pct" ref={pctRef} />
          </div>

          {selEntry ? (
            <>
              <div className="sw-dec__main">
                <div key={`${selEntry.id}:${heroTick}`} className="sw-dec__card is-swap">
                  <Mat look={look} holo={holo}>
                    <b
                      ref={codeRef}
                      className="sw-tile__code"
                      style={{ '--k': heroScale(selEntry.code) }}
                    />
                  </Mat>
                </div>
                <div className="sw-dec__txt">
                  <small>“{selEntry.code}”的意思</small>
                  <p
                    ref={meaningRef}
                    className="sw-dec__m"
                    contentEditable={editing}
                    suppressContentEditableWarning
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (!editing) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveEdit();
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        cancelEdit();
                      }
                    }}
                  />
                  <div className={`sw-sig${holo ? ' is-holo' : ''}`} aria-hidden="true">
                    {Array.from({ length: HOLO_USES }, (_, i) => (
                      <i key={i} className={i < used ? 'on' : ''} />
                    ))}
                  </div>
                  <span className="sw-dec__u">
                    用过 {used} 次，{holo ? '已经是镭射卡' : `再用 ${HOLO_USES - used} 次变镭射`}
                  </span>
                </div>
              </div>
              <div className="sw-dec__bar">
                <i ref={barRef} />
              </div>
              <div className="sw-dec__acts">
                <button
                  type="button"
                  className="sw-pill"
                  aria-pressed={editing}
                  onClick={() => {
                    if (editing) {
                      void saveEdit();
                    } else {
                      setEditing(true);
                      setMoving(false);
                    }
                  }}
                >
                  {editing ? '保存' : '改含义'}
                </button>
                <button
                  type="button"
                  className="sw-pill"
                  aria-pressed={moving}
                  onClick={() => {
                    if (editing) cancelEdit();
                    setMoving((value) => !value);
                  }}
                >
                  换文件夹
                </button>
                <button
                  type="button"
                  className="sw-pill"
                  data-armed={delArmed ? 'true' : 'false'}
                  onClick={() => void handleDeleteEntry()}
                >
                  {delArmed ? '再点一次撕掉' : '撕掉'}
                </button>
              </div>
              {moving && (
                <div className="sw-move">
                  <em>移到哪个文件夹？材质会跟着换。</em>
                  {moveTargets.length === 0 && <em>还没有别的文件夹，先回到文件夹柜新建一个。</em>}
                  {moveTargets.map((target) => {
                    const targetLook = getFolderLook(target);
                    return (
                      <button
                        key={target.id}
                        type="button"
                        className="sw-cchip"
                        style={{ '--fc': targetLook.color }}
                        onClick={() => void handleMoveTo(target)}
                      >
                        <i className="sw-dot" />
                        {target.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="sw-dec__empty">
              这个文件夹还没有暗号。做一张，它会先变成密文，掉下去，再在这里被破译。
            </p>
          )}
        </div>
      </div>

      <div className="sw-pitwrap">
        <div className="sw-pit" ref={pitRef} />
        {wallMessage && <div className="sw-pit__msg">{wallMessage}</div>}
      </div>

      {composeOpen && (
        <ComposeSheet
          look={look}
          entries={entries}
          initial={composeInitial}
          onSubmit={handleAdd}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
};

export default SecretCodeFolderView;
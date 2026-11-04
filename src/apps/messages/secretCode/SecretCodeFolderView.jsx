// src/apps/messages/secretCode/SecretCodeFolderView.jsx
//
// 悄悄话词典的文件夹内页：竖排大号文件夹名、左侧打孔、一行用途说明、
// 一叠素纸小签。小签可以改含义、移到别的文件夹、删除（点两次撕掉）；
// 内页顶部可以改文件夹名和用途、删文件夹（里面的暗号移到"未分类"）。
//
// 所有数据读写都走 secretCodeService；每次操作后把返回的 { entries, folders }
// 交给父组件（onResult）刷新，失败的原因用 showToast 明确告诉用户。
import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, FolderInput, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  SECRET_CODE_LIMITS,
  addSecretCode,
  deleteSecretCode,
  deleteSecretCodeFolder,
  moveSecretCode,
  updateSecretCode,
  updateSecretCodeFolder,
} from './secretCodeService';
import { getFolderColorVar } from './secretCodeFolderStyle';
import { BigClip, NewBurst, PaperClip, SLIP_TILTS, padTwo } from './SecretCodeDecor';

const UNCAT_DESC = '还没归类的暗号都放在这里';

// ---------------------------------------------------------------------------
// 一张小签
// ---------------------------------------------------------------------------
const Slip = ({
  entry,
  index,
  isNew,
  isMoving,
  moveTargets,
  onSaveMeaning,
  onToggleMove,
  onMoveTo,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.meaning);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState('');
  const armTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(armTimerRef.current), []);

  const saveEdit = async () => {
    const ok = await onSaveMeaning(entry, draft);
    if (ok) setEditing(false);
  };

  const handleEditClick = () => {
    if (editing) {
      void saveEdit();
      return;
    }
    setDraft(entry.meaning);
    setEditing(true);
  };

  const handleDeleteClick = () => {
    if (!armed) {
      setArmed(true);
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = window.setTimeout(() => setArmed(false), 2600);
      return;
    }
    window.clearTimeout(armTimerRef.current);
    setLeaving('tear');
    // 动画停在透明状态，所以不管成功失败，做完都要复位：成功时这张小签
    // 会随列表刷新消失，失败时它得重新显示出来，不能凭空不见了
    window.setTimeout(async () => {
      await onDelete(entry);
      setLeaving('');
    }, 540);
  };

  const handleMoveTo = (folder) => {
    setLeaving('fly');
    window.setTimeout(async () => {
      await onMoveTo(entry, folder);
      setLeaving('');
    }, 480);
  };

  const className = [
    'sc-slip2 sc-paper',
    isNew ? 'sc-enter' : '',
    leaving === 'tear' ? 'sc-tear' : '',
    leaving === 'fly' ? 'sc-fly' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{ '--sc-tilt': `${SLIP_TILTS[index % SLIP_TILTS.length]}deg`, '--i': index }}
    >
      <span
        className="sc-tape"
        style={{
          top: -7,
          left: 'calc(50% - 23px)',
          transform: `rotate(${index % 2 ? 4 : -4}deg)`,
          '--tape-c': 'color-mix(in srgb, var(--fc) 70%, var(--bg-surface-strong))',
        }}
      />
      <span className="sc-slip2__code">{entry.code}</span>
      <span className="sc-slip2__dash" />
      {editing ? (
        <input
          className="sc-slip2__edit"
          value={draft}
          autoFocus
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="sc-slip2__meaning">{entry.meaning}</span>
      )}
      <span className="sc-slip2__meta">USED {entry.useCount}</span>
      <span className="sc-slip2__actions">
        <button
          type="button"
          className="sc-icon-btn"
          onClick={handleEditClick}
          aria-label={editing ? '保存含义' : '编辑含义'}
        >
          {editing ? <Check /> : <Pencil />}
        </button>
        <button
          type="button"
          className="sc-icon-btn"
          onClick={() => onToggleMove(entry)}
          aria-label="移到别的文件夹"
        >
          <FolderInput />
        </button>
        <button
          type="button"
          className="sc-icon-btn"
          data-armed={armed ? 'true' : 'false'}
          onClick={handleDeleteClick}
          aria-label="删除暗号"
        >
          {armed ? '撕掉？' : <Trash2 />}
        </button>
      </span>
      {isMoving && (
        <div className="sc-movebox">
          <em>移到</em>
          {moveTargets.length === 0 && <em>没有别的文件夹</em>}
          {moveTargets.map((target) => (
            <button
              key={target.id}
              type="button"
              className="sc-chipf"
              style={{ '--fc': getFolderColorVar(target) }}
              onClick={() => handleMoveTo(target)}
            >
              {target.name}
            </button>
          ))}
        </div>
      )}
      {isNew && <NewBurst />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 写新暗号的小签（回形针夹着，盖章添加）
// ---------------------------------------------------------------------------
const WriteSlip = ({ onSubmit, onCancel }) => {
  const [code, setCode] = useState('');
  const [meaning, setMeaning] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = Boolean(code.trim() && meaning.trim()) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setPressed(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
    setBusy(true);
    try {
      const reason = await onSubmit({ code, meaning });
      if (reason) {
        setError(reason);
        setShaking(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`sc-slip2 sc-slip2--write sc-paper${shaking ? ' sc-shake' : ''}`}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShaking(false);
      }}
    >
      <PaperClip />
      <div className="sc-write__row">
        <input
          className="sc-field sc-field--code"
          value={code}
          autoFocus
          autoComplete="off"
          maxLength={12}
          placeholder="暗号"
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
        />
        <input
          className="sc-field sc-field--meaning"
          value={meaning}
          autoComplete="off"
          maxLength={80}
          placeholder="含义，比如：我想你了"
          onChange={(e) => {
            setMeaning(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <button
          type="button"
          className={`sc-stamp-btn${pressed ? ' sc-pressed' : ''}`}
          disabled={!canSubmit}
          onClick={() => void submit()}
          aria-label="添加暗号"
        >
          盖章
          <span className="sc-ripple" onAnimationEnd={() => setPressed(false)} />
        </button>
      </div>
      <div className="sc-write__error">{error}</div>
      <p className="sc-write__hint">
        <span>最多 {SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符，不能有空格、方括号、竖线和 emoji。</span>
        <button type="button" className="sc-ghost-btn" onClick={onCancel}>
          取消
        </button>
      </p>
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
  showToast,
}) => {
  const [writing, setWriting] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [newId, setNewId] = useState(null);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [renameDesc, setRenameDesc] = useState(folder.desc || '');
  const [folderDelArmed, setFolderDelArmed] = useState(false);
  const folderArmTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(folderArmTimerRef.current), []);

  const list = entries.filter((entry) => entry.folderId === folder.id);
  const moveTargets = [
    ...folders.filter((item) => !item.uncat && item.id !== folder.id),
    ...folders.filter((item) => item.uncat && item.id !== folder.id),
  ];
  const isFull = entries.length >= SECRET_CODE_LIMITS.MAX_ENTRIES;

  const handleSaveMeaning = async (entry, meaning) => {
    const result = await updateSecretCode(characterId, entry.id, {
      code: entry.code,
      meaning,
    });
    onResult(result);
    if (!result.ok) {
      showToast(result.reason);
      return false;
    }
    return true;
  };

  const handleMoveTo = async (entry, target) => {
    setMovingId(null);
    const result = await moveSecretCode(characterId, entry.id, target.id);
    onResult(result);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    onMovedTo(target.id);
    showToast(`已移到「${target.name}」`);
  };

  const handleDelete = async (entry) => {
    const result = await deleteSecretCode(characterId, entry.id);
    onResult(result);
  };

  const handleAdd = async ({ code, meaning }) => {
    if (isFull) return `词典最多 ${SECRET_CODE_LIMITS.MAX_ENTRIES} 条，先删掉一些。`;
    const result = await addSecretCode(characterId, {
      code,
      meaning,
      folderId: folder.id,
    });
    onResult(result);
    if (!result.ok) return result.reason;
    setNewId(result.entry.id);
    setWriting(false);
    return '';
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
      window.clearTimeout(folderArmTimerRef.current);
      folderArmTimerRef.current = window.setTimeout(() => setFolderDelArmed(false), 2800);
      return;
    }
    window.clearTimeout(folderArmTimerRef.current);
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

  return (
    <div className="sc-open" style={{ '--fc': getFolderColorVar(folder) }}>
      <div className="sc-open__bar">
        <button type="button" className="sc-backbtn" onClick={onBack}>
          <ChevronLeft />
          全部文件夹
        </button>
        <span className="sc-spacer" />
        {!folder.uncat && (
          <>
            <button
              type="button"
              className="sc-icon-btn"
              onClick={() => {
                setRenameName(folder.name);
                setRenameDesc(folder.desc || '');
                setRenaming((value) => !value);
              }}
              aria-label="改文件夹名和用途"
            >
              <Pencil />
            </button>
            <button
              type="button"
              className="sc-icon-btn"
              data-armed={folderDelArmed ? 'true' : 'false'}
              onClick={() => void handleDeleteFolderClick()}
              aria-label="删除文件夹"
            >
              {folderDelArmed ? '删除文件夹？' : <Trash2 />}
            </button>
          </>
        )}
      </div>

      {renaming && (
        <div className="sc-renamebox sc-paper">
          <input
            className="sc-field sc-field--wide"
            value={renameName}
            maxLength={SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH}
            placeholder="文件夹名字"
            onChange={(e) => setRenameName(e.target.value)}
          />
          <input
            className="sc-field sc-field--wide"
            value={renameDesc}
            maxLength={SECRET_CODE_LIMITS.MAX_FOLDER_DESC_LENGTH}
            placeholder="一句用途说明（可不写）"
            onChange={(e) => setRenameDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSaveRename();
            }}
          />
          <div className="sc-renamebox__row">
            <button type="button" className="sc-ghost-btn" onClick={() => setRenaming(false)}>
              取消
            </button>
            <button
              type="button"
              className="sc-tlabel"
              disabled={!renameName.trim()}
              onClick={() => void handleSaveRename()}
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="sc-open__shell">
        <span className="sc-open__tab">
          <span>{folder.name}</span>
          <span className="sc-count" style={{ minWidth: 30, height: 20, fontSize: 10 }}>
            {padTwo(list.length)}
          </span>
        </span>
        <div className="sc-open__body">
          <BigClip />
          <div className="sc-sheaf">
            <div className="sc-vname">
              <span>{folder.name}</span>
            </div>
            <p className="sc-open__desc">{desc}</p>
            <div className="sc-sgrid">
              {list.map((entry, index) => (
                <Slip
                  key={entry.id}
                  entry={entry}
                  index={index}
                  isNew={entry.id === newId}
                  isMoving={movingId === entry.id}
                  moveTargets={moveTargets}
                  onSaveMeaning={handleSaveMeaning}
                  onToggleMove={(target) =>
                    setMovingId((current) => (current === target.id ? null : target.id))
                  }
                  onMoveTo={handleMoveTo}
                  onDelete={handleDelete}
                />
              ))}
              {list.length === 0 && !writing && (
                <div className="sc-open__empty">
                  这个文件夹还是空的。TA 觉得合适时会提议放进来，你也可以点下面自己写一个。
                </div>
              )}
              {writing ? (
                <WriteSlip onSubmit={handleAdd} onCancel={() => setWriting(false)} />
              ) : (
                <button
                  type="button"
                  className="sc-slip2 sc-slip2--blank"
                  style={{ '--i': list.length }}
                  onClick={() => {
                    if (isFull) {
                      showToast(`词典最多 ${SECRET_CODE_LIMITS.MAX_ENTRIES} 条，先删掉一些。`);
                      return;
                    }
                    setMovingId(null);
                    setWriting(true);
                  }}
                >
                  <Plus />
                  新暗号
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretCodeFolderView;

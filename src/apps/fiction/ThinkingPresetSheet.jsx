// src/apps/fiction/ThinkingPresetSheet.jsx
//
// 思考预设的底部抽屉（从向导「思维链」区块打开）。一次只显示一层：
//   list     选预设：点左边的圆点选用，点右边的箭头进入；底部可新建
//   entries  条目列表：开关、上移 / 下移、改预设名、复制、删除（内置预设只读）
//   edit     编辑条目：标题、内容、开关；也用来添加新条目
//   delete   删除确认
//
// 预设库由父组件持有：本组件改完库会先写进 db.settings，再通过 onLibraryChange 交回去。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';

import FictionSheetPortal from './FictionSheetPortal';
import {
  THINKING_LIMITS,
  countSavesUsingPresets,
  createPresetFromBuiltin,
  deleteEntry,
  deletePreset,
  duplicatePreset,
  moveEntry,
  renamePreset,
  saveThinkingLibrary,
  setEntryEnabled,
  upsertEntry,
} from './fictionThinkingLibrary';
import { listThinkingPresets, resolveThinkingPreset } from './fictionThinkingPresets';
import './fictionThinkingEditor.css';

const ThinkingPresetSheet = ({ library, selectedId, onSelect, onLibraryChange, onClose }) => {
  const [view, setView] = useState({ name: 'list', id: '' });
  const [usage, setUsage] = useState({});
  const [nameDraft, setNameDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(null);
  const noticeTimer = useRef(null);

  // 编辑过程中连点开关时，用 ref 拿最新的库，避免用到上一次渲染的旧值。
  const libraryRef = useRef(library);

  // 小提示显示在抽屉里（不依赖外面的 toast），3 秒后自动消失。
  const notify = (text) => {
    setNotice(text);

    if (noticeTimer.current) clearTimeout(noticeTimer.current);

    noticeTimer.current = setTimeout(() => setNotice(''), 3000);
  };

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  libraryRef.current = library;

  const presets = useMemo(() => listThinkingPresets(library), [library]);
  const currentId = resolveThinkingPreset(library, selectedId).id;
  const target = presets.find((preset) => preset.id === view.id) || null;

  useEffect(() => {
    let alive = true;

    countSavesUsingPresets().then((counts) => {
      if (alive) setUsage(counts);
    });

    return () => {
      alive = false;
    };
  }, []);

  // 进入某份预设时，把预设名放进输入框。
  useEffect(() => {
    setNameDraft(target?.name || '');
  }, [target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 看不到目标预设了（比如刚被删除），退回列表。
  useEffect(() => {
    if (view.name !== 'list' && !target) setView({ name: 'list', id: '' });
  }, [view.name, target]);

  const commit = async (next) => {
    const previous = libraryRef.current;

    libraryRef.current = next;
    onLibraryChange(next);

    try {
      await saveThinkingLibrary(next);

      return true;
    } catch (error) {
      console.warn('[Fiction] 保存思考预设失败：', error);
      libraryRef.current = previous;
      onLibraryChange(previous);
      notify('保存失败，请再试一次');

      return false;
    }
  };

  const openEntries = (id) => {
    setDraft(null);
    setView({ name: 'entries', id });
  };

  // entry 为空 = 添加新条目
  const openEdit = (entry) => {
    if (!entry && target.entries.length >= THINKING_LIMITS.entries) {
      notify(`每份预设最多 ${THINKING_LIMITS.entries} 个条目`);

      return;
    }

    setDraft({
      id: entry?.id || '',
      title: entry?.title || '',
      content: entry?.content || '',
      enabled: entry ? entry.enabled : true,
      choiceOnly: Boolean(entry?.choiceOnly),
      origin: entry ? `${entry.title}\u0000${entry.content}\u0000${entry.enabled}` : '',
    });
    setView({ name: 'edit', id: target.id });
  };

  const handleSaveEntry = async () => {
    const title = draft.title.trim();
    const content = draft.content.trim();

    if (!title) {
      notify('标题不能为空');

      return;
    }

    if (!content) {
      notify('内容不能为空');

      return;
    }

    const next = upsertEntry(libraryRef.current, target.id, { ...draft, title, content });

    if (!next) {
      notify(`每份预设最多 ${THINKING_LIMITS.entries} 个条目`);

      return;
    }

    if (await commit(next)) openEntries(target.id);
  };

  const handleDeleteEntry = async () => {
    if (!draft?.id) return;

    if (await commit(deleteEntry(libraryRef.current, target.id, draft.id))) openEntries(target.id);
  };

  const handleCreate = async () => {
    const result = createPresetFromBuiltin(libraryRef.current);

    if (!result) {
      notify(`最多 ${THINKING_LIMITS.presets} 份预设`);

      return;
    }

    if (await commit(result.library)) openEntries(result.preset.id);
  };

  const handleDuplicate = async () => {
    if (!target) return;

    const result = duplicatePreset(libraryRef.current, target);

    if (!result) {
      notify(`最多 ${THINKING_LIMITS.presets} 份预设`);

      return;
    }

    if (await commit(result.library)) {
      notify('已复制');
      openEntries(result.preset.id);
    }
  };

  const handleRename = () => {
    if (!target || target.builtin) return;

    const next = nameDraft.trim().slice(0, THINKING_LIMITS.name);

    if (!next) {
      setNameDraft(target.name);

      return;
    }

    if (next !== target.name) void commit(renamePreset(libraryRef.current, target.id, next));
  };

  const handleDelete = async () => {
    if (!target || target.builtin) return;

    const id = target.id;

    if (await commit(deletePreset(libraryRef.current, id))) {
      if (currentId === id) onSelect('');
      setView({ name: 'list', id: '' });
    }
  };

  const handleToggle = (entry) => {
    void commit(setEntryEnabled(libraryRef.current, target.id, entry.id, !entry.enabled));
  };

  const handleMove = (index, delta) => {
    void commit(moveEntry(libraryRef.current, target.id, index, index + delta));
  };

  const usedBy = target ? usage[target.id] || 0 : 0;

  // ---------- 各层的内容 ----------

  const renderList = () => (
    <Shell
      notice={notice}
      title="思考预设"
      meta="每份预设是一组思考步骤。点左边选用，点右边进入"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={handleCreate}>
            新建预设（从默认复制）
          </button>
          <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={onClose}>
            完成
          </button>
        </>
      )}
    >
      <ul className="fic-th-list">
        {presets.map((preset) => {
          const enabledCount = preset.entries.filter((entry) => entry.enabled).length;
          const used = usage[preset.id] || 0;
          const picked = preset.id === currentId;

          return (
            <li key={preset.id} className="fic-th-row">
              <button
                type="button"
                role="radio"
                aria-checked={picked}
                aria-label={`选用 ${preset.name}`}
                className="fic-btn-reset fic-th-radio-hit"
                onClick={() => onSelect(preset.builtin ? '' : preset.id)}
              >
                <span className={`fic-th-radio ${picked ? 'is-on' : ''}`} />
              </button>

              <button type="button" className="fic-btn-reset fic-th-main" onClick={() => openEntries(preset.id)}>
                <span className="fic-th-name">
                  {preset.name}
                  {preset.builtin && <span className="fic-th-badge">内置</span>}
                </span>
                <span className="fic-th-sub">
                  {preset.entries.length} 个条目
                  {preset.builtin ? ' · 不可修改，可复制后再改' : ` · ${enabledCount} 个开启${used ? ` · ${used} 个存档在用` : ''}`}
                </span>
              </button>

              <ChevronRight size={18} className="fic-th-chev" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </Shell>
  );

  const renderEntries = () => {
    const readOnly = Boolean(target.builtin);

    return (
      <Shell
        notice={notice}
        title={target.name}
        onClose={onClose}
        back={() => setView({ name: 'list', id: '' })}
        footer={readOnly ? (
          <>
            <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={handleDuplicate}>
              复制一份再改
            </button>
            <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={() => setView({ name: 'list', id: '' })}>
              返回
            </button>
          </>
        ) : (
          <>
            <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={() => openEdit(null)}>
              添加条目
            </button>
            <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={handleDuplicate}>
              复制这份预设
            </button>
            <button
              type="button"
              className="fic-btn-reset fic-sheet-btn is-danger"
              onClick={() => setView({ name: 'delete', id: target.id })}
            >
              删除这份预设
            </button>
            <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={() => setView({ name: 'list', id: '' })}>
              返回
            </button>
          </>
        )}
      >
        <div className="fic-th-note">
          {readOnly
            ? '内置预设不能修改。想调整的话，复制一份再改。'
            : usedBy > 0
              ? `${usedBy} 个存档在用这份预设，改动会同时影响它们。`
              : '改动会同时影响所有用这份预设的存档。'}
        </div>

        {!readOnly && (
          <>
            <div className="fic-w-label-row fic-th-label">
              <span className="fic-w-label">预设名称</span>
              <span className="fic-w-tag">{nameDraft.length}/{THINKING_LIMITS.name}</span>
            </div>
            <input
              type="text"
              className="fic-w-input"
              aria-label="预设名称"
              value={nameDraft}
              maxLength={THINKING_LIMITS.name}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={handleRename}
            />
          </>
        )}

        <div className="fic-w-label-row fic-th-label">
          <span className="fic-w-label">思考步骤</span>
          <span className="fic-w-tag">按顺序逐条想</span>
        </div>

        <ul className="fic-th-list">
          {target.entries.map((entry, index) => (
            <li key={entry.id} className={`fic-th-row ${!readOnly && !entry.enabled ? 'is-off' : ''}`}>
              {readOnly ? (
                <span className="fic-th-num">{index + 1}</span>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={entry.enabled}
                  aria-label={`${entry.enabled ? '关闭' : '开启'} ${entry.title}`}
                  className={`fic-btn-reset fic-w-switch fic-th-switch ${entry.enabled ? 'is-on' : ''}`}
                  onClick={() => handleToggle(entry)}
                />
              )}

              {React.createElement(
                readOnly ? 'span' : 'button',
                readOnly
                  ? { className: 'fic-th-main is-static' }
                  : { type: 'button', className: 'fic-btn-reset fic-th-main', onClick: () => openEdit(entry) },
                <span className="fic-th-name">
                  {entry.title || '未命名条目'}
                  {entry.choiceOnly && readOnly && <span className="fic-th-badge">仅选择式</span>}
                </span>,
                <span className="fic-th-snippet">{entry.content}</span>,
              )}

              {!readOnly && (
                <span className="fic-th-moves">
                  <button
                    type="button"
                    className="fic-btn-reset fic-th-icon"
                    aria-label="上移"
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    className="fic-btn-reset fic-th-icon"
                    aria-label="下移"
                    disabled={index === target.entries.length - 1}
                    onClick={() => handleMove(index, 1)}
                  >
                    <ChevronDown size={18} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Shell>
    );
  };

  const renderEdit = () => {
    const dirty = draft.id
      ? `${draft.title}\u0000${draft.content}\u0000${draft.enabled}` !== draft.origin
      : Boolean(draft.title.trim() || draft.content.trim());

    return (
      <Shell
        notice={notice}
        title={draft.id ? '编辑条目' : '添加条目'}
        meta="写的是「想什么」。写作要求请放在文风里"
        onClose={onClose}
        footer={(
          <>
            <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={handleSaveEntry}>
              保存
            </button>
            {draft.id && (
              <button type="button" className="fic-btn-reset fic-sheet-btn is-danger" onClick={handleDeleteEntry}>
                删除这条
              </button>
            )}
            <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={() => openEntries(target.id)}>
              {dirty ? '放弃修改并返回' : '返回'}
            </button>
          </>
        )}
      >
        <div className="fic-w-label-row fic-th-label">
          <label className="fic-w-label" htmlFor="fic-th-title">标题</label>
          <span className="fic-w-tag">{draft.title.length}/{THINKING_LIMITS.title}</span>
        </div>
        <input
          id="fic-th-title"
          type="text"
          className="fic-w-input"
          value={draft.title}
          maxLength={THINKING_LIMITS.title}
          placeholder="比如：线索与误导"
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />

        <div className="fic-w-label-row fic-th-label">
          <label className="fic-w-label" htmlFor="fic-th-content">内容</label>
          <span className="fic-w-tag">{draft.content.length}/{THINKING_LIMITS.content}</span>
        </div>
        <textarea
          id="fic-th-content"
          className="fic-w-textarea fic-th-textarea"
          rows={14}
          value={draft.content}
          maxLength={THINKING_LIMITS.content}
          placeholder="告诉模型这一步要想什么、怎么想。写得具体一点，它会照着逐条想完。"
          onChange={(event) => setDraft({ ...draft, content: event.target.value })}
        />

        <button
          type="button"
          role="switch"
          aria-checked={draft.enabled}
          className="fic-btn-reset fic-w-switch-row"
          onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
        >
          <span className="fic-w-switch-text">
            <span className="fic-w-switch-label">启用这一条</span>
            <span className="fic-w-switch-hint">关掉后这一条不会交给模型</span>
          </span>
          <span className={`fic-w-switch ${draft.enabled ? 'is-on' : ''}`} aria-hidden="true" />
        </button>
      </Shell>
    );
  };

  const renderDelete = () => (
    <Shell
      notice={notice}
      title="删除这份预设"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="fic-btn-reset fic-sheet-btn is-danger-solid" onClick={handleDelete}>
            确认删除
          </button>
          <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={() => openEntries(target.id)}>
            取消
          </button>
        </>
      )}
    >
      <p className="fic-th-confirm">
        {usedBy > 0
          ? `删除「${target.name}」后，正在用它的 ${usedBy} 个存档会改用内置的「默认 · 先想后写」。已经生成的思考内容不受影响。`
          : `删除「${target.name}」后无法恢复。`}
      </p>
    </Shell>
  );

  if (view.name === 'entries' && target) return renderEntries();
  if (view.name === 'edit' && target && !target.builtin && draft) return renderEdit();
  if (view.name === 'delete' && target && !target.builtin) return renderDelete();

  return renderList();
};

// 抽屉外壳：和向导里的 SheetShell 同样的结构和样式类，多一个可选的返回箭头。
const Shell = ({ title, meta, notice, back, onClose, footer, children }) => (
  <FictionSheetPortal>
    <button type="button" className="fic-btn-reset fic-mask" aria-label="关闭" onClick={onClose} />
    <div className="fic-sheet fic-w-sheet fic-th-sheet" role="dialog" aria-label={title}>
      <div className="fic-sheet-grab" />
      <div className="fic-th-head">
        {back ? (
          <button type="button" className="fic-btn-reset fic-th-icon" aria-label="返回" onClick={back}>
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div className="fic-sheet-name fic-th-title">{title}</div>
      </div>
      {meta ? <div className="fic-sheet-meta">{meta}</div> : null}
      {notice ? <div className="fic-th-note is-warn" role="status">{notice}</div> : null}
      <div className="fic-w-sheet-scroll">{children}</div>
      {footer ? <div className="fic-sheet-actions">{footer}</div> : null}
    </div>
  </FictionSheetPortal>
);

export default ThinkingPresetSheet;
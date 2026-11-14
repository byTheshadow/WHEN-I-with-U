// src/apps/fiction/FictionApp.jsx
//
// 互动文游。书架页：空状态、存档列表、「最近游玩」大卡、更多操作（删除，带二次确认）。
// 第 2 轮：「新建存档」进入新建向导；草稿存档点开后回到向导继续填。
// 第 3 轮：正式存档点开进入游玩页（选择式）；纯小说式的游玩页第 6 轮再做。
// 编辑设定：书架里存档的「更多操作」抽屉和游玩页左上角都能打开，复用新建向导
// （wizard.editSaveId）；从游玩页进去的，保存或放弃后回到游玩页，不是书架。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Plus } from 'lucide-react';

import {
  FICTION_IMAGE_MODES,
  FICTION_MODES,
  deleteSave,
  listSaveSummaries,
} from './fictionService';
import { WIZARD_STEP_COUNT } from './fictionWizardService';
import FictionWizard from './FictionWizard';
import FictionPlayRoom from './FictionPlayRoom';
import useFictionViewportHeight from './useFictionViewportHeight';
import './fiction.css';
import './fictionSheetScroll.css';

const FILTERS = {
  ALL: 'all',
  CHOICE: FICTION_MODES.CHOICE,
  NOVEL: FICTION_MODES.NOVEL,
};

const MODE_LABEL = {
  [FICTION_MODES.CHOICE]: '选择式',
  [FICTION_MODES.NOVEL]: '小说式',
};

const IMAGE_LABEL = {
  [FICTION_IMAGE_MODES.MANUAL]: '手动配图',
  [FICTION_IMAGE_MODES.AUTO]: '自动配图',
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatRelative = (timestamp) => {
  const diff = Date.now() - Number(timestamp || 0);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;

  return new Date(timestamp).toLocaleDateString('zh-CN');
};

const buildMetaLine = (save) => {
  if (save.isDraft) {
    const stepNo = Math.min(Number(save.draftStep) || 0, WIZARD_STEP_COUNT - 1) + 1;

    return `草稿 · 第 ${stepNo}/${WIZARD_STEP_COUNT} 步 · ${formatRelative(save.updatedAt)}`;
  }

  const parts = [MODE_LABEL[save.mode] || '选择式'];

  if (save.segmentCount > 0) {
    parts.push(save.mode === FICTION_MODES.NOVEL ? `第 ${save.segmentCount} 节` : `第 ${save.segmentCount} 段`);
  } else {
    parts.push('还没开始');
  }

  parts.push(formatRelative(save.updatedAt));

  return parts.join(' · ');
};

const buildTags = (save) => {
  const tags = [];

  if (save.isDraft) tags.push('草稿');
  if (save.branchCount > 0) tags.push(`${save.branchCount} 条分支`);
  if (Array.isArray(save.stats) && save.stats.length > 0) tags.push('有数值');
  if (IMAGE_LABEL[save.imageMode]) tags.push(IMAGE_LABEL[save.imageMode]);

  return tags;
};

const FictionApp = ({ onBackHub }) => {
  // 键盘弹出时按可视区域定高，底部抽屉和底栏才不会被键盘盖住（见该文件注释）
  useFictionViewportHeight();

  const [saves, setSaves] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [menuSave, setMenuSave] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  // null = 书架；{ draftId } = 新建向导（draftId 为 null 表示全新开始）；
  // { editSaveId, returnToPlay } = 编辑已有存档的设定（returnToPlay：结束后回游玩页）
  const [wizard, setWizard] = useState(null);
  // null = 不在游玩页；{ saveId } = 正在玩这份存档
  const [play, setPlay] = useState(null);

  const toastTimerRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const reload = useCallback(async () => {
    try {
      setSaves(await listSaveSummaries());
    } catch (error) {
      console.warn('[Fiction] 读取存档失败：', error);
      setSaves([]);
      showToast('读取存档失败，请退出重进一次');
    } finally {
      setLoaded(true);
    }
  }, [showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => ({
    [FILTERS.ALL]: saves.length,
    [FILTERS.CHOICE]: saves.filter((save) => save.mode === FILTERS.CHOICE).length,
    [FILTERS.NOVEL]: saves.filter((save) => save.mode === FILTERS.NOVEL).length,
  }), [saves]);

  const visibleSaves = useMemo(
    () => (filter === FILTERS.ALL ? saves : saves.filter((save) => save.mode === filter)),
    [saves, filter],
  );

  // listSaveSummaries 已经按 updatedAt 倒序，第一份就是最近游玩的。
  // 草稿和还没开始的存档都不配当「继续」大卡。
  const latestSave = saves.find((save) => !save.isDraft && save.segmentCount > 0) || null;

  const handleNew = () => {
    setWizard({ draftId: null });
  };

  const handleOpenSave = (save) => {
    if (save?.isDraft) {
      setWizard({ draftId: save.id });
      return;
    }

    if (save?.mode === FICTION_MODES.NOVEL) {
      showToast('纯小说式的游玩页下一阶段开放');
      return;
    }

    setPlay({ saveId: save.id });
  };

  const handleWizardExit = async (result = {}) => {
    const backToPlayId = wizard?.returnToPlay && wizard?.editSaveId != null ? wizard.editSaveId : null;

    setWizard(null);
    if (backToPlayId != null) setPlay({ saveId: backToPlayId });
    await reload();

    if (result.message) showToast(result.message);
  };

  const handlePlayExit = async (result = {}) => {
    setPlay(null);
    await reload();

    if (result.message) showToast(result.message);
  };

  // 游玩页左上角：离开游玩页，打开设定向导，结束后回到这份存档的游玩页。
  const handleEditSettingsFromPlay = (saveId) => {
    setPlay(null);
    setWizard({ draftId: null, editSaveId: saveId, returnToPlay: true });
  };

  // 书架「更多操作」抽屉：编辑设定，结束后回书架。
  const handleEditSettingsFromMenu = () => {
    if (!menuSave || busy) return;

    const targetId = menuSave.id;

    setMenuSave(null);
    setConfirming(false);
    setWizard({ draftId: null, editSaveId: targetId, returnToPlay: false });
  };

  const closeMenu = () => {
    if (busy) return;

    setMenuSave(null);
    setConfirming(false);
  };

  const handleConfirmDelete = async () => {
    if (!menuSave || busy) return;

    setBusy(true);

    try {
      await deleteSave(menuSave.id);
      setMenuSave(null);
      setConfirming(false);
      await reload();
      showToast('存档已删除');
    } catch (error) {
      console.warn('[Fiction] 删除存档失败：', error);
      showToast('删除失败，请再试一次');
    } finally {
      setBusy(false);
    }
  };

  const filterItems = [
    { id: FILTERS.ALL, label: '全部' },
    { id: FILTERS.CHOICE, label: '选择式' },
    { id: FILTERS.NOVEL, label: '小说式' },
  ];

  if (wizard) {
    return (
      <div className="fic-root">
        <FictionWizard
          draftId={wizard.draftId}
          editSaveId={wizard.editSaveId ?? null}
          onExit={handleWizardExit}
        />
      </div>
    );
  }

  if (play) {
    return (
      <div className="fic-root">
        <FictionPlayRoom
          saveId={play.saveId}
          onExit={handlePlayExit}
          onEditSettings={handleEditSettingsFromPlay}
        />
        {toast && <div className="fic-toast" role="status">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="fic-root">
      <div className="fic-col">
        <button
          type="button"
          className="fic-btn-reset fic-round-btn fic-back"
          aria-label="返回主界面"
          onClick={onBackHub}
        >
          <ArrowLeft size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>

        <div className="fic-scroll">
          <div className="fic-vol-row">
            <span className="fic-vol">VOL. {pad2(saves.length)} SAVES</span>
          </div>

          <header className="fic-head">
            <div className="fic-eyebrow">Interactive Fiction</div>
            <h1 className="fic-title">
              Story
              <br />
              Shelf
            </h1>
            <div className="fic-title-zh">互动文游</div>
            <p className="fic-lead">每一份存档都是一条没走完的故事线。可以同时开着很多份，彼此互不影响。</p>
          </header>

          {saves.length > 0 && (
            <div className="fic-filters" role="tablist" aria-label="按形式筛选">
              {filterItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={`fic-btn-reset fic-filter ${filter === item.id ? 'is-on' : ''}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} {counts[item.id]}
                </button>
              ))}
            </div>
          )}

          {latestSave && (
            <section className="fic-resume" aria-label="最近游玩">
              <div className="fic-resume-top">
                <span className="fic-resume-no">No. 01 · 最近游玩</span>
                <span className="fic-resume-time">{formatRelative(latestSave.updatedAt)}</span>
              </div>
              <div className="fic-resume-name">{latestSave.title}</div>
              <div className="fic-resume-meta">
                {MODE_LABEL[latestSave.mode]} · 第 {latestSave.segmentCount} {latestSave.mode === FICTION_MODES.NOVEL ? '节' : '段'}
                {latestSave.branchCount > 0 ? ` · ${latestSave.branchCount} 条分支` : ''}
              </div>
              <button
                type="button"
                className="fic-btn-reset fic-resume-btn"
                onClick={() => handleOpenSave(latestSave)}
              >
                继续
              </button>
            </section>
          )}

          {loaded && saves.length === 0 && (
            <div className="fic-empty">
              <div className="fic-empty-hand">书架还是空的。</div>
              <p className="fic-empty-text">
                新建一份存档，写下背景、挑几位角色，故事就会从第一段开始。
              </p>
            </div>
          )}

          {visibleSaves.length > 0 && (
            <ol className="fic-list">
              {visibleSaves.map((save, index) => {
                const tags = buildTags(save);

                return (
                  <li key={save.id} className="fic-row">
                    <span className="fic-row-no">{pad2(index + 1)}</span>
                    <button
                      type="button"
                      className="fic-btn-reset fic-row-main"
                      onClick={() => handleOpenSave(save)}
                    >
                      <span className="fic-row-name">{save.title}</span>
                      <span className="fic-row-meta">{buildMetaLine(save)}</span>
                      {tags.length > 0 && (
                        <span className="fic-tags">
                          {tags.map((tag) => (
                            <span key={tag} className="fic-tag">{tag}</span>
                          ))}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="fic-btn-reset fic-more"
                      aria-label={`${save.title} 的更多操作`}
                      onClick={() => {
                        setConfirming(false);
                        setMenuSave(save);
                      }}
                    >
                      <MoreHorizontal size={20} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="fic-foot">
          <button type="button" className="fic-btn-reset fic-new-btn" onClick={handleNew}>
            <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
            新建存档
          </button>
        </div>

        {menuSave && (
          <>
            <button
              type="button"
              className="fic-btn-reset fic-mask"
              aria-label="关闭"
              onClick={closeMenu}
            />
            <div className="fic-sheet" role="dialog" aria-label="存档操作">
              <div className="fic-sheet-grab" />
              <div className="fic-sheet-name">{menuSave.title}</div>
              <div className="fic-sheet-meta">{buildMetaLine(menuSave)}</div>

              {!confirming && (
                <div className="fic-sheet-actions">
                  {!menuSave.isDraft && (
                    <button
                      type="button"
                      className="fic-btn-reset fic-sheet-btn"
                      onClick={handleEditSettingsFromMenu}
                    >
                      编辑设定
                    </button>
                  )}
                  <button
                    type="button"
                    className="fic-btn-reset fic-sheet-btn is-danger"
                    onClick={() => setConfirming(true)}
                  >
                    {menuSave.isDraft ? '删除草稿' : '删除存档'}
                  </button>
                  <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeMenu}>
                    取消
                  </button>
                </div>
              )}

              {confirming && (
                <>
                  <p className="fic-sheet-warn">
                    {menuSave.isDraft
                      ? '草稿里已填的内容会一起删掉，删除后无法恢复。'
                      : '会同时删掉这份存档的全部剧情、分支和配图，删除后无法恢复。'}
                  </p>
                  <div className="fic-sheet-actions">
                    <button
                      type="button"
                      className="fic-btn-reset fic-sheet-btn is-danger-solid"
                      disabled={busy}
                      onClick={handleConfirmDelete}
                    >
                      {busy ? '正在删除' : '确认删除'}
                    </button>
                    <button
                      type="button"
                      className="fic-btn-reset fic-sheet-btn"
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                    >
                      返回
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {toast && <div className="fic-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
};

export default FictionApp;
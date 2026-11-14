// src/apps/fiction/FictionPlayRoom.jsx
//
// 互动文游的游玩页（选择式）。第 3 轮：
//   - 没有开场时先显示序章页，点「开始故事」生成开场
//   - 当前路径上的每一段从上往下排，打开时自动滚到最新一段
//   - 顶部数值条；底部「Your move」抽屉：选项、自由输入、重新生成
//   - 生成期间显示「正在生成中」，可以取消（取消不会写入任何东西）
//   - 解析不出选项 / 输出被截断时给提示，可以重新生成
// 第 4A 轮：
//   - 重 roll 保留旧版本：抽屉标题行有「‹ 2/3 ›」，只对最后一段（还没有后续的那段）
//     出现，可以在各个版本之间切换
//   - 选过的选项带「走过」标记；回退之后再点它，直接回到已有的那一段，不重新生成
// 第 4B 轮：
//   - 右上角分支按钮 → 故事线（整棵剧情树；点节点可以另开分支、命名存档点）
//   - 点每一段的「第 N 段」标题 → 回看（当时的选项、数值变化、你选了哪个）
//   - 另开分支 = 回到那一段（jumpTo），再选一个不同的行动就是一条新分支
// 第 5A 轮：
//   - 右上角（分支按钮下面）常驻一个「总结」入口；有满一批却还没总结的内容时
//     带一个小红点。点开是总结总览页（FictionSummaryOverview），不影响游玩页本身。
// 手动编辑：每一段末尾「编辑这一段」，改正文文字，不重新生成（FictionTextEditor）。
// 设定：左上角返回按钮下面的「编辑设定」，交给 FictionApp 重新打开向导（onEditSettings）。
// 配图在后面几轮。
//
// 生成函数都在 fictionAiService.js 里：写库发生在 AI 返回之后，
// 所以中途取消或失败不会留下半截节点。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  NotebookText,
  RotateCcw,
  Settings2,
} from 'lucide-react';

import {
  getPathToNode,
  getSave,
  listChildren,
  listLeafVersions,
  setCurrentNode,
} from './fictionService';
import {
  FICTION_ERROR,
  generateNext,
  generateOpening,
  rerollNode,
} from './fictionAiService';
import { PARSE_WARNING, normalizeStatDefs } from './fictionParser';
import { ACTION_TYPES, findPendingSummaryBatch } from './fictionPromptAssembler';
import FictionStoryline from './FictionStoryline';
import FictionReveal from './FictionReveal';
import FictionSummaryOverview from './FictionSummaryOverview';
import FictionTextEditor from './FictionTextEditor';
import './fictionPlay.css';
import './fictionEdit.css';

const FREE_TEXT_MAX = 300;
const BACKGROUND_PREVIEW_MAX = 220;

const splitParagraphs = (text) => String(text || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const describeUserAction = (action) => {
  if (!action?.text) return '';

  if (action.type === ACTION_TYPES.OPTION) return `你选了：${action.text}`;
  if (action.type === ACTION_TYPES.FREE) return `你写下：${action.text}`;

  return '';
};

const formatDelta = (value) => `${value > 0 ? '+' : '−'}${Math.abs(value)}`;

const statPercent = (stat, value) => {
  const span = stat.max - stat.min;

  if (span <= 0) return 0;

  return Math.min(100, Math.max(0, ((value - stat.min) / span) * 100));
};

const GeneratingDots = () => (
  <span className="fic-p-dots" aria-hidden="true">
    <span>.</span>
    <span>.</span>
    <span>.</span>
  </span>
);

const FictionPlayRoom = ({ saveId, onExit, onEditSettings }) => {
  const [save, setSave] = useState(null);
  const [path, setPath] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null); // null | 'opening' | 'next' | 'regen'
  const [error, setError] = useState(null); // { message, retry }
  const [freeText, setFreeText] = useState('');
  // 当前这一段的各个「还没有后续」的版本（重 roll 出来的），按创建顺序
  const [versions, setVersions] = useState([]);
  // 当前这一段后面已经走过的行动（children 的 actionKey）；空 = 这一段还没有后续
  const [explored, setExplored] = useState(() => new Set());
  // 4B：盖在上面的两层。回看可以盖在故事线上面，关掉回看还能回到故事线。
  const [storylineOpen, setStorylineOpen] = useState(false);
  const [reveal, setReveal] = useState(null); // { nodeId, chosenChildId, number }
  // 5A：总结总览页；是否有待总结的内容只影响入口按钮上的小红点，不影响能不能生成下一段。
  const [summaryOpen, setSummaryOpen] = useState(false);
  // 手动编辑正文：{ nodeId, number }，null = 没有在编辑
  const [editing, setEditing] = useState(null);

  const abortRef = useRef(null);
  const busyRef = useRef(null);
  const mountedRef = useRef(true);
  const scrollRef = useRef(null);
  const sectionRefs = useRef(new Map());
  const scrolledOnceRef = useRef(false);
  // onExit 每次渲染都是新函数，放进 ref 里，避免它进依赖数组后反复重新读存档。
  const onExitRef = useRef(onExit);

  onExitRef.current = onExit;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ---------- 读存档 ----------

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const found = await getSave(saveId);

        if (!found || found.isDraft) {
          if (alive) onExitRef.current?.({ message: '这份存档现在不能游玩' });
          return;
        }

        const nodes = found.currentNodeId ? await getPathToNode(found.currentNodeId) : [];

        if (!alive) return;

        setSave(found);
        setPath(nodes);
      } catch (loadError) {
        console.warn('[Fiction] 读取存档失败：', loadError);
        if (alive) onExitRef.current?.({ message: '读取存档失败，请再试一次' });
      } finally {
        if (alive) setLoaded(true);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [saveId]);

  // ---------- 派生数据 ----------

  const current = path.length > 0 ? path[path.length - 1] : null;
  const stats = useMemo(() => normalizeStatDefs(save?.stats), [save]);
  const snapshot = current?.statsSnapshot || {};
  const showStats = save?.mode === 'choice' && stats.length > 0;
  const warnings = current?.parseWarnings || [];
  const options = current?.options || [];
  const noOptions = Boolean(current) && save?.mode === 'choice' && options.length === 0;
  const truncated = warnings.some((warning) => warning.code === PARSE_WARNING.TRUNCATED);
  const generating = busy === 'opening' || busy === 'next';
  // 只有「还没有后续」的最后一段才能重 roll、切版本
  const isLeaf = explored.size === 0;
  const versionIndex = current ? versions.findIndex((item) => item.id === current.id) : -1;
  const showPager = isLeaf && versions.length > 1 && versionIndex !== -1;
  // path 里每个节点都带着自己的 summaryText，不用额外查库就能知道有没有待总结的批次。
  const summaryPending = useMemo(() => Boolean(findPendingSummaryBatch(path)), [path]);

  // 换了当前节点，就重新读一遍它的版本和后续。
  useEffect(() => {
    if (!current) {
      setVersions([]);
      setExplored(new Set());
      return undefined;
    }

    let alive = true;

    const loadAround = async () => {
      try {
        const [children, leafVersions] = await Promise.all([
          listChildren(saveId, current.id),
          listLeafVersions(current),
        ]);

        if (!alive) return;

        setExplored(new Set(children.map((child) => child.actionKey)));
        setVersions(leafVersions);
      } catch (loadError) {
        console.warn('[Fiction] 读取版本失败：', loadError);
      }
    };

    void loadAround();

    return () => {
      alive = false;
    };
  }, [saveId, current?.id]);

  // 新一段出现（或重新生成覆盖了内容）时，滚到这一段的开头。
  useEffect(() => {
    if (!loaded || !current) return;

    const section = sectionRefs.current.get(current.id);
    const box = scrollRef.current;

    if (!section || !box) return;

    box.scrollTo({
      top: Math.max(0, section.offsetTop - 12),
      behavior: scrolledOnceRef.current ? 'smooth' : 'auto',
    });
    scrolledOnceRef.current = true;
  }, [loaded, current?.id, current?.text]);

  // ---------- 生成 ----------

  // 统一的执行入口：同一时间只跑一个任务；取消不算错误；失败时记下「重试」要做什么。
  const execute = async (kind, task, onDone, retry) => {
    if (busyRef.current) return;

    const controller = new AbortController();

    busyRef.current = kind;
    abortRef.current = controller;
    setBusy(kind);
    setError(null);

    try {
      const { node } = await task(controller.signal);

      if (mountedRef.current) onDone(node);
    } catch (taskError) {
      if (!mountedRef.current || taskError?.code === FICTION_ERROR.ABORTED) return;

      console.warn('[Fiction] 生成失败：', taskError);
      setError({ message: taskError?.message || '生成失败，请再试一次。', retry });
    } finally {
      busyRef.current = null;
      abortRef.current = null;
      if (mountedRef.current) setBusy(null);
    }
  };

  const startOpening = () => execute(
    'opening',
    (signal) => generateOpening(saveId, { signal }),
    (node) => setPath([node]),
    startOpening,
  );

  const takeAction = (action) => {
    if (!current) return;

    const parentId = current.id;

    execute(
      'next',
      (signal) => generateNext(saveId, parentId, action, { signal }),
      (node) => {
        setPath((previous) => [...previous, node]);
        if (action.type === ACTION_TYPES.FREE) setFreeText('');
      },
      () => takeAction(action),
    );
  };

  // 重 roll：写出一个新版本并切过去，旧版本还在，用「‹ 2/3 ›」切回。
  const handleRegenerate = () => {
    if (!current || !isLeaf) return;

    const targetId = current.id;

    execute(
      'regen',
      (signal) => rerollNode(saveId, targetId, { signal }),
      (node) => setPath((previous) => [...previous.slice(0, -1), node]),
      handleRegenerate,
    );
  };

  // 切到上一个 / 下一个版本。只是读写数据库，不调用 AI。
  const handleSwitchVersion = async (step) => {
    if (busyRef.current || !current) return;

    const target = versions[versionIndex + step];

    if (!target) return;

    try {
      await setCurrentNode(saveId, target.id);

      if (mountedRef.current) {
        setPath((previous) => [...previous.slice(0, -1), target]);
        setError(null);
      }
    } catch (switchError) {
      console.warn('[Fiction] 切换版本失败：', switchError);
      if (mountedRef.current) setError({ message: '切换版本失败，请再试一次。', retry: null });
    }
  };

  // 另开分支 / 回到某一段：把当前位置挪到那个节点，回到游玩页。
  // 数值不用额外处理，每个节点自己存着数值快照。
  const jumpTo = async (nodeId) => {
    if (busyRef.current) return;

    try {
      await setCurrentNode(saveId, nodeId);

      const nodes = await getPathToNode(nodeId);

      if (!mountedRef.current) return;

      setPath(nodes);
      setError(null);
      setFreeText('');
    } catch (jumpError) {
      console.warn('[Fiction] 跳转失败：', jumpError);
      if (mountedRef.current) setError({ message: '跳转失败，请再试一次。', retry: null });
    } finally {
      if (mountedRef.current) {
        setStorylineOpen(false);
        setReveal(null);
      }
    }
  };

  // 手动编辑完成：用写库后返回的节点替换界面里同 id 的旧节点，不重新生成、不动其他段。
  const handleTextSaved = (updatedNode) => {
    setPath((previous) => previous.map((item) => (item.id === updatedNode.id ? updatedNode : item)));
    setEditing(null);
  };

  const closeOverlays = () => {
    setStorylineOpen(false);
    setReveal(null);
  };

  const handleCancel = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  const handleSendFree = () => {
    const text = freeText.trim();

    if (!text || busyRef.current) return;

    takeAction({ type: ACTION_TYPES.FREE, text });
  };

  const handleFreeKeyDown = (event) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSendFree();
    }
  };

  const handleBack = () => {
    if (abortRef.current) abortRef.current.abort();

    onExitRef.current?.();
  };

  // ---------- 渲染片段 ----------

  const renderStats = () => (
    <div className="fic-p-stats" aria-label="当前数值">
      {stats.map((stat) => {
        const value = snapshot[stat.id] !== undefined ? snapshot[stat.id] : stat.initial;

        return (
          <div key={stat.id} className="fic-p-stat">
            <span className="fic-p-stat-name">{stat.name}</span>
            <span className="fic-p-stat-value">{value}</span>
            <span className="fic-p-stat-bar" aria-hidden="true">
              <span style={{ width: `${statPercent(stat, value)}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderIntro = () => (
    <div className="fic-p-intro">
      <div className="fic-p-eyebrow">Prologue</div>
      <h2 className="fic-p-intro-title">{save.title}</h2>
      <p className="fic-p-intro-bg">
        {save.background.length > BACKGROUND_PREVIEW_MAX
          ? `${save.background.slice(0, BACKGROUND_PREVIEW_MAX)}…`
          : save.background}
      </p>
      <div className="fic-p-intro-tags">
        <span className="fic-tag">每段不少于 {save.wordMin} 字</span>
        <span className="fic-tag">每次至少 {save.optionMin} 个选项</span>
        {stats.length > 0 && <span className="fic-tag">{stats.length} 项数值</span>}
      </div>
    </div>
  );

  const renderSegments = () => path.map((node, index) => {
    const note = describeUserAction(node.userAction);
    const isLast = index === path.length - 1;

    return (
      <section
        key={node.id}
        ref={(element) => {
          if (element) sectionRefs.current.set(node.id, element);
          else sectionRefs.current.delete(node.id);
        }}
        className={`fic-p-seg ${isLast && busy === 'regen' ? 'is-dim' : ''}`}
      >
        <button
          type="button"
          className="fic-btn-reset fic-p-seg-head is-link"
          aria-label={`回看第 ${index + 1} 段`}
          onClick={() => setReveal({
            nodeId: node.id,
            chosenChildId: path[index + 1]?.id ?? null,
            number: index + 1,
          })}
        >
          <span className="fic-p-seg-no">第 {index + 1} 段</span>
          <span className="fic-p-seg-line" />
          <span className="fic-p-seg-peek">回看</span>
        </button>
        {note &&<div className="fic-p-act">{note}</div>}
        {splitParagraphs(node.text).map((paragraph, paragraphIndex) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={paragraphIndex} className="fic-p-para">{paragraph}</p>
        ))}
        {!busy && (
          <div className="fic-p-seg-foot">
            <button
              type="button"
              className="fic-btn-reset fic-p-edit-link"
              aria-label={`编辑第 ${index + 1} 段的文字`}
              onClick={() => setEditing({ nodeId: node.id, number: index + 1 })}
            >
              编辑这一段
            </button>
          </div>
        )}
      </section>
    );
  });

  const renderPending = () => (
    <section className="fic-p-seg is-pending" aria-live="polite">
      <div className="fic-p-seg-head">
        <span className="fic-p-seg-no">第 {path.length + 1} 段</span>
        <span className="fic-p-seg-line" />
      </div>
      <p className="fic-p-pending-text">正在写这一段<GeneratingDots /></p>
    </section>
  );

  const renderError = () => error && (
    <div className="fic-p-error" role="alert">
      <p>{error.message}</p>
      {error.retry && (
        <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={error.retry}>
          重试
        </button>
      )}
    </div>
  );

  const renderOptionList = () => (
    <div className="fic-p-options">
      {options.map((option) => {
        const pills = save.showDeltas
          ? stats
            .filter((stat) => option.deltas && option.deltas[stat.id])
            .map((stat) => `${stat.name} ${formatDelta(option.deltas[stat.id])}`)
          : [];

        return (
          <button
            key={option.key}
            type="button"
            className="fic-btn-reset fic-p-option"
            disabled={Boolean(busy)}
            onClick={() => takeAction({ type: ACTION_TYPES.OPTION, optionKey: option.key })}
          >
            <span className="fic-p-option-key">{option.key}</span>
            <span className="fic-p-option-body">
              <span className="fic-p-option-text">{option.text}</span>
              {explored.has(`opt:${option.key}`) && (
                <span className="fic-p-seen">走过 · 点一下回到那一段</span>
              )}
              {pills.length > 0 && (
                <span className="fic-p-pills">
                  {pills.map((pill) => <span key={pill} className="fic-p-pill">{pill}</span>)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderSheetBody = () => {
    if (generating) {
      return (
        <div className="fic-p-gen" role="status" aria-live="polite">
          <div className="fic-p-gen-text">正在生成中<GeneratingDots /></div>
          <div className="fic-p-gen-hint">每段要写上千字，请稍等一会儿</div>
          <button type="button" className="fic-btn-reset fic-p-link" onClick={handleCancel}>
            取消
          </button>
        </div>
      );
    }

    if (busy === 'regen') {
      return (
        <div className="fic-p-gen" role="status" aria-live="polite">
          <div className="fic-p-gen-text">正在重新生成这一段<GeneratingDots /></div>
          <button type="button" className="fic-btn-reset fic-p-link" onClick={handleCancel}>
            取消
          </button>
        </div>
      );
    }

    return (
      <>
        {renderError()}
        {noOptions && isLeaf && (
          <div className="fic-p-note">
            <span>选项没生成出来，可以重新生成。</span>
            <button type="button" className="fic-btn-reset fic-p-link" onClick={handleRegenerate}>
              重新生成
            </button>
          </div>
        )}
        {truncated && isLeaf && (
          <div className="fic-p-note">
            <span>这一段可能被截断了（输出长度不够）。</span>
            <button type="button" className="fic-btn-reset fic-p-link" onClick={handleRegenerate}>
              重新生成
            </button>
          </div>
        )}
        {options.length > 0 && renderOptionList()}
      </>
    );
  };

  const renderSheet = () => {
    if (!current) {
      return (
        <div className="fic-p-sheet is-start">
          {renderError()}
          <button
            type="button"
            className="fic-btn-reset fic-p-start"
            disabled={Boolean(busy)}
            onClick={startOpening}
          >
            {busy === 'opening' ? <>正在生成开场<GeneratingDots /></> : '开始故事'}
          </button>
          {busy === 'opening' && (
            <button type="button" className="fic-btn-reset fic-p-link is-center" onClick={handleCancel}>
              取消
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="fic-p-sheet">
        <div className="fic-p-sheet-grab" />
        <div className="fic-p-sheet-head">
          <span className="fic-p-sheet-title">Your move</span>
          <div className="fic-p-sheet-tools">
            {showPager && (
              <div className="fic-p-pager" role="group" aria-label="切换版本">
                <button
                  type="button"
                  className="fic-btn-reset fic-p-pager-btn"
                  aria-label="上一个版本"
                  disabled={Boolean(busy) || versionIndex <= 0}
                  onClick={() => handleSwitchVersion(-1)}
                >
                  <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <span className="fic-p-pager-count">{versionIndex + 1} / {versions.length}</span>
                <button
                  type="button"
                  className="fic-btn-reset fic-p-pager-btn"
                  aria-label="下一个版本"
                  disabled={Boolean(busy) || versionIndex >= versions.length - 1}
                  onClick={() => handleSwitchVersion(1)}
                >
                  <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            )}
            <button
              type="button"
              className="fic-btn-reset fic-p-icon-btn"
              aria-label="重新生成这一段（旧版本会保留）"
              disabled={Boolean(busy) || !isLeaf}
              onClick={handleRegenerate}
            >
              <RotateCcw size={19} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="fic-p-sheet-body">{renderSheetBody()}</div>

        {save.allowFreeInput && (
          <div className="fic-p-free">
            <input
              type="text"
              className="fic-p-free-input"
              value={freeText}
              maxLength={FREE_TEXT_MAX}
              placeholder="或者，写下你自己的行动……"
              enterKeyHint="send"
              disabled={Boolean(busy)}
              aria-label="自由输入你的行动"
              onChange={(event) => setFreeText(event.target.value)}
              onKeyDown={handleFreeKeyDown}
            />
            <button
              type="button"
              className="fic-btn-reset fic-p-send"
              aria-label="发送"
              disabled={Boolean(busy) || !freeText.trim()}
              onClick={handleSendFree}
            >
              <ArrowRight size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---------- 页面 ----------

  return (
    <div className="fic-col fic-p-col">
      <button
        type="button"
        className="fic-btn-reset fic-round-btn fic-back"
        aria-label="返回书架"
        onClick={handleBack}
      >
        <ArrowLeft size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>

      {loaded && save && onEditSettings && (
        <button
          type="button"
          className="fic-btn-reset fic-round-btn fic-p-settings-btn"
          aria-label="编辑设定"
          disabled={Boolean(busy)}
          onClick={() => {
            if (abortRef.current) abortRef.current.abort();
            onEditSettings(saveId);
          }}
        >
          <Settings2 size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      )}

      {loaded && save && current && (
        <button
          type="button"
          className="fic-btn-reset fic-round-btn fic-p-branch-btn"
          aria-label="故事线"
          disabled={Boolean(busy)}
          onClick={() => setStorylineOpen(true)}
        >
          <GitBranch size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      )}

      {loaded && save && current && (
        <button
          type="button"
          className="fic-btn-reset fic-round-btn fic-p-summary-btn"
          aria-label={summaryPending ? '总结（有待总结的内容）' : '总结'}
          disabled={Boolean(busy)}
          onClick={() => setSummaryOpen(true)}
        >
          <NotebookText size={18} strokeWidth={1.6} aria-hidden="true" />
          {summaryPending && <span className="fic-p-summary-dot" aria-hidden="true" />}
        </button>
      )}

      {loaded && save && (
        <>
          <div className="fic-p-top">
            <div className="fic-p-title">{save.title}</div>
            <div className="fic-p-sub">选择式</div>
          </div>

          {showStats && renderStats()}

          <div className="fic-p-scroll" ref={scrollRef}>
            {current ? renderSegments() : renderIntro()}
            {generating && current && renderPending()}
          </div>

          {renderSheet()}
        </>
      )}

      {storylineOpen && save && current && (
        <FictionStoryline
          save={save}
          currentNodeId={current.id}
          onClose={() => setStorylineOpen(false)}
          onJump={jumpTo}
          onReveal={setReveal}
        />
      )}

      {reveal && save && (
        <FictionReveal
          save={save}
          nodeId={reveal.nodeId}
          chosenChildId={reveal.chosenChildId}
          number={reveal.number}
          busy={busy}
          onClose={() => setReveal(null)}
          onReturn={closeOverlays}
          onBranch={jumpTo}
        />
      )}

      {summaryOpen && save && (
        <FictionSummaryOverview
          save={save}
          onClose={() => setSummaryOpen(false)}
        />
      )}

      {editing && save && (() => {
        const target = path.find((item) => item.id === editing.nodeId);

        return target ? (
          <FictionTextEditor
            node={target}
            number={editing.number}
            onClose={() => setEditing(null)}
            onSaved={handleTextSaved}
          />
        ) : null;
      })()}
    </div>
  );
};

export default FictionPlayRoom;
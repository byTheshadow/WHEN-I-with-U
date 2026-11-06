// src/apps/badges/BadgeDancingLineBoard.jsx
//
// "本月限定" tab 主视图：赛季场景（10 月万圣节浮岛 / 11 月秋收到长夜小路，
// 按 seasonDef.sceneKind 选择）+ 节点快捷条 + 条件详情 + 图标网格。
//
// 逻辑改动摘要（相比旧版）：
//   - 引入 HalloweenScene（全场景 SVG）替代原来的平面路径 + 散件 Marks
//   - 新增 selectedNodeIdx state，控制灵魂方块位置 & 高亮详情卡
//   - 把条件列表精简成"节点快捷条 + 详情卡"两层，不再用 <ul> 罗列
//   - 图标网格保持不变（badge-tile / badge-tile--locked 等类名不动）

import React, { useLayoutEffect, useRef, useState } from 'react';

import { HalloweenScene, NodeIcon, TRACK_H, TRACK_W } from './badgeDancingLineArt';
import {
  NovemberScene,
  NovemberNodeIcon,
  NOVEMBER_NODE_TYPES,
  NOVEMBER_SCENE_HEIGHT,
} from './NovemberScene';

/* ─────────────────────────────────────────────
   常量
───────────────────────────────────────────── */
const EFFECTS_KEY = 'badge-dancingline-effects';

const CONDITION_TYPES = ['pumpkin', 'tomb', 'crystal'];  // 对应 NodeIcon 的 type

/* 各赛季场景的终点文案（按 seasonDef.sceneKind 取，缺省按万圣节） */
const SCENE_COPY = {
  halloween: {
    vaultShort: '终点宝箱',
    vaultTitle: '终点宝箱',
    vaultDesc: '三个节点全部点亮，宝箱就会打开，整套图标一次性全部解锁，随时切换佩戴。',
    vaultOn: '宝箱已开',
    vaultOff: '尚未开启',
    chipOn: '已开启',
    chipOff: '未开启',
    hintLocked: '沿着这条路，三个节点都点亮，终点的宝箱才会开。点击节点可以查看详情。',
    hintUnlocked: '整套图标已经解锁，藏宝箱已经打开。',
  },
  november: {
    vaultShort: '圭表观星台',
    vaultTitle: '圭表观星台',
    vaultDesc: '前三处地标全部点亮，观星台就会亮起，整套图标一次性全部解锁，随时切换佩戴。',
    vaultOn: '观星台已亮',
    vaultOff: '尚未点亮',
    chipOn: '已点亮',
    chipOff: '未点亮',
    hintLocked: '沿着小路，前三处地标都点亮，终点的观星台才会亮起。点击地标可以查看详情。',
    hintUnlocked: '整套图标已经解锁，观星台已经亮起。',
  },
};

/* effects 偏好读取（localStorage + prefers-reduced-motion） */
const readEffectsPreference = () => {
  try {
    const saved = window.localStorage.getItem(EFFECTS_KEY);
    if (saved === 'off') return false;
    if (saved === 'on') return true;
  } catch {
    // 读不到
  }
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};

/* ─────────────────────────────────────────────
   Hook：响应式缩放（同 Almanac 的 useStageScale）
───────────────────────────────────────────── */
const useStageScale = (ref) => {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () =>
      setScale(Math.min(1, Math.max(0.56, el.clientWidth / TRACK_W)));

    update();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return scale;
};

/* ─────────────────────────────────────────────
   BadgeDancingLineBoard
   Props（与 BadgeExchangeApp 保持一致，不改外部接口）：
     board             { seasons, equippedBadgeId }
     activeSeasonKey   string
     equipError        string
     onEquip           (badgeId) => void
───────────────────────────────────────────── */
export const BadgeDancingLineBoard = ({ board, activeSeasonKey, equipError, onEquip }) => {
  const [effects, setEffects] = useState(readEffectsPreference);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState(0);
  const outerRef = useRef(null);
  const scale = useStageScale(outerRef);

  const season = board.seasons.find((item) => item.seasonKey === activeSeasonKey);
  if (!season) return null;

  const { seasonDef, unlocked, aiCondition, characterWantedBadgeId, conditionResults = {} } = season;

  /* lit[0-2]：三个条件；lit[3]：宝箱（全部点亮才开） */
  const condMet = seasonDef.conditions.map(
    (c) => Boolean(conditionResults[c.id])
  );
  const allMet = unlocked || condMet.every(Boolean);
  const lit = [...condMet, allMet];

  const toggleEffects = () => {
    const next = !effects;
    setEffects(next);
    try {
      window.localStorage.setItem(EFFECTS_KEY, next ? 'on' : 'off');
    } catch {
      // 存不了也没关系
    }
  };

  /* ── 节点元数据 ── */
  const isNovember = seasonDef.sceneKind === 'november';
  const copy = isNovember ? SCENE_COPY.november : SCENE_COPY.halloween;
  const nodeTypes = isNovember ? NOVEMBER_NODE_TYPES : CONDITION_TYPES;
  const vaultKey = isNovember ? 'gnomon' : 'vault';
  const NodeIconComp = isNovember ? NovemberNodeIcon : NodeIcon;

  // 四个节点的文案；前三个来自 seasonDef.conditions，第四个固定
  const nodeData = [
    ...seasonDef.conditions.map((c, i) => ({
      key: nodeTypes[i] || nodeTypes[nodeTypes.length - 1],
      short: c.title,
      title: c.title,
      desc: c.kind === 'ai'
        ? (aiCondition?.description || aiCondition?.title || '正在等待 TA 想一个要求…')
        : c.description,
      note: c.kind === 'ai' ? '这个要求是 TA 在本月第一次打开时自己想的。' : null,
      progress: c.type === 'messages_total'
        ? { max: c.threshold, now: conditionResults[`__progress_${c.id}`] ?? null }
        : null,
      lit: condMet[i],
    })),
    {
      key: vaultKey,
      short: copy.vaultShort,
      title: copy.vaultTitle,
      desc: copy.vaultDesc,
      note: null,
      progress: null,
      lit: allMet,
    },
  ];

  const selNode = nodeData[selectedNodeIdx];

  return (
    <section className="badge-season badge-season--current">
      {/* ── 卡头 ── */}
      <div
        className={`bdl-scene-wrap${isNovember ? ' bdl-scene-wrap--november' : ''}`}
        ref={outerRef}
        style={{ height: isNovember ? NOVEMBER_SCENE_HEIGHT : TRACK_H * scale }}
      >
        {/* HUD 标题（叠在场景左上角） */}
        <div className="bdl-hud-title" aria-hidden="true">
          <small className="bdl-hud-eyebrow">{seasonDef.sceneEyebrow || ''}</small>
          <h3 className="bdl-hud-h3">{seasonDef.seasonTitle}</h3>
        </div>
        {/* 进度点（左下角） */}
        <div className="bdl-hud-pill" aria-hidden="true">
          <span className="bdl-dots">
            {condMet.map((m, i) => (
              <i key={i} className={m ? 'bdl-dot bdl-dot--on' : 'bdl-dot'} />
            ))}
          </span>
          <span>{condMet.filter(Boolean).length} / {condMet.length} 已点亮</span>
        </div>
        {/* 光效切换（右下角） */}
        <button
          type="button"
          className="bdl-fx-btn"
          onClick={toggleEffects}
          aria-pressed={effects}
        >
          {effects ? '关闭光效' : '开启光效'}
        </button>

        {/* 场景：十一月用自己的整幅场景，其余赛季沿用万圣节浮岛 */}
        {isNovember ? (
          <NovemberScene
            lit={lit}
            selectedIdx={selectedNodeIdx}
            fxEnabled={effects}
            onNodeClick={setSelectedNodeIdx}
          />
        ) : (
          <div
            className="bdl-stage"
            style={{
              width: TRACK_W,
              height: TRACK_H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <HalloweenScene
              lit={lit}
              selectedIdx={selectedNodeIdx}
              fxEnabled={effects}
              onNodeClick={setSelectedNodeIdx}
            />
          </div>
        )}
      </div>

      {/* ── 节点快捷条（chips）── */}
      <div className="bdl-body">
        <p className="bdl-hint">
          {unlocked ? copy.hintUnlocked : copy.hintLocked}
        </p>

        <div className="bdl-chips">
          {nodeData.map((n, i) => (
            <button
              key={n.key}
              type="button"
              className={`bdl-chip ${n.lit ? 'bdl-chip--on' : ''}`}
              aria-pressed={selectedNodeIdx === i}
              onClick={() => setSelectedNodeIdx(i)}
            >
              <span className="bdl-chip-ico">
                <NodeIconComp type={n.key} on={n.lit} size={22} />
              </span>
              <span className="bdl-chip-text">
                <b>{n.short}</b>
                <span>
                  {i === 3
                    ? (n.lit ? copy.chipOn : copy.chipOff)
                    : (n.lit ? '已点亮' : '未点亮')}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* ── 详情卡 ── */}
        <div
          className={`bdl-detail ${selNode.lit ? 'bdl-detail--on' : ''}`}
          key={selectedNodeIdx}
        >
          <span className="bdl-detail-icon">
            <NodeIconComp type={selNode.key} on={selNode.lit} size={28} />
          </span>
          <div className="bdl-detail-body">
            <h4>{selNode.title}</h4>
            <span className={`bdl-tag ${selNode.lit ? 'bdl-tag--on' : ''}`}>
              {selectedNodeIdx === 3
                ? (selNode.lit ? copy.vaultOn : copy.vaultOff)
                : (selNode.lit ? '已点亮' : '未点亮')}
            </span>
            <p>{selNode.desc}</p>
            {selNode.note && <p className="bdl-detail-note">{selNode.note}</p>}

            {/* 消息进度条 */}
            {selNode.progress && selNode.progress.now !== null && !selNode.lit && (
              <div className="bdl-prog">
                <div className="bdl-prog-track">
                  <div
                    className="bdl-prog-fill"
                    style={{ width: `${Math.min(100, Math.round(selNode.progress.now / selNode.progress.max * 100))}%` }}
                  />
                </div>
                <small>
                  {selNode.progress.now} / {selNode.progress.max} 条
                  （{Math.round(selNode.progress.now / selNode.progress.max * 100)}%）
                </small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 图标区 ── */}
      <div className="bdl-badge-section">
        <div className="bdl-sec-head">
          <h4>本月图标</h4>
          <small>{seasonDef.badges.length} 枚</small>
          {unlocked && (
            <span className="bdl-tag bdl-tag--on" style={{ marginLeft: 'auto' }}>
              已解锁
            </span>
          )}
        </div>

        {board.equippedBadgeId && (() => {
          const equippedBadge = seasonDef.badges.find((b) => b.id === board.equippedBadgeId);
          if (!equippedBadge) return null;
          return (
            <div className="bdl-equip-bar">
              <span className="bdl-equip-thumb">
                <img src={equippedBadge.imageUrl} alt={equippedBadge.title} loading="lazy" />
              </span>
              <span>
                佩戴中：<b>{equippedBadge.title}</b>
              </span>
              <button
                type="button"
                onClick={() => onEquip(board.equippedBadgeId)}
                style={{ marginLeft: 'auto' }}
              >
                取下
              </button>
            </div>
          );
        })()}

        {equipError && <p className="badge-equip-error">{equipError}</p>}

        <div className="badge-grid">
          {seasonDef.badges.map((badge) => {
            const isEquipped = board.equippedBadgeId === badge.id;
            const isWanted = characterWantedBadgeId === badge.id;
            const isLocked = !unlocked;

            return (
              <button
                type="button"
                key={badge.id}
                className={[
                  'badge-tile',
                  isLocked ? 'badge-tile--locked' : '',
                  isEquipped ? 'badge-tile--equipped' : '',
                ].join(' ').trim()}
                onClick={() => !isLocked && onEquip(badge.id)}
                disabled={isLocked}
                title={badge.description}
              >
                {isWanted && <span className="badge-tile-wanted">TA 想要</span>}
                <span className="badge-tile-image-wrap">
                  <img src={badge.imageUrl} alt={badge.title} loading="lazy" />
                </span>
                <span className="badge-tile-title">{badge.title}</span>
                {isEquipped && <span className="badge-tile-equipped-tag">佩戴中</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BadgeDancingLineBoard;
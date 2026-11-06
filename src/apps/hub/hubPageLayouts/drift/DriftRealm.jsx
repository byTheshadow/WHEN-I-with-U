// src/apps/hub/hubPageLayouts/drift/DriftRealm.jsx
//
// 「漂流星群」里的应用区：顶部一排 6 个星群选择球，中间是漂浮的应用气泡，
// 下面是「看一眼」卡片。交互：点气泡先选中并在卡片里看说明，再点一次（或点卡片
// 右边的箭头）才真正打开应用，避免在漂浮的气泡上误触。
//
// props：
//   realms      星群数组（见 driftData.js 的 buildDriftRealms）
//   stats       useHubAppStats 的三个数字，用来决定气泡上有没有小圆点
//   nameMode    应用名称显示模式（en / bilingual / korean）
//   motionOn    false 时没有涟漪和触感
//   onOpenApp   (appId) => void

import React, { useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getAppIcon } from '../../appIcons';
import { getAppSecondaryName } from '../../appRegistry';
import { hasAppBadgeDot } from '../shared/hubAppBadges';
import {
  DRIFT_STARS,
  DRIFT_TINT_CYCLE,
  getDriftAppNote,
  getDriftLayout,
} from './driftData';

const buzz = () => {
  try {
    if (navigator.vibrate) navigator.vibrate(8);
  } catch {
    // 不支持震动的设备直接忽略。
  }
};

// 点气泡时从点击处扩散的一圈涟漪，直接加在 DOM 上，动画结束后自己移除。
const spawnRipple = (button, event) => {
  const host = button.querySelector('.dr-fx');
  if (!host) return;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const fromPointer = event && event.detail;
  const x = fromPointer ? event.clientX : rect.left + rect.width / 2;
  const y = fromPointer ? event.clientY : rect.top + rect.height / 2;
  const ripple = document.createElement('span');
  ripple.className = 'dr-ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - rect.left - size / 2}px;top:${y - rect.top - size / 2}px`;
  host.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
};

export const DriftRealm = ({ realms, stats, nameMode, motionOn, onOpenApp }) => {
  const [realmIndex, setRealmIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const stageRef = useRef(null);

  const realm = realms[realmIndex] || realms[0];
  const apps = realm.apps;
  const layout = getDriftLayout(apps.length);
  const selectedApp = apps.find((app) => app.id === selectedId) || apps[0];
  const selectedIndex = Math.max(0, apps.indexOf(selectedApp));
  const peekTint = selectedIndex === 0 ? realm.tint : DRIFT_TINT_CYCLE[selectedIndex % DRIFT_TINT_CYCLE.length];
  const PeekIcon = selectedApp ? getAppIcon(selectedApp.icon) : null;
  const peekSecondary = selectedApp ? getAppSecondaryName(selectedApp, nameMode) : null;

  const handlePickRealm = (index) => {
    if (index === realmIndex) return;
    if (motionOn) buzz();
    setRealmIndex(index);
    setSelectedId(null);
  };

  const handleBubble = (app, event) => {
    if (motionOn) {
      spawnRipple(event.currentTarget, event);
      buzz();
    }
    if (selectedApp && app.id === selectedApp.id && selectedId === app.id) {
      onOpenApp(app.id);
    } else {
      setSelectedId(app.id);
    }
  };

  // 指针轻微视差：不同气泡深度不同。触屏不处理。
  const handleStageMove = (event) => {
    if (!motionOn || event.pointerType === 'touch') return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty('--dr-px', (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
    stage.style.setProperty('--dr-py', (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
  };

  const handleStageLeave = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty('--dr-px', 0);
    stage.style.setProperty('--dr-py', 0);
  };

  return (
    <section className="dr-realm" aria-label="应用入口">
      <div className="dr-realm-head">
        <h2 className="dr-realm-title">{realm.en}</h2>
        <span className="dr-realm-meta">{`${realm.zh} · ${apps.length} 个入口`}</span>
      </div>

      <div className="dr-picker" role="group" aria-label="切换分组">
        {realms.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className={`dr-pk${index === realmIndex ? ' on' : ''}`}
            aria-pressed={index === realmIndex}
            aria-label={entry.zh}
            onClick={() => handlePickRealm(index)}
          >
            <span className="dr-pk-orb" style={{ '--dr-bt': `var(${entry.tint})` }} />
            <span className="dr-pk-label">{entry.short}</span>
          </button>
        ))}
      </div>

      <div
        ref={stageRef}
        className="dr-stage"
        style={{ aspectRatio: `390 / ${layout.height}` }}
        onPointerMove={handleStageMove}
        onPointerLeave={handleStageLeave}
      >
        <div className="dr-orbit" aria-hidden="true" />
        {DRIFT_STARS.map((star, index) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="dr-star"
            aria-hidden="true"
            style={{ left: `${star[0]}%`, top: `${star[1]}%`, animationDelay: `-${(index * 0.9).toFixed(1)}s` }}
          />
        ))}
        {apps.map((app, index) => {
          const position = layout.positions[index];
          if (!position) return null;
          const Icon = getAppIcon(app.icon);
          const tint = index === 0 ? realm.tint : DRIFT_TINT_CYCLE[index % DRIFT_TINT_CYCLE.length];
          const secondary = getAppSecondaryName(app, nameMode);
          const isSelected = selectedApp && app.id === selectedApp.id;
          return (
            <div
              key={app.id}
              className="dr-item"
              style={{
                left: `${((position.x / 390) * 100).toFixed(2)}%`,
                top: `${((position.y / layout.height) * 100).toFixed(2)}%`,
                width: `${((position.s / 390) * 100).toFixed(2)}%`,
                '--i': index,
              }}
            >
              <div className="dr-par" style={{ '--dr-d': position.d }}>
                <div
                  className="dr-bob"
                  style={{
                    animationDuration: `${(5 + (index % 3) * 1.4).toFixed(1)}s`,
                    animationDelay: `-${(index * 0.9).toFixed(1)}s`,
                  }}
                >
                  <button
                    type="button"
                    className={`dr-bub${isSelected ? ' sel' : ''}`}
                    style={{ '--dr-bt': `var(${tint})` }}
                    aria-label={`${app.zh} ${app.en}`}
                    onClick={(event) => handleBubble(app, event)}
                  >
                    <span className="dr-fx" />
                    <Icon aria-hidden="true" strokeWidth={1.4} />
                    {hasAppBadgeDot(app, stats) && <span className="dr-badge" />}
                  </button>
                  <span className="dr-cap">
                    <b className="dr-cap-en">{app.en}</b>
                    {secondary && <i className="dr-cap-zh">{secondary}</i>}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedApp && (
        <div className="dr-peek" style={{ '--dr-bt': `var(${peekTint})` }}>
          <span className="dr-peek-ico">
            <PeekIcon width={24} height={24} strokeWidth={1.4} aria-hidden="true" />
          </span>
          <div className="dr-peek-body" key={selectedApp.id}>
            <div className="dr-peek-name">
              <span className="dr-peek-en">{selectedApp.en}</span>
              {peekSecondary && <span className="dr-peek-zh">{peekSecondary}</span>}
              {selectedApp.status === 'wip' && <span className="dr-chip">装修中</span>}
            </div>
            <span className="dr-peek-sub">{selectedApp.sub || '-'}</span>
            <span className="dr-peek-note">{getDriftAppNote(selectedApp)}</span>
          </div>
          <button
            type="button"
            className="dr-go"
            aria-label={`打开${selectedApp.zh}`}
            onClick={() => {
              if (motionOn) buzz();
              onOpenApp(selectedApp.id);
            }}
          >
            <ArrowUpRight width={18} height={18} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="dr-hint">轻触星球看一眼，再点一次或点箭头进入</p>
    </section>
  );
};

export default DriftRealm;

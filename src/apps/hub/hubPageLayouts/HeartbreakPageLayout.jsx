// src/apps/hub/hubPageLayouts/HeartbreakPageLayout.jsx
//
// 「心碎先生」整页版式（片 A）：拼贴海报 + 桌面窗口。
// 三屏：第一屏大字和消息窗口，第二屏匿名信箱和定时工作流窗口，第三屏
// 「SIDE B」和文件夹，点文件夹打开「全部应用」窗口（33 个入口，来自
// appRegistry）。底部是任务栏：开始键回到顶部，最小化的窗口会变成任务按钮。
//
// 本片里「真的能用」的：消息窗口（快速打开消息）、匿名信箱和定时工作流
// 窗口的数量与打开、全部应用窗口、名称显示模式、低功耗开关。播放器、
// 剪纸、键帽、文字贴纸都是装饰。工作流开关、播放器联动在后续片里做。
//
// 性能：字体只在这个版式挂载时才加载（离线自动回退系统字体）；视差只在
// 滚动时计算；低功耗模式或系统「减少动画」下视差、入场、光盘旋转全部关闭。
// 约定的 props 见 pageLayoutRegistry.js：{ onOpenApp, onOpenArchive }。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, FolderOpen, Play, Zap } from 'lucide-react';
import './heartbreak/heartbreak.css';
import HbWindow from './heartbreak/HbWindow';
import HbAppsWindow from './heartbreak/HbAppsWindow';
import {
  useHbParallax,
  useHbReveal,
  usePrefersReducedMotion,
} from './heartbreak/useHbMotion';
import { useHubLowPower, setHubLowPower } from '../useHubLowPower';
import { useHubAppStats } from '../useHubAppStats';
import { useAppNameDisplayMode } from '../useAppNameDisplayMode';
import { HUB_APPS } from '../appRegistry';

const FONT_LINK_ID = 'hb-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;800&family=Pirata+One&family=ZCOOL+QingKe+HuangYou&display=swap';

const WINDOW_TITLES = {
  messages: 'messages.exe',
  askbox: 'ask_box.exe',
  workflows: 'workflows.exe',
  apps: 'all_apps',
  readme: 'readme.txt',
};

const INITIAL_WINDOWS = {
  messages: { open: true, min: false },
  askbox: { open: true, min: false },
  workflows: { open: true, min: false },
  apps: { open: false, min: false },
  readme: { open: true, min: false },
};

const formatClock = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const useClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    const timer = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  return formatClock(now);
};

export const HeartbreakPageLayout = ({ onOpenApp }) => {
  const rootRef = useRef(null);
  const lowPower = useHubLowPower();
  const reducedMotion = usePrefersReducedMotion();
  const motionOn = !lowPower && !reducedMotion;
  const stats = useHubAppStats();
  const nameMode = useAppNameDisplayMode();
  const clock = useClock();

  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [order, setOrder] = useState(['readme', 'workflows', 'askbox', 'messages', 'apps']);

  // 字体：只在这个版式显示时才加；离开版式后移除。
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return undefined;
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  useHbParallax(rootRef, motionOn);
  useHbReveal(rootRef, motionOn);

  const focusWindow = useCallback((id) => {
    setOrder((prev) => (prev[prev.length - 1] === id ? prev : [...prev.filter((x) => x !== id), id]));
  }, []);

  const openWindow = useCallback(
    (id) => {
      setWindows((prev) => ({ ...prev, [id]: { open: true, min: false } }));
      focusWindow(id);
    },
    [focusWindow]
  );

  const minimizeWindow = useCallback((id) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], min: true } }));
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows((prev) => ({ ...prev, [id]: { open: false, min: false } }));
  }, []);

  const zOf = (id) => 3 + order.indexOf(id);
  const hiddenOf = (id) => !windows[id].open || windows[id].min;
  const minimized = Object.keys(windows).filter((id) => windows[id].open && windows[id].min);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: motionOn ? 'smooth' : 'auto' });
  };

  const appCount = HUB_APPS.length;

  return (
    <div
      ref={rootRef}
      className="hb-root"
      data-lp={lowPower ? 'on' : 'off'}
      data-motion={motionOn ? 'on' : 'off'}
    >
      {/* ---------- 第一屏 ---------- */}
      <div className="hb-spread">
        <div className="hb-brand hb-fade-up">
          <div className="hb-brand-mr">Mr.</div>
          <div className="hb-brand-mr" style={{ marginTop: '-0.1rem' }}>
            &ldquo;Broken Heart&rdquo;
          </div>
          <div className="hb-brand-zh">心碎先生!</div>
          <div className="hb-brand-sub">SIDE A / HOME SCREEN</div>
          <div style={{ marginTop: '0.7rem' }}>
            <button
              type="button"
              className="hb-chip"
              aria-pressed={lowPower}
              onClick={() => setHubLowPower(!lowPower)}
            >
              <Zap size={13} aria-hidden="true" />
              {lowPower ? '低功耗 开' : '低功耗 关'}
            </button>
          </div>
        </div>

        <div
          className="hb-deco hb-giant hb-giant-pop"
          data-depth="0.08"
          style={{ top: '9.5rem', left: '0.5rem', fontSize: '7.5rem' }}
          aria-hidden="true"
        >
          Heart
        </div>
        <div
          className="hb-deco hb-giant hb-giant-outline"
          data-depth="0.14"
          style={{ top: '16rem', right: '-0.5rem', fontSize: '7.5rem' }}
          aria-hidden="true"
        >
          Break
        </div>
        <div className="hb-deco hb-cd" data-depth="0.2" data-slide="0.05" style={{ top: '4.5rem', right: '1.2rem' }} aria-hidden="true" />
        <div className="hb-deco hb-star" data-depth="0.25" style={{ top: '8rem', right: '8.5rem' }} aria-hidden="true" />
        <div className="hb-deco hb-keycap" data-depth="0.18" style={{ top: '26rem', left: '0.8rem' }} aria-hidden="true">M</div>
        <div className="hb-deco hb-keycap" data-depth="0.12" style={{ top: '27.5rem', left: '3.6rem' }} aria-hidden="true">R</div>
        <div className="hb-deco hb-word" data-depth="0.1" style={{ top: '13.5rem', right: '1rem' }} aria-hidden="true">no signal / no sleep</div>

        <div style={{ position: 'relative', marginTop: '17.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <HbWindow
            id="messages"
            title={WINDOW_TITLES.messages}
            hidden={hiddenOf('messages')}
            zIndex={zOf('messages')}
            onFocus={focusWindow}
            onMinimize={minimizeWindow}
            onClose={closeWindow}
          >
            <div className="hb-player" style={{ marginBottom: '0.6rem' }} aria-hidden="true">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Play size={11} /> now playing (demo)
              </span>
              <div className="hb-player-bar" />
            </div>
            <button type="button" className="hb-open" onClick={() => onOpenApp('messages')}>
              <span>Continue the conversation</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
            <p className="hb-note">快速打开消息。</p>
          </HbWindow>
        </div>
      </div>

      {/* ---------- 第二屏 ---------- */}
      <div className="hb-spread">
        <div className="hb-deco hb-tag" data-depth="0.16" style={{ top: '1rem', right: '1.2rem' }} aria-hidden="true">
          MAIL / TASKS
        </div>
        <div className="hb-deco hb-cutout" data-depth="0.22" style={{ top: '2.4rem', left: '0.9rem' }} aria-hidden="true">
          PHOTO
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.4rem', alignItems: 'flex-start', paddingTop: '9rem' }}>
          <HbWindow
            id="askbox"
            title={WINDOW_TITLES.askbox}
            hidden={hiddenOf('askbox')}
            zIndex={zOf('askbox')}
            onFocus={focusWindow}
            onMinimize={minimizeWindow}
            onClose={closeWindow}
          >
            <div className="hb-count">{stats.askCount}</div>
            <p className="hb-note">条匿名问题等你回答</p>
            <button type="button" className="hb-open" style={{ marginTop: '0.6rem' }} onClick={() => onOpenApp('askbox')}>
              <span>Open Ask Box</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </HbWindow>

          <HbWindow
            id="workflows"
            title={WINDOW_TITLES.workflows}
            hidden={hiddenOf('workflows')}
            zIndex={zOf('workflows')}
            onFocus={focusWindow}
            onMinimize={minimizeWindow}
            onClose={closeWindow}
          >
            <div className="hb-count">{stats.activeWorkflowCount}</div>
            <p className="hb-note">个定时工作流正在运行</p>
            <button type="button" className="hb-open hb-open-plain" style={{ marginTop: '0.6rem' }} onClick={() => onOpenApp('workflows')}>
              <span>Open Workflows</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </HbWindow>
        </div>
      </div>

      {/* ---------- 第三屏 ---------- */}
      <div className="hb-spread">
        <div
          className="hb-deco hb-giant hb-giant-outline"
          data-depth="0.1"
          style={{ top: '1rem', left: '0.5rem', fontSize: '6.5rem' }}
          aria-hidden="true"
        >
          Side
        </div>
        <div
          className="hb-deco hb-giant hb-giant-pop"
          data-depth="0.16"
          style={{ top: '6.5rem', right: '0.5rem', fontSize: '6.5rem' }}
          aria-hidden="true"
        >
          B
        </div>
        <div className="hb-deco hb-tag hb-tag-plain" data-depth="0.2" style={{ top: '13rem', left: '1.2rem' }} aria-hidden="true">
          {appCount} 个入口
        </div>

        <div style={{ position: 'relative', paddingTop: '15.5rem', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
          <button type="button" className="hb-folder" onClick={() => openWindow('apps')}>
            <FolderOpen size={22} aria-hidden="true" />
            <span>
              All Apps
              <span className="hb-app-sub" style={{ display: 'block' }}>
                全部应用 / {appCount} 个入口
              </span>
            </span>
          </button>

          <HbWindow
            id="apps"
            title={WINDOW_TITLES.apps}
            hidden={hiddenOf('apps')}
            zIndex={zOf('apps')}
            onFocus={focusWindow}
            onMinimize={minimizeWindow}
            onClose={closeWindow}
          >
            <HbAppsWindow nameMode={nameMode} stats={stats} onOpenApp={onOpenApp} />
          </HbWindow>

          <HbWindow
            id="readme"
            title={WINDOW_TITLES.readme}
            hidden={hiddenOf('readme')}
            zIndex={zOf('readme')}
            onFocus={focusWindow}
            onMinimize={minimizeWindow}
            onClose={closeWindow}
          >
            <p className="hb-note" style={{ marginTop: 0 }}>
              这里是心碎先生的首页。窗口可以拖动、最小化和关闭，找不到的窗口去底部任务栏，
              或者点 All Apps 文件夹。手机发热卡顿时，点最上面的「低功耗」。
            </p>
          </HbWindow>
        </div>
      </div>

      {/* ---------- 任务栏 ---------- */}
      <nav className="hb-taskbar" aria-label="任务栏">
        <button type="button" className="hb-start" onClick={scrollToTop}>
          <Zap size={13} aria-hidden="true" /> START
        </button>
        <div className="hb-tasks">
          {minimized.map((id) => (
            <button key={id} type="button" className="hb-task" onClick={() => openWindow(id)}>
              {WINDOW_TITLES[id]}
            </button>
          ))}
        </div>
        <span className="hb-clock">{clock}</span>
      </nav>
    </div>
  );
};

export default HeartbreakPageLayout;
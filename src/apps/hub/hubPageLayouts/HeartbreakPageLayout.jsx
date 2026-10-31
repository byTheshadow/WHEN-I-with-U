// src/apps/hub/hubPageLayouts/HeartbreakPageLayout.jsx
//
// 「心碎先生」整页版式（片 A，统一风格后的 v6）：拼贴海报 + 桌面窗口，
// 视觉照 mr-heartbreak-home-preview_v6 移植（v5 的撞色改成每个主题一个低饱和
// 点缀色，标题和飘字统一用英文衬线，和站内「WHEN I with U.」同一种气质）。三屏：
//   A 正在放：HEART / BREAK 巨字、铬面光盘、播放器、键帽、抠图占位；
//   B 有人在找你：Messages 窗口、Ask Box 窗口、哥特体 heartbreak；
//   C 桌面：Workflows 窗口、骰子、All Apps 文件夹、SIDE B 巨字。
// 底部是 readme 窗口和任务栏（开始键回到顶部，最小化的窗口会变成任务按钮）。
//
// 「真的能用」的：Messages 快速打开（显示最近的聊天）、Ask Box 的真实数量、
// 最新问题和打开、Workflows 窗口里真实的工作流列表和开关（写 enabled，带
// 撤销提示）、全部应用窗口（33 个入口）、名称显示模式、低功耗开关；
// 播放器控制真实的静音保活（播放键、光盘转动、标签、计时随之变化）；
// 骰子随机换一款开机加载页；Habitats 卡片显示真实数量；「贴一个小组件」
// 打开添加面板，贴上的小组件显示在下方的小组件区。键帽、文字贴纸是装饰。
// 装饰文字（标签、飘字、感叹号牌、readme）和图片位（人物图、播放器封面）
// 可以由用户自己改：顶栏铅笔进入编辑模式，点虚线框修改，保存在
// db.settings（见 heartbreak/useHbCustom.js）。
//
// 性能：字体只在这个版式挂载时才加载（离线回退系统字体）；视差只在滚动时
// 计算；低功耗模式或系统「减少动画」下，视差、入场、光盘旋转、毛玻璃、发光
// 全部关闭。约定的 props 见 pageLayoutRegistry.js：{ onOpenApp, onOpenArchive }。

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Zap } from 'lucide-react';
import './heartbreak/heartbreak.css';
import HbWindow from './heartbreak/HbWindow';
import HbAppsWindow from './heartbreak/HbAppsWindow';
import HbWorkflowsWindow from './heartbreak/HbWorkflowsWindow';
import HbHabitatCard from './heartbreak/HbHabitatCard';
import HbElapsed from './heartbreak/HbElapsed';
import { HbWidgetModals, HbWidgetShelf } from './heartbreak/HbWidgets';
import HbCutout from './heartbreak/HbCutout';
import { HbText, HbImageSlot } from './heartbreak/HbEditable';
import HbEditLayer from './heartbreak/HbEditLayer';
import { HbCustomContext, useHbCustom } from './heartbreak/useHbCustom';
import {
  useHbParallax,
  useHbReveal,
  usePrefersReducedMotion,
} from './heartbreak/useHbMotion';
import { useHubLowPower, setHubLowPower } from '../useHubLowPower';
import { useHubAppStats } from '../useHubAppStats';
import { useHubWorkflows } from '../useHubWorkflows';
import { useKeepAliveAudio, useKeepAliveConfig } from '../useKeepAliveAudio';
import { useStartupAnimationChoice } from '../useStartupAnimationChoice';
import { useHubHomeWidgets } from '../useHubHomeWidgets';
import { addHomeWidget, removeHomeWidget, updateHomeWidgetConfig } from '../widgets/homeWidgetsStore';
import { useHubAskPreview, useHubLatestChat } from '../useHubPreviews';
import { useAppNameDisplayMode } from '../useAppNameDisplayMode';
import { HUB_APPS } from '../appRegistry';

const FONT_LINK_ID = 'hb-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap';

const WINDOW_META = {
  messages: { title: 'Messages', alt: '消息' },
  askbox: { title: 'Ask Box', alt: '匿名信箱' },
  workflows: { title: 'Workflows', alt: '定时工作流' },
  apps: { title: 'All Apps', alt: '全部应用' },
};

const INITIAL_WINDOWS = {
  messages: { open: true, min: false },
  askbox: { open: true, min: false },
  workflows: { open: true, min: false },
  apps: { open: false, min: false },
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

// 绝对定位的装饰块；data-depth 交给视差 hook（正数偏慢，负数偏快）。
// 编辑模式下里面有可点的东西，不能再对辅助技术隐藏。
// decor=false：里面有可操作的按钮（播放器、骰子、卡片……），不能对辅助技术隐藏。
const Para = ({ left, top, depth = 0, slide, z, className = '', style, decor = true, children }) => {
  const { editing } = useContext(HbCustomContext);
  return (
    <div
      className={`hb-para ${className}`}
      data-depth={depth}
      data-slide={slide}
      style={{ left, top, zIndex: z, ...style }}
      aria-hidden={decor && !editing ? 'true' : undefined}
    >
      {children}
    </div>
  );
};

// id 不为空的文字用户可以自己改；children 是默认文字。
const Editable = ({ id, label, maxLength, children }) =>
  id ? (
    <HbText id={id} fallback={children} label={label} maxLength={maxLength} />
  ) : (
    children
  );

const Word = ({ id, children, left, top, depth }) => (
  <Para className="hb-word" left={left} top={top} depth={depth}>
    <Editable id={id} label="飘字">{children}</Editable>
  </Para>
);

const Bang = ({ id, left, top, depth, z, children = '!!!' }) => (
  <Para className="hb-bang" left={left} top={top} depth={depth} z={z}>
    <Editable id={id} label="感叹号牌" maxLength={6}>{children}</Editable>
  </Para>
);

const Key = ({ letter, left, top, depth, rotate, index }) => (
  <Para left={left} top={top} depth={depth}>
    <div className="hb-key hb-pop" style={{ '--r': `${rotate}deg`, '--d': `${0.8 + index * 0.08}s` }}>
      <div className="cap">{letter}</div>
    </div>
  </Para>
);

const Giant = ({ text, left, top, depth, slide, line = false, size, startIndex = 0 }) => (
  <Para
    className={`hb-giant ${line ? 'hb-giant-line' : ''}`}
    left={left}
    top={top}
    depth={depth}
    slide={slide}
    style={size ? { fontSize: size } : undefined}
  >
    {[...text].map((char, index) => (
      <span key={index} className="hb-slam" style={{ '--i': startIndex + index }}>
        {char === ' ' ? ' ' : char}
      </span>
    ))}
  </Para>
);

const Tag = ({ id, children, left, top, rotate = -2 }) => (
  <span className="hb-tag hb-pop" style={{ left, top, '--r': `${rotate}deg`, '--d': '0.5s' }}>
    <Editable id={id} label="标签">{children}</Editable>
  </span>
);

const Chip = ({ id, letter, children, left, top }) => (
  <span className="hb-chip hb-pop" style={{ left, top, '--d': '0.3s' }}>
    <em>{letter}</em>
    <Editable id={id} label="分区名称">{children}</Editable>
  </span>
);

export const HeartbreakPageLayout = ({ onOpenApp }) => {
  const rootRef = useRef(null);
  const lowPower = useHubLowPower();
  const reducedMotion = usePrefersReducedMotion();
  const motionOn = !lowPower && !reducedMotion;
  const baseStats = useHubAppStats();
  const workflowState = useHubWorkflows();
  const latestChat = useHubLatestChat();
  const askPreview = useHubAskPreview();
  // 工作流的启用数量以列表为准（开关切换后马上变），其余数字仍用统计 hook。
  const stats = useMemo(
    () =>
      workflowState.ready
        ? { ...baseStats, activeWorkflowCount: workflowState.activeCount }
        : baseStats,
    [baseStats, workflowState.ready, workflowState.activeCount]
  );
  const nameMode = useAppNameDisplayMode();
  const clock = useClock();

  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [order, setOrder] = useState(['workflows', 'askbox', 'messages', 'apps']);

  // 编辑模式：用户自己改装饰文字和图片（顶栏铅笔）。
  const custom = useHbCustom();
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const customContext = useMemo(
    () => ({
      editing,
      texts: custom.texts,
      images: custom.images,
      requestEdit: setEditTarget,
    }),
    [editing, custom]
  );
  const toggleEditing = useCallback(() => {
    setEditing((prev) => !prev);
    setEditTarget(null);
  }, []);
  const closeEditTarget = useCallback(() => setEditTarget(null), []);

  // 播放器：真实的静音保活。标题、歌手优先用用户在编辑模式里改的，其次是
  // KeepAlivePlayer 保存的配置。
  const keepAliveConfig = useKeepAliveConfig();
  const playerTitle = custom.texts.plTitle || keepAliveConfig.title;
  const playerArtist = custom.texts.plArtist || keepAliveConfig.artist;
  const keepAlive = useKeepAliveAudio(
    useMemo(() => ({ title: playerTitle, artist: playerArtist }), [playerTitle, playerArtist])
  );

  // 骰子：随机换一款开机加载页。
  const { animation: startupAnimation, roll: rollStartup } = useStartupAnimationChoice();
  const [cubeTurn, setCubeTurn] = useState({ x: -22, y: 32 });
  const [diceBusy, setDiceBusy] = useState(false);
  const [diceNote, setDiceNote] = useState('');
  const handleRollDice = useCallback(async () => {
    if (diceBusy) return;
    setDiceBusy(true);
    if (motionOn) {
      setCubeTurn((prev) => ({
        x: prev.x + 360 + 90 * Math.floor(Math.random() * 4),
        y: prev.y + 360 + 90 * Math.floor(Math.random() * 4),
      }));
    }
    const next = await rollStartup();
    setDiceNote(next ? '' : '现在只有这一款可选');
    setDiceBusy(false);
  }, [diceBusy, motionOn, rollStartup]);

  // 小组件：和经典首页是同一批数据（db.homeWidgets）。
  const homeWidgets = useHubHomeWidgets();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const handleAddWidget = useCallback(async ({ type, config }) => {
    await addHomeWidget({ type, config });
    setAddWidgetOpen(false);
    setTimeout(() => {
      document.getElementById('hb-widget-shelf')?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 350);
  }, []);
  const handleSaveWidgetConfig = useCallback(async (widgetId, config) => {
    await updateHomeWidgetConfig(widgetId, config);
    setEditingWidget(null);
  }, []);

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

  // 顶栏贴顶后才显示底色：用一个 1px 的哨兵元素观察，直接改属性，不触发 React 渲染。
  const topbarRef = useRef(null);
  const sentinelRef = useRef(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const topbar = topbarRef.current;
    if (!sentinel || !topbar || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      topbar.dataset.stuck = !entry.isIntersecting && entry.boundingClientRect.top < 0 ? 'true' : 'false';
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
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
      // 打开后把窗口带到视野中间，免得用户还停在别的屏上找不到。
      requestAnimationFrame(() => {
        document
          .getElementById(`hb-${id}-win`)
          ?.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
    },
    [focusWindow]
  );

  const minimizeWindow = useCallback((id) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], min: true } }));
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows((prev) => ({ ...prev, [id]: { open: false, min: false } }));
  }, []);

  // 全部应用窗口盖在标签和装饰之上（标签 z 13），其余窗口在它们之下。
  const zOf = (id) => (id === 'apps' ? 20 : 8) + order.indexOf(id);
  const hiddenOf = (id) => !windows[id].open || windows[id].min;
  const minimized = Object.keys(windows).filter((id) => windows[id].open && windows[id].min);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: motionOn ? 'smooth' : 'auto' });
  };

  const windowProps = (id) => ({
    id,
    title: WINDOW_META[id].title,
    alt: WINDOW_META[id].alt,
    hidden: hiddenOf(id),
    zIndex: zOf(id),
    onFocus: focusWindow,
    onMinimize: minimizeWindow,
    onClose: id === 'apps' ? closeWindow : undefined,
  });

  const appCount = HUB_APPS.length;

  return (
    <HbCustomContext.Provider value={customContext}>
    <div
      ref={rootRef}
      className="hb-root"
      data-lp={lowPower ? 'on' : 'off'}
      data-motion={motionOn ? 'on' : 'off'}
      data-playing={keepAlive.isPlaying ? 'true' : 'false'}
    >
      <div className="hb-aura" aria-hidden="true">
        <i style={{ left: '-38%', top: '2%', width: 540, height: 540 }} />
        <i className="h2" style={{ left: '36%', top: '11%', width: 460, height: 460 }} />
        <i className="h3" style={{ left: '-24%', top: '25%', width: 500, height: 500 }} />
        <i style={{ left: '46%', top: '35%', width: 540, height: 540 }} />
        <i className="h2" style={{ left: '-34%', top: '47%', width: 520, height: 520 }} />
        <i className="h3" style={{ left: '42%', top: '58%', width: 470, height: 470 }} />
        <i style={{ left: '-28%', top: '70%', width: 540, height: 540 }} />
        <i className="h2" style={{ left: '38%', top: '83%', width: 500, height: 500 }} />
      </div>

      <div ref={sentinelRef} className="hb-topbar-sentinel" aria-hidden="true" />
      <header ref={topbarRef} className="hb-topbar" data-stuck="false">
        <div className="hb-logo">
          <i className="hb-logo-mark" aria-hidden="true" />
          <span>Mr. &ldquo;Broken Heart&rdquo;</span>
        </div>
        <div className="hb-tb">
          <button
            type="button"
            className="hb-ib"
            aria-label={editing ? '完成编辑' : '编辑装饰文字和图片'}
            aria-pressed={editing}
            onClick={toggleEditing}
          >
            <Pencil className="hb-i" />
          </button>
          <button
            type="button"
            className="hb-ib"
            aria-label={lowPower ? '关闭低功耗模式' : '开启低功耗模式'}
            aria-pressed={lowPower}
            onClick={() => setHubLowPower(!lowPower)}
          >
            <Zap className="hb-i" />
          </button>
        </div>
      </header>

      {/* ---------- A 正在放 ---------- */}
      <section className="hb-spread" style={{ height: 760 }}>
        <svg className="hb-crack" viewBox="0 0 390 34" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-4 17 L38 11 L58 23 L96 8 L132 26 L170 12 L204 28 L246 9 L282 24 L318 11 L352 21 L394 13" />
        </svg>
        <Chip id="chipA" letter="A" left="5%" top={18}>正在放</Chip>

        <Giant text="HEART" left="-3%" top={62} depth={0.1} slide={0.2} />
        <Giant text="BREAK" left="10%" top={196} depth={0.1} slide={-0.2} startIndex={5} />

        <Para left="26%" top={226} depth={-0.02}>
          <div className="hb-cd" />
        </Para>

        <Para left="6%" top={282} z={6} depth={0.02} decor={false}>
          <div className="hb-player hb-pop" style={{ '--d': '0.45s' }}>
            <div className="hb-pl-top">
              <div className="hb-pl-meta">
                <small>
                  <b>KeepAlive Player</b>
                  <HbText id="plArtist" fallback={keepAliveConfig.artist} maxLength={28} label="歌手" />
                </small>
                <span className="hb-pl-star">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2l2.6 6.6L21 9.3l-5 4.6 1.5 6.9L12 17.3 6.5 20.8 8 13.9 3 9.3l6.4-.7z" />
                  </svg>
                </span>
              </div>
              <div className="hb-pl-art">
                <HbImageSlot
                  id="cover"
                  label="播放器封面"
                  imgClassName="hb-cover-img"
                  fallbackSrc={keepAliveConfig.companionAvatar || ''}
                >
                  <span className="hb-ph-tag">封面 1:1</span>
                </HbImageSlot>
              </div>
            </div>
            <span className="hb-pl-chip">{keepAlive.isPlaying ? '正在放' : '暂停中'}</span>
            <div className="hb-pl-panel">
              <div className="hb-pl-title">
                <HbText id="plTitle" fallback={keepAliveConfig.title} maxLength={28} label="曲名" />
              </div>
              <div className="hb-pl-prog">
                <HbElapsed since={keepAlive.startedAt} />
                <div className="hb-pl-track" />
                <span aria-hidden="true">&infin;</span>
              </div>
            </div>
            <div className="hb-pl-ctrl">
              <span className="dim" aria-hidden="true">
                <svg className="hb-i" viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" x2="5" y1="19" y2="5" /></svg>
              </span>
              <button
                type="button"
                className="play"
                aria-label={keepAlive.isPlaying ? '暂停静音保活' : '开始静音保活'}
                aria-pressed={keepAlive.isPlaying}
                onClick={keepAlive.toggle}
              >
                {keepAlive.isPlaying ? (
                  <svg className="hb-i" viewBox="0 0 24 24"><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" /><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" /></svg>
                ) : (
                  <svg className="hb-i" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" /></svg>
                )}
              </button>
              <span className="dim" aria-hidden="true">
                <svg className="hb-i" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" /></svg>
              </span>
            </div>
          </div>
        </Para>

        <Para left="72%" top={226} depth={-0.16} className="hb-star">
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id="hb-chromeG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--bg-main)' }} />
                <stop offset=".3" style={{ stopColor: 'var(--text-muted)' }} />
                <stop offset=".5" style={{ stopColor: 'var(--bg-main)' }} />
                <stop offset=".72" style={{ stopColor: 'var(--text-sub)' }} />
                <stop offset="1" style={{ stopColor: 'var(--bg-surface-strong)' }} />
              </linearGradient>
            </defs>
            <path d="M50 0 C54 34,66 46,100 50 C66 54,54 66,50 100 C46 66,34 54,0 50 C34 46,46 34,50 0Z" fill="url(#hb-chromeG)" style={{ stroke: 'var(--text-muted)' }} strokeWidth=".8" />
            <path d="M50 22 C52 42,58 48,78 50 C58 52,52 58,50 78 C48 58,42 52,22 50 C42 48,48 42,50 22Z" fill="url(#hb-chromeG)" transform="rotate(45 50 50)" style={{ stroke: 'var(--text-muted)' }} strokeWidth=".6" />
          </svg>
        </Para>

        <Para left="58%" top={502} z={7} depth={-0.08} style={{ width: 160, height: 214 }}>
          <HbCutout variant={0} slotId="cutA" slotLabel="人物图（第一屏）" />
        </Para>
        {keepAlive.isPlaying ? (
          <Tag id="tagNow" left="52%" top={470} rotate={-4}>正在听</Tag>
        ) : (
          <Tag id="tagPaused" left="52%" top={470} rotate={-4}>先停一会</Tag>
        )}

        <Key letter="M" left="79%" top={122} depth={-0.22} rotate={18} index={0} />
        <Key letter="R" left="3%" top={178} depth={-0.14} rotate={-14} index={1} />
        <Key letter="!" left="5%" top={612} depth={-0.18} rotate={12} index={2} />
        <Key letter="H" left="32%" top={684} depth={-0.1} rotate={-9} index={3} />
        <Key letter="B" left="83%" top={404} depth={-0.24} rotate={-22} index={4} />

        <Word id="w01" left="44%" top={136} depth={-0.3}>replay</Word>
        <Word id="w02" left="62%" top={350} depth={-0.26}>slow</Word>
        <Word id="w03" left="8%" top={552} depth={-0.2}>其实</Word>
        <Word id="w04" left="24%" top={250} depth={-0.34}>没关系</Word>
        <Word id="w05" left="12%" top={730} depth={-0.28}>again</Word>
      </section>

      {/* ---------- B 有人在找你 ---------- */}
      <section className="hb-spread" style={{ height: 760 }}>
        <Chip id="chipB" letter="B" left="5%" top={0}>有人在找你</Chip>
        <Para className="hb-goth" left="-6%" top={330} depth={0.06} slide={0.14}>
          <Editable id="goth" label="大字" maxLength={14}>heartbreak</Editable>
        </Para>

        <HbWindow {...windowProps('messages')} paraStyle={{ left: '4%', top: 50 }} depth={0.03} winStyle={{ '--r': '-1deg' }}>
          <div className="hb-field">
            <b>To:</b>
            <span className="hb-boxed">{latestChat?.characterName || '还没有聊天'}</span>
          </div>
          <div className={`hb-bubble ${latestChat?.fromUser ? 'me' : ''}`}>
            {latestChat?.text || 'Continue the conversation'}
          </div>
          <div className="hb-btns">
            <button type="button" className="hb-btn main" onClick={() => onOpenApp('messages')}>
              打开
            </button>
          </div>
        </HbWindow>
        <Bang id="bangB1" left="82%" top={26} depth={-0.18} />

        <HbWindow {...windowProps('askbox')} paraStyle={{ left: '38%', top: 384 }} depth={-0.04} winStyle={{ width: 226, '--r': '2deg' }}>
          <div className="hb-qq">???</div>
          <div className="hb-ask-sub">
            <b>{stats.askCount}</b> 个问题还没回答
          </div>
          {askPreview && (
            <p className="hb-ask-quote">
              {askPreview.locked ? '最新一条是上锁的问题' : `\u201c${askPreview.text}\u201d`}
            </p>
          )}
          <div className="hb-btns">
            <button type="button" className="hb-btn" onClick={() => minimizeWindow('askbox')}>
              等会儿
            </button>
            <button type="button" className="hb-btn main" onClick={() => onOpenApp('askbox')}>
              去回答
            </button>
          </div>
        </HbWindow>
        <Para className="hb-qm" left="6%" top={338} depth={-0.14} style={{ fontSize: 112 }}>?</Para>
        <Para className="hb-qm" left="28%" top={310} depth={-0.22} style={{ fontSize: 62, rotate: '16deg' }}>?</Para>

        <Para left="2%" top={500} z={7} depth={-0.06} style={{ width: 154, height: 206 }}>
          <HbCutout variant={1} slotId="cutB" slotLabel="人物图（第二屏）" />
        </Para>
        <Tag id="tagWho" left="44%" top={640} rotate={3}>这是谁？</Tag>
        <Tag id="tagLook" left="58%" top={310} rotate={-3}>别装没看见</Tag>
        <Bang id="bangB2" left="76%" top={700} depth={-0.12} />

        <Word id="w06" left="84%" top={240} depth={-0.3}>until</Word>
        <Word id="w07" left="12%" top={300} depth={-0.24}>someone</Word>
        <Word id="w08" left="50%" top={720} depth={-0.2}>在吗</Word>
        <Word id="w09" left="80%" top={560} depth={-0.32}>to</Word>
      </section>

      {/* ---------- C 桌面 ---------- */}
      <section className="hb-spread" style={{ height: 840 }}>
        <Chip id="chipC" letter="C" left="5%" top={0}>桌面</Chip>
        <Giant text="SIDE B" left="-4%" top={700} depth={0.08} slide={0.16} line size={104} />

        <Para left="4%" top={52} z={6} depth={0.03} decor={false} style={{ rotate: '-1.5deg' }}>
          <HbHabitatCard count={stats.habitatCount} onOpen={() => onOpenApp('habitat')} />
        </Para>
        <Tag id="tagMost" left="64%" top={20} rotate={4}>最常去</Tag>

        <HbWindow {...windowProps('workflows')} paraStyle={{ left: '43%', top: 318 }} depth={-0.04} winStyle={{ width: 206, '--r': '-2deg' }}>
          <HbWorkflowsWindow
            workflows={workflowState.workflows}
            ready={workflowState.ready}
            activeCount={workflowState.activeCount}
            onOpenWorkflows={() => onOpenApp('workflows')}
          />
        </HbWindow>
        <Bang id="bangC" left="84%" top={258} z={9} depth={-0.1} />

        <Para left="5%" top={330} depth={-0.1} decor={false} style={{ textAlign: 'center' }}>
          <button
            type="button"
            className="hb-die"
            aria-label="换一个开机加载页"
            disabled={diceBusy}
            onClick={handleRollDice}
          >
            <span
              className="hb-cube"
              style={motionOn ? { transform: `rotateX(${cubeTurn.x}deg) rotateY(${cubeTurn.y}deg)` } : undefined}
            >
              <i /><i /><i /><i /><i /><i />
            </span>
          </button>
          <span className="hb-capt" aria-live="polite">
            <b style={{ fontSize: 13, color: 'var(--text-main)' }}>加载页</b>
            <br />
            {startupAnimation.title}
            <br />
            <em>{diceNote || '点一下换一款'}</em>
          </span>
        </Para>

        <div className="hb-para" data-depth="-0.06" style={{ left: '7%', top: 520, zIndex: 5 }}>
          <button type="button" className="hb-folder" aria-label="全部应用" onClick={() => openWindow('apps')}>
            <svg viewBox="0 0 24 24">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
            <span className="hb-chip">全部应用</span>
          </button>
        </div>
        <Tag left="30%" top={584} rotate={-3}>{appCount} 个入口</Tag>

        <Para left="54%" top={622} z={7} depth={0.08} decor={false}>
          <button type="button" className="hb-sticker" onClick={() => setAddWidgetOpen(true)}>
            <Plus className="hb-i" />
            贴一个小组件
          </button>
        </Para>

        <Word id="w10" left="76%" top={250} depth={-0.3}>own</Word>
        <Word id="w11" left="36%" top={470} depth={-0.24}>收好</Word>
        <Word id="w12" left="10%" top={308} depth={-0.2}>the</Word>

        <HbWindow
          {...windowProps('apps')}
          paraStyle={{ left: '5%', top: 60, width: 'min(350px, 90%)' }}
          depth={0}
          winStyle={{ width: '100%' }}
        >
          <HbAppsWindow nameMode={nameMode} stats={stats} onOpenApp={onOpenApp} />
        </HbWindow>
      </section>

      <HbWidgetShelf
        widgets={homeWidgets}
        editing={editing}
        onOpenApp={onOpenApp}
        onEditWidget={setEditingWidget}
        onRemoveWidget={removeHomeWidget}
      />

      <div className="hb-readme">
        <section className="hb-win" style={{ '--r': '-1deg' }} aria-label="readme.txt">
          <div className="hb-win-bar" style={{ cursor: 'default' }}>
            <span className="hb-grip">
              <i />
              readme.txt
            </span>
          </div>
          <div className="hb-win-body">
            <p>
              <Editable id="readme" label="readme 标题" maxLength={60}>
                Things kept close, and places to return to.
              </Editable>
            </p>
            <small>
              <Editable id="readmeSub" label="readme 小字" maxLength={30}>
                Personal Index
              </Editable>
            </small>
          </div>
        </section>
      </div>

      {/* ---------- 任务栏 ---------- */}
      <nav className="hb-taskbar" aria-label="任务栏">
        <button type="button" className="hb-start" onClick={scrollToTop}>
          <i />
          心碎
        </button>
        <div className="hb-tasks">
          {minimized.map((id) => (
            <button key={id} type="button" className="hb-task" onClick={() => openWindow(id)}>
              {WINDOW_META[id].title}
            </button>
          ))}
        </div>
        <span className="hb-tray">{clock}</span>
      </nav>
    </div>
    <HbEditLayer
      editing={editing}
      onDone={toggleEditing}
      target={editTarget}
      onCloseTarget={closeEditTarget}
    />
    <HbWidgetModals
      addOpen={addWidgetOpen}
      onCloseAdd={() => setAddWidgetOpen(false)}
      onAdd={handleAddWidget}
      editingWidget={editingWidget}
      onCloseEdit={() => setEditingWidget(null)}
      onSaveEdit={handleSaveWidgetConfig}
    />
    </HbCustomContext.Provider>
  );
};

export default HeartbreakPageLayout;
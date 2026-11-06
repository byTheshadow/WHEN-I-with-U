// src/apps/hub/hubPageLayouts/DialPageLayout.jsx
//
// 「转盘电台」整页版式：杂志封面风格的首页。第一屏是一个可以拖动的转盘，
// 一圈是 6 个章节页加全部应用，像收音机一样「调频」——停在哪一格，上面的大标题
// 就变成哪个应用的名字，点「打开」进入；转盘中心固定是 Messages。往下是新鲜事
// 跑马灯、「边栏拼贴」（留言板、图片墙、纪念日、下一封定时消息、正在播放）、
// 一句大字语录、全部入口的索引，和底部的几个显示开关。
//
// 数据全部是真实的：应用的名称、图标、分组来自 appRegistry.js；角标来自
// useHubAppStats；留言板是 db.homeBoard；新鲜事是 db.backgroundUpdates；图片墙和
// 资料是 db.pinnedGallery / db.profile；纪念日、音乐、语录读首页小组件（db.homeWidgets，
// 与经典首页共用）；定时消息读已启用的定时工作流；保活按钮就是真实的静音保活播放器。
//
// 和参考稿的几处取舍（都是和用户确认过的）：不放主题色块（主题仍在设置页改）；
// 顶部不重复画品牌名和设置按钮（App.jsx 的首页标题行已经有）；章节大装饰图保留斜纹
// 占位；右上角信封接到「信件存档」，角标是留言板未读数。
//
// 性能：转盘的动画循环只在转盘可见、有东西在动时运行；标题的乱码和起伏在标题不在
// 视野时停止；低功耗模式或系统「减少动画」下全部装饰动效关闭，只保留静态画面。
// 约定的 props 见 pageLayoutRegistry.js：{ onOpenApp, onOpenArchive }。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Dices, Mail, Volume2, VolumeX } from 'lucide-react';
import './dial/dial.css';
import DialCanvas from './dial/DialCanvas';
import ScrambleTitle from './dial/ScrambleTitle';
import {
  AnniversaryCard,
  MusicCard,
  NextLetterCard,
  NoteCard,
  PullQuote,
  WallCard,
} from './dial/DialCards';
import { buildDialSlots, getDialTint, DIAL_TINTS } from './dial/dialData';
import { getAppSecondaryName, getGroupedHubApps } from '../appRegistry';
import { useAppNameDisplayMode, APP_NAME_DISPLAY_BILINGUAL } from '../useAppNameDisplayMode';
import { useHubAppStats } from '../useHubAppStats';
import { useKeepAliveAudio, useKeepAliveConfig } from '../useKeepAliveAudio';
import { setHubLowPower } from '../useHubLowPower';
import { useHubFonts } from './shared/useHubFonts';
import { useHubMotion } from './shared/useHubMotion';
import { useHubBoard } from './shared/useHubBoard';
import { useHubTicker, TICKER_SOURCE_LABEL } from './shared/useHubTicker';
import { useHubProfileData } from './shared/useHubProfileData';
import { useHubNextLetter } from './shared/useHubNextLetter';
import { useHubWidgetSlots, HubWidgetModals } from './shared/useHubWidgetSlots';
import { getAppBadgeText } from './shared/hubAppBadges';
import { NAME_MODE_OPTIONS, setAppNameDisplayMode } from './shared/hubLookSettings';

const FONT_LINK_ID = 'dl-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap';

const EMPTY_TICKER_TEXT = '新鲜事会从这里缓缓飘过';

const pad2 = (value) => String(value).padStart(2, '0');

const formatIssueDate = (date) =>
  `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

export const DialPageLayout = ({ onOpenApp, onOpenArchive }) => {
  useHubFonts(FONT_LINK_ID, FONT_HREF);

  const { motionOn, reduced } = useHubMotion();
  const nameMode = useAppNameDisplayMode();
  const stats = useHubAppStats();
  const board = useHubBoard();
  const ticker = useHubTicker();
  const profile = useHubProfileData();
  const letter = useHubNextLetter();
  const widgetSlots = useHubWidgetSlots();

  const keepConfig = useKeepAliveConfig();
  const keepMeta = useMemo(
    () => ({ title: keepConfig.title, artist: keepConfig.artist }),
    [keepConfig.title, keepConfig.artist]
  );
  const keepAlive = useKeepAliveAudio(keepMeta);

  const { slots, appCount } = useMemo(() => buildDialSlots(), []);
  const groups = useMemo(() => getGroupedHubApps(), []);
  const issueDate = useMemo(() => formatIssueDate(new Date()), []);

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const plateRef = useRef(null);
  const dialRef = useRef(null);

  const [selected, setSelected] = useState(0);
  const [hintGone, setHintGone] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [stageVisible, setStageVisible] = useState(true);

  const slot = slots[selected] || slots[0];
  const showBilingual = nameMode === APP_NAME_DISPLAY_BILINGUAL;

  // ---- 当前电台的文字 ----
  const secondaryName =
    slot.type === 'chapter'
      ? showBilingual
        ? slot.zh
        : ''
      : getAppSecondaryName(slot.app, nameMode) || '';
  const badgeText = slot.type === 'app' ? getAppBadgeText(slot.app, stats) : '';
  const subText = slot.type === 'chapter' ? slot.sub : slot.app.sub || '';
  const bandText =
    slot.type === 'chapter'
      ? `BAND ${slot.num} · CHAPTER`
      : `BAND ${slot.num} · ${slot.chapterEn.toUpperCase()} · ${pad2(slot.no)} / ${appCount}`;
  const tint = getDialTint(slot.ch);
  const liveText = slot.type === 'chapter' ? `${slot.en}，${slot.zh}` : `${slot.en}，${slot.app.zh}`;

  // ---- 转盘回调 ----
  const handleSelect = useCallback((index) => setSelected(index), []);
  const handleActivate = useCallback(
    (activated) => {
      if (activated && activated.id) onOpenApp(activated.id);
    },
    [onOpenApp]
  );
  const handleInteract = useCallback(() => setHintGone(true), []);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) dialRef.current?.enableSound();
  };

  // ---- 章节变化时装饰图弹一下 ----
  useEffect(() => {
    const plate = plateRef.current;
    if (!plate || !motionOn) return;
    plate.classList.remove('bump');
    // 读一次 offsetWidth 强制重排，下一行重新加类才会重新播放动画。
    void plate.offsetWidth;
    plate.classList.add('bump');
  }, [slot.ch, motionOn]);

  // ---- 标题是否在视野里（不在就停掉标题的起伏动画）----
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setStageVisible(entry.isIntersecting));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // ---- 装饰图的视差：只在鼠标 / 触控笔移动时更新两个 CSS 变量 ----
  const parallaxFrame = useRef(0);
  const handleRootPointerMove = (event) => {
    if (!motionOn || event.pointerType === 'touch') return;
    const { clientX, clientY } = event;
    if (parallaxFrame.current) return;
    parallaxFrame.current = requestAnimationFrame(() => {
      parallaxFrame.current = 0;
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty('--dl-px', `${((clientX / window.innerWidth - 0.5) * -26).toFixed(1)}px`);
      root.style.setProperty('--dl-py', `${((clientY / window.innerHeight - 0.5) * -18).toFixed(1)}px`);
    });
  };
  useEffect(
    () => () => {
      if (parallaxFrame.current) cancelAnimationFrame(parallaxFrame.current);
    },
    []
  );

  // ---- 新鲜事跑马灯 ----
  const tickerLabels = useMemo(() => {
    if (ticker.items.length === 0) return [EMPTY_TICKER_TEXT];
    return ticker.items.map((item) => {
      const source = TICKER_SOURCE_LABEL[item.source];
      return source ? `${source} · ${item.title}` : item.title;
    });
  }, [ticker.items]);
  const tickerLoop = useMemo(() => {
    // 一半的内容至少重复两遍，整条再复制一份，动画移动 50% 就能无缝循环。
    const half = [...tickerLabels, ...tickerLabels];
    return [...half, ...half];
  }, [tickerLabels]);

  const widgetTypes = widgetSlots.byType;

  return (
    <div
      ref={rootRef}
      className="dl-root"
      data-motion={motionOn ? 'on' : 'off'}
      style={{ '--dl-tint': tint }}
      onPointerMove={handleRootPointerMove}
    >
      <div className="dl-aura" aria-hidden="true">
        <i className="a" />
        <i className="b" />
        <i className="c" />
      </div>

      <section ref={stageRef} className="dl-stage" aria-label="主页转盘">
        <div className="dl-spine dl-mono" aria-hidden="true">
          WHEN I WITH U - A MAGAZINE FOR TWO - ALWAYS ON AIR
        </div>
        <div className="dl-wrap dl-stage-inner">
          <header className="dl-top">
            <div className="dl-issue dl-mono">{`ISSUE ${issueDate}`}</div>
            <div className="dl-tools">
              <button
                type="button"
                className="dl-round dl-glass"
                aria-pressed={soundOn}
                aria-label="转盘音效"
                onClick={handleToggleSound}
              >
                {soundOn ? <Volume2 width={19} height={19} strokeWidth={1.6} /> : <VolumeX width={19} height={19} strokeWidth={1.6} />}
              </button>
              <button
                type="button"
                className="dl-round dl-glass"
                aria-label={board.unreadCount > 0 ? `信件存档，${board.unreadCount} 条未读` : '信件存档'}
                onClick={onOpenArchive}
              >
                <Mail width={19} height={19} strokeWidth={1.6} />
                {board.unreadCount > 0 && (
                  <span className="dl-n dl-mono">{board.unreadCount > 9 ? '9+' : board.unreadCount}</span>
                )}
              </button>
            </div>
          </header>

          <div className="dl-info">
            <div ref={plateRef} className="dl-plate" data-ch={slot.ch + 1} aria-hidden="true">
              <span className="dl-plate-tag dl-mono">{`PLATE ${slot.num} · 装饰图片`}</span>
            </div>
            <div className="dl-band dl-mono">
              <i aria-hidden="true" />
              <span>{bandText}</span>
            </div>
            <ScrambleTitle
              text={slot.en}
              motionOn={motionOn}
              waving={keepAlive.isPlaying}
              active={stageVisible}
            />
            <div className="dl-zhline">
              {secondaryName && <span className="dl-zh dl-serif">{secondaryName}</span>}
              {badgeText && <span className="dl-badge dl-mono">{badgeText}</span>}
            </div>
            {subText && <div className="dl-subline dl-mono">{subText}</div>}
            <button type="button" className="dl-open" onClick={() => dialRef.current?.activate()}>
              <span>{slot.type === 'chapter' ? '进入这一章 · Tune in' : '打开 · Open'}</span>
              <ArrowUpRight width={18} height={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        <DialCanvas
          ref={dialRef}
          slots={slots}
          tints={DIAL_TINTS}
          motionOn={motionOn}
          soundOn={soundOn}
          onSelect={handleSelect}
          onActivate={handleActivate}
          onInteract={handleInteract}
        >
          <button
            type="button"
            className="dl-hub"
            aria-label="打开 Messages 消息"
            onClick={() => onOpenApp('messages')}
          >
            <b className="dl-serif">Messages</b>
            {showBilingual && <span className="dl-hub-zh">消息</span>}
            <span className="dl-live dl-mono">
              <i aria-hidden="true" />
              ON AIR
            </span>
          </button>
          <button
            type="button"
            className="dl-dice dl-glass"
            aria-label="随机转一下"
            onClick={() => dialRef.current?.spin()}
          >
            <Dices width={20} height={20} strokeWidth={1.6} />
          </button>
          <div className={`dl-hint dl-mono${hintGone ? ' gone' : ''}`}>DRAG TO TUNE · 拖动转盘调频</div>
        </DialCanvas>
        <div className="dl-sr" aria-live="polite">
          {liveText}
        </div>
      </section>

      <div className="dl-ticker dl-mono" aria-label="新鲜事">
        <div className="dl-ticker-lane">
          <div className="dl-ticker-track">
            {tickerLoop.map((label, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <span key={index}>
                {label}
                <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
                </svg>
              </span>
            ))}
          </div>
        </div>
        {ticker.items.length > 0 && (
          <button type="button" className="dl-ticker-take" onClick={ticker.takeAll}>
            全部收下
          </button>
        )}
      </div>

      <div className="dl-wrap">
        <section className="dl-margins">
          <div className="dl-sec-head">
            <h2 className="dl-sec-h dl-serif">
              In the <i>margins.</i>
            </h2>
            <button type="button" className="dl-pill dl-pill-ghost" onClick={widgetSlots.openAdd}>
              贴一个小组件
            </button>
          </div>
          <div className="dl-collage">
            <NoteCard board={board} onOpenArchive={onOpenArchive} motionOn={motionOn} />
            <WallCard profile={profile} motionOn={motionOn} />
            <AnniversaryCard
              widget={(widgetTypes.importantDateCountdown || [])[0] || null}
              onOpenApp={onOpenApp}
              onAdd={widgetSlots.openAdd}
              motionOn={motionOn}
            />
            <NextLetterCard letter={letter} onOpenApp={onOpenApp} motionOn={motionOn} />
            <MusicCard
              widget={(widgetTypes.musicCard || [])[0] || null}
              keepConfig={keepConfig}
              keepAlive={keepAlive}
              onEdit={widgetSlots.openEdit}
              onAdd={widgetSlots.openAdd}
              motionOn={motionOn}
            />
          </div>
          <PullQuote
            widget={(widgetTypes.quoteCard || [])[0] || null}
            onEdit={widgetSlots.openEdit}
            onAdd={widgetSlots.openAdd}
          />
        </section>

        <section className="dl-index" aria-label="全部入口">
          <h2 className="dl-sec-h dl-serif">
            All {appCount} <i>rooms.</i>
          </h2>
          <div className="dl-idx">
            {groups.map((group, groupIndex) => {
              const chapterCopy = slots.find((entry) => entry.type === 'chapter' && entry.ch === groupIndex);
              const apps = group.apps.filter((app) => !app.pinned);
              const firstNo = slots.find((entry) => entry.type === 'app' && entry.ch === groupIndex);
              const startNo = firstNo ? firstNo.no : 1;
              return (
                <div key={group.id}>
                  <h3 className="dl-serif">
                    {chapterCopy ? chapterCopy.en : group.en}
                    <em className="dl-mono">{pad2(groupIndex + 1)}</em>
                  </h3>
                  <ul>
                    {apps.map((app, appIndex) => {
                      const secondary = getAppSecondaryName(app, nameMode);
                      return (
                        <li key={app.id}>
                          <button
                            type="button"
                            aria-label={`打开 ${app.en}`}
                            onClick={() => onOpenApp(app.id)}
                          >
                            <span className="dl-pg dl-mono">{pad2(startNo + appIndex)}</span>
                            <span className="dl-en dl-serif">{app.en}</span>
                            {secondary && <span className="dl-z">{secondary}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="dl-bottom">
          <div className="dl-ctl">
            <span className="dl-lab dl-mono">APP NAMES</span>
            <div className="dl-seg" role="group" aria-label="应用名称显示方式">
              {NAME_MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={nameMode === option.id}
                  onClick={() => setAppNameDisplayMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="dl-ctl">
            <button
              type="button"
              className="dl-sw dl-mono"
              aria-pressed={keepAlive.isPlaying}
              onClick={keepAlive.toggle}
            >
              <i aria-hidden="true" />
              <span>{`KEEP-ALIVE ${keepAlive.isPlaying ? 'ON' : 'OFF'}`}</span>
            </button>
            <button
              type="button"
              className="dl-sw dl-mono"
              aria-pressed={motionOn}
              disabled={reduced}
              title={reduced ? '系统已开启减少动画' : undefined}
              onClick={() => setHubLowPower(motionOn)}
            >
              <i aria-hidden="true" />
              <span>{`MOTION ${motionOn ? 'ON' : 'OFF'}`}</span>
            </button>
          </div>
          <span className="dl-sign dl-serif">printed for two, every day.</span>
        </footer>
      </div>

      <HubWidgetModals slots={widgetSlots} />
    </div>
  );
};

export default DialPageLayout;

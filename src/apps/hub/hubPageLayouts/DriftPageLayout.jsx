// src/apps/hub/hubPageLayouts/DriftPageLayout.jsx
//
// 「漂流星群」整页版式：夜空里漂浮着气泡的首页。最上面是一张拍立得（资料卡头像和名字）、
// 一枚「with U」贴纸，和一轮 Messages 月亮；往下是新鲜事跑马灯，然后是 6 个「星群」
// （对应应用分组），每个星群里的应用漂成一圈气泡，点一下先看说明、再点一下进入；
// 再往下是横向的小物件栏、留言板便签，和底部的保活条与显示开关。
//
// 数据全部是真实的：应用的名称、图标、分组来自 appRegistry.js；气泡上的小圆点来自
// useHubAppStats；留言板是 db.homeBoard；新鲜事是 db.backgroundUpdates；拍立得和照片是
// db.profile / db.pinnedGallery；纪念日、音乐、语录读首页小组件（db.homeWidgets，与经典首页
// 共用）；定时消息读已启用的定时工作流；Messages 月亮下的话，第一句是最近一段聊天的预览。
//
// 和参考稿的几处取舍（都是和用户确认过的）：不放主题色块（主题仍在设置页改）；顶部不重复
// 画品牌名和设置按钮（App.jsx 的首页标题行已经有）；右上角信封接到「信件存档」，角标是
// 留言板未读数；背景光晕用静态渐变，不做持续模糊动画。
//
// 低功耗模式或系统「减少动画」下，漂浮、涟漪、视差、跑马灯全部关闭，只保留静态画面。
// 约定的 props 见 pageLayoutRegistry.js：{ onOpenApp, onOpenArchive }。

import React, { useEffect, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import './drift/drift.css';
import DriftRealm from './drift/DriftRealm';
import {
  AddMiniCard,
  LetterMiniCard,
  PhotoMiniCard,
  QuoteMiniCard,
  VinylMiniCard,
} from './drift/DriftCards';
import { DRIFT_WHISPERS, buildDriftRealms } from './drift/driftData';
import { useAppNameDisplayMode } from '../useAppNameDisplayMode';
import { useHubAppStats } from '../useHubAppStats';
import { useKeepAliveAudio, useKeepAliveConfig } from '../useKeepAliveAudio';
import { setHubLowPower } from '../useHubLowPower';
import { useHubLatestChat } from '../useHubPreviews';
import { useHubFonts } from './shared/useHubFonts';
import { useHubMotion } from './shared/useHubMotion';
import { useHubBoard, formatBoardTime } from './shared/useHubBoard';
import { useHubTicker, TICKER_SOURCE_LABEL } from './shared/useHubTicker';
import { useHubProfileData } from './shared/useHubProfileData';
import { useHubNextLetter } from './shared/useHubNextLetter';
import { useHubWidgetSlots, HubWidgetModals } from './shared/useHubWidgetSlots';
import { NAME_MODE_OPTIONS, setAppNameDisplayMode } from './shared/hubLookSettings';

const FONT_LINK_ID = 'dr-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Serif+SC:wght@400;600&display=swap';

const EMPTY_TICKER_TEXT = '新鲜事会从这里缓缓飘过';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatTopDate = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${WEEKDAYS[date.getDay()]} · ${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
};

export const DriftPageLayout = ({ onOpenApp, onOpenArchive }) => {
  useHubFonts(FONT_LINK_ID, FONT_HREF);

  const { motionOn, reduced } = useHubMotion();
  const nameMode = useAppNameDisplayMode();
  const stats = useHubAppStats();
  const board = useHubBoard();
  const ticker = useHubTicker();
  const profile = useHubProfileData();
  const letter = useHubNextLetter();
  const latestChat = useHubLatestChat();
  const widgetSlots = useHubWidgetSlots();

  const keepConfig = useKeepAliveConfig();
  const keepMeta = useMemo(
    () => ({ title: keepConfig.title, artist: keepConfig.artist }),
    [keepConfig.title, keepConfig.artist]
  );
  const keepAlive = useKeepAliveAudio(keepMeta);

  const realms = useMemo(() => buildDriftRealms(), []);
  const topDate = useMemo(() => formatTopDate(new Date()), []);

  const [flipped, setFlipped] = useState(false);
  const [whisperIndex, setWhisperIndex] = useState(0);

  // ---- Messages 月亮下的话：第一句是最近一段聊天的预览，后面是固定的几句 ----
  const whispers = useMemo(() => {
    const lines = [...DRIFT_WHISPERS];
    if (latestChat && latestChat.text) {
      const who = latestChat.characterName ? `${latestChat.characterName}：` : '';
      lines.unshift(`${who}${latestChat.text}`);
    }
    return lines;
  }, [latestChat]);

  useEffect(() => {
    if (!motionOn || whispers.length < 2) return undefined;
    const timer = window.setInterval(() => setWhisperIndex((value) => value + 1), 6000);
    return () => window.clearInterval(timer);
  }, [motionOn, whispers.length]);

  const whisper = whispers[whisperIndex % whispers.length];

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

  // ---- 留言板便签 ----
  const frontNote = board.latestUnread;
  const caughtUp = !frontNote;
  const handleReread = () => {
    if (board.newest) board.setRead(board.newest.id, false);
  };

  const widgetTypes = widgetSlots.byType;
  const photoPortrait = profile.avatar || profile.banner || '';
  const displayName = profile.name || 'Hello';

  return (
    <div className="dr-root" data-motion={motionOn ? 'on' : 'off'}>
      <div className="dr-aura" aria-hidden="true">
        <i className="a" />
        <i className="b" />
        <i className="c" />
      </div>

      <div className="dr-wrap">
        <header className="dr-top">
          <span className="dr-date">{topDate}</span>
          <button
            type="button"
            className="dr-round"
            aria-label={board.unreadCount > 0 ? `信件存档，${board.unreadCount} 条未读` : '信件存档'}
            onClick={onOpenArchive}
          >
            <Mail width={18} height={18} strokeWidth={1.6} aria-hidden="true" />
            {board.unreadCount > 0 && <span className="dr-pip" />}
          </button>
        </header>

        <section className="dr-hero" aria-label="问候">
          <button
            type="button"
            className={`dr-polaroid${flipped ? ' flipped' : ''}`}
            aria-pressed={flipped}
            aria-label="翻转拍立得"
            onClick={() => setFlipped((value) => !value)}
          >
            <span className="dr-pol-face dr-pol-front">
              <span className="dr-pol-photo">
                {photoPortrait ? <img src={photoPortrait} alt="" loading="lazy" /> : <i />}
              </span>
              <span className="dr-pol-name">{displayName}</span>
            </span>
            <span className="dr-pol-face dr-pol-back">
              <span className="dr-pol-back-title">{profile.galleryTitle || 'with U'}</span>
              <span className="dr-pol-back-cap">{profile.galleryCaption || 'every day, a little closer'}</span>
            </span>
          </button>

          <span className="dr-sticker" aria-hidden="true">
            with U
          </span>

          <div className="dr-moon-wrap">
            <button
              type="button"
              className="dr-moon"
              aria-label="打开 Messages 消息"
              onClick={() => onOpenApp('messages')}
            >
              <b>Messages</b>
              <span>消息</span>
            </button>
            <p className="dr-whisper" key={whisper} aria-live="off">
              {whisper}
            </p>
          </div>
        </section>
      </div>

      <div className="dr-ticker" aria-label="新鲜事">
        <div className="dr-ticker-lane">
          <div className="dr-ticker-track">
            {tickerLoop.map((label, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <span key={index}>{label}</span>
            ))}
          </div>
        </div>
        {ticker.items.length > 0 && (
          <button type="button" className="dr-ticker-take" onClick={ticker.takeAll}>
            全部收下
          </button>
        )}
      </div>

      <div className="dr-wrap">
        <DriftRealm
          realms={realms}
          stats={stats}
          nameMode={nameMode}
          motionOn={motionOn}
          onOpenApp={onOpenApp}
        />

        <section className="dr-rail-sec" aria-label="小物件">
          <div className="dr-sec-head">
            <h2>Little things</h2>
            <span>横向滑动看看</span>
          </div>
          <div className="dr-rail">
            <PhotoMiniCard
              profile={profile}
              widget={(widgetTypes.importantDateCountdown || [])[0] || null}
              onOpenApp={onOpenApp}
              onAdd={widgetSlots.openAdd}
            />
            <VinylMiniCard
              widget={(widgetTypes.musicCard || [])[0] || null}
              keepConfig={keepConfig}
              keepAlive={keepAlive}
            />
            <LetterMiniCard letter={letter} onOpenApp={onOpenApp} />
            <QuoteMiniCard
              widgets={widgetTypes.quoteCard || []}
              onEdit={widgetSlots.openEdit}
              onAdd={widgetSlots.openAdd}
            />
            <AddMiniCard onAdd={widgetSlots.openAdd} />
          </div>
        </section>

        <section className="dr-notes" aria-label="留言板">
          <div className="dr-sec-head">
            <h2>Notes</h2>
            <span>{board.unreadCount > 0 ? `${board.unreadCount} 条未读` : '都看完了'}</span>
          </div>
          <div className="dr-stack">
            <span className="dr-sheet dr-sheet-b" aria-hidden="true" />
            <span className="dr-sheet dr-sheet-a" aria-hidden="true" />
            {caughtUp ? (
              <div className="dr-note dr-note-done">
                <p className="dr-note-text">
                  {board.newest ? '留言都看完了。' : '还没有留言。角色发来的主页留言会出现在这里。'}
                </p>
                {board.newest && (
                  <div className="dr-note-row">
                    <button type="button" className="dr-pill" onClick={handleReread}>
                      再看一遍
                    </button>
                    <button type="button" className="dr-pill dr-pill-ghost" onClick={onOpenArchive}>
                      信件存档
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="dr-note">
                <span className="dr-note-from">{`From ${frontNote.characterName || '对方'}`}</span>
                <p className="dr-note-text">{String(frontNote.content || '')}</p>
                <div className="dr-note-row">
                  <button type="button" className="dr-pill" onClick={() => board.setRead(frontNote.id, true)}>
                    标为已读
                  </button>
                  <button type="button" className="dr-pill dr-pill-ghost" onClick={onOpenArchive}>
                    信件存档
                  </button>
                  <span className="dr-note-time">{formatBoardTime(frontNote.timestamp)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="dr-foot">
          <div className="dr-keep">
            <span className="dr-keep-dot" aria-hidden="true" />
            <div className="dr-keep-text">
              <b>{keepConfig.title}</b>
              <span>{keepAlive.isPlaying ? '静音保活运行中' : '静音保活未开启'}</span>
            </div>
            <button
              type="button"
              className="dr-switch"
              aria-pressed={keepAlive.isPlaying}
              aria-label="静音保活"
              onClick={keepAlive.toggle}
            >
              <i aria-hidden="true" />
            </button>
          </div>

          <div className="dr-look">
            <div className="dr-look-row">
              <span className="dr-look-lab">应用名称</span>
              <div className="dr-seg" role="group" aria-label="应用名称显示方式">
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
            <div className="dr-look-row">
              <span className="dr-look-lab">动态效果</span>
              <button
                type="button"
                className="dr-switch"
                aria-pressed={motionOn}
                aria-label="动态效果"
                disabled={reduced}
                title={reduced ? '系统已开启减少动画' : undefined}
                onClick={() => setHubLowPower(motionOn)}
              >
                <i aria-hidden="true" />
              </button>
            </div>
          </div>
          <span className="dr-sign">drifting together, every day.</span>
        </footer>
      </div>

      <HubWidgetModals slots={widgetSlots} />
    </div>
  );
};

export default DriftPageLayout;

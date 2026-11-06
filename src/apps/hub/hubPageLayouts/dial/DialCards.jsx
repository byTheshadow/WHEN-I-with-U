// src/apps/hub/hubPageLayouts/dial/DialCards.jsx
//
// 「转盘电台」版式下半部分「边栏拼贴」里的几张卡片：
//   NoteCard         留言板最新一条（db.homeBoard），可标已读、可进信件存档
//   WallCard         图片墙三张拍立得（db.pinnedGallery，只读）
//   AnniversaryCard  纪念日倒数（读首页小组件里的「纪念日倒数」）
//   NextLetterCard   下一封定时消息（读已启用的定时工作流）
//   MusicCard        正在播放（保活播放器的真实开关；有「音乐卡片」小组件时借它的歌名）
//   PullQuote        大字语录（读首页小组件里的「心语卡片」）
// 数据都由 DialPageLayout 用共享 hook 取好再传进来，这里只负责画和点击。
// 某一类小组件还没贴过时，画一个「贴一个」入口，点开添加面板。

import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Plus } from 'lucide-react';
import { formatBoardTime } from '../shared/useHubBoard';
import { useHubImportantDate } from '../shared/useHubWidgetSlots';
import { formatRemainingClock } from '../shared/useHubNextLetter';

const DAY_MS = 24 * 60 * 60 * 1000;
const RING_LENGTH = 170;

// 卡片轻微倾斜：只在鼠标 / 触控笔下生效，触屏不处理。
const TILT_HANDLERS = {
  onPointerMove: (event) => {
    if (event.pointerType === 'touch') return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--ry', `${(((event.clientX - rect.left) / rect.width - 0.5) * 6).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(((event.clientY - rect.top) / rect.height - 0.5) * -6).toFixed(2)}deg`);
  },
  onPointerLeave: (event) => {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
  },
};

const tiltProps = (motionOn) => (motionOn ? TILT_HANDLERS : {});

// 每秒走一次的时钟，只给倒计时用；动效关闭时降到半分钟一次。
const useNow = (intervalMs) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};

const AddSlot = ({ className, label, kicker, onAdd }) => (
  <button type="button" className={`dl-card dl-glass dl-tilt-off dl-addcard ${className}`} onClick={onAdd}>
    <span className="dl-k dl-mono">{kicker}</span>
    <span className="dl-addcard-body">
      <Plus width={22} height={22} strokeWidth={1.5} aria-hidden="true" />
      <span>{label}</span>
    </span>
  </button>
);

export const NoteCard = ({ board, onOpenArchive, motionOn }) => {
  const [expanded, setExpanded] = useState(false);
  const message = board.newest;

  if (!message) {
    return (
      <div className="dl-card dl-glass dl-c-note dl-note" {...tiltProps(motionOn)}>
        <div className="dl-k dl-mono">QUICKBOARD · 留言板</div>
        <p className="dl-serif dl-note-text dl-note-empty">还没有留言。角色发来的主页留言会出现在这里。</p>
      </div>
    );
  }

  const isRead = Boolean(message.isRead);
  const content = String(message.content || '');
  const isLong = content.length > 90;
  const from = message.characterName || '对方';

  return (
    <div
      className={`dl-card dl-glass dl-c-note dl-note${isRead ? ' read' : ''}`}
      {...tiltProps(motionOn)}
    >
      <div className="dl-k dl-mono">QUICKBOARD · 留言板 · FROM {from}</div>
      <p className={`dl-serif dl-note-text${isLong && !expanded ? ' clamp' : ''}`}>{content}</p>
      {isLong && (
        <button type="button" className="dl-linkbtn" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起' : '展开全文'}
        </button>
      )}
      <div className="dl-row">
        <button
          type="button"
          className="dl-pill"
          aria-pressed={isRead}
          onClick={() => board.setRead(message.id, !isRead)}
        >
          <span className="dl-dot" aria-hidden="true" />
          <span>{isRead ? '已读' : '标为已读'}</span>
        </button>
        <button type="button" className="dl-pill dl-pill-ghost" onClick={onOpenArchive}>
          信件存档
        </button>
        <span className="dl-time dl-mono">
          {formatBoardTime(message.timestamp)}
          {board.unreadCount > 0 ? ` · ${board.unreadCount} 条未读` : ''}
        </span>
      </div>
    </div>
  );
};

export const WallCard = ({ profile, motionOn }) => {
  const hasTitle = Boolean(profile.galleryTitle || profile.galleryCaption);
  return (
    <div className="dl-card dl-glass dl-c-wall" {...tiltProps(motionOn)}>
      <div className="dl-k dl-mono">WALL · 图片墙</div>
      <div className="dl-wall">
        {profile.photos.map((url, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div className={`dl-photo dl-p${index + 1}`} key={index}>
            <i>{url ? <img src={url} alt="" loading="lazy" /> : null}</i>
          </div>
        ))}
      </div>
      {hasTitle && (
        <div className="dl-wall-cap">
          {profile.galleryTitle && <span className="dl-serif">{profile.galleryTitle}</span>}
          {profile.galleryCaption && <span className="dl-wall-sub">{profile.galleryCaption}</span>}
        </div>
      )}
    </div>
  );
};

export const AnniversaryCard = ({ widget, onOpenApp, onAdd, motionOn }) => {
  const info = useHubImportantDate(widget ? widget.config : undefined);

  if (!widget) {
    return <AddSlot className="dl-c-ann" kicker="ANNIVERSARY · 纪念日" label="贴一个纪念日" onAdd={onAdd} />;
  }

  let caption = '';
  if (info.missing) caption = '这个纪念日已被删除';
  else if (info.days === 0) caption = `就是今天 · ${info.title}`;
  else if (info.days !== null && info.days < 0) caption = `已过去 · ${info.title}`;
  else caption = `距离 ${info.title || '纪念日'}`;

  return (
    <button
      type="button"
      className="dl-card dl-glass dl-c-ann dl-ann"
      onClick={() => onOpenApp('almanac')}
      {...tiltProps(motionOn)}
    >
      <span className="dl-k dl-mono">ANNIVERSARY · 纪念日</span>
      <span className="dl-ann-num">
        <span className="dl-big dl-serif">{info.days === null ? '--' : Math.abs(info.days)}</span>
        <span className="dl-unit dl-serif">days</span>
      </span>
      <span className="dl-cap">{caption}</span>
    </button>
  );
};

export const NextLetterCard = ({ letter, onOpenApp, motionOn }) => {
  const now = useNow(motionOn ? 1000 : 30000);
  const occurrence = letter.occurrence;

  const remainingMs = occurrence ? occurrence.getTime() - now : 0;
  const remainingRatio = occurrence ? Math.min(1, Math.max(0, remainingMs / DAY_MS)) : 0;
  const clock = occurrence ? formatRemainingClock(occurrence, now) : '--:--:--';
  const caption = occurrence
    ? `${letter.characterName || '角色'} · 下一封定时消息`
    : letter.hasEnabled
      ? '暂时算不出下一次'
      : '暂无进行中的例程';

  return (
    <button
      type="button"
      className="dl-card dl-glass dl-c-time dl-time-w"
      onClick={() => onOpenApp('workflows')}
      {...tiltProps(motionOn)}
    >
      <span className="dl-k dl-mono">NEXT LETTER · 定时消息</span>
      <span className="dl-ring">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" className="dl-ring-track" />
          <circle
            cx="32"
            cy="32"
            r="27"
            className="dl-ring-fill"
            style={{ strokeDasharray: RING_LENGTH, strokeDashoffset: RING_LENGTH * (1 - remainingRatio) }}
          />
        </svg>
        <span className="dl-clock dl-mono">{clock}</span>
      </span>
      <span className="dl-cap">{caption}</span>
    </button>
  );
};

export const MusicCard = ({ widget, keepConfig, keepAlive, onEdit, onAdd, motionOn }) => {
  const config = widget ? widget.config || {} : {};
  const title = config.title || keepConfig.title;
  const artist = config.artist || keepConfig.artist;
  const cover = config.coverImage || '';
  const playing = keepAlive.isPlaying;

  // 波形的高度是固定的伪随机，不需要每次渲染重新算。
  const bars = useMemo(
    () =>
      Array.from({ length: 52 }, (_, index) => {
        const v = Math.abs(Math.sin(index * 0.62 + 1.7) * Math.cos(index * 0.21 + 3.4));
        return {
          height: Math.round(6 + v * 30),
          opacity: (0.5 + 0.5 * v).toFixed(2),
          delay: `-${(((index * 37) % 11) / 10).toFixed(1)}s`,
        };
      }),
    []
  );

  return (
    <div
      className={`dl-card dl-c-music${playing ? '' : ' paused'}`}
      {...tiltProps(motionOn)}
    >
      <div className="dl-music-head">
        <span className="dl-k dl-mono">NOW PLAYING · 保活播放</span>
        <button
          type="button"
          className="dl-play"
          aria-label={playing ? '暂停静音保活' : '开始静音保活'}
          aria-pressed={playing}
          onClick={keepAlive.toggle}
        >
          {playing ? <Pause width={16} height={16} fill="currentColor" /> : <Play width={16} height={16} fill="currentColor" />}
        </button>
      </div>
      <div className="dl-wave" aria-hidden="true">
        {bars.map((bar, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={index} style={{ height: bar.height, opacity: bar.opacity, animationDelay: bar.delay }} />
        ))}
      </div>
      <div className="dl-music-meta">
        {cover ? <img className="dl-cover" src={cover} alt="" /> : null}
        <div className="dl-music-text">
          {widget ? (
            <button type="button" className="dl-music-edit" onClick={() => onEdit(widget)}>
              <span className="dl-tn dl-serif">{title}</span>
              <span className="dl-tw">{artist}</span>
            </button>
          ) : (
            <>
              <span className="dl-tn dl-serif">{title}</span>
              <span className="dl-tw">{artist}</span>
            </>
          )}
        </div>
        {!widget && (
          <button type="button" className="dl-music-add" onClick={onAdd}>
            贴音乐卡片
          </button>
        )}
      </div>
    </div>
  );
};

export const PullQuote = ({ widget, onEdit, onAdd }) => {
  if (!widget) {
    return (
      <button type="button" className="dl-pull-add dl-serif" onClick={onAdd}>
        贴一句心语，它会在这里变成大字
      </button>
    );
  }
  const { mainText = '', subText = '' } = widget.config || {};
  return (
    <figure className="dl-pull">
      <span className="dl-mark dl-serif" aria-hidden="true">&ldquo;</span>
      <button type="button" className="dl-pull-text" onClick={() => onEdit(widget)}>
        <span className="dl-serif">{mainText || '点击填写这句话'}</span>
      </button>
      {subText && <figcaption className="dl-from dl-mono">{`- ${subText}`}</figcaption>}
    </figure>
  );
};

// src/apps/hub/hubPageLayouts/drift/DriftCards.jsx
//
// 「漂流星群」下方横向滚动的小物件栏，每张都是一张窄卡片：
//   PhotoMiniCard   图片墙第一张照片 + 纪念日倒数（纪念日读首页小组件）
//   VinylMiniCard   黑胶唱片，转动即保活播放器正在播放（有「音乐卡片」小组件时借它的歌名）
//   LetterMiniCard  下一封定时消息的时刻，点开进入定时工作流
//   QuoteMiniCard   心语卡片，点「换一句」在已有的心语之间轮换
//   AddMiniCard     末尾的「贴一个」，打开添加小组件面板
// 数据由 DriftPageLayout 取好传进来，这里只负责画和点击。

import React, { useEffect, useState } from 'react';
import { Pause, Play, Plus, RefreshCw } from 'lucide-react';
import { useHubImportantDate } from '../shared/useHubWidgetSlots';
import { formatOccurrenceTime, formatRemainingClock } from '../shared/useHubNextLetter';

// 每 30 秒刷新一次，给「还有多久」这种分钟级的文字用。
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

export const PhotoMiniCard = ({ profile, widget, onOpenApp, onAdd }) => {
  const info = useHubImportantDate(widget ? widget.config : undefined);
  const photo = profile.photos.find(Boolean) || '';

  let caption = '贴一个纪念日';
  if (widget) {
    if (info.missing) caption = '这个纪念日已被删除';
    else if (info.days === 0) caption = `就是今天 · ${info.title}`;
    else if (info.days !== null && info.days < 0) caption = `已过去 · ${info.title}`;
    else caption = `距离 ${info.title || '纪念日'}`;
  }

  const handleClick = widget ? () => onOpenApp('almanac') : onAdd;

  return (
    <button type="button" className="dr-mini dr-mini-photo" onClick={handleClick}>
      <span className="dr-mini-k">Anniversary</span>
      <span className="dr-mini-img" aria-hidden="true">
        {photo ? <img src={photo} alt="" loading="lazy" /> : <i />}
      </span>
      <span className="dr-mini-num">
        <b>{widget && info.days !== null ? Math.abs(info.days) : '--'}</b>
        <em>days</em>
      </span>
      <span className="dr-mini-cap">{caption}</span>
    </button>
  );
};

export const VinylMiniCard = ({ widget, keepConfig, keepAlive }) => {
  const config = widget ? widget.config || {} : {};
  const title = config.title || keepConfig.title;
  const artist = config.artist || keepConfig.artist;
  const playing = keepAlive.isPlaying;

  return (
    <div className={`dr-mini dr-mini-vinyl${playing ? ' playing' : ''}`}>
      <span className="dr-mini-k">Now playing</span>
      <span className="dr-disc" aria-hidden="true">
        <i />
      </span>
      <span className="dr-mini-title">{title}</span>
      <span className="dr-mini-cap">{artist}</span>
      <button
        type="button"
        className="dr-mini-play"
        aria-label={playing ? '暂停静音保活' : '开始静音保活'}
        aria-pressed={playing}
        onClick={keepAlive.toggle}
      >
        {playing ? (
          <Pause width={14} height={14} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play width={14} height={14} fill="currentColor" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export const LetterMiniCard = ({ letter, onOpenApp }) => {
  const now = useNow();
  const occurrence = letter.occurrence;

  let time = '--:--';
  let caption = '暂无进行中的例程';
  if (occurrence) {
    time = formatOccurrenceTime(occurrence);
    caption = `${letter.characterName || '角色'} · 还有 ${formatRemainingClock(occurrence, now)}`;
  } else if (letter.hasEnabled) {
    caption = '暂时算不出下一次';
  }

  return (
    <button type="button" className="dr-mini dr-mini-letter" onClick={() => onOpenApp('workflows')}>
      <span className="dr-mini-k">Next letter</span>
      <span className="dr-mini-time">{time}</span>
      <span className="dr-mini-cap">{caption}</span>
    </button>
  );
};

export const QuoteMiniCard = ({ widgets, onEdit, onAdd }) => {
  const [index, setIndex] = useState(0);
  const list = widgets || [];

  if (list.length === 0) {
    return (
      <button type="button" className="dr-mini dr-mini-quote" onClick={onAdd}>
        <span className="dr-mini-k">Quote</span>
        <span className="dr-mini-text dr-mini-text-empty">贴一句心语，它会出现在这里</span>
        <span className="dr-mini-cap">
          <Plus width={12} height={12} aria-hidden="true" /> 贴一个
        </span>
      </button>
    );
  }

  const current = list[index % list.length];
  const { mainText = '', subText = '' } = current.config || {};

  return (
    <div className="dr-mini dr-mini-quote">
      <span className="dr-mini-k">Quote</span>
      <button type="button" className="dr-mini-text" onClick={() => onEdit(current)}>
        {mainText || '点击填写这句话'}
      </button>
      <span className="dr-mini-cap">{subText ? `- ${subText}` : ' '}</span>
      {list.length > 1 && (
        <button
          type="button"
          className="dr-mini-next"
          aria-label="换一句"
          onClick={() => setIndex((value) => value + 1)}
        >
          <RefreshCw width={13} height={13} aria-hidden="true" />
          <span>换一句</span>
        </button>
      )}
    </div>
  );
};

export const AddMiniCard = ({ onAdd }) => (
  <button type="button" className="dr-mini dr-mini-add" onClick={onAdd}>
    <Plus width={22} height={22} strokeWidth={1.5} aria-hidden="true" />
    <span>贴一个小组件</span>
  </button>
);

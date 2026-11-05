// src/apps/messages/phoneScreen/PhoneScreenCard.jsx
//
// 角色发来的"手机截图"消息卡片（message.type === 'phone_screen'）。
//
// 存的是结构化 spec（message.metadata.spec，见 phoneScreenSpec.js），这里
// 每次渲染时现画一张手机屏幕的样子——不是存下来的图片，所以清晰、不占
// 空间。想保存成真图片时点下面的"保存为图片"，用 html-to-image 把这张卡
// 片的 DOM 节点导出成 PNG（复用 margin-notes 里现成的 exportPageToImage，
// 它本身跟便签没有任何绑定，就是个通用的 DOM 转 PNG 并下载的工具）。
//
// 文字内容全部走 React 文本节点，颜色在解析阶段已经被严格校验成
// #rgb/#rrggbb，所以不存在 HTML/CSS 注入的问题。
//
// 六种画面：锁屏通知栏 / 浏览器搜索记录 / 音乐播放器 / 聊天软件对话 / 备忘录
// 笔记列表 / 日历日程，按 spec.kind 分发。以后加新画面只需要在这个文件里
// 多写一个画面组件、在 phoneScreenSpec.js 里多写一段解析，不用动别的地方。
import React, { useMemo, useRef, useState } from 'react';
import {
  Lock,
  Camera,
  Download,
  Search,
  Clock,
  Music,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  ChevronLeft,
  Plus,
  StickyNote,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { exportPageToImage } from '../../margin-notes/marginNotesExportService';
import {
  PHONE_SCREEN_KIND_LOCKSCREEN,
  PHONE_SCREEN_KIND_BROWSER,
  PHONE_SCREEN_KIND_MUSIC,
  PHONE_SCREEN_KIND_CHAT,
  PHONE_SCREEN_KIND_NOTES,
  PHONE_SCREEN_KIND_CALENDAR,
  PHONE_SCREEN_STYLE_ANDROID,
  DEFAULT_WALLPAPER_COLOR,
  isPhoneScreenSpecRenderable,
} from './phoneScreenSpec';
import './phoneScreen.css';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const toDate = (timestamp) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatClock = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatDateLine = (date) =>
  `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;

// 壁纸颜色偏浅时文字改用深色，保证看得清。按相对亮度粗略判断即可。
const isLightColor = (hex) => {
  let value = String(hex || '').replace('#', '');

  if (value.length === 3) {
    value = value.split('').map((char) => char + char).join('');
  }

  if (!/^[0-9a-f]{6}$/i.test(value)) return false;

  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.62;
};

// 深色/渐变背景的画面（锁屏、音乐）用的一组颜色变量：背景由 spec.wallpaper
// 决定，文字颜色按背景深浅自动选。
const buildGradientVars = (color) => {
  const wallpaper = color || DEFAULT_WALLPAPER_COLOR;
  const light = isLightColor(wallpaper);

  return {
    '--ps-wallpaper': wallpaper,
    '--ps-fg': light ? '#1b1b1f' : '#ffffff',
    '--ps-fg-soft': light ? 'rgba(27, 27, 31, 0.62)' : 'rgba(255, 255, 255, 0.72)',
    '--ps-notice-bg': light ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.18)',
  };
};

// 浏览器画面是固定的浅色页面，spec.wallpaper 只当强调色用。
const buildPageVars = (color) => ({
  '--ps-accent': color || DEFAULT_WALLPAPER_COLOR,
  '--ps-fg': '#1b1b1f',
  '--ps-fg-soft': 'rgba(27, 27, 31, 0.55)',
});

// 聊天画面：页面是固定的浅色，spec.wallpaper 当"我"发出的气泡颜色，
// 气泡里的文字颜色按气泡深浅自动选。
const buildChatVars = (color) => {
  const accent = color || DEFAULT_WALLPAPER_COLOR;

  return {
    '--ps-accent': accent,
    '--ps-fg': '#1b1b1f',
    '--ps-fg-soft': 'rgba(27, 27, 31, 0.55)',
    '--ps-me-bg': accent,
    '--ps-me-fg': isLightColor(accent) ? '#1b1b1f' : '#ffffff',
  };
};

// 应用图标：用应用名第一个字 + 由应用名算出来的稳定颜色，同一个应用
// 每次渲染都是同一个颜色，不需要图片资源。
const getAppIconColor = (app) => {
  let hash = 0;

  for (const char of String(app || '')) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return `hsl(${hash}, 52%, 48%)`;
};

const Battery = ({ level }) => {
  if (!level) return null;

  return (
    <span className="phone-screen-battery" aria-label={`电量 ${level}%`}>
      <span className="phone-screen-battery__body">
        <span
          className="phone-screen-battery__fill"
          style={{
            width: `${level}%`,
            background: level <= 20 ? '#ff5a5a' : 'var(--ps-fg)',
          }}
        />
      </span>
      <span className="phone-screen-battery__cap" />
    </span>
  );
};

const StatusBar = ({ timeText, battery }) => (
  <div className="phone-screen-statusbar">
    <span>{timeText}</span>
    <Battery level={battery} />
  </div>
);

const LockScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const timeText = spec.time || formatClock(date);

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={buildGradientVars(spec.wallpaper)}
    >
      <StatusBar timeText={isAndroid ? timeText : ''} battery={spec.battery} />

      <div className="phone-screen-clock">
        {!isAndroid && <Lock className="phone-screen-lock" strokeWidth={2.2} />}
        <div className="phone-screen-date">{formatDateLine(date)}</div>
        <div className="phone-screen-time">{timeText}</div>
      </div>

      <div className="phone-screen-notices">
        {spec.notifications.map((item, index) => (
          <div className="phone-screen-notice" key={`${item.app}-${index}`}>
            <span
              className="phone-screen-notice__icon"
              style={{ background: getAppIconColor(item.app) }}
            >
              {Array.from(item.app)[0]}
            </span>
            <div className="phone-screen-notice__main">
              <div className="phone-screen-notice__head">
                <span className="phone-screen-notice__app">{item.app}</span>
                {item.time && (
                  <span className="phone-screen-notice__time">{item.time}</span>
                )}
              </div>
              {item.title && (
                <div className="phone-screen-notice__title">{item.title}</div>
              )}
              {item.body && (
                <div className="phone-screen-notice__body">{item.body}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="phone-screen-bottom">
        {isAndroid ? (
          <span className="phone-screen-homebar" />
        ) : (
          <>
            <span className="phone-screen-round">
              <Lock className="h-4 w-4" />
            </span>
            <span className="phone-screen-round">
              <Camera className="h-4 w-4" />
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// iOS 风格地址栏在屏幕底部，安卓风格在顶部。
const AddressBar = () => (
  <div className="phone-browser-address">
    <Lock className="h-3 w-3" strokeWidth={2.2} />
    <span>搜索或输入网址</span>
  </div>
);

const BrowserScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const timeText = spec.time || formatClock(date);

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card phone-screen-card--page ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={buildPageVars(spec.wallpaper)}
    >
      <StatusBar timeText={timeText} battery={spec.battery} />

      {isAndroid && <AddressBar />}

      <div className="phone-browser-title">
        <Clock className="h-3.5 w-3.5" />
        <span>搜索记录</span>
      </div>

      <div className="phone-browser-list">
        {spec.searches.map((item, index) => (
          <div className="phone-browser-row" key={`${item.query}-${index}`}>
            <Search className="phone-browser-row__icon" strokeWidth={2.2} />
            <span className="phone-browser-row__query">{item.query}</span>
            {item.time && (
              <span className="phone-browser-row__time">{item.time}</span>
            )}
          </div>
        ))}
      </div>

      {!isAndroid && (
        <div className="phone-browser-bottom">
          <AddressBar />
        </div>
      )}
    </div>
  );
};

const MusicScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const timeText = spec.time || formatClock(date);
  const { track } = spec;

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card phone-screen-card--music ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={buildGradientVars(spec.wallpaper)}
    >
      <StatusBar timeText={timeText} battery={spec.battery} />

      <div className="phone-music-state">
        {track.playing ? '正在播放' : '已暂停'}
      </div>

      <div className="phone-music-cover">
        <Music className="phone-music-cover__icon" strokeWidth={1.6} />
      </div>

      <div className="phone-music-title">{track.title}</div>
      <div className="phone-music-artist">{track.artist}</div>

      {track.lyric && <div className="phone-music-lyric">{track.lyric}</div>}

      <div className="phone-music-progress">
        <span className="phone-music-progress__fill" style={{ width: `${track.progress}%` }} />
        <span className="phone-music-progress__knob" style={{ left: `${track.progress}%` }} />
      </div>

      <div className="phone-music-controls">
        <SkipBack className="h-5 w-5" />
        <span className="phone-music-play">
          {track.playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </span>
        <SkipForward className="h-5 w-5" />
      </div>
    </div>
  );
};

const ChatScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const timeText = spec.time || formatClock(date);
  const { chat } = spec;

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card phone-screen-card--page phone-screen-card--chat ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={buildChatVars(spec.wallpaper)}
    >
      <StatusBar timeText={timeText} battery={spec.battery} />

      <div className="phone-chat-header">
        <ChevronLeft className="h-4 w-4" />
        <div className="phone-chat-header__main">
          <div className="phone-chat-header__name">{chat.contact}</div>
          <div className="phone-chat-header__app">{chat.app}</div>
        </div>
        <span className="phone-chat-header__spacer" />
      </div>

      <div className="phone-chat-messages">
        {chat.messages.map((item, index) => {
          const isMe = item.from === 'me';

          return (
            <div
              className={`phone-chat-row ${isMe ? 'phone-chat-row--me' : ''}`}
              key={`${item.from}-${index}`}
            >
              {!isMe && (
                <span
                  className="phone-chat-avatar"
                  style={{ background: getAppIconColor(chat.contact) }}
                >
                  {Array.from(chat.contact)[0]}
                </span>
              )}
              <div
                className={`phone-chat-bubble ${
                  isMe ? 'phone-chat-bubble--me' : 'phone-chat-bubble--other'
                }`}
              >
                {item.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="phone-chat-input">
        <span className="phone-chat-input__field">输入消息</span>
        <span className="phone-chat-input__plus">
          <Plus className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
};

// 备忘录：沿用浏览器那套浅色页面底 + 强调色，列表样式也跟搜索记录类似，
// 只是每行多一条摘要。
const NotesScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const timeText = spec.time || formatClock(date);

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card phone-screen-card--page ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={buildPageVars(spec.wallpaper)}
    >
      <StatusBar timeText={timeText} battery={spec.battery} />

      <div className="phone-browser-title">
        <StickyNote className="h-3.5 w-3.5" />
        <span>备忘录</span>
      </div>

      <div className="phone-notes-list">
        {spec.notes.map((item, index) => (
          <div className="phone-notes-row" key={`${item.title}-${index}`}>
            <div className="phone-notes-row__head">
              <span className="phone-notes-row__title">{item.title}</span>
              {item.time && (
                <span className="phone-notes-row__time">{item.time}</span>
              )}
            </div>
            {item.preview && (
              <div className="phone-notes-row__preview">{item.preview}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// 日历：标题栏用这条截图自己的日期（跟锁屏一样用 formatDateLine 现算），
// 日程按时间先后排成一条时间线，没写时间的排在"全天"区。
const CalendarScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const timeText = spec.time || formatClock(date);

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card phone-screen-card--page ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={buildPageVars(spec.wallpaper)}
    >
      <StatusBar timeText={timeText} battery={spec.battery} />

      <div className="phone-browser-title">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>{formatDateLine(date)}</span>
      </div>

      <div className="phone-calendar-list">
        {spec.events.map((item, index) => (
          <div className="phone-calendar-row" key={`${item.title}-${index}`}>
            <span className="phone-calendar-row__time">{item.time || '全天'}</span>
            <div className="phone-calendar-row__main">
              <span className="phone-calendar-row__title">{item.title}</span>
              {item.location && (
                <span className="phone-calendar-row__location">
                  <MapPin className="h-2.5 w-2.5" strokeWidth={2} />
                  {item.location}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SCREEN_BY_KIND = {
  [PHONE_SCREEN_KIND_LOCKSCREEN]: LockScreen,
  [PHONE_SCREEN_KIND_BROWSER]: BrowserScreen,
  [PHONE_SCREEN_KIND_MUSIC]: MusicScreen,
  [PHONE_SCREEN_KIND_CHAT]: ChatScreen,
  [PHONE_SCREEN_KIND_NOTES]: NotesScreen,
  [PHONE_SCREEN_KIND_CALENDAR]: CalendarScreen,
};

export const PhoneScreenCard = ({ content, metadata, timestamp, messageId }) => {
  const cardRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const spec = metadata?.spec;
  const date = useMemo(() => toDate(timestamp), [timestamp]);

  const Screen = spec ? SCREEN_BY_KIND[spec.kind] : null;

  // spec 缺失、损坏或是不认识的画面时，退回显示 content 里那段文字摘要，
  // 不让整条消息空白。
  if (!Screen || !isPhoneScreenSpecRenderable(spec)) {
    return (
      <div className="text-[12px] leading-relaxed opacity-70">
        {content || '[手机截图]'}
      </div>
    );
  }

  const handleSave = async () => {
    if (isSaving || !cardRef.current) return;

    setIsSaving(true);
    setSaveFailed(false);

    try {
      await exportPageToImage(
        cardRef.current,
        `phone-screen-${messageId || Date.now()}.png`,
      );
    } catch (error) {
      console.warn('[PhoneScreen] 保存为图片失败:', error);
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="phone-screen-wrap">
      <Screen spec={spec} date={date} cardRef={cardRef} />

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="phone-screen-save"
      >
        <Download className="h-3 w-3" />
        <span>
          {isSaving ? '正在保存...' : saveFailed ? '保存失败，点一下重试' : '保存为图片'}
        </span>
      </button>
    </div>
  );
};

export default PhoneScreenCard;
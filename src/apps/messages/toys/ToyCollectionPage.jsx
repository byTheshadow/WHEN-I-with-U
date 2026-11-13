// src/apps/messages/toys/ToyCollectionPage.jsx
//
// 小玩具收藏页（视觉方向 B「墨色便当」）：把所有角色做给用户的小游戏放在一个页面里。
//   - 顶部是标题和数量，下面一张墨色大卡片："继续玩"最近玩过的那个，
//     还没玩过任何一个时，显示最新做的那个，按钮写"来玩玩"；
//   - 再往下是便当格：宽卡和小卡循环排（每三个一组：一宽两小）；
//   - 底部悬浮 dock：固定的"全部"和排序按钮，中间是可横向滑动的角色头像，点头像按角色筛选；
//   - 点任何一个玩具都直接用 ToyPlayer 试玩（删除在试玩弹层的"更多"里，和聊天里一致）。
// 数据层见 toyCollectionService.js，样式见 toyCollection.css（颜色全部走主题变量，玻璃质感同首页）。
// 渲染到 document.body（portal），层级在聊天设置之上、试玩弹层之下。

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bird,
  Bug,
  Cat,
  ChevronDown,
  Cloud,
  Cookie,
  Dices,
  Fish,
  Flame,
  Flower2,
  Gamepad2,
  Ghost,
  Heart,
  Moon,
  Music,
  Play,
  Puzzle,
  Rocket,
  Smile,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';

import db from '../../../db';
import { listAllToys, resolvePlayerMessage } from './toyCollectionService';
import { TOY_SOURCE } from './toyService';
import './toyCollection.css';

const ToyPlayer = lazy(() => import('./ToyPlayer'));

// 每个玩具的"外表"（图标、糖果色）由它自己的 id 决定，
// 所以同一个玩具每次打开都长得一样，相邻的玩具又各不相同。
const TOY_ICONS = [
  Gamepad2, Ghost, Rocket, Cat, Star, Puzzle, Fish, Bird, Bug, Cookie,
  Cloud, Moon, Flower2, Heart, Sparkles, Zap, Music, Smile, Flame, Dices,
];

const TOY_ORBS = [
  { hi: '#eafff0', mid: '#8fe0a8', lo: '#43b877' },
  { hi: '#f2edff', mid: '#b9a8ff', lo: '#7d67ea' },
  { hi: '#fff1e4', mid: '#ffb47a', lo: '#f0803f' },
  { hi: '#ffecf5', mid: '#ff9ec8', lo: '#ee5c98' },
  { hi: '#e9f6ff', mid: '#7cc4ff', lo: '#3591e8' },
  { hi: '#fffbe3', mid: '#ffe27a', lo: '#f4b92a' },
];

// 角色没有头像时的渐变底色（按角色 id 取，同一个角色总是同一种）。
const AVATAR_TONES = [
  ['#7aa7d9', '#4f7fc0'],
  ['#f0a3c0', '#d96d97'],
  ['#a9a3e8', '#7a72d0'],
  ['#7fcfb0', '#3fa37f'],
  ['#f2b87f', '#df8a3f'],
  ['#9fb4c7', '#6b859e'],
];

const pickBySeed = (list, seed, salt = 0) => {
  const base = Math.abs(Math.trunc(Number(seed) || 0));
  return list[(base * 7 + salt) % list.length];
};

const SOURCE_LABELS = {
  [TOY_SOURCE.CHARACTER]: 'TA 主动做的',
  [TOY_SOURCE.USER]: '你点的菜',
  [TOY_SOURCE.USER_ASK]: '你开口要的',
};

const SORT_MODES = {
  newest: '按时间',
  recent: '按最近玩过',
};

const formatDay = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const orbVars = (toy) => {
  const orb = pickBySeed(TOY_ORBS, toy.id);
  return { '--orb-hi': orb.hi, '--orb-mid': orb.mid, '--orb-lo': orb.lo };
};

const playsText = (toy) => (toy.playCount > 0 ? `玩过 ${toy.playCount} 次` : '等你来玩');

const Avatar = ({ character, size }) => {
  const name = character?.name || 'TA';
  const style = { '--av': `${size}px` };

  if (character?.avatar) {
    return <img className="toybox-avatar" style={style} src={character.avatar} alt="" />;
  }

  const [from, to] = pickBySeed(AVATAR_TONES, character?.id ?? 0);

  return (
    <span
      className="toybox-avatar toybox-avatar--letter"
      style={{ ...style, background: `linear-gradient(145deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {String(name).slice(0, 1)}
    </span>
  );
};

// 圆角方块的彩色小图（便当格里用）。
const Art = ({ toy, size, radius, iconSize, dot = false }) => {
  const Icon = pickBySeed(TOY_ICONS, toy.id);

  return (
    <span
      className="toybox-art"
      style={{ ...orbVars(toy), '--art': `${size}px`, '--art-r': `${radius}px`, '--art-icon': `${iconSize}px` }}
      aria-hidden="true"
    >
      <span className="toybox-art__shine" />
      <Icon />
      {dot && <span className="toybox-art__dot" />}
    </span>
  );
};

// 有高光的糖果球（墨色大卡片里用）。
const Sphere = ({ toy, size }) => {
  const Icon = pickBySeed(TOY_ICONS, toy.id);

  return (
    <span className="toybox-sphere" style={{ ...orbVars(toy), '--d': `${size}px` }} aria-hidden="true">
      <span className="toybox-sphere__shine" />
      <Icon />
    </span>
  );
};

// 排序图标：lucide 里对应的图标项目里没用过，这里直接内联，避免引入未经确认的名字。
const SortIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="19"
    height="19"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3" />
  </svg>
);

// 空箱子的小插图：原创的一只玩具盒小角色，颜色全部跟随主题。
const EmptyArt = () => (
  <svg
    className="toybox-empty__art"
    viewBox="0 0 180 140"
    role="img"
    aria-label="空空的小玩具箱"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="90" cy="126" rx="46" ry="6" fill="currentColor" stroke="none" opacity="0.12" />
    <path d="M90 52V38" />
    <circle className="toybox-empty__bulb" cx="90" cy="32" r="5" fill="currentColor" />
    <rect x="52" y="52" width="76" height="20" rx="8" style={{ fill: 'var(--bg-surface)' }} />
    <rect x="58" y="70" width="64" height="50" rx="14" style={{ fill: 'var(--bg-surface)' }} />
    <circle cx="76" cy="92" r="3.2" fill="currentColor" stroke="none" />
    <circle cx="104" cy="92" r="3.2" fill="currentColor" stroke="none" />
    <path d="M83 102q7 6 14 0" strokeWidth="2.6" />
    <ellipse cx="68" cy="101" rx="5" ry="3" fill="currentColor" stroke="none" opacity="0.25" />
    <ellipse cx="112" cy="101" rx="5" ry="3" fill="currentColor" stroke="none" opacity="0.25" />
    <g className="toybox-empty__spark" strokeWidth="2.6">
      <path d="M30 56v14M23 63h14" />
      <path d="M152 70v12M146 76h12" />
      <path d="M40 104v9M35.5 108.5h9" />
    </g>
  </svg>
);

const ToyCollectionPage = ({ onClose }) => {
  const [toys, setToys] = useState([]);
  const [characters, setCharacters] = useState({});
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [filterId, setFilterId] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [playing, setPlaying] = useState(null);

  const openingRef = useRef(false);
  const closeButtonRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const rows = await listAllToys();
      const ids = [
        ...new Set(rows.map((row) => row.characterId).filter((id) => id !== undefined && id !== null)),
      ];
      const found = ids.length > 0 ? await db.characters.bulkGet(ids) : [];

      const map = {};
      found.forEach((character) => {
        if (character) map[character.id] = character;
      });

      setToys(rows);
      setCharacters(map);
      setLoadState('ready');
    } catch (error) {
      console.warn('读取小玩具收藏失败：', error);
      setLoadState((previous) => (previous === 'ready' ? previous : 'error'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // 试玩弹层自己也会响应 Escape，这里只在没有试玩弹层时才关收藏页，避免一次按键关两层。
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !playing) onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, playing]);

  // 角色筛选：只列出真的做过小玩具的角色，做得多的排前面。
  const characterChips = useMemo(() => {
    const counts = new Map();
    toys.forEach((toy) => {
      const key = String(toy.characterId);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, character: characters[id] || null }))
      .sort((a, b) => b.count - a.count);
  }, [toys, characters]);

  // 选中的角色已经没有玩具了（比如刚把最后一个删掉），回到"全部"。
  useEffect(() => {
    if (filterId !== 'all' && !characterChips.some((chip) => chip.id === filterId)) {
      setFilterId('all');
    }
  }, [characterChips, filterId]);

  // listAllToys 已经按做的时间排好（新到旧），筛选不会改变这个顺序。
  const filtered = useMemo(
    () => (filterId === 'all' ? toys : toys.filter((toy) => String(toy.characterId) === filterId)),
    [toys, filterId],
  );

  // 大卡片：最近玩过的那个；一个都没玩过，就是最新做的那个。
  const heroToy = useMemo(() => {
    if (filtered.length === 0) return null;

    const played = filtered.filter((toy) => toy.lastPlayedAt > 0);
    if (played.length > 0) {
      return [...played].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)[0];
    }

    return filtered[0];
  }, [filtered]);

  const heroPlayed = Boolean(heroToy && heroToy.lastPlayedAt > 0);

  // 便当格里不再重复放大卡片里的那个。
  const gridToys = useMemo(() => {
    const rest = filtered.filter((toy) => toy.id !== heroToy?.id);

    if (sortMode === 'recent') {
      return [...rest].sort(
        (a, b) => b.lastPlayedAt - a.lastPlayedAt || b.createdAt - a.createdAt,
      );
    }

    return rest;
  }, [filtered, heroToy, sortMode]);

  const toggleSort = () => setSortMode((mode) => (mode === 'newest' ? 'recent' : 'newest'));

  const handleOpen = async (toy) => {
    if (openingRef.current) return;
    openingRef.current = true;

    try {
      const message = await resolvePlayerMessage(toy);
      setPlaying({ toy, message });
    } catch (error) {
      console.warn('打开小玩具失败：', error);
    } finally {
      openingRef.current = false;
    }
  };

  // 关掉试玩弹层后重新读一遍：玩过次数变了，或者刚在里面删掉了这个玩具。
  const handleClosePlayer = () => {
    setPlaying(null);
    load();
  };

  const characterOf = (toy) => characters[toy.characterId] || null;
  const nameOf = (toy) => characterOf(toy)?.name || 'TA';

  const renderMeta = (toy, last) => (
    <span className="toybox-tile__meta">
      <Avatar character={characterOf(toy)} size={18} />
      <b>{nameOf(toy)}</b>
      <i aria-hidden="true">·</i>
      <span>{last}</span>
    </span>
  );

  // 每三个一组：一宽两小。最后如果只剩一张孤零零的小卡，就让它也撑成宽卡，避免右边空一块。
  const renderTile = (toy, index, total) => {
    const wide = index % 3 === 0 || (index === total - 1 && index % 3 === 1);
    const sourceLabel = SOURCE_LABELS[toy.source] || '';
    const label = `玩「${toy.title}」，${nameOf(toy)} 做的`;

    return (
      <li
        key={toy.id}
        className={`toybox-cell${wide ? ' toybox-cell--wide' : ''}`}
        style={{ '--toy-delay': `${Math.min(index, 8) * 50}ms` }}
      >
        {wide ? (
          <button
            type="button"
            className="toybox-tile toybox-tile--wide toybox-glass"
            aria-label={label}
            onClick={() => handleOpen(toy)}
          >
            <Art toy={toy} size={76} radius={22} iconSize={30} dot={toy.playCount === 0} />
            <span className="toybox-tile__main">
              <span className="toybox-tile__title">{toy.title}</span>
              <span className="toybox-tile__rules">{toy.rules}</span>
              <span className="toybox-tile__meta">
                <Avatar character={characterOf(toy)} size={18} />
                <b>{nameOf(toy)}</b>
                <i aria-hidden="true">·</i>
                <span>{playsText(toy)}</span>
                {sourceLabel && <em className="toybox-pill">{sourceLabel}</em>}
              </span>
            </span>
            <span className="toybox-play" aria-hidden="true">
              <Play />
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="toybox-tile toybox-tile--small toybox-glass"
            aria-label={label}
            onClick={() => handleOpen(toy)}
          >
            <span className="toybox-tile__top">
              <Art toy={toy} size={50} radius={16} iconSize={22} />
              {toy.playCount > 0 ? (
                <span className="toybox-badge">×{toy.playCount}</span>
              ) : (
                <span className="toybox-badge toybox-badge--new">NEW</span>
              )}
            </span>
            <span className="toybox-tile__title">{toy.title}</span>
            {sourceLabel && <em className="toybox-pill">{sourceLabel}</em>}
            {renderMeta(toy, formatDay(toy.createdAt))}
          </button>
        )}
      </li>
    );
  };

  const hasToys = toys.length > 0;
  const sectionLabel =
    filterId === 'all'
      ? '全部作品'
      : `${characterChips.find((chip) => chip.id === filterId)?.character?.name || 'TA'} 做的`;

  return createPortal(
    <div className="toybox" role="dialog" aria-modal="true" aria-label="小玩具收藏">
      <div className="toybox__blobs" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="toybox__scroll">
        <div className="toybox__inner">
          <div className="toybox__top">
            <button
              ref={closeButtonRef}
              type="button"
              className="toybox-round toybox-glass"
              aria-label="关闭"
              onClick={onClose}
            >
              <X />
            </button>
            <span className="toybox__kicker">TOY BOX</span>
            <span className="toybox__top-spacer" aria-hidden="true" />
          </div>

          <div className="toybox__title-row">
            <h1 className="toybox__title">小玩具</h1>
            <span className="toybox__count" aria-label={`共 ${filtered.length} 个`}>
              {String(filtered.length).padStart(2, '0')}
            </span>
          </div>

          {loadState === 'loading' && !hasToys && <div className="toybox-note">正在翻箱子……</div>}

          {loadState === 'error' && !hasToys && (
            <div className="toybox-note">没能打开小玩具箱，关掉再试一次。</div>
          )}

          {loadState === 'ready' && !hasToys && (
            <div className="toybox-empty toybox-glass">
              <EmptyArt />
              <h2>箱子还是空的</h2>
              <p>
                {'TA 做过的小玩具都会收在这里。你可以在聊天的互动菜单里点“让TA做个小玩具”，或者直接对 TA 说想玩什么。'}
              </p>
            </div>
          )}

          {heroToy && (
            <section
              className="toybox-hero"
              aria-label={heroPlayed ? '继续玩' : '最新做的小玩具'}
              style={{ '--toy-delay': '0ms' }}
            >
              <span className="toybox-hero__orb" aria-hidden="true">
                <Sphere toy={heroToy} size={150} />
              </span>
              <Sparkles className="toybox-hero__spark" aria-hidden="true" />

              <div className="toybox-hero__body">
                <div className="toybox-hero__kicker">{heroPlayed ? 'CONTINUE' : 'LATEST'}</div>
                <h2 className="toybox-hero__title">{heroToy.title}</h2>
                <p className="toybox-hero__sub">
                  {nameOf(heroToy)} 做的 · {heroPlayed ? `玩过 ${heroToy.playCount} 次` : '刚做好，还没玩过'}
                </p>
                <button type="button" className="toybox-hero__cta" onClick={() => handleOpen(heroToy)}>
                  <Play />
                  {heroPlayed ? '继续玩' : '来玩玩'}
                </button>
              </div>
            </section>
          )}

          {gridToys.length > 0 && (
            <>
              <div className="toybox__section">
                <h2>{sectionLabel}</h2>
                <button
                  type="button"
                  className="toybox__section-sort"
                  aria-label={`排序方式：${SORT_MODES[sortMode]}，点一下切换`}
                  onClick={toggleSort}
                >
                  {SORT_MODES[sortMode]}
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>

              <ul className="toybox-bento">
                {gridToys.map((toy, index) => renderTile(toy, index, gridToys.length))}
              </ul>
            </>
          )}
        </div>
      </div>

      {hasToys && (
        <nav className="toybox-dock toybox-glass toybox-glass--strong" aria-label="按角色筛选和排序">
          <button
            type="button"
            className="toybox-dock__all"
            aria-pressed={filterId === 'all'}
            onClick={() => setFilterId('all')}
          >
            全部
            <span>{toys.length}</span>
          </button>

          <div className="toybox-dock__people">
            {characterChips.map((chip) => {
              const selected = filterId === chip.id;
              const name = chip.character?.name || 'TA';

              return (
                <button
                  key={chip.id}
                  type="button"
                  className="toybox-dock__person"
                  aria-pressed={selected}
                  aria-label={`只看${name}做的，共 ${chip.count} 个`}
                  onClick={() => setFilterId(selected ? 'all' : chip.id)}
                >
                  <Avatar character={chip.character} size={36} />
                  {selected && <span className="toybox-dock__name">{name}</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="toybox-dock__sort"
            aria-label={`排序方式：${SORT_MODES[sortMode]}，点一下切换`}
            onClick={toggleSort}
          >
            <SortIcon />
          </button>
        </nav>
      )}

      {playing && (
        <Suspense fallback={null}>
          <ToyPlayer
            message={playing.message}
            characterName={nameOf(playing.toy)}
            onClose={handleClosePlayer}
          />
        </Suspense>
      )}
    </div>,
    document.body,
  );
};

export default ToyCollectionPage;
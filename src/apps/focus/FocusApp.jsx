// src/apps/focus/FocusApp.jsx
//
// 心流：专注 / 番茄钟。独立 app，和长期的"小伙伴"区域没有关系。
//
// 这一轮（第三轮）包含：开始前设置、进行中（成长图标 + 倒计时）、
// 放弃 / 提前结束、结束页、休息页，以及把结果作为普通消息写进被通知的聊天窗。
// 专注期间对被通知角色的静音是纯时间判断，写在聊天记录的 focus* 字段上
// （见 focusMuteState.js），本页面关掉、锁屏都不影响。
//
// 页面外壳照抄 HourglassApp 的做法：根容器 min-height + 内容居中限宽，
// 不用 h-[100dvh] + 内部滚动区域（嵌在 Hub 的 currentApp 容器里撑不满整页）。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import db from '../../db';
import {
  FOCUS_STATUS,
  finishFocusSession,
  getFocusPlaces,
  getRunningFocusSession,
  saveFocusPlaces,
  settleExpiredFocusSessions,
  startFocusSession,
} from './focusSessionService';
import { recordUnwrittenFocusSessions, writeFocusRecordToChats } from './focusRecordMessage';
import {
  getFocusGrowthStyle,
  getFocusLastPrefs,
  saveFocusGrowthStyle,
  saveFocusLastPrefs,
} from './focusSettings';
import { DEFAULT_GROWTH_STYLE } from './focusGrowthIcons';
import FocusSetup, { MAX_DURATION, MIN_DURATION } from './FocusSetup';
import FocusRunning from './FocusRunning';
import { FocusDone, FocusRest, REST_MINUTES } from './FocusDone';
import './focus.css';

const loadChatOptions = async () => {
  try {
    const [chats, characters] = await Promise.all([db.chats.toArray(), db.characters.toArray()]);
    const byId = new Map(characters.map((character) => [character.id, character]));
    const seen = new Set();
    const out = [];

    chats.forEach((chat) => {
      const character = byId.get(chat.characterId);
      if (!character || seen.has(chat.characterId)) return;
      seen.add(chat.characterId);
      out.push({
        chatId: chat.id,
        characterId: chat.characterId,
        name: String(character.name || 'TA'),
        avatar: character.avatar || '',
      });
    });

    return out;
  } catch (error) {
    console.warn('[focus] 读取聊天列表失败:', error);
    return [];
  }
};

const FocusApp = ({ onBackHub }) => {
  const [view, setView] = useState('loading'); // loading | setup | running | done | rest
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [task, setTask] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [places, setPlaces] = useState([]);
  const [place, setPlace] = useState('');
  const [chatOptions, setChatOptions] = useState([]);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [restEnabled, setRestEnabled] = useState(true);
  const [growthStyle, setGrowthStyle] = useState(DEFAULT_GROWTH_STYLE);

  const finishingRef = useRef(false);

  // 首次进入：结算过期记录、补写聊天记录、读设置，然后决定落在哪一页。
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const settled = await settleExpiredFocusSessions();
        await recordUnwrittenFocusSessions();

        const [style, savedPlaces, prefs, options, running] = await Promise.all([
          getFocusGrowthStyle(),
          getFocusPlaces(),
          getFocusLastPrefs(),
          loadChatOptions(),
          getRunningFocusSession(),
        ]);

        if (!active) return;

        setGrowthStyle(style);
        setPlaces(savedPlaces);
        setChatOptions(options);

        const validMinutes = Math.round(Number(prefs.durationMinutes));
        if (validMinutes >= MIN_DURATION && validMinutes <= MAX_DURATION) {
          setDurationMinutes(validMinutes);
        }
        if (typeof prefs.place === 'string' && savedPlaces.includes(prefs.place)) {
          setPlace(prefs.place);
        }
        if (typeof prefs.restEnabled === 'boolean') setRestEnabled(prefs.restEnabled);
        if (Array.isArray(prefs.chatIds)) {
          const existing = new Set(options.map((option) => option.chatId));
          setSelectedChatIds(prefs.chatIds.filter((id) => existing.has(id)));
        }

        setNow(Date.now());

        if (running) {
          setSession(running);
          setView('running');
        } else if (settled.length > 0) {
          setSession(settled[settled.length - 1]);
          setView('done');
        } else {
          setView('setup');
        }
      } catch (loadError) {
        console.error('[focus] 初始化失败:', loadError);
        if (active) {
          setError('专注页暂时打不开，请刷新后再试。');
          setView('setup');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // 只有进行中和休息时才需要每秒走一次表；是否到点永远用时间戳比，不依赖这个计时器是否准。
  useEffect(() => {
    if (view !== 'running' && view !== 'rest') return undefined;

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view]);

  const notifiedNames = useCallback(
    (target) =>
      (target?.chatIds || [])
        .map((id) => chatOptions.find((option) => option.chatId === id)?.name)
        .filter(Boolean),
    [chatOptions],
  );

  const settleSession = useCallback(
    async (status, reason = '') => {
      if (!session || finishingRef.current) return;
      finishingRef.current = true;
      setBusy(true);

      try {
        const result = await finishFocusSession(session.id, { status, reason });
        const row = result || (await db.focusSessions.get(session.id));

        if (row && row.status !== FOCUS_STATUS.RUNNING) {
          await writeFocusRecordToChats(row);
          setSession(row);
          setView('done');
        }
      } catch (finishError) {
        console.error('[focus] 结束专注失败:', finishError);
        setError('结束时出了点问题，请再试一次。');
      } finally {
        finishingRef.current = false;
        setBusy(false);
      }
    },
    [session],
  );

  // 到点自动完成。
  useEffect(() => {
    if (view !== 'running' || !session) return;
    if (now >= new Date(session.plannedEndAt).getTime()) {
      settleSession(FOCUS_STATUS.COMPLETED);
    }
  }, [view, session, now, settleSession]);

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const sessionId = await startFocusSession({
        task,
        durationMinutes,
        place,
        chatIds: selectedChatIds,
        restEnabled,
      });
      const row = await db.focusSessions.get(sessionId);

      await saveFocusLastPrefs({
        durationMinutes,
        place,
        restEnabled,
        chatIds: selectedChatIds,
      });

      setSession(row);
      setNow(Date.now());
      setView('running');
    } catch (startError) {
      if (startError?.message === 'focus_session_already_running') {
        const running = await getRunningFocusSession();
        if (running) {
          setSession(running);
          setView('running');
        }
      } else if (startError?.message === 'focus_invalid_duration') {
        setError('请填写 1 到 240 之间的分钟数。');
      } else {
        console.error('[focus] 开始专注失败:', startError);
        setError('没能开始，请再试一次。');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleToggleChat = (chatId) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId],
    );
  };

  const handlePlacesChange = async (next) => {
    setPlaces(next);
    try {
      await saveFocusPlaces(next);
    } catch (saveError) {
      console.warn('[focus] 保存地点失败:', saveError);
    }
  };

  const handleGrowthStyleChange = async (style) => {
    setGrowthStyle(style);
    try {
      await saveFocusGrowthStyle(style);
    } catch (saveError) {
      console.warn('[focus] 保存图标风格失败:', saveError);
    }
  };

  const goSetup = () => {
    setError('');
    setSession(null);
    setView('setup');
  };

  const startRest = () => {
    setRestEndsAt(Date.now() + REST_MINUTES * 60 * 1000);
    setNow(Date.now());
    setView('rest');
  };

  const titleByView = {
    loading: '心流',
    setup: '心流',
    running: '专注中',
    done: '这一轮',
    rest: '休息',
  };

  return (
    <div className="focus-app" data-view={view}>
      <div className="focus-wrap">
        <header className="focus-bar">
          <button type="button" className="focus-back" aria-label="返回" onClick={onBackHub}>
            <ArrowLeft size={18} />
          </button>
          <h1>{titleByView[view]}</h1>
          <span className="focus-bar-gap" />
        </header>

        {view === 'loading' && <p className="focus-muted focus-center">正在准备…</p>}

        {view === 'setup' && (
          <FocusSetup
            task={task}
            onTaskChange={setTask}
            durationMinutes={durationMinutes}
            onDurationChange={setDurationMinutes}
            places={places}
            place={place}
            onPlaceChange={setPlace}
            onPlacesChange={handlePlacesChange}
            chatOptions={chatOptions}
            selectedChatIds={selectedChatIds}
            onToggleChat={handleToggleChat}
            restEnabled={restEnabled}
            onRestChange={setRestEnabled}
            growthStyle={growthStyle}
            onGrowthStyleChange={handleGrowthStyleChange}
            onStart={handleStart}
            starting={busy}
            error={error}
          />
        )}

        {view === 'running' && session && (
          <>
            <FocusRunning
              session={session}
              now={now}
              growthStyle={growthStyle}
              notifiedNames={notifiedNames(session)}
              busy={busy}
              onAbandon={(reason) => settleSession(FOCUS_STATUS.ABANDONED, reason)}
              onFinishEarly={() => settleSession(FOCUS_STATUS.COMPLETED)}
            />
            {error && <p className="focus-error focus-center" role="alert">{error}</p>}
          </>
        )}

        {view === 'done' && session && (
          <FocusDone
            session={session}
            growthStyle={growthStyle}
            notifiedNames={notifiedNames(session)}
            onRest={startRest}
            onAgain={goSetup}
            onBack={onBackHub}
          />
        )}

        {view === 'rest' && (
          <FocusRest restEndsAt={restEndsAt} now={now} onAgain={goSetup} onBack={onBackHub} />
        )}
      </div>
    </div>
  );
};

export default FocusApp;
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CircleAlert,
  Clock3,
  MessageCircle,
  Music2,
  Pause,
  Play,
  ShieldCheck,
  Square,
  TimerReset,
  Wrench,
} from 'lucide-react';


import db from '../../../db';

import {
  createCompanionshipSession,
  getRunningCompanionship,
  stopCompanionship,
} from './companionshipService';



import {
  startCompanionshipScheduler,
} from './companionshipScheduler';

import {
  runCompanionshipTurn,
} from './companionshipAiService';

import {
  requestCompanionshipNotificationPermission,
} from './companionshipNotificationService';

import {
  createCompanionshipEvent,
  listCompanionshipEvents,
} from './companionshipEventService';

import './companionship.css';

const formatRemaining = (endsAt) => {
  if (!endsAt) return '尚未开始';

  const remaining = Math.max(
    0,
    new Date(endsAt).getTime() - Date.now(),
  );

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatClockTime = (value) => {
  if (!value) return '--:--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateTime = (value) => {
  if (!value) return '时间未知';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (startedAt, endedAt, now = Date.now()) => {
  if (!startedAt) return '00 分 00 秒';

  const startedTime = new Date(startedAt).getTime();

  const endedTime = endedAt
    ? new Date(endedAt).getTime()
    : now;

  if (
    !Number.isFinite(startedTime)
    || !Number.isFinite(endedTime)
  ) {
    return '00 分 00 秒';
  }

  const seconds = Math.max(
    0,
    Math.floor((endedTime - startedTime) / 1000),
  );

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')} 分 ${
    String(remainingSeconds).padStart(2, '0')
  } 秒`;
};

const getEventIcon = (type) => {
  switch (type) {
    case 'voice':
      return <Music2 size={15} />;
    case 'mcp':
      return <Wrench size={15} />;
    case 'error':
      return <AlertTriangle size={15} />;
    case 'reminder':
      return <Bell size={15} />;
    case 'assistant':
    case 'text':
      return <MessageCircle size={15} />;
    case 'silent':
      return <Pause size={15} />;
    case 'status':
    default:
      return <Check size={15} />;
  }
};

const getEventTypeLabel = (type) => {
  switch (type) {
    case 'voice':
      return '语音';
    case 'mcp':
      return '动作';
    case 'error':
      return '错误';
    case 'reminder':
      return '提醒';
    case 'assistant':
    case 'text':
      return '文字';
    case 'silent':
      return '静默';
    case 'status':
    default:
      return '状态';
  }
};

const getRelativeEventTime = (event, session) => {
  if (!event?.createdAt || !session?.startedAt) {
    return '';
  }

  const eventTime = new Date(event.createdAt).getTime();
  const startedTime = new Date(session.startedAt).getTime();

  if (
    !Number.isFinite(eventTime)
    || !Number.isFinite(startedTime)
  ) {
    return '';
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((eventTime - startedTime) / 1000),
  );

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `陪伴 ${String(minutes).padStart(2, '0')}:${
    String(seconds).padStart(2, '0')
  }`;
};


const getChatCharacterName = (chat, characters) => {
  const character = characters.find(
    (item) => String(item.id) === String(chat?.characterId),
  );

  return character?.name || '未命名陪伴';
};

const CompanionshipVoicePlayer = ({ messageId }) => {
  const [audioUrl, setAudioUrl] = useState('');
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadVoice = async () => {
      if (!messageId) {
        setStatus('missing');
        return;
      }

      try {
        const message = await db.messages.get(messageId);
        const audioBlob = message?.metadata?.audioBlob;

        if (!(audioBlob instanceof Blob)) {
          if (!cancelled) {
            setStatus('missing');
          }
          return;
        }

        const nextUrl = URL.createObjectURL(
          audioBlob,
        );

        if (cancelled) {
          return;
        }

        /*
         * 不在陪伴页面卸载时 revoke。
         * 音频已经属于聊天消息，后续 ChatRoom 仍需要继续使用。
         */
        setAudioUrl(nextUrl);
        setStatus('ready');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(
            error?.message || '语音暂时无法播放。',
          );
        }
      }
    };

    void loadVoice();

    return () => {
      cancelled = true;
    };
  }, [messageId]);

  if (status === 'loading') {
    return (
      <span className="companionship-voice-state">
        正在准备语音
      </span>
    );
  }

  if (status === 'missing') {
    return (
      <span className="companionship-voice-state">
        语音数据已保存，但当前没有可播放的音频
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="companionship-voice-state">
        {errorMessage}
      </span>
    );
  }

  return (
    <audio
      className="companionship-audio-player"
      src={audioUrl}
      controls
      preload="metadata"
    >
      你的浏览器不支持音频播放。
    </audio>
  );
};


export const CompanionshipPage = ({
  chats = [],
  characters = [],
  initialChatId = null,
  onBack,
}) => {
  const [selectedChatId, setSelectedChatId] = useState(
    initialChatId ? String(initialChatId) : '',
  );
  const [goal, setGoal] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  const [session, setSession] = useState(null);
  const [boundChat, setBoundChat] = useState(null);
  const [boundCharacter, setBoundCharacter] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAuthorization, setShowAuthorization] = useState(false);
  const [clock, setClock] = useState(Date.now());
  
  const resetCompanionshipForm = () => {
  setGoal('');
  setDurationMinutes(30);
  setIntervalMinutes(5);
  setNotificationEnabled(true);
};


useEffect(() => {
  if (!session?.id || session.status !== 'running') {
    return undefined;
  }

  const timer = window.setInterval(() => {
    setClock(Date.now());
  }, 1000);

  return () => {
    window.clearInterval(timer);
  };
}, [session?.id, session?.status]);


  const selectedChat = useMemo(
    () => chats.find(
      (chat) => String(chat.id) === String(selectedChatId),
    ),
    [chats, selectedChatId],
  );
const appendEvent = async (
  event,
  sessionId = session?.id,
) => {
  const localEvent = {
    id: event?.id
      || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: event?.createdAt
      || new Date().toISOString(),
    ...event,
  };

  setEvents((current) => {
    const exists = current.some(
      (item) => String(item.id) === String(localEvent.id),
    );

    if (exists) {
      return current.map((item) => (
        String(item.id) === String(localEvent.id)
          ? {
            ...item,
            ...localEvent,
          }
          : item
      ));
    }

    return [
      ...current,
      localEvent,
    ].slice(-100);
  });

  /*
   * AI Service 已经持久化过的事件只更新界面，
   * 不再重复写入数据库。
   */
  if (event?.id || !sessionId) {
    return localEvent;
  }

  try {
    const persistedEvent = await createCompanionshipEvent({
      sessionId,
      chatId: session?.chatId,
      ...event,
    });

    if (!persistedEvent?.id) {
      return localEvent;
    }

    setEvents((current) => current.map((item) => (
      item.id === localEvent.id
        ? {
          ...item,
          ...persistedEvent,
        }
        : item
    )));

    return persistedEvent;
  } catch (error) {
    console.error(
      '[Companionship] create event failed:',
      error,
    );

    return localEvent;
  }
};


 useEffect(() => {
  if (!selectedChatId) {
    setSession(null);
    setEvents([]);
    return undefined;
  }

  // 切换聊天框时，先清除上一个聊天框的页面状态
  setSession(null);
  setEvents([]);

  let cancelled = false;

  getRunningCompanionship(selectedChatId)
    .then((running) => {
      if (cancelled) return;

      setSession(running || null);
    })
    .catch((error) => {
      console.error(
        '[Companionship] load running session failed:',
        error,
      );

      if (!cancelled) {
        setSession(null);
        setEvents([]);
      }
    });

  return () => {
    cancelled = true;
  };
}, [selectedChatId]);


  useEffect(() => {
    if (!session?.id) {
      setEvents([]);
      return undefined;
    }

    let cancelled = false;

    listCompanionshipEvents({
      sessionId: session.id,
    })
      .then((items) => {
        if (!cancelled) {
          setEvents(items);
        }
      })
      .catch((error) => {
        console.error('[Companionship] load events failed:', error);

        if (!cancelled) {
          setEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.id]);

 useEffect(() => {
  if (!session) {
    resetCompanionshipForm();
    return;
  }

  setGoal(session.goal || '');
  setDurationMinutes(session.durationMinutes || 30);
  setIntervalMinutes(session.intervalMinutes || 5);
  setNotificationEnabled(
    session.notificationEnabled !== false,
  );
}, [session?.id]);


  useEffect(() => {
    if (!selectedChatId) {
      setBoundChat(null);
      setBoundCharacter(null);
      return undefined;
    }

    let cancelled = false;

    Promise.all([
      db.chats.get(selectedChatId),
      db.characters.toCollection().toArray(),
    ])
      .then(([chatData, characterList]) => {
        if (cancelled) return;

        setBoundChat(chatData || null);

        const character = characterList.find(
          (item) => String(item.id) === String(chatData?.characterId),
        );

        setBoundCharacter(character || null);
      })
      .catch((error) => {
        console.error('[Companionship] load bound chat failed:', error);

        if (!cancelled) {
          setBoundChat(null);
          setBoundCharacter(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChatId]);

  useEffect(() => {
    if (
      !session?.id
      || session.status !== 'running'
    ) {
      return undefined;
    }

    const scheduler = startCompanionshipScheduler({
      sessionId: session.id,

      onTrigger: async ({
        session: activeSession,
        reason,
      }) => {
        appendEvent({
          type: 'status',
          title: reason === 'recovered-missed-trigger'
            ? '接住错过的时刻'
            : '陪伴回合开始',
          content: '正在根据这个聊天框的记忆，决定如何陪伴你。',
        });

        await runCompanionshipTurn({
          session: activeSession,
          onEvent: (event) => {
            appendEvent(event);
          },
        });
      },

      onSessionChange: (latestSession) => {
        setSession(latestSession);
      },

      onError: (error) => {
        appendEvent({
          type: 'error',
          title: '陪伴暂时停顿',
          content: error?.message || '这一回合没有顺利完成。',
        });
      },
    });

    const refreshScheduler = () => {
      void scheduler.refresh();
    };

    document.addEventListener(
      'visibilitychange',
      refreshScheduler,
    );

    window.addEventListener(
      'focus',
      refreshScheduler,
    );

    window.addEventListener(
      'pageshow',
      refreshScheduler,
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        refreshScheduler,
      );

      window.removeEventListener(
        'focus',
        refreshScheduler,
      );

      window.removeEventListener(
        'pageshow',
        refreshScheduler,
      );

      scheduler.destroy();
    };
  }, [session?.id, session?.status]);

  const handleStart = async () => {
    setErrorMessage('');

    if (!selectedChat) {
      setErrorMessage('请先选择一个聊天框。');
      return;
    }

    if (notificationEnabled) {
      await requestCompanionshipNotificationPermission();
    }

    setShowAuthorization(true);
  };


const handleConfirmStart = async () => {
  setIsLoading(true);
  setErrorMessage('');
  setEvents([]);

  try {
    const chatId = selectedChat?.id;


      if (
        chatId === undefined
        || chatId === null
        || chatId === ''
      ) {
        throw new Error('请先选择一个聊天框。');
      }

      const created = await createCompanionshipSession({
        chatId,
        goal,
        durationMinutes,
        intervalMinutes,
        notificationEnabled,
      });

      setSelectedChatId(String(created.chatId));
      setSession(created);
      setShowAuthorization(false);
    } catch (error) {
      setErrorMessage(
        error?.message || '暂时无法绑定这个聊天框。',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
  if (!session?.id || !isRunning) return;

  await stopCompanionship(
    session.id,
    'stopped',
  );

  const endedAt = new Date().toISOString();

  setSession((current) => ({
    ...current,
    status: 'stopped',
    endedAt: current?.endedAt || endedAt,
    mcpAuthorizationGranted: false,
  }));

  await appendEvent({
    type: 'status',
    title: '陪伴由你结束',
    content: '这段陪伴已经停下，时间线仍会为你保留。',
    createdAt: endedAt,
  });
};


const handleExitFinishedSession = () => {
  setSession(null);
  setEvents([]);
  setErrorMessage('');
  setShowAuthorization(false);
  resetCompanionshipForm();
};


  const isRunning = session?.status === 'running';

const isFinished = (
  session?.status === 'completed'
  || session?.status === 'stopped'
);


  const runningChatTitle = (
    boundChat?.title
    || selectedChat?.title
    || getChatCharacterName(
      boundChat || selectedChat,
      boundCharacter ? [boundCharacter] : characters,
    )
    || '这段陪伴'
  );

  return (
  <main className="companionship-page">
    <header className="companionship-header">
      <button
        type="button"
        className="companionship-back-button"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        <span>返回对话</span>
      </button>

      <div className="companionship-heading">
        <span className="companionship-eyebrow">
          A QUIET INTERVAL
        </span>

        <h1>长期陪伴</h1>

        <p>
          让一段时间慢慢长出自己的节奏。
        </p>
      </div>
    </header>

    {!isRunning && !isFinished ? (
  <section className="companionship-setup">
        <div className="companionship-setup-layout">
          <div className="companionship-setup-visual">
            <div className="companionship-visual-caption">
              <strong>把时间交给一首歌</strong>
  
            </div>

            <div
              className="companionship-note-scene"
              aria-hidden="true"
            >
              <span className="companionship-floating-note note-one">
                ♪
              </span>

              <span className="companionship-floating-note note-two">
                ♫
              </span>

              <span className="companionship-floating-note note-three">
                ·
              </span>

              <div className="companionship-note-orbit">
                <span className="companionship-record-highlight" />
              </div>
            </div>
          </div>

          <div className="companionship-setup-content">
            <span className="companionship-eyebrow">
              SET YOUR RHYTHM
            </span>

            <h2 className="companionship-setup-title">
              准备一段
              <br />
              不被打扰的时间。
            </h2>

            <p className="companionship-setup-description">
              像开始播放一张唱片一样，先为这次陪伴选定对象、目标和节奏。
              AI 不会持续打断你，只会在合适的间隔里出现。
            </p>

            <label className="companionship-field">
              <span className="companionship-field-title">
                <b>绑定聊天框</b>
                <small>MEMORY SOURCE</small>
              </span>

              <select
                value={selectedChatId}
                onChange={(event) => {
  const nextChatId = event.target.value;

  setSelectedChatId(nextChatId);
  setSession(null);
  setEvents([]);
  setErrorMessage('');
  setShowAuthorization(false);

  resetCompanionshipForm();
}}

              >
                <option value="">请选择聊天框</option>

                {chats.map((chat) => (
                  <option
                    key={chat.id}
                    value={String(chat.id)}
                  >
                    {chat.title || '未命名聊天框'}
                    {' · '}
                    {getChatCharacterName(chat, characters)}
                  </option>
                ))}
              </select>

              <p className="companionship-field-hint">
                陪伴会沿用这个聊天框里的消息、记忆、摘要与角色状态。
              </p>
            </label>

            <label className="companionship-field">
              <span className="companionship-field-title">
                <b>本次陪伴目标</b>
                <small>YOUR INTENTION</small>
              </span>

              <textarea
                value={goal}
                onChange={(event) => {
                  setGoal(event.target.value);
                }}
                placeholder="例如：陪我学习两个小时，适时提醒我保持专注，但不要频繁打扰。"
                maxLength={1200}
                rows={4}
              />
            </label>

            <div className="companionship-field-grid">
              <label className="companionship-field">
                <span className="companionship-field-title">
                  <b>
                    <Clock3 size={13} />
                    陪伴时长
                  </b>
                  <small>SESSION</small>
                </span>

                <select
                  value={durationMinutes}
                  onChange={(event) => {
                    const value = Number(event.target.value);

                    setDurationMinutes(value);
                    setIntervalMinutes((current) => (
                      Math.min(current, value)
                    ));
                  }}
                >
                  {[15, 30, 45, 60, 90, 120].map((value) => (
                    <option key={value} value={value}>
                      {value} 分钟
                    </option>
                  ))}
                </select>
              </label>

              <label className="companionship-field">
                <span className="companionship-field-title">
                  <b>
                    <Clock3 size={13} />
                    主动间隔
                  </b>
                  <small>INTERVAL</small>
                </span>

                <select
                  value={intervalMinutes}
                  onChange={(event) => {
                    setIntervalMinutes(
                      Number(event.target.value),
                    );
                  }}
                >
                  {[1, 3, 5, 10, 15, 20, 30].map((value) => (
                    <option
                      key={value}
                      value={value}
                      disabled={value > durationMinutes}
                    >
                      每 {value} 分钟
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="companionship-setup-note">
              <ShieldCheck size={15} />

              <span>
                开始时会确认一次本次 MCP 授权。陪伴结束或手动停止后，
                授权会立即失效。
              </span>
            </div>

            <div className="companionship-setup-footer">
              <label className="companionship-toggle">
                <input
                  type="checkbox"
                  checked={notificationEnabled}
                  onChange={(event) => {
                    setNotificationEnabled(event.target.checked);
                  }}
                />

                <Bell size={14} />

                <span>允许浏览器通知</span>
              </label>

              <button
                type="button"
                className="companionship-primary-button"
                onClick={handleStart}
              >
                <Play size={15} />
                <span>开始陪伴</span>
              </button>
            </div>

            {errorMessage && (
              <p className="companionship-error">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </section>
    ) : isRunning ? (
  <section className="companionship-running">
        <div className="companionship-running-layout">
          <div className="companionship-running-visual">
            <div className="companionship-running-meta">
              <span className="companionship-eyebrow">
                NOW PLAYING · COMPANIONSHIP
              </span>

              <h2>{runningChatTitle}</h2>

              <p>
                这段时间正在被好好留住。
              </p>
            </div>

            <div
              className="companionship-focus-scene"
              aria-label="音符专注场景"
            >
              <div className="companionship-focus-ring ring-two" />

              <div className="companionship-focus-ring ring-one">
                <span className="companionship-record-highlight" />
              </div>

              <span className="companionship-focus-note">
                <span className="companionship-needle-arm" />
                <span className="companionship-needle-head" />
              </span>
            </div>

            <p className="companionship-running-slogan">
              你专心做自己的事，
              <br />
              我会在这里听着。
            </p>
          </div>

          <aside className="companionship-running-content">
            <div className="companionship-timer">
              <span>REMAINING TIME</span>

              <strong>
                {formatRemaining(session.endsAt)}
              </strong>

              <div className="companionship-timer-track">
                <span />
              </div>
            </div>

            <div className="companionship-companion-message">
              <span className="companionship-message-label">
                {boundCharacter?.name || '陪伴中'} · 刚刚
              </span>

              <p>
                你可以继续做自己的事，不用急着回复我。
                等你看到想分享的地方，再告诉我。
              </p>
            </div>

            <div className="companionship-running-status">
              <span className="companionship-status-dot" />

              <span>
                陪伴已连接。下一次主动出现会在合适的时候发生。
              </span>
            </div>

            <div className="companionship-bubble companionship-bubble-goal">
              <span className="companionship-bubble-label">
                本次目标
              </span>

              <p>
                {goal
                  || session.goal
                  || '保持自然、低打扰的陪伴。'}
              </p>
            </div>

            <div className="companionship-bubble companionship-bubble-status">
              <Check size={15} />

              <span>
                MCP 会话授权已开启。文字、语音和动作会根据情境自然组合。
              </span>
            </div>

          <div className="companionship-event-stream">
  {events.length === 0 && (
    <div className="companionship-empty-timeline">
      陪伴已经开始，下一次主动出现会在合适的时候发生。
    </div>
  )}

  {events.map((event) => (
    <div
      key={event.id}
      className={[
        'companionship-timeline-event',
        `companionship-timeline-event-${
          event.type || 'status'
        }`,
      ].join(' ')}
    >
      <div className="companionship-timeline-marker">
        {getEventIcon(event.type)}
      </div>

      <div className="companionship-timeline-content">
        <div className="companionship-timeline-meta">
          <span>
            {formatClockTime(event.createdAt)}
          </span>

          <span>
            {getRelativeEventTime(event, session)}
          </span>

          <span>
            {getEventTypeLabel(event.type)}
          </span>
        </div>

        {event.title && (
          <strong>
            {event.title}
          </strong>
        )}

        {event.content && (
          <p>{event.content}</p>
        )}

        {event.type === 'voice'
          && event.metadata?.messageId && (
          <CompanionshipVoicePlayer
            messageId={event.metadata.messageId}
          />
        )}
      </div>
    </div>
  ))}
</div>

            <button
              type="button"
              className="companionship-stop-button"
              onClick={handleStop}
            >
              <Square size={14} />
              <span>结束陪伴</span>
            </button>
          </aside>
        </div>
           </section>
    ) : isFinished ? (

    
           <section className="companionship-finished">
        <div className="companionship-finished-header">
          <span className="companionship-eyebrow">
            THE INTERVAL HAS ENDED
          </span>

          <h2>
            这段陪伴已经结束。
          </h2>

          <p>
            时间停在这里，但刚才发生过的事情仍然被好好保存着。
          </p>
        </div>

        <div className="companionship-finished-summary">
          <div className="companionship-finished-duration">
            <span>ACTUAL COMPANIONSHIP TIME</span>

            <strong>
              {formatDuration(
                session?.startedAt,
                session?.endedAt,
                clock,
              )}
            </strong>
          </div>

          <dl className="companionship-finished-times">
            <div>
              <dt>开始时间</dt>
              <dd>
                {formatDateTime(session?.startedAt)}
              </dd>
            </div>

            <div>
              <dt>结束时间</dt>
              <dd>
                {formatDateTime(
                  session?.endedAt || session?.endsAt,
                )}
              </dd>
            </div>

            <div>
              <dt>结束方式</dt>
              <dd>
                {session?.status === 'completed'
                  ? '预定时间已到'
                  : '你手动结束了陪伴'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="companionship-finished-timeline">
          <div className="companionship-finished-timeline-heading">
            <TimerReset size={16} />

            <span>本次陪伴时间线</span>
          </div>

          {events.length === 0 ? (
            <p className="companionship-empty-timeline">
              这次陪伴没有留下可见事件。
            </p>
          ) : (
            <div className="companionship-event-stream">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={[
                    'companionship-timeline-event',
                    `companionship-timeline-event-${
                      event.type || 'status'
                    }`,
                  ].join(' ')}
                >
                  <div className="companionship-timeline-marker">
                    {getEventIcon(event.type)}
                  </div>

                  <div className="companionship-timeline-content">
                    <div className="companionship-timeline-meta">
                      <span>
                        {formatClockTime(event.createdAt)}
                      </span>

                      <span>
                        {getRelativeEventTime(event, session)}
                      </span>

                      <span>
                        {getEventTypeLabel(event.type)}
                      </span>
                    </div>

                    {event.title && (
                      <strong>
                        {event.title}
                      </strong>
                    )}

                    {event.content && (
                      <p>{event.content}</p>
                    )}

                    {event.type === 'voice'
                      && event.metadata?.messageId && (
                      <CompanionshipVoicePlayer
                        messageId={event.metadata.messageId}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="companionship-primary-button"
          onClick={handleExitFinishedSession}
        >
          <ArrowLeft size={15} />
          <span>退出本次陪伴</span>
        </button>
      </section>
) : null}

    {showAuthorization && (
      <div className="companionship-dialog-backdrop">
        <section
          className="companionship-dialog"
          role="dialog"
          aria-modal="true"
        >
          <ShieldCheck size={20} />

          <h2>确认本次陪伴授权</h2>

          <p>
            在这次陪伴结束前，AI 可以使用当前已启用的全部 MCP 工具。
            该授权只对本次陪伴有效，结束或停止后立即失效。
          </p>

          <div className="companionship-dialog-actions">
            <button
              type="button"
              className="companionship-secondary-button"
              onClick={() => {
                setShowAuthorization(false);
              }}
            >
              先不开始
            </button>

            <button
              type="button"
              className="companionship-primary-button"
              onClick={handleConfirmStart}
              disabled={isLoading}
            >
              <ShieldCheck size={15} />

              {isLoading ? '正在准备' : '确认并开始'}
            </button>
          </div>
        </section>
      </div>
    )}
      </main>
  );
};

export default CompanionshipPage;


import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Clock3,
  Music2,
  Pause,
  Play,
  ShieldCheck,
  Square,
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

const getChatCharacterName = (chat, characters) => {
  const character = characters.find(
    (item) => String(item.id) === String(chat?.characterId),
  );

  return character?.name || '未命名陪伴';
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

  const selectedChat = useMemo(
    () => chats.find(
      (chat) => String(chat.id) === String(selectedChatId),
    ),
    [chats, selectedChatId],
  );

  const appendEvent = async (event, sessionId = session?.id) => {
    const localEvent = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...event,
    };

    setEvents((current) => [
      ...current,
      localEvent,
    ].slice(-80));

    if (!sessionId) return;

    try {
      const persistedEvent = await createCompanionshipEvent({
        sessionId,
        ...event,
      });

      if (persistedEvent?.id) {
        setEvents((current) => current.map((item) => (
          item.id === localEvent.id
            ? {
              ...item,
              ...persistedEvent,
            }
            : item
        )));
      }
    } catch (error) {
      console.error('[Companionship] create event failed:', error);
    }
  };

  useEffect(() => {
    if (!selectedChatId) {
      setSession(null);
      return undefined;
    }

    let cancelled = false;

    getRunningCompanionship(selectedChatId)
      .then((running) => {
        if (!cancelled) {
          setSession(running);
        }
      })
      .catch((error) => {
        console.error('[Companionship] load session failed:', error);

        if (!cancelled) {
          setSession(null);
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
    if (!session) return;

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
    if (!session?.id) return;

    await stopCompanionship(session.id, 'stopped');

    setSession((current) => ({
      ...current,
      status: 'stopped',
      mcpAuthorizationGranted: false,
    }));
  };

  const isRunning = session?.status === 'running';

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

    {!isRunning ? (
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
                  setSelectedChatId(event.target.value);
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
    ) : (
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
                <div className="companionship-bubble companionship-bubble-silent">
                  <Pause size={14} />

                  <span>
                    陪伴已经开始，下一次主动出现会在合适的时候发生。
                  </span>
                </div>
              )}

              {events.map((event) => (
                <div
                  key={event.id}
                  className={[
                    'companionship-bubble',
                    `companionship-bubble-${event.type || 'status'}`,
                  ].join(' ')}
                >
                  {event.type === 'mcp' && (
                    <Music2 size={14} />
                  )}

                  {event.type === 'voice' && (
                    <Music2 size={14} />
                  )}

                  {event.type === 'error' && (
                    <Pause size={14} />
                  )}

                  {event.type === 'status' && (
                    <Check size={14} />
                  )}

                  <div>
                    {event.title && (
                      <span className="companionship-bubble-label">
                        {event.title}
                      </span>
                    )}

                    <p>{event.content}</p>
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
    )}

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

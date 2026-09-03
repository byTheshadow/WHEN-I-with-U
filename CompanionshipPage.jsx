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

import {
  createCompanionshipSession,
  getRunningCompanionship,
  stopCompanionship,
} from './companionshipService';

import {
  startCompanionshipScheduler,
} from './companionshipScheduler';

import {
  notifyCompanionship,
  requestCompanionshipNotificationPermission,
} from './companionshipNotificationService';

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
  const [events, setEvents] = useState([]);
  const [schedulerError, setSchedulerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAuthorization, setShowAuthorization] = useState(false);

  const appendEvent = (event) => {
    setEvents((current) => [
      ...current,
      {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        ...event,
      },
    ].slice(-80));
  };

  const selectedChat = useMemo(
    () => chats.find(
      (chat) => String(chat.id) === String(selectedChatId),
    ),
    [chats, selectedChatId],
  );

  useEffect(() => {
    if (!selectedChatId) return undefined;

    let cancelled = false;

    getRunningCompanionship(selectedChatId)
      .then((running) => {
        if (!cancelled) {
          setSession(running);
        }
      })
      .catch((error) => {
        console.error('[Companionship] load session failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChatId]);

  useEffect(() => {
    if (!session?.id || session.status !== 'running') {
      return undefined;
    }

    const scheduler = startCompanionshipScheduler({
      sessionId: session.id,

      onSessionChange: (latest) => {
        if (latest) {
          setSession(latest);
        }
      },

      onTrigger: async ({ session: activeSession, reason }) => {
        appendEvent({
          type: 'status',
          title: '陪伴回合开始',
          content: reason === 'recovered-missed-trigger'
            ? '刚才错过的陪伴时刻已经被温柔地接住。'
            : 'AI 正在根据当前聊天框的记忆决定这一刻如何靠近。',
        });

        notifyCompanionship({
          title: '长期陪伴',
          body: '陪伴空间有新的动静。',
        });

        /*
         * 这里先保留为独立回调入口。
         *
         * 下一步接入 companionshipAiService 后，
         * 这里会统一处理：
         * - 读取 chatId 的历史消息和记忆；
         * - 注入 goal；
         * - 调用 AI Tool Orchestrator；
         * - 写入文字消息；
         * - 写入 MCP 动作事件；
         * - 生成 MiniMax realVoice 消息；
         * - 更新事件气泡。
         */
        void activeSession;
      },

      onError: (error) => {
        setSchedulerError(error?.message || '陪伴触发失败。');

        appendEvent({
          type: 'error',
          title: '陪伴暂时停顿',
          content: error?.message || '这一次没有顺利完成。',
        });
      },
    });

    const handleVisibility = () => {
      void scheduler.refresh();
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibility,
    );

    window.addEventListener('focus', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibility,
      );
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
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
    setSchedulerError('');
    setEvents([]);

    try {
      const created = await createCompanionshipSession({
        chatId: selectedChat.id,
        characterId: selectedChat.characterId,
        goal,
        durationMinutes,
        intervalMinutes,
        notificationEnabled,
      });

      setSession(created);
      setShowAuthorization(false);
    } catch (error) {
      setErrorMessage(error?.message || '暂时无法开始陪伴。');
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
          <span className="companionship-eyebrow">A QUIET INTERVAL</span>
          <h1>长期陪伴</h1>
          <p>让一段时间慢慢长出自己的节奏。</p>
        </div>
      </header>

      {!isRunning ? (
        <section className="companionship-setup">
          <div className="companionship-note-scene" aria-hidden="true">
            <Music2 className="companionship-note note-one" />
            <Music2 className="companionship-note note-two" />
            <Music2 className="companionship-note note-three" />
            <div className="companionship-note-orbit" />
          </div>

          <div className="companionship-bubble companionship-bubble-system">
            <Music2 size={15} />
            <span>选择一个聊天框，让陪伴沿着已有的记忆继续。</span>
          </div>

          <label className="companionship-field">
            <span>绑定聊天框</span>
            <select
              value={selectedChatId}
              onChange={(event) => setSelectedChatId(event.target.value)}
            >
              <option value="">请选择聊天框</option>
              {chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title || getChatCharacterName(chat, characters)}
                </option>
              ))}
            </select>
          </label>

          <label className="companionship-field">
            <span>本次陪伴目标</span>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="例如：陪我学习两个小时，适时提醒我保持专注，但不要频繁打扰。"
              maxLength={1200}
              rows={4}
            />
          </label>

          <div className="companionship-field-grid">
            <label className="companionship-field">
              <span><Clock3 size={14} />陪伴时长</span>
              <select
                value={durationMinutes}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDurationMinutes(value);
                  setIntervalMinutes((current) => Math.min(current, value));
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
              <span><Clock3 size={14} />主动间隔</span>
              <select
                value={intervalMinutes}
                onChange={(event) => setIntervalMinutes(Number(event.target.value))}
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

          <label className="companionship-toggle">
            <input
              type="checkbox"
              checked={notificationEnabled}
              onChange={(event) => setNotificationEnabled(event.target.checked)}
            />
            <Bell size={15} />
            <span>允许浏览器通知</span>
          </label>

          <div className="companionship-bubble companionship-bubble-notice">
            <ShieldCheck size={15} />
            <span>
              开始时会一次确认本次 MCP 授权。确认后，本次陪伴最长两小时内允许使用当前已启用的 MCP 工具。
            </span>
          </div>

          <div className="companionship-bubble companionship-bubble-warning">
            陪伴会尝试在后台继续运行，但浏览器和系统可能限制后台任务。建议尽量留在此页面，以获得更及时、完整的陪伴体验。
          </div>

          {errorMessage && (
            <p className="companionship-error">{errorMessage}</p>
          )}

          <button
            type="button"
            className="companionship-primary-button"
            onClick={handleStart}
          >
            <Play size={15} />
            开始陪伴
          </button>
        </section>
      ) : (
        <section className="companionship-running">
          <div className="companionship-running-top">
            <div>
              <span className="companionship-eyebrow">NOW GROWING</span>
              <h2>
                {selectedChat?.title || '这段陪伴'}
              </h2>
            </div>

            <div className="companionship-timer">
              <span>剩余</span>
              <strong>{formatRemaining(session.endsAt)}</strong>
            </div>
          </div>

          <div className="companionship-focus-scene" aria-label="音符专注场景">
            <div className="companionship-focus-ring ring-one" />
            <div className="companionship-focus-ring ring-two" />
            <Music2 className="companionship-focus-note" />
            <span>这段时间正在被好好留住</span>
          </div>

          <div className="companionship-bubble companionship-bubble-goal">
            <span className="companionship-bubble-label">本次目标</span>
            <p>{goal || session.goal || '保持自然、低打扰的陪伴。'}</p>
          </div>

          <div className="companionship-bubble companionship-bubble-status">
            <Check size={15} />
            <span>
              MCP 会话授权已开启。文字、语音和动作会根据情境自然组合。
            </span>
          </div>

          {schedulerError && (
            <p className="companionship-error">{schedulerError}</p>
          )}

          <div className="companionship-event-stream">
            {events.length === 0 && (
              <div className="companionship-bubble companionship-bubble-silent">
                <Pause size={14} />
                <span>陪伴已经开始，下一次主动出现会在合适的时候发生。</span>
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
                {event.type === 'mcp' && <Music2 size={14} />}
                {event.type === 'voice' && <Music2 size={14} />}
                {event.type === 'error' && <Pause size={14} />}
                {event.type === 'status' && <Check size={14} />}

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
            结束陪伴
          </button>
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
                onClick={() => setShowAuthorization(false)}
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

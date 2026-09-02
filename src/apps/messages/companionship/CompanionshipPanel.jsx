import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import db from '../../../db';


import {
  Bell,
  Check,
  Clock3,
  HeartHandshake,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react';

import {
  createCompanionshipSession,
  getRunningCompanionshipSession,
  stopCompanionshipSession,
} from './companionshipService';

import {
  startCompanionshipScheduler,
  stopCompanionshipScheduler,
} from './companionshipScheduler';

import {
  requestCompanionshipNotificationPermission,
  getNotificationPermission,
} from './companionshipNotificationService';

import {
  COMPANIONSHIP_DEFAULT_DURATION_MINUTES,
  COMPANIONSHIP_DEFAULT_INTERVAL_MINUTES,
  COMPANIONSHIP_MAX_DURATION_MINUTES,
  COMPANIONSHIP_MIN_INTERVAL_MINUTES,
  COMPANIONSHIP_MAX_INTERVAL_MINUTES,
} from './companionshipConstants';

const formatRemaining = (endsAt) => {
  const remaining = Math.max(
    0,
    new Date(endsAt).getTime() - Date.now(),
  );

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  }

  return `${minutes} 分钟 ${seconds} 秒`;
};

const CompanionshipPanel = ({
  chatId,
  chat,
  character,
  onClose,
  onChatUpdated,
}) => {
  const [existingSession, setExistingSession] = useState(null);
  const [goal, setGoal] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(
    COMPANIONSHIP_DEFAULT_DURATION_MINUTES,
  );
  const [intervalMinutes, setIntervalMinutes] = useState(
    COMPANIONSHIP_DEFAULT_INTERVAL_MINUTES,
  );
  const [notificationEnabled, setNotificationEnabled] = useState(true);
 
  const [responseMode, setResponseMode] = useState('auto');

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  const isRunning = Boolean(
    existingSession
    && existingSession.status === 'running'
    && new Date(existingSession.endsAt).getTime() > now,
  );

  const loadSession = useCallback(async () => {
    const session = await getRunningCompanionshipSession({
      chatId,
    });

    setExistingSession(session);
  }, [chatId]);

  useEffect(() => {
    void loadSession();

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void loadSession();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadSession]);

  const previousKeepAlive = Boolean(chat?.keepAlive);

  const characterName = useMemo(
    () => character?.name || '当前角色',
    [character?.name],
  );

  const handleNotificationChange = async (event) => {
    const checked = event.target.checked;

    if (!checked) {
      setNotificationEnabled(false);
      return;
    }

    const permission = await requestCompanionshipNotificationPermission();

    if (permission === 'granted') {
      setNotificationEnabled(true);
      return;
    }

    setNotificationEnabled(false);
    setErrorMessage(
      permission === 'denied'
        ? '浏览器没有授予通知权限。你仍然可以使用陪伴模式。'
        : '当前浏览器不支持通知。你仍然可以使用陪伴模式。',
    );
  };

  const handleOpenConfirmation = () => {
    setErrorMessage('');

    const safeDuration = Number(durationMinutes);
    const safeInterval = Number(intervalMinutes);

    if (
      !Number.isFinite(safeDuration)
      || safeDuration < 1
      || safeDuration > COMPANIONSHIP_MAX_DURATION_MINUTES
    ) {
      setErrorMessage('陪伴时长需要在 1 到 120 分钟之间。');
      return;
    }

    if (
      !Number.isFinite(safeInterval)
      || safeInterval < COMPANIONSHIP_MIN_INTERVAL_MINUTES
      || safeInterval > COMPANIONSHIP_MAX_INTERVAL_MINUTES
      || safeInterval > safeDuration
    ) {
      setErrorMessage(
        '主动触发间隔不能小于 1 分钟、不能大于 60 分钟，也不能超过陪伴时长。',
      );
      return;
    }

    setShowConfirmation(true);
  };

  const handleStart = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const session = await createCompanionshipSession({
        chatId,
        characterId: character?.id || chat?.characterId,
        goal,
        durationMinutes,
        intervalMinutes,
        notificationEnabled,
        responseMode,
        previousKeepAlive,
      });

      setExistingSession(session);
      setShowConfirmation(false);

      await startCompanionshipScheduler({
        chatId,
      });

     if (!previousKeepAlive && chat?.id) {
  await db.chats.update(chat.id, {
    keepAlive: true,
  });

  await onChatUpdated?.();
}


      window.dispatchEvent(
        new CustomEvent('companionship-started', {
          detail: {
            session,
          },
        }),
      );
    } catch (error) {
      setErrorMessage(
        error?.message || '陪伴模式没有成功开启。',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStop = async () => {
    if (!existingSession?.id) return;

    setIsSaving(true);
    setErrorMessage('');

    try {
     await stopCompanionshipSession(existingSession.id);
stopCompanionshipScheduler();

if (existingSession.keepAliveEnabledBySession) {
  await db.chats.update(existingSession.chatId, {
    keepAlive: existingSession.previousKeepAlive,
  });

  await onChatUpdated?.();
}

setExistingSession(null);


      window.dispatchEvent(
        new CustomEvent('companionship-stopped', {
          detail: {
            sessionId: existingSession.id,
          },
        }),
      );
    } catch (error) {
      setErrorMessage(
        error?.message || '陪伴模式没有成功停止。',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="companionship-layer">
      <button
        type="button"
        className="companionship-backdrop"
        aria-label="关闭陪伴面板"
        onClick={onClose}
      />

      <section
        className="companionship-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="companionship-title"
      >
        <header className="companionship-panel-header">
          <div>
            <p className="companionship-kicker">
              与 {characterName} 在一起
            </p>
            <h2 id="companionship-title">
              长期陪伴
            </h2>
          </div>

          <button
            type="button"
            className="companionship-icon-button"
            onClick={onClose}
            aria-label="关闭陪伴面板"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isRunning ? (
          <div className="companionship-running">
            <div className="companionship-running-mark">
              <HeartHandshake className="h-5 w-5" />
            </div>

            <p className="companionship-running-label">
              陪伴正在继续
            </p>

            <p className="companionship-running-time">
              还剩 {formatRemaining(existingSession.endsAt)}
            </p>

            <p className="companionship-muted">
              下一次主动触发会根据当前情境决定是否出现。
            </p>

            <button
              type="button"
              className="companionship-danger-button"
              onClick={handleStop}
              disabled={isSaving}
            >
              {isSaving ? '正在停止...' : '结束本次陪伴'}
            </button>
          </div>
        ) : (
          <>
            <div className="companionship-field">
              <label htmlFor="companionship-goal">
                本次陪伴目标
              </label>

              <textarea
                id="companionship-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="例如：陪我学习，提醒我保持专注，但不要频繁打扰。"
                maxLength={1200}
                rows={4}
              />

              <span className="companionship-counter">
                {goal.length} / 1200
              </span>
            </div>

            <div className="companionship-grid">
              <label className="companionship-field">
                <span>陪伴时长</span>
                <select
                  value={durationMinutes}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);

                    setDurationMinutes(nextValue);

                    if (intervalMinutes > nextValue) {
                      setIntervalMinutes(nextValue);
                    }
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
                <span>主动间隔</span>
                <select
                  value={intervalMinutes}
                  onChange={(event) => {
                    setIntervalMinutes(
                      Number(event.target.value),
                    );
                  }}
                >
                  {[1, 3, 5, 10, 15, 20, 30, 60]
                    .filter((value) => value <= durationMinutes)
                    .map((value) => (
                      <option key={value} value={value}>
                        每 {value} 分钟
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="companionship-option-list">
              <label className="companionship-option">
                <span className="companionship-option-icon">
                  <Bell className="h-4 w-4" />
                </span>

                <span className="companionship-option-copy">
                  <strong>浏览器通知</strong>
                  <small>
                    页面切到后台时，提醒你有新的陪伴动态。
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={notificationEnabled}
                  onChange={handleNotificationChange}
                />
              </label>

             

              <label className="companionship-option">
                <span className="companionship-option-icon">
                  <Volume2 className="h-4 w-4" />
                </span>

                <span className="companionship-option-copy">
                  <strong>表达方式</strong>
                  <small>
                    优先考虑 MCP 动作和声音表达。
                  </small>
                </span>

                <select
                  value={responseMode}
                  onChange={(event) => {
                    setResponseMode(event.target.value);
                  }}
                >
                  <option value="auto">由 AI 判断</option>
                  <option value="mcp-and-voice">优先 MCP 与声音</option>
                  <option value="text">仅文字</option>
                </select>
              </label>
            </div>

            <div className="companionship-notice">
              <Clock3 className="h-4 w-4 shrink-0" />
              <p>
                陪伴会尝试在后台继续运行，但浏览器、系统和 PWA
                可能限制后台任务。建议尽量留在此页面，以获得更及时、
                完整的陪伴体验。
              </p>
            </div>

            {errorMessage && (
              <p className="companionship-error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              className="companionship-primary-button"
              onClick={handleOpenConfirmation}
              disabled={isSaving}
            >
              <HeartHandshake className="h-4 w-4" />
              开始陪伴
            </button>
          </>
        )}

        {showConfirmation && (
          <div className="companionship-confirm-layer">
            <div className="companionship-confirm-card">
              <div className="companionship-confirm-icon">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <h3>确认本次陪伴权限</h3>

              <p>
                开启后，在本次陪伴有效期间，AI 可以使用当前已启用的
                MCP 工具。授权只属于本次陪伴，会在结束、停止或过期后失效。
              </p>

              <p>
                预计时长：{durationMinutes} 分钟；
                主动判断间隔：每 {intervalMinutes} 分钟。
              </p>

              <div className="companionship-confirm-actions">
                <button
                  type="button"
                  className="companionship-secondary-button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSaving}
                >
                  返回修改
                </button>

                <button
                  type="button"
                  className="companionship-primary-button"
                  onClick={handleStart}
                  disabled={isSaving}

                >
                  <Check className="h-4 w-4" />
                  {isSaving ? '正在开启...' : '确认并开始'}
                </button>
              </div>

            
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default CompanionshipPanel;

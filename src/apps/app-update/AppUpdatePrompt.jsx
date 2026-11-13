import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RotateCw,
  ShieldAlert,
  X,
} from 'lucide-react';

import { checkForNewVersion } from './appVersionCheck';
import './app-update.css';

const UPDATE_MESSAGE = {
  type: 'SKIP_WAITING',
};

const getServiceWorkerUrl = () => {
  return `${import.meta.env.BASE_URL}sw.js`;
};

const isWaitingWorkerAvailable = (registration) => {
  return Boolean(registration?.waiting);
};

const AppUpdatePrompt = ({
  isAppReady = true,
  isInsideChatRoom = false,
}) => {
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyTimedOut, setApplyTimedOut] = useState(false);
  const applyTimerRef = useRef(null);

  const markUpdateAvailable = useCallback((nextRegistration) => {
    if (!nextRegistration) return;

    setRegistration(nextRegistration);
    setUpdateAvailable(
      isWaitingWorkerAvailable(nextRegistration),
    );
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    let currentRegistration = null;
    let isUnmounted = false;

    const handleControllerChange = () => {
      if (isUnmounted) return;

      /*
       * 新 Service Worker 已经接管页面。
       * 只在用户主动点击更新后刷新，避免后台自动刷新。
       */
      if (isApplying) {
        if (applyTimerRef.current) {
          window.clearTimeout(applyTimerRef.current);
        }

        window.location.reload();
      }
    };

    const handleWorkerStateChange = (worker) => {
      if (worker.state !== 'installed') {
        return;
      }

      /*
       * 没有旧 controller 代表首次安装。
       * 首次安装不显示“有新版本”的弹窗。
       */
      if (!navigator.serviceWorker.controller) {
        return;
      }

      if (currentRegistration?.waiting === worker) {
        markUpdateAvailable(currentRegistration);
      } else if (currentRegistration?.waiting) {
        markUpdateAvailable(currentRegistration);
      }
    };

    const handleUpdateFound = () => {
      const installingWorker = currentRegistration?.installing;

      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener(
        'statechange',
        () => handleWorkerStateChange(installingWorker),
      );
    };

    const registerServiceWorker = async () => {
      try {
        const nextRegistration =
          await navigator.serviceWorker.register(
            getServiceWorkerUrl(),
          );

        if (isUnmounted) return;

        currentRegistration = nextRegistration;
        setRegistration(nextRegistration);

        if (nextRegistration.waiting) {
          markUpdateAvailable(nextRegistration);
        }

        nextRegistration.addEventListener(
          'updatefound',
          handleUpdateFound,
        );

        /*
         * 注册完成后主动检查一次。
         * 这不会强制刷新页面。
         */
        await nextRegistration.update();

        if (
          !isUnmounted &&
          nextRegistration.waiting
        ) {
          markUpdateAvailable(nextRegistration);
        }
      } catch (error) {
        console.warn(
          '[PWA] Service Worker 注册或更新检查失败：',
          error,
        );
      }
    };

    /*
     * 2026-11：只在打开应用时检查更新（注册完成后的那一次 update()），
     * 使用过程中不再因为切回前台、重新联网、定时而检查，避免发布修复时
     * 打断正在使用的用户。
     */

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );

    void registerServiceWorker();

    return () => {
      isUnmounted = true;

      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );

      if (currentRegistration) {
        currentRegistration.removeEventListener(
          'updatefound',
          handleUpdateFound,
        );
      }
    };
  }, [isApplying, markUpdateAvailable]);

  /*
   * 2026-11：打开应用时，除了 Service Worker 自己的更新检查，还看一眼线上
   * 页面是不是比当前跑的新。因为 sw.js 文件没变时（没改 CACHE_NAME），浏览器
   * 不会发现新的 Service Worker，也就不会有弹窗。这里只在刚打开时做一次
   * （稍等几秒，不和启动抢网络），不会在使用过程中反复检查。
   * 没有等待中的 Service Worker 时，点"载入新的布置"会直接刷新页面，
   * 此时缓存里的入口页已经被检测请求更新成最新版。
   */
  useEffect(() => {
    let cancelled = false;

    const timerId = window.setTimeout(async () => {
      const hasNewVersion = await checkForNewVersion({ force: true });

      if (!cancelled && hasNewVersion) {
        setUpdateAvailable(true);
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => () => {
    if (applyTimerRef.current) {
      window.clearTimeout(applyTimerRef.current);
    }
  }, []);

  const handleApplyUpdate = () => {
    if (isApplying) return;

    if (!registration) {
      window.location.reload();
      return;
    }

    const waitingWorker = registration.waiting;

    if (!waitingWorker) {
      window.location.reload();
      return;
    }

    setIsApplying(true);
    setApplyTimedOut(false);

    waitingWorker.postMessage(UPDATE_MESSAGE);

    /*
     * 2026-11：点击更新后弹窗保持显示"正在载入"状态。
     * 12 秒内新版本还没接管页面，就提示没有成功并给出重试入口，
     * 避免用户面对一个没有任何反馈的界面。
     */
    if (applyTimerRef.current) {
      window.clearTimeout(applyTimerRef.current);
    }

    applyTimerRef.current = window.setTimeout(() => {
      setApplyTimedOut(true);
    }, 12000);

    /*
     * 某些浏览器可能已经激活但没有及时触发 controllerchange。
     * 这里不立即刷新，优先等待新 SW 接管，避免刷新过早。
     */
  };

  const handleRetryApply = () => {
    setIsApplying(false);
    setApplyTimedOut(false);

    if (registration?.waiting) {
      setIsApplying(true);
      registration.waiting.postMessage(UPDATE_MESSAGE);

      applyTimerRef.current = window.setTimeout(() => {
        setApplyTimedOut(true);
      }, 12000);

      return;
    }

    window.location.reload();
  };

  const handleDismiss = () => {
    if (isApplying) return;
    setIsDismissed(true);
  };

  const shouldShow =
    isAppReady &&
    !isInsideChatRoom &&
    updateAvailable &&
    (!isDismissed || isApplying);

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className="app-update-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
    >
      <section className="app-update-window">
        <div className="app-update-frame">
          {!isApplying && (
            <button
              type="button"
              onClick={handleDismiss}
              className="app-update-close"
              aria-label="稍后更新"
              title="稍后更新"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>

          )}

          {isApplying ? (
            <div className="app-update-applying" role="status" aria-live="polite">
              <div className="app-update-spinner" aria-hidden="true" />

              <h2 id="app-update-title" className="app-update-title">
                {applyTimedOut ? '载入花了比预期更久的时间' : '新的布置正在载入'}
              </h2>

              <div className="app-update-progress" aria-hidden="true">
                <div className="app-update-progress-bar" />
              </div>

              <p className="app-update-note app-update-note-center">
                {applyTimedOut
                  ? '新的布置可能没有成功接管，可以再试一次。你的存档不会受到影响。'
                  : '请稍候，完成后页面会自动刷新，先不要关闭。'}
              </p>

              {applyTimedOut && (
                <button
                  type="button"
                  onClick={handleRetryApply}
                  className="app-update-primary"
                >
                  <RotateCw className="h-4 w-4" strokeWidth={1.6} />
                  <span>再试一次</span>
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="app-update-mark" aria-hidden="true">
              <ShieldAlert
                className="h-5 w-5"
                strokeWidth={1.35}
              />
            </div>

            <p className="app-update-eyebrow">
              A NEW ARRANGEMENT HAS ARRIVED
            </p>

            <h2
              id="app-update-title"
              className="app-update-title"
            >
              shadow 努力的工作了一会，
              <br />
              并奉上了新的更新
            </h2>

            <div className="app-update-divider" />

            <p className="app-update-note">
              注意，更新可能会存在 bug。
              <br />
              【with U】采用独立沙盒设计，App 无法打开并不会影响您原本的存档。
            </p>

            <p className="app-update-note">
              如遇 bug，通过 Q 群反馈是修复最快的途径。
              <br />
              感谢您的谅解。
            </p>

            <button
              type="button"
              onClick={handleApplyUpdate}
              className="app-update-primary"
            >
              <RotateCw
                className="h-4 w-4"
                strokeWidth={1.6}
              />
              <span>载入新的布置</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="app-update-secondary"
            >
              暂时不打扰我
            </button>

            </>
          )}

          <p className="app-update-footer">
            THE SANCTUARY REMAINS UNTOUCHED
          </p>
        </div>
      </section>
    </div>
  );
};

export default AppUpdatePrompt;
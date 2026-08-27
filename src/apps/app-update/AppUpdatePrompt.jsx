import React, { useCallback, useEffect, useState } from 'react';
import {
  RotateCw,
  ShieldAlert,
  X,
} from 'lucide-react';

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

    const checkForUpdate = () => {
      if (!currentRegistration) return;

      currentRegistration.update().catch(() => {
        /*
         * 网络不可用时静默处理。
         * 当前缓存版本仍然可以继续使用。
         */
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    const handleFocus = () => {
      checkForUpdate();
    };

    const handleOnline = () => {
      checkForUpdate();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    const intervalId = window.setInterval(
      checkForUpdate,
      60 * 60 * 1000,
    );

    void registerServiceWorker();

    return () => {
      isUnmounted = true;

      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );

      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.clearInterval(intervalId);

      if (currentRegistration) {
        currentRegistration.removeEventListener(
          'updatefound',
          handleUpdateFound,
        );
      }
    };
  }, [isApplying, markUpdateAvailable]);

  const handleApplyUpdate = () => {
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

    waitingWorker.postMessage(UPDATE_MESSAGE);

    /*
     * 某些浏览器可能已经激活但没有及时触发 controllerchange。
     * 这里不立即刷新，优先等待新 SW 接管，避免刷新过早。
     */
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const shouldShow =
    isAppReady &&
    !isInsideChatRoom &&
    updateAvailable &&
    !isDismissed &&
    !isApplying;

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
          <button
            type="button"
            onClick={handleDismiss}
            className="app-update-close"
            aria-label="稍后更新"
            title="稍后更新"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>

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

          <p className="app-update-footer">
            THE SANCTUARY REMAINS UNTOUCHED
          </p>
        </div>
      </section>
    </div>
  );
};

export default AppUpdatePrompt;

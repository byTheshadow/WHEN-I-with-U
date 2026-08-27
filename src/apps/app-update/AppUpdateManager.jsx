import React, { useEffect, useState } from 'react';
import { Cpu, RotateCw, Sparkles, BookOpen } from 'lucide-react';
import './app-update.css';

// 全局注册实例引用与检查状态回调，方便与 SettingsPage 联动
let globalRegistration = null;
const listeners = new Set();

const notifyListeners = (status) => {
  listeners.forEach((cb) => cb(status));
};

export const subscribeToUpdateStatus = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

// 触发 SW 手动检查更新
export const triggerUpdateCheck = async () => {
  if (!globalRegistration) {
    return { status: 'unsupported', message: '离线或容器未就绪' };
  }
  try {
    // 强制 SW 去服务器拉取最新的 sw.js 以确认更新
    await globalRegistration.update();
    
    // 如果没有发现处于 waiting 的 worker，说明当前已是最新
    if (!globalRegistration.waiting && !globalRegistration.installing) {
      return { status: 'latest', message: '已是最新布置' };
    }
    return { status: 'found', message: '已发现新的布置，正在下载' };
  } catch (err) {
    console.warn('[SW Update Check Error]', err);
    return { status: 'error', message: '检查未成功，请稍后再试' };
  }
};

export const AppUpdateManager = ({ isInsideChatRoom }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // 当新的 SW 接管控制权后，执行唯一的自动重载
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 注册 Service Worker 并获取其 registration 实例
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        globalRegistration = reg;
        console.log('[SW] 注册成功：', reg.scope);

        // 1. 如果已有 waiting worker，直接提示
        if (reg.waiting) {
          setUpdateAvailable(true);
          notifyListeners('available');
        }

        // 2. 监听新 worker 的安装状态
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // 已有旧 SW 控制，代表是真正的“有更新就绪”
                setUpdateAvailable(true);
                notifyListeners('available');
              } else {
                // 首次安装，静默完成，不作打扰
                notifyListeners('latest');
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] 注册失败：', err);
      });

    // 3. 自检：切回页面、回到前台或网络恢复时自检
    const checkUpdateSilently = () => {
      if (globalRegistration) {
        globalRegistration.update().catch(() => {});
      }
    };

    window.addEventListener('focus', checkUpdateSilently);
    window.addEventListener('online', checkUpdateSilently);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkUpdateSilently();
      }
    });

    // 每 1 小时自动在后台校对一次
    const intervalId = setInterval(checkUpdateSilently, 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('focus', checkUpdateSilently);
      window.removeEventListener('online', checkUpdateSilently);
      clearInterval(intervalId);
    };
  }, []);

  const handleApplyUpdate = () => {
    if (globalRegistration && globalRegistration.waiting) {
      // 触发 SKIP_WAITING 指令给 sw.js
      globalRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // 降级刷新
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // 如果没有更新，或者用户主动点击了稍后，或者当前正在聊天室中（避免遮挡聊天），则不弹出
  if (!updateAvailable || isDismissed || isInsideChatRoom) {
    return null;
  }

  return (
    <div className="gothic-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="gothic-window w-full max-w-[360px] overflow-hidden text-stone-300 font-mono text-sm leading-relaxed">
        <div className="gothic-border-inner">
          {/* 四个古典角折线 */}
          <div className="gothic-corner gothic-corner-tl" />
          <div className="gothic-corner gothic-corner-tr" />
          <div className="gothic-corner gothic-corner-bl" />
          <div className="gothic-corner gothic-corner-br" />

          {/* 哥特尖拱模拟标头 */}
          <div className="gothic-arch-header flex flex-col items-center">
            <div className="gothic-dot h-6 w-6 mb-1" />
            <span className="text-[10px] tracking-[0.2em] text-purple-400 uppercase font-semibold">
              sanctuary registry
            </span>
          </div>

          {/* 文学提示文本 */}
          <div className="space-y-4 px-1 py-2 text-xs text-stone-300">
            <p className="font-serif text-stone-200 text-[13px] leading-relaxed">
              shadow 努力的工作了一会，并奉上了新的更新。
            </p>
            
            <p className="border-l border-purple-900/60 pl-2 text-stone-400 italic text-[11px]">
              注意更新可能会存在 bug，[ with U ] 采用独立沙盒设计，app 无法打开并不会影响您原本的存档。
            </p>
            
            <p className="text-stone-400 text-[11px]">
              如遇 bug，通过 Q 群反馈是修复最快的途径。
              <br />
              感谢您的谅解。
            </p>
          </div>

          {/* 选项按钮 */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleApplyUpdate}
              className="gothic-btn-update flex w-full items-center justify-center gap-2 rounded-sm py-2.5 text-xs font-semibold tracking-wider transition-all"
            >
              <RotateCw className="h-3.5 w-3.5 animate-spin-slow" />
              立刻载入新布置
            </button>
            
            <button
              type="button"
              onClick={handleDismiss}
              className="gothic-btn-dismiss w-full rounded-sm py-2 text-[11px] tracking-wide transition-all"
            >
              稍后进入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

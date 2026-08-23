import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X, Mail, MessageSquare } from 'lucide-react';
import { subscribeAiEvents } from '../services/aiService';

export const triggerGlobalToast = ({
  title = '提示',
  content = '',
  iconType = 'bell',
  duration = 4000,
} = {}) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('WHEN_I_WITH_U_TOAST', {
      detail: {
        title,
        content,
        iconType,
        duration,
      },
    }),
  );
};

export const NotificationToast = () => {
  const [toast, setToast] = useState(null);
  const dismissTimerRef = useRef(null);

  const showToast = useCallback((nextToast) => {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
    }

    const duration = Number(nextToast?.duration) || 4000;

    setToast({
      title: nextToast?.title || '提示',
      content: nextToast?.content || '',
      iconType: nextToast?.iconType || 'bell',
      id: Date.now(),
    });

    dismissTimerRef.current = window.setTimeout(() => {
      setToast(null);
      dismissTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAiEvents((event) => {
      if (event.type === 'NEW_MESSAGE') {
        showToast({
          title: event.characterName || '新消息',
          content: event.preview || '收到一则新回复',
          iconType: 'chat',
          duration: 4000,
        });
      }

      if (event.type === 'NEW_HOME_BOARD_MESSAGE') {
        showToast({
          title: `${event.characterName || '伴侣'} 在主页发来随笔`,
          content: event.content || '',
          iconType: 'mail',
          duration: 5000,
        });
      }
    });

    const handleGlobalToast = (event) => {
      showToast(event.detail || {});
    };

    window.addEventListener('WHEN_I_WITH_U_TOAST', handleGlobalToast);

    return () => {
      unsubscribe();
      window.removeEventListener('WHEN_I_WITH_U_TOAST', handleGlobalToast);

      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, [showToast]);

  if (!toast) return null;

  return (
    <div className="fixed top-5 left-1/2 z-50 w-11/12 max-w-sm -translate-x-1/2 animate-fade-in-down">
      <div
        className="flex items-center justify-between rounded-2xl border p-3.5 text-left text-xs"
        style={{
          background: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex min-w-0 items-center gap-3 pr-2">
          <div
            className="shrink-0 rounded-xl p-2"
            style={{
              background: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            {toast.iconType === 'mail' ? (
              <Mail className="h-4 w-4" />
            ) : toast.iconType === 'chat' ? (
              <MessageSquare className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <h5 className="truncate font-serif font-bold">{toast.title}</h5>
            {toast.content && (
              <p className="truncate text-[11px] opacity-80">{toast.content}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
          aria-label="关闭通知"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// 🌟 必须追加此导出以完成铁律双重导出，修复构建错误！
export default NotificationToast;
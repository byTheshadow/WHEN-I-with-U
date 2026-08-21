import React, { useEffect, useState } from 'react';
import { Bell, X, Mail, MessageSquare } from 'lucide-react';
import { subscribeAiEvents } from '../services/aiService';

export const NotificationToast = () => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeAiEvents((event) => {
      if (event.type === 'NEW_MESSAGE') {
        setToast({
          title: event.characterName || '新消息',
          content: event.preview || '收到一则新回复',
          iconType: 'chat',
          id: Date.now()
        });

        setTimeout(() => setToast(null), 4000);
      }

      if (event.type === 'NEW_HOME_BOARD_MESSAGE') {
        setToast({
          title: `${event.characterName || '伴侣'} 在主页发来随笔`,
          content: event.content || '',
          iconType: 'mail',
          id: Date.now()
        });

        setTimeout(() => setToast(null), 5000);
      }
    });

    return unsubscribe;
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm animate-fade-in-down">
      <div
        className="flex items-center justify-between p-3.5 rounded-2xl shadow-2xl border text-xs text-left"
        style={{
          background: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
        }}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            className="p-2 rounded-xl shrink-0"
            style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            {toast.iconType === 'mail' ? (
              <Mail className="w-4 h-4" />
            ) : toast.iconType === 'chat' ? (
              <MessageSquare className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <h5 className="font-bold font-serif truncate">{toast.title}</h5>
            <p className="opacity-80 truncate text-[11px]">{toast.content}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;

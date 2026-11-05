// src/apps/messages/phoneScreen/PhoneScreenSettingsSection.jsx
//
// 聊天设置里的"角色手机截图"开关区块。字段 phoneScreenEnabled 是 chats
// 表上新增的无索引字段，不需要升级 db.version。
// 写法照抄 chatImageGen/ChatImageGenSettingsSection.jsx：自己持有状态、
// 自己读写 db.chats，通过 onUpdated 通知外层 ChatSettingsModal 重新拉取
// chat（外层传的就是 onUpdatedUserPersona，它自己会 loadChatData）。
import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
import db from '../../../db';

export const PhoneScreenSettingsSection = ({ chat, onUpdated }) => {
  const [isBusy, setIsBusy] = useState(false);

  const enabled = chat?.phoneScreenEnabled === true;

  const handleToggle = async () => {
    if (!chat?.id || isBusy) return;

    setIsBusy(true);

    try {
      const fields = { phoneScreenEnabled: !enabled };
      await db.chats.update(chat.id, fields);
      if (onUpdated) onUpdated(fields);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="space-y-2.5 p-3.5 rounded-2xl border w-full"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold">
          <Smartphone className="w-3.5 h-3.5" />
          <span>角色手机截图</span>
        </div>
        <span className="font-mono text-[9px] opacity-45">
          PHONE SCREEN
        </span>
      </div>

      <p className="text-[10px] opacity-55 leading-relaxed">
        开启后，角色会自己判断时机，像截了一张自己手机的屏幕一样发给你
        （支持锁屏通知栏、浏览器搜索记录、音乐播放器、聊天软件对话、备忘录
        笔记、日历日程六种画面）。画面内容由角色自己编写，每次的手机风格、
        颜色和内容都不一样；不会调用生图，也不产生额外费用。没有次数限制。
        截图里的内容会进入记忆。
      </p>

      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        className="w-full flex items-center justify-between p-2.5 rounded-xl border transition-all active:scale-95"
        style={{
          background: enabled ? 'var(--accent-color)' : 'var(--bg-main)',
          borderColor: enabled ? 'var(--accent-color)' : 'var(--divider)',
          color: enabled ? 'var(--accent-foreground)' : 'var(--text-main)',
        }}
      >
        <span className="text-[12px] font-medium">
          {enabled ? '已开启' : '已关闭'}
        </span>
        <span
          className="block w-9 h-5 rounded-full relative transition-colors"
          style={{
            background: enabled ? 'var(--accent-foreground)' : 'var(--divider)',
            opacity: enabled ? 0.9 : 0.6,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: enabled ? 'var(--accent-color)' : 'var(--bg-main)',
              transform: enabled ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </span>
      </button>
    </div>
  );
};

export default PhoneScreenSettingsSection;
// src/apps/messages/toys/ToySettingsSection.jsx
//
// 聊天设置里的"允许角色自己做小玩具"（每个聊天窗单独一份，写法同 AwaySettingsSection）。
// 只有一个开关，默认关闭。字段 chat.toySettings = { allowCharacterToy: boolean }，
// 是聊天记录上的无索引新增字段，不需要升级数据库版本。
// 注意：用户在聊天里明确说想要小玩具、或点菜单按钮，都不受这个开关限制。

import React, { useState } from 'react';

import db from '../../../db';
import { TOY_AUTO } from './toyConstants';
import { isCharacterToyAllowed } from './toyDirective';

const COOLDOWN_HOURS = Math.round(TOY_AUTO.cooldownMs / (60 * 60 * 1000));

const ToySettingsSection = ({ chat, character, onUpdated }) => {
  const [isBusy, setIsBusy] = useState(false);

  const allowed = isCharacterToyAllowed(chat);
  const characterName = character?.name || '角色';

  const handleToggle = async () => {
    if (!chat?.id || isBusy) return;

    setIsBusy(true);

    try {
      await db.chats.update(chat.id, { toySettings: { allowCharacterToy: !allowed } });
      if (onUpdated) onUpdated();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="space-y-3 rounded-2xl border p-3"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium">角色自己做小玩具</p>
          <p
            className="mt-1 text-[10px] leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            开启后，{characterName} 偶尔会在聊天里自己决定给你做一个小游戏，做好后以卡片出现在聊天里。
            同一个聊天大约 {COOLDOWN_HOURS} 小时最多主动做一次，每做一个会多花一次较长的 AI 调用。
            你直接对 TA 说想要小游戏，或点互动菜单里的“让TA做个小玩具”，不受这个开关和间隔限制。
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label="允许角色自己做小玩具"
          disabled={isBusy}
          onClick={handleToggle}
          className="relative h-5 w-10 shrink-0 overflow-hidden rounded-full transition-colors"
          style={{
            background: allowed ? 'var(--accent-color)' : 'var(--divider)',
          }}
        >
          <span
            className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform"
            style={{
              background: 'var(--bg-main)',
              transform: allowed ? 'translateX(20px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>
    </div>
  );
};

export default ToySettingsSection;
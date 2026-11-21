// src/apps/focus/FocusDone.jsx
//
// 结束页（完成 / 提前结束 / 放弃）和休息页。
// 这一轮只做到"记录已写进聊天"；写总结给角色、角色的小纸条放在下一轮。

import React from 'react';
import GrowthIcon from './GrowthIcon';
import { growthStageFromProgress } from './focusGrowthIcons';
import { formatCountdown } from './FocusRunning';
import FocusAfter, { useRestLines } from './FocusAfter';

export const REST_MINUTES = 5;

export const FocusDone = ({ session, growthStyle, notifiedNames, chatOptions, onRest, onAgain, onBack }) => {
  const abandoned = session.status === 'abandoned';
  const planned = Math.max(1, session.durationMinutes || 1);
  const actual = Math.max(0, session.actualMinutes || 0);
  const early = !abandoned && actual < planned;
  const progress = abandoned || early ? Math.min(1, actual / planned) : 1;
  const stage = abandoned || early ? growthStageFromProgress(progress) : 5;

  let title = '这一轮完成了';
  if (abandoned) title = '这一次放弃了';
  else if (early) title = '提前结束了';

  return (
    <div className="focus-done">
      <div className="focus-stage focus-stage--done">
        <GrowthIcon
          style={growthStyle}
          stage={stage}
          withered={abandoned}
          className="focus-gicon--stage"
        />
      </div>
      <h2 className="focus-done-title">{title}</h2>
      <div className="focus-meta">
        {session.task ? `${session.task} · ` : ''}
        {session.place ? `${session.place} · ` : ''}
        专注了 {actual} 分钟
      </div>
      <p className="focus-hint focus-hint--center">
        {notifiedNames.length > 0
          ? `已经在和 ${notifiedNames.join('、')} 的聊天里留下了一条记录，下次聊天时他们会知道。`
          : '这一轮没有通知任何人，所以聊天里没有留下记录。'}
      </p>

      <FocusAfter session={session} chatOptions={chatOptions} />

      {!abandoned && session.restEnabled && (
        <button type="button" className="focus-main-btn" onClick={onRest}>
          休息 {REST_MINUTES} 分钟
        </button>
      )}
      <button
        type="button"
        className={abandoned || !session.restEnabled ? 'focus-main-btn' : 'focus-ghost-btn'}
        onClick={onAgain}
      >
        再来一轮
      </button>
      <div className="focus-foot focus-foot--single">
        <button type="button" className="focus-link" onClick={onBack}>先到这里</button>
      </div>
    </div>
  );
};

export const FocusRest = ({ restEndsAt, now, session, chatOptions, onAgain, onBack }) => {
  const restLines = useRestLines(session, chatOptions);
  const left = restEndsAt - now;
  const over = left <= 0;

  return (
    <div className="focus-done">
      <div className="focus-rest-orb" aria-hidden="true">
        <span className="focus-rest-orb-o" />
        <span className="focus-rest-orb-r" />
      </div>
      <div className="focus-time">{formatCountdown(left)}</div>
      <p className="focus-hint focus-hint--center">
        {over ? restLines.over || '休息好了。' : restLines.rest || '站起来动一动，喝口水，看看远处。'}
      </p>
      <button type="button" className="focus-main-btn" onClick={onAgain}>再来一轮</button>
      <div className="focus-foot focus-foot--single">
        <button type="button" className="focus-link" onClick={onBack}>先到这里</button>
      </div>
    </div>
  );
};

// src/apps/focus/FocusRunning.jsx
//
// 专注进行中：环形进度 + 成长图标 + 倒计时。
// 唯一的"打断"方式是用户自己点"放弃"。切到别的 App、锁屏都不算中断，
// 时间一到就是完成（由 FocusApp 在到点时结算）。
// 也提供"提前结束"：不是放弃，会记为提前完成，图标停在当前阶段、不会枯萎。

import React, { useState } from 'react';
import GrowthIcon from './GrowthIcon';
import { growthStageFromProgress } from './focusGrowthIcons';

const RING_R = 120;
const RING_C = 2 * Math.PI * RING_R;

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

export const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const FocusRunning = ({
  session,
  now,
  growthStyle,
  notifiedNames,
  busy,
  onAbandon,
  onFinishEarly,
}) => {
  const [sheet, setSheet] = useState(null); // null | 'abandon' | 'early'
  const [reason, setReason] = useState('');

  const startMs = new Date(session.startedAt).getTime();
  const endMs = new Date(session.plannedEndAt).getTime();
  const span = Math.max(1, endMs - startMs);
  const progress = Math.max(0, Math.min(1, (now - startMs) / span));
  const stage = growthStageFromProgress(progress);

  return (
    <div className="focus-running">
      <div className="focus-stage">
        <svg className="focus-ring" viewBox="0 0 280 280" aria-hidden="true">
          <circle className="focus-ring-track" cx="140" cy="140" r={RING_R} />
          <circle
            className="focus-ring-prg"
            cx="140"
            cy="140"
            r={RING_R}
            transform="rotate(-90 140 140)"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
          />
        </svg>
        <GrowthIcon style={growthStyle} stage={stage} className="focus-gicon--stage" />
      </div>

      <div className="focus-time" aria-live="off">{formatCountdown(endMs - now)}</div>
      <div className="focus-task">{session.task || '专注中'}</div>
      <div className="focus-meta">
        {session.place ? `${session.place} · ` : ''}共 {session.durationMinutes} 分钟
      </div>
      <p className="focus-hint focus-hint--center">
        {notifiedNames.length > 0
          ? `${notifiedNames.join('、')} 知道你在专注，不会来打扰你。`
          : '这一轮没有通知任何人。'}
      </p>

      <div className="focus-foot">
        <button type="button" className="focus-link" disabled={busy} onClick={() => setSheet('early')}>
          提前结束
        </button>
        <button type="button" className="focus-link" disabled={busy} onClick={() => setSheet('abandon')}>
          放弃这一次
        </button>
      </div>

      {sheet && (
        <div className="focus-sheet-mask" onClick={() => !busy && setSheet(null)}>
          <div className="focus-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet === 'abandon' ? (
              <>
                <h4>要放弃这一次吗</h4>
                <p>放弃后，这株小东西会枯萎，聊天里也会留下一条记录。想说一句原因的话可以写在下面，不写也行。</p>
                <input
                  className="focus-input"
                  type="text"
                  value={reason}
                  maxLength={60}
                  placeholder="原因（可以不写）"
                  onChange={(event) => setReason(event.target.value)}
                />
              </>
            ) : (
              <>
                <h4>现在结束吗</h4>
                <p>提前结束不算放弃，会记为提前完成，图标停在现在的样子。</p>
              </>
            )}
            <button type="button" className="focus-main-btn" disabled={busy} onClick={() => setSheet(null)}>
              继续专注
            </button>
            <div className="focus-foot focus-foot--single">
              <button
                type="button"
                className="focus-link"
                disabled={busy}
                onClick={() => (sheet === 'abandon' ? onAbandon(reason) : onFinishEarly())}
              >
                {sheet === 'abandon' ? '放弃' : '提前结束'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusRunning;

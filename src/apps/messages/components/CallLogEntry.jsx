import React, { useState } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video, Volume2 } from 'lucide-react';

import CallReviewModal from '../call/CallReviewModal';

import './call-log-entry.css';

// 消息流里的通话记录条，跟微信的通话记录行是同一个思路：正常情况下
// 只是一条不可点的小卡片；如果这通电话还"活着"（响铃中/进行中），
// 点一下会把已经存在的全局通话悬浮/全屏界面重新唤出来；如果已经
// 结束且确实说过话，点一下改为打开只读的回看弹窗（CallReviewModal）。
const formatCallDuration = (metadata) => {
  const { connectedAt, endedAt } = metadata;
  if (!connectedAt || !endedAt) return null;

  const totalSeconds = Math.max(
    0,
    Math.round((new Date(endedAt) - new Date(connectedAt)) / 1000)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const CallLogEntry = ({ message, isUser, character, userName, userAvatar }) => {
  const [showReview, setShowReview] = useState(false);
  const metadata = message.metadata || {};
  const { status, direction, declined, mode } = metadata;
  const isLive = status === 'ringing' || status === 'active';
  const hasTranscript = Array.isArray(metadata.turns) && metadata.turns.length > 0;
  const isReviewable = status === 'ended' && !declined && hasTranscript;
  const duration = formatCallDuration(metadata);
  const isMissedOrDeclined = status === 'ended' && declined;
  // 角色主动来电时带的理由(callScheduler.js 生成);没接的来电在记录条上
  // 留一句,云端邀请和旧记录没有这个字段,按空串处理。
  const missedReason = isMissedOrDeclined && direction === 'incoming'
    ? String(metadata.reason || '').trim()
    : '';

  // 视频通话的记录条文案跟语音通话区分开，其余（点开回看、记忆落地
  // 等）走的都是同一套逻辑。
  const callTypeLabel = mode === 'video' ? '视频通话' : '语音通话';
 
  let title;
  let subtitle;
  let Icon;
 
  if (status === 'ringing') {
    title = callTypeLabel;
    subtitle = direction === 'incoming' ? '来电响铃中...' : '正在呼叫...';
    Icon = direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  } else if (status === 'active') {
    title = callTypeLabel;
     subtitle = '通话进行中...';
    Icon = Phone;
  } else if (isMissedOrDeclined) {
    title = direction === 'incoming'
      ? '未接听的来电'
      : (metadata.unavailable ? '对方暂时无法接听' : '对方拒绝了通话');
    subtitle = null;
    Icon = PhoneMissed;
  } else if (duration) {
    title = callTypeLabel;
    subtitle = `通话时长 ${duration}`;
    Icon = direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  } else {
    title = callTypeLabel;
    subtitle = '通话已结束';
    Icon = Phone;
  }
 

  const handleClick = () => {
    if (isLive) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('call-overlay-open'));
      }
      return;
    }

    if (isReviewable) {
      setShowReview(true);
    }
  };

  const isClickable = isLive || isReviewable;

  // 通话记录条始终展示"对方"（角色）的头像——跟手机通话记录的习惯
  // 一致，不管这通电话是谁打给谁的，条目上认的都是聊天对象。
  const avatarSrc = character?.avatar;
  const avatarFallback = character?.name?.[0] || 'C';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!isClickable}
        className={`call-log-entry flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition-transform ${
          isClickable ? 'active:scale-[0.97]' : 'call-log-entry--static'
        } ${isMissedOrDeclined ? 'call-log-entry--missed' : ''} ${
          isUser ? 'flex-row-reverse text-right' : 'flex-row'
        }`}
      >
        <span className="call-log-entry__avatar-ring relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={character?.name}
              className="h-9 w-9 rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full font-serif text-sm font-semibold"
              style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
            >
              {avatarFallback}
            </span>
          )}

          <span
            className={`call-log-entry__badge ${status === 'ringing' ? 'call-log-entry__badge--pulse' : ''}`}
            style={{
              background: isMissedOrDeclined ? '#ef4444' : 'var(--accent-color)',
              color: isMissedOrDeclined ? '#fff' : 'var(--accent-foreground)',
            }}
          >
           {mode === 'video' && !isMissedOrDeclined ? (
              <Video className="h-2.5 w-2.5" />
            ) : mode === 'real' && !isMissedOrDeclined ? (
              <Volume2 className="h-2.5 w-2.5" />
            ) : (
              <Icon className="h-2.5 w-2.5" />
            )}
          </span>
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[12.5px] font-medium" style={{ color: 'var(--text-main)' }}>
            {title}
          </span>
          {subtitle && (
            <span
              className="truncate text-[11px]"
              style={{ color: isMissedOrDeclined ? '#ef4444' : 'var(--text-muted)' }}
            >
                          {subtitle}
            </span>
          )}
          {missedReason && (
            <span className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {`「${missedReason}」`}
            </span>
          )}
        </span>
      </button>

      {showReview && (
        <CallReviewModal
          message={message}
          character={character}
          userName={userName}
          userAvatar={userAvatar}
          onClose={() => setShowReview(false)}
        />
      )}
    </>
  );
};

export default CallLogEntry;
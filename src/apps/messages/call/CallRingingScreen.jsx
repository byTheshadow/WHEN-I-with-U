import React from 'react';
import { Phone, PhoneOff, Video, VideoOff, Volume2, Sparkles } from 'lucide-react';

import './call-ringing-screen.css';

// 来电 / 拨号中的独立视觉层，和"通话中"界面分开维护。
// 布局思路参考了一张约会 App 的来电截图（大头像居中 + 光环 + 底部
// 操作区），但配色完全走 app 自己的主题变量（--accent-color 等），
// 不带参考图原本的暖橙色调。用户呼出、角色呼入两个方向共用同一层，
// 只有底部按钮组不同。
//
// 布局分三段：顶部头像+名字，中下段是一整块声波可视化区域（占满
// 剩余空间，视觉上是屏幕主体），底部是操作按钮。
const CallRingingScreen = ({
  character,
    direction,
  statusLabel,
  reason,
  realVoiceAvailable,
  videoVisionAvailable,
  onAccept,
  onDecline,
  onCancel,
  voicemailSlot,
}) => {
  const isIncoming = direction === 'incoming';

  return (
    <div className="call-ringing flex h-full flex-col items-center">
      <div className="call-ringing__top flex shrink-0 flex-col items-center gap-5 pt-4">
        <div className="call-ringing__avatar-wrap relative flex items-center justify-center">
          <span className="call-ringing__ring call-ringing__ring--1" aria-hidden="true" />
          <span className="call-ringing__ring call-ringing__ring--2" aria-hidden="true" />
          <span className="call-ringing__ring call-ringing__ring--3" aria-hidden="true" />

          {character?.avatar ? (
            <img
              src={character.avatar}
              alt={character.name}
              className="call-ringing__avatar relative object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="call-ringing__avatar relative flex items-center justify-center font-serif text-4xl font-semibold">
              {character?.name?.[0] || 'C'}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <h2
            className="font-serif text-xl font-semibold"
            style={{ textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}
          >
            {character?.name}
          </h2>

          <p
            className="font-mono text-[11px] tracking-[0.1em]"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
                        {statusLabel}
          </p>

          {isIncoming && reason && (
            <p className="call-ringing__reason">{reason}</p>
          )}
        </div>
            </div>

      <div className="call-ringing__wave-zone flex w-full flex-1 items-center justify-center">
        {voicemailSlot}
        <div
          className="call-ringing__wave flex items-center justify-center gap-[5px]"
          aria-hidden="true"
          style={voicemailSlot ? { display: 'none' } : undefined}
        >
          {Array.from({ length: 26 }).map((_, index) => (
            <span
              key={index}
              className="call-ringing__wave-bar"
              style={{
                animationDelay: `${index * 0.07}s`,
                animationDuration: `${1.1 + (index % 5) * 0.14}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="call-ringing__controls flex shrink-0 flex-col items-center gap-4 pb-4">
        {isIncoming ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onAccept('text')}
                className="call-ringing__pill flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
              >
                <Phone className="h-3.5 w-3.5" />
                接听（文字语气）
              </button>

              {realVoiceAvailable && (
                <button
                  type="button"
                  onClick={() => onAccept('real')}
                  className="call-ringing__pill flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  接听（真实语音）
                </button>
              )}

              {realVoiceAvailable && (
                <button
                  type="button"
                  onClick={() => onAccept('auto')}
                  className="call-ringing__pill flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  接听（由TA决定）
                </button>
              )}

              {videoVisionAvailable ? (
                <button
                  type="button"
                  onClick={() => onAccept('video')}
                  className="call-ringing__pill flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform active:scale-95"
                >
                  <Video className="h-3.5 w-3.5" />
                  视频接听
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="call-ringing__pill flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold opacity-40 cursor-not-allowed"
                 title="当前模型不支持视频，请在设置里配置视频通话 API（需要支持图片输入的模型）"
                >
                  <VideoOff className="h-3.5 w-3.5" />
                  视频（不支持）
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onDecline}
              className="call-ringing__hangup flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95"
              aria-label="拒绝通话"
              title="拒绝通话"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="call-ringing__hangup flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95"
            aria-label="取消呼叫"
            title="取消呼叫"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CallRingingScreen;
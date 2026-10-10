// src/apps/messages/screenEffects/FullscreenEffectLayer.jsx
//
// 全屏特效图层：监听 screen-effect-play 事件，播一次氛围动画或专注文字，
// 几秒后自动淡出，点击画面可以提前关闭。
//
// - 聊天室里挂一份（传 chatId），只响应自己聊天窗的事件，铺满聊天室容器。
// - 设置页预览用 preview 模式：只响应 detail.preview 的事件，
//   通过 portal 挂到 body 上用 fixed 铺满整个窗口。
//
// 底色（背景渐变）是否显示按预设读用户偏好（screenEffectPrefs.js），
// 预览时可以用 detail.backdrop 直接覆盖。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  AMBIENT_DURATION_MS,
  FADE_OUT_MS,
  FLAKE_PATH,
  FOCUS_DURATION_MS,
  FOCUS_PRESET,
  SCREEN_EFFECT_EVENT,
  buildFocusLayout,
  getPresetById,
} from './screenEffectPresets';
import { getBackdropPref } from './screenEffectPrefs';
import './screenEffects.css';

const rand = (min, max) => min + Math.random() * (max - min);
const round = (value, digits = 1) => Number(value.toFixed(digits));

// 一半粒子从"已经在半空"的位置开始（负延迟），避免只有七八秒的画面
// 一开始光秃秃的；另一半稍后从顶部进入，保持持续飘落的感觉。
const spreadDelay = (duration) => (
  Math.random() < 0.6 ? -rand(0, duration) : rand(0, 2.2)
);

const buildParticles = (presetId) => {
  switch (presetId) {
    case 'snow':
      return Array.from({ length: 18 }, () => {
        const size = round(rand(18, 50), 0);
        const duration = round(rand(9, 15));
        return {
          size,
          near: size > 40,
          left: round(rand(0, 96)),
          duration,
          delay: round(spreadDelay(duration), 2),
          opacity: round(rand(0.65, 1), 2),
        };
      });
    case 'meteor':
      return {
        meteors: Array.from({ length: 6 }, (_, index) => ({
          top: round(rand(0, 26)),
          left: round(rand(4, 90)),
          duration: round(rand(2, 2.9)),
          delay: round(index * 0.55 + rand(0, 0.4), 2),
        })),
        stars: Array.from({ length: 26 }, () => ({
          top: round(rand(0, 90)),
          left: round(rand(0, 98)),
          size: round(rand(1.5, 3)),
          duration: round(rand(2, 4.5)),
          delay: round(rand(0, 3), 2),
        })),
      };
    case 'aurora':
      return {
        blobs: [
          { top: 6, left: 0, size: 440, color: 'rgba(72,196,150,0.55)', duration: 9, delay: 0 },
          { top: 18, left: 34, size: 480, color: 'rgba(92,128,220,0.5)', duration: 11, delay: 1.5 },
          { top: 4, left: 62, size: 420, color: 'rgba(150,100,210,0.45)', duration: 10, delay: 3 },
          { top: 42, left: 18, size: 360, color: 'rgba(72,196,150,0.3)', duration: 12, delay: 2 },
        ],
        stars: Array.from({ length: 18 }, () => ({
          top: round(rand(0, 70)),
          left: round(rand(0, 98)),
          size: round(rand(1.5, 2.6)),
          duration: round(rand(2.5, 5)),
          delay: round(rand(0, 3), 2),
        })),
      };
    case 'sakura':
      return Array.from({ length: 14 }, () => {
        const duration = round(rand(8, 13));
        return {
          size: round(rand(11, 22), 0),
          left: round(rand(0, 96)),
          duration,
          delay: round(spreadDelay(duration), 2),
        };
      });
    case 'firefly':
      return Array.from({ length: 16 }, () => ({
        top: round(rand(10, 85)),
        left: round(rand(4, 96)),
        size: round(rand(4, 8)),
        duration: round(rand(4.2, 6.8)),
        delay: round(rand(0, 3), 2),
      }));
    case 'fireplace':
      return Array.from({ length: 12 }, () => ({
        left: round(rand(14, 88)),
        size: round(rand(3, 7)),
        duration: round(rand(3, 4.2)),
        delay: round(rand(0, 3), 2),
      }));
    default:
      return [];
  }
};

const ALIGN_TO_FLEX = { start: 'flex-start', center: 'center', end: 'flex-end' };
const ALIGN_TO_TEXT = { start: 'left', center: 'center', end: 'right' };

const FlakeIcon = ({ size, near, left, duration, delay, opacity }) => (
  <svg
    className={`sfx-flake${near ? ' sfx-flake--near' : ''}`}
    width={size}
    height={size}
    viewBox="0 0 48 48"
    aria-hidden="true"
    style={{
      left: `${left}%`,
      opacity,
      animation: `sfx-snow-fall ${duration}s linear ${delay}s infinite`,
    }}
  >
    <path
      d={FLAKE_PATH}
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Stars = ({ stars }) => stars.map((star, index) => (
  <span
    key={`star-${index}`}
    className="sfx-star"
    style={{
      top: `${star.top}%`,
      left: `${star.left}%`,
      width: star.size,
      height: star.size,
      animation: `sfx-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
    }}
  />
));

const AmbientScene = ({ presetId, particles }) => {
  switch (presetId) {
    case 'snow':
      return particles.map((flake, index) => <FlakeIcon key={index} {...flake} />);

    case 'meteor':
      return (
        <>
          <Stars stars={particles.stars} />
          {particles.meteors.map((meteor, index) => (
            <div
              key={`meteor-${index}`}
              className="sfx-meteor"
              style={{
                top: `${meteor.top}%`,
                left: `${meteor.left}%`,
                animation: `sfx-meteor-streak ${meteor.duration}s ease-in ${meteor.delay}s infinite`,
              }}
            />
          ))}
        </>
      );

    case 'aurora':
      return (
        <>
          <Stars stars={particles.stars} />
          {particles.blobs.map((blob, index) => (
            <div
              key={`blob-${index}`}
              className="sfx-blob"
              style={{
                top: `${blob.top}%`,
                left: `${blob.left}%`,
                width: blob.size,
                height: blob.size,
                background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
                animation: `sfx-aurora-drift ${blob.duration}s ease-in-out ${blob.delay}s infinite`,
              }}
            />
          ))}
        </>
      );

    case 'sakura':
      return particles.map((petal, index) => (
        <div
          key={index}
          className="sfx-petal"
          style={{
            left: `${petal.left}%`,
            width: petal.size,
            height: petal.size,
            animation: `sfx-petal-fall ${petal.duration}s linear ${petal.delay}s infinite`,
          }}
        />
      ));

    case 'firefly':
      return particles.map((fly, index) => (
        <div
          key={index}
          className="sfx-firefly"
          style={{
            top: `${fly.top}%`,
            left: `${fly.left}%`,
            width: fly.size,
            height: fly.size,
            animation: `sfx-firefly-glow ${fly.duration}s ease-in-out ${fly.delay}s infinite`,
          }}
        />
      ));

    case 'fireplace':
      return (
        <>
          <div className="sfx-fire-glow" />
          {particles.map((ember, index) => (
            <div
              key={index}
              className="sfx-ember"
              style={{
                left: `${ember.left}%`,
                width: ember.size,
                height: ember.size,
                animation: `sfx-ember-rise ${ember.duration}s ease-out ${ember.delay}s infinite`,
              }}
            />
          ))}
        </>
      );

    default:
      return null;
  }
};

const FocusScene = ({ layout }) => (
  <div className="sfx-focus-wrap">
    <div className="sfx-focus-lines">
      {layout.map((line, index) => {
        const base = `${line.enter} 0.75s ease-out ${line.delay}s both`;
        const animation = line.glow
          ? `${base}, sfx-focus-glow 3.2s ease-in-out ${round(line.delay + 0.75, 2)}s infinite`
          : base;

        return (
          <div
            key={index}
            className={`sfx-focus-line${line.glow ? ' sfx-focus-line--glow' : ''}`}
            style={{
              alignSelf: ALIGN_TO_FLEX[line.align] || 'center',
              textAlign: ALIGN_TO_TEXT[line.align] || 'center',
              // 手机上窄屏时按视口宽度收缩，避免大字号折行溢出
              fontSize: `min(${line.size}px, ${round(line.size / 4.5)}vw)`,
              fontWeight: line.weight,
              color: line.color,
              animation,
            }}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  </div>
);

const FullscreenEffectLayer = ({ chatId = null, preview = false }) => {
  const [playing, setPlaying] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const fadeTimerRef = useRef(null);
  const endTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const playTokenRef = useRef(0);

  const clearTimers = useCallback(() => {
    window.clearTimeout(fadeTimerRef.current);
    window.clearTimeout(endTimerRef.current);
  }, []);

  const startLeaving = useCallback(() => {
    clearTimers();
    setLeaving(true);
    endTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setPlaying(null);
      setLeaving(false);
    }, FADE_OUT_MS + 60);
  }, [clearTimers]);

  useEffect(() => {
    mountedRef.current = true;

    const handlePlay = async (event) => {
      const detail = event?.detail || {};

      if (preview) {
        if (!detail.preview) return;
      } else if (detail.preview || detail.chatId !== chatId) {
        return;
      }

      const isFocus = detail.kind === 'focus';
      const presetId = isFocus ? FOCUS_PRESET.id : detail.presetId;
      const preset = getPresetById(presetId);
      if (!preset) return;

      if (isFocus && (!Array.isArray(detail.lines) || detail.lines.length === 0)) return;

      const token = playTokenRef.current + 1;
      playTokenRef.current = token;

      const backdrop = typeof detail.backdrop === 'boolean'
        ? detail.backdrop
        : await getBackdropPref(presetId);

      // 等待读取偏好期间又来了新的事件，或组件已经卸载，则放弃这一次
      if (!mountedRef.current || playTokenRef.current !== token) return;

      clearTimers();
      setLeaving(false);
      setPlaying({
        key: `${Date.now()}-${token}`,
        isFocus,
        presetId,
        preset,
        backdrop,
        caption: isFocus ? '' : String(detail.caption || ''),
        particles: isFocus ? null : buildParticles(presetId),
        layout: isFocus ? buildFocusLayout(detail.lines) : null,
      });

      fadeTimerRef.current = window.setTimeout(
        startLeaving,
        isFocus ? FOCUS_DURATION_MS : AMBIENT_DURATION_MS,
      );
    };

    window.addEventListener(SCREEN_EFFECT_EVENT, handlePlay);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(SCREEN_EFFECT_EVENT, handlePlay);
      clearTimers();
    };
  }, [chatId, preview, clearTimers, startLeaving]);

  if (!playing) return null;

  const { preset, backdrop, isFocus, presetId, particles, layout, caption } = playing;

  const className = [
    'sfx-root',
    preview ? 'sfx-root--preview' : '',
    backdrop ? '' : 'sfx-nobg',
    leaving ? 'sfx-out' : '',
  ].filter(Boolean).join(' ');

  const node = (
    <div
      key={playing.key}
      className={className}
      // 没有底色时不挡住聊天界面，用户仍然可以继续打字；有底色时点击可提前关闭
      style={{ pointerEvents: backdrop && !leaving ? 'auto' : 'none' }}
      onClick={startLeaving}
      role="presentation"
    >
      {backdrop && (
        <div className="sfx-backdrop" style={{ background: preset.background }} />
      )}

      {isFocus ? (
        <FocusScene layout={layout} />
      ) : (
        <>
          <AmbientScene presetId={presetId} particles={particles} />
          {caption && (
            <div
              className="sfx-caption"
              style={{
                bottom: preset.captionBottom,
                color: preset.captionColor,
                textShadow: preset.captionShadow,
              }}
            >
              {caption}
            </div>
          )}
        </>
      )}
    </div>
  );

  return preview && typeof document !== 'undefined'
    ? createPortal(node, document.body)
    : node;
};

export default FullscreenEffectLayer;
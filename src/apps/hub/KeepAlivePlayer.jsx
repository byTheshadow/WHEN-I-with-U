import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Edit3,
  Pause,
  Play,
  Settings2,
  Upload,
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

const PLAYER_CONFIG_KEY = 'keep_alive_player_config';
const SILENT_WAV_DATA =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const WAVE_BARS = Array.from({ length: 34 }, (_, index) => index);

const getInitial = (name, fallback) => {
  const value = String(name || '').trim();
  return value ? value.slice(0, 1).toUpperCase() : fallback;
};

export const KeepAlivePlayer = ({ delay = 600 }) => {
  const [isActive, setIsActive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [config, setConfig] = useState({
    issue: 'LATE NIGHT ISSUE / 001',
    title: 'You make me sad',
    artist: 'Lovely Bomb · Angel Kittens',
    description:
      '有些歌不是一个人听完的。它们穿过夜色，把两个相隔很远的人，暂时放进同一段旋律。',
    companionName: '陪伴者',
    userAvatar: null,
    companionAvatar: null,
  });

  const [draft, setDraft] = useState(config);
  const [stats, setStats] = useState({
    diaries: 0,
    snapshots: 0,
    travels: 0,
    todos: 0,
  });

  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const audioRef = useRef(null);
  const userInputRef = useRef(null);
  const companionInputRef = useRef(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [savedSetting, profile, character, diaries, snapshots, travels, todos] =
          await Promise.all([
            db.settings.get(PLAYER_CONFIG_KEY),
            db.profile.toCollection().first(),
            db.characters.orderBy('id').first(),
            db.diaries.count(),
            db.snapshots.count(),
            db.travels.count(),
            db.todos.count(),
          ]);

        const savedConfig = savedSetting?.value || {};

        const nextConfig = {
          issue: savedConfig.issue || 'LATE NIGHT ISSUE / 001',
          title: savedConfig.title || 'You make me sad',
          artist: savedConfig.artist || 'Lovely Bomb · Angel Kittens',
          description:
            savedConfig.description ||
            '有些歌不是一个人听完的。它们穿过夜色，把两个相隔很远的人，暂时放进同一段旋律。',
          companionName:
            savedConfig.companionName || character?.name || '陪伴者',
          userAvatar: savedConfig.userAvatar || profile?.avatar || null,
          companionAvatar:
            savedConfig.companionAvatar || character?.avatar || null,
        };

        setConfig(nextConfig);
        setDraft(nextConfig);
        setStats({
          diaries,
          snapshots,
          travels,
          todos,
        });
      } catch (error) {
        console.warn('Unable to load keep-alive player data:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!isReady) return undefined;

    if (isActive) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }

    return () => stopKeepAlive();
  }, [isActive, isReady]);

  const saveConfig = async (nextConfig) => {
    try {
      await db.settings.put({
        key: PLAYER_CONFIG_KEY,
        value: nextConfig,
      });
    } catch (error) {
      console.error('Unable to save keep-alive player configuration:', error);
    }
  };

  const startKeepAlive = async () => {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        if (!oscillatorRef.current) {
          const oscillator = audioContextRef.current.createOscillator();
          const gain = audioContextRef.current.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(
            1,
            audioContextRef.current.currentTime,
          );
          gain.gain.setValueAtTime(0.0001, audioContextRef.current.currentTime);

          oscillator.connect(gain);
          gain.connect(audioContextRef.current.destination);
          oscillator.start();

          oscillatorRef.current = oscillator;
        }
      }

      await audioRef.current?.play();

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: config.title || 'WHEN I with U',
          artist: config.artist || config.companionName,
          album: 'WHEN I with U / Quiet Frequency',
        });
      }
    } catch (error) {
      console.warn('Keep-alive audio needs a user interaction:', error);
    }
  };

  const stopKeepAlive = () => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }

      audioRef.current?.pause();

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    } catch (error) {
      console.warn('Unable to stop keep-alive audio:', error);
    }
  };

  const handleToggle = () => {
    setIsActive((currentValue) => !currentValue);
  };

  const handleEdit = () => {
    if (!isEditing) {
      setDraft(config);
      setIsEditing(true);
      return;
    }

    setConfig(draft);
    setIsEditing(false);
    saveConfig(draft);
  };

  const handleAvatarUpload = (event, target) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      const avatar = loadEvent.target?.result;
      if (!avatar) return;

      const nextConfig = {
        ...config,
        [target]: avatar,
      };

      setConfig(nextConfig);
      setDraft(nextConfig);
      saveConfig(nextConfig);
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <GlassCard
      delay={delay}
      tone="ink"
      className="keep-alive-player relative overflow-hidden !rounded-[0.35rem] !p-0"
    >
      <input
        ref={userInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleAvatarUpload(event, 'userAvatar')}
      />

      <input
        ref={companionInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleAvatarUpload(event, 'companionAvatar')}
      />

      <audio ref={audioRef} src={SILENT_WAV_DATA} loop hidden />

      <div className="pointer-events-none absolute inset-0 keep-alive-player__grid" />

      <header className="relative flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--text-on-ink-muted)]">
          <strong className="font-semibold text-[var(--text-on-ink)]">
            Together
          </strong>
          <span>/ Quiet Frequency</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-[0.16em] text-[var(--text-on-ink-muted)]">
            01 / 01
          </span>

          <span className="flex items-center gap-1.5 text-[9px] font-medium tracking-[0.16em] text-[var(--text-on-ink)]">
            <i
              className={`keep-alive-player__status-dot ${
                isActive ? 'keep-alive-player__status-dot--active' : ''
              }`}
            />
            {isActive ? 'Live Sync' : 'Standby'}
          </span>

          <button
            type="button"
            onClick={handleEdit}
            aria-label={isEditing ? '保存播放器文字' : '编辑播放器文字'}
            title={isEditing ? '保存' : '编辑'}
            className="flex h-6 w-6 items-center justify-center transition-opacity hover:opacity-60 active:scale-95"
          >
            {isEditing ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </header>

      <div className="relative px-5 pb-5 pt-6">
        <div className="grid grid-cols-[minmax(0,1fr)_8.8rem] items-start gap-3">
          <section className="min-w-0 pt-1">
            {isEditing ? (
              <input
                value={draft.issue}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    issue: event.target.value,
                  }))
                }
                className="keep-alive-player__field mb-4 w-full"
                aria-label="期刊标签"
              />
            ) : (
              <p className="mb-4 text-[9px] uppercase tracking-[0.18em] text-[var(--text-on-ink-muted)]">
                {config.issue}
              </p>
            )}

            {isEditing ? (
              <textarea
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                rows={2}
                className="keep-alive-player__title-field w-full"
                aria-label="主标题"
              />
            ) : (
              <h4 className="keep-alive-player__title">
                {config.title}
              </h4>
            )}

            {isEditing ? (
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="keep-alive-player__field mt-4 w-full leading-relaxed"
                aria-label="描述文字"
              />
            ) : (
              <p className="mt-4 max-w-[12rem] text-[11px] leading-relaxed text-[var(--text-on-ink-muted)]">
                {config.description}
              </p>
            )}
          </section>

          <section className="pt-2">
            <div className="keep-alive-player__vinyl-stage">
              <div
                className={`keep-alive-player__vinyl ${
                  isActive ? 'keep-alive-player__vinyl--playing' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => companionInputRef.current?.click()}
                  title="更换唱片封面或伴侣头像"
                  aria-label="更换唱片封面或伴侣头像"
                  className="keep-alive-player__label group"
                >
                  {config.companionAvatar ? (
                    <img
                      src={config.companionAvatar}
                      alt={config.companionName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-serif text-xl">
                      {getInitial(config.companionName, 'W')}
                    </span>
                  )}

                  <span className="keep-alive-player__label-upload">
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.4} />
                  </span>
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-[8px] uppercase tracking-[0.16em] text-[var(--text-on-ink-muted)]">
              Quiet transmission
            </p>
          </section>
        </div>

        <section className="relative mt-7 border-t pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.17em] text-[var(--text-on-ink-muted)]">
                Now keeping alive / Track 01
              </p>

              {isEditing ? (
                <input
                  value={draft.artist}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      artist: event.target.value,
                    }))
                  }
                  className="keep-alive-player__title-field mt-1 w-full !text-lg"
                  aria-label="副标题"
                />
              ) : (
                <h5 className="mt-1 font-serif text-xl leading-none tracking-tight text-[var(--text-on-ink)]">
                  {config.artist}
                </h5>
              )}
            </div>

            <span className="shrink-0 pt-1 text-right text-[9px] leading-relaxed tracking-[0.13em] text-[var(--text-on-ink-muted)]">
              {stats.diaries} NOTES
              <br />
              {stats.snapshots} MOMENTS
              <br />
              {stats.travels} JOURNEYS
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => companionInputRef.current?.click()}
                className="keep-alive-player__avatar relative z-10"
                title="更换伴侣头像"
                aria-label="更换伴侣头像"
              >
                {config.companionAvatar ? (
                  <img
                    src={config.companionAvatar}
                    alt={config.companionName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitial(config.companionName, 'W')
                )}
              </button>

              <button
                type="button"
                onClick={() => userInputRef.current?.click()}
                className="keep-alive-player__avatar -ml-2"
                title="更换用户头像"
                aria-label="更换用户头像"
              >
                {config.userAvatar ? (
                  <img
                    src={config.userAvatar}
                    alt="用户头像"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  'U'
                )}
              </button>

              <div className="ml-3 text-[10px] leading-relaxed text-[var(--text-on-ink-muted)]">
                <strong className="block font-medium text-[var(--text-on-ink)]">
                  你 和 {config.companionName}
                </strong>
                {isActive ? '正在一起听 · 页面状态已同步' : '等待下一次静默同行'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggle}
              className="keep-alive-player__play-button"
              aria-label={isActive ? '停止静音保活' : '启动静音保活'}
            >
              {isActive ? (
                <Pause className="h-4 w-4 fill-current" strokeWidth={1.5} />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={1.5} />
              )}
            </button>
          </div>

          <div className="keep-alive-player__wave mt-5" aria-hidden="true">
            {WAVE_BARS.map((bar) => (
              <span
                key={bar}
                className={
                  isActive ? 'keep-alive-player__wave-bar--active' : ''
                }
                style={{ '--wave-index': bar }}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[9px] tracking-[0.14em] text-[var(--text-on-ink-muted)]">
            <span>{isActive ? '00:00' : '--:--'}</span>
            <span>{isActive ? 'KEEPING ALIVE' : 'QUIET MODE'}</span>
          </div>
        </section>
      </div>

      <div className="relative border-t px-5 py-2 text-right text-[8px] uppercase tracking-[0.2em] text-[var(--text-on-ink-muted)]">
        Two people · One frequency · {stats.todos} open notes
      </div>

      <style>{`
        .keep-alive-player {
          border-color: var(--ink-card-border) !important;
          box-shadow: var(--ink-card-shadow) !important;
        }

        .keep-alive-player__grid {
          opacity: 0.34;
          background-image:
            linear-gradient(
              90deg,
              transparent 0,
              transparent 49.75%,
              var(--ink-card-border) 49.9%,
              transparent 50.05%
            ),
            linear-gradient(
              0deg,
              transparent 0,
              transparent 76%,
              var(--ink-card-border) 76.15%,
              transparent 76.3%
            );
        }

        .keep-alive-player header,
        .keep-alive-player section,
        .keep-alive-player > div:last-of-type {
          border-color: var(--ink-card-border);
        }

        .keep-alive-player__status-dot {
          display: block;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: var(--text-on-ink-muted);
        }

        .keep-alive-player__status-dot--active {
          background: var(--text-on-ink);
          box-shadow: 0 0 0 4px var(--ink-card-border);
          animation: keep-alive-status-pulse 2s ease-in-out infinite;
        }

        .keep-alive-player__vinyl-stage {
          display: flex;
          min-height: 142px;
          align-items: center;
          justify-content: center;
        }

        .keep-alive-player__vinyl {
          display: flex;
          width: 132px;
          height: 132px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--ink-card-border);
          border-radius: 999px;
          background:
            repeating-radial-gradient(
              circle,
              transparent 0,
              transparent 4px,
              var(--ink-card-border) 4.5px,
              transparent 5.5px
            ),
            var(--ink-card-bg);
          box-shadow: inset 0 0 0 10px var(--ink-card-bg);
        }

        .keep-alive-player__vinyl--playing {
          animation: keep-alive-vinyl-spin 11s linear infinite;
        }

        .keep-alive-player__label {
          position: relative;
          width: 55px;
          height: 55px;
          overflow: hidden;
          border: 1px solid var(--ink-card-border);
          border-radius: 999px;
          background: var(--control-soft-bg);
          color: var(--text-main);
        }

        .keep-alive-player__label-upload {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--ink-card-bg);
          color: var(--text-on-ink);
          opacity: 0;
          transition: opacity 180ms ease;
        }

        .keep-alive-player__label:hover .keep-alive-player__label-upload,
        .keep-alive-player__label:focus-visible .keep-alive-player__label-upload {
          opacity: 0.84;
        }

        .keep-alive-player__title {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.85rem, 8vw, 2.55rem);
          font-weight: 400;
          line-height: 0.84;
          letter-spacing: -0.07em;
          color: var(--text-on-ink);
        }

        .keep-alive-player__title::first-letter {
          font-style: italic;
        }

        .keep-alive-player__field,
        .keep-alive-player__title-field {
          border: 0;
          border-bottom: 1px solid var(--ink-card-border);
          border-radius: 0;
          outline: 0;
          resize: none;
          background: transparent;
          color: var(--text-on-ink);
        }

        .keep-alive-player__field {
          padding: 3px 0;
          font-size: 11px;
        }

        .keep-alive-player__title-field {
          padding: 2px 0 5px;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.8rem;
          line-height: 0.9;
          letter-spacing: -0.06em;
        }

        .keep-alive-player__avatar {
          display: flex;
          width: 31px;
          height: 31px;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid var(--ink-card-border);
          border-radius: 999px;
          background: var(--control-soft-bg);
          color: var(--text-main);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 11px;
          transition: transform 180ms ease;
        }

        .keep-alive-player__avatar:active {
          transform: scale(0.92);
        }

        .keep-alive-player__play-button {
          display: flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--text-on-ink-muted);
          border-radius: 999px;
          background: transparent;
          color: var(--text-on-ink);
          transition: transform 180ms ease, background 180ms ease, color 180ms ease;
        }

        .keep-alive-player__play-button:hover {
          background: var(--text-on-ink);
          color: var(--accent-color);
        }

        .keep-alive-player__play-button:active {
          transform: scale(0.9);
        }

        .keep-alive-player__wave {
          display: flex;
          height: 30px;
          align-items: center;
          gap: 2px;
          overflow: hidden;
        }

        .keep-alive-player__wave span {
          display: block;
          width: 100%;
          min-width: 1px;
          height: calc(4px + (var(--wave-index) % 7) * 2px);
          border-radius: 999px;
          background: var(--text-on-ink-muted);
          opacity: 0.34;
        }

        .keep-alive-player__wave .keep-alive-player__wave-bar--active {
          animation: keep-alive-wave 1.45s ease-in-out infinite;
          animation-delay: calc(var(--wave-index) * -0.075s);
          background: var(--text-on-ink);
          opacity: 0.78;
        }

        @keyframes keep-alive-vinyl-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes keep-alive-status-pulse {
          0%,
          100% {
            opacity: 0.55;
          }

          50% {
            opacity: 1;
          }
        }

        @keyframes keep-alive-wave {
          0%,
          100% {
            height: calc(5px + (var(--wave-index) % 5) * 2px);
          }

          50% {
            height: calc(11px + (var(--wave-index) % 9) * 2px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .keep-alive-player__vinyl--playing,
          .keep-alive-player__status-dot--active,
          .keep-alive-player__wave .keep-alive-player__wave-bar--active {
            animation: none;
          }
        }
      `}</style>
    </GlassCard>
  );
};

export default KeepAlivePlayer;


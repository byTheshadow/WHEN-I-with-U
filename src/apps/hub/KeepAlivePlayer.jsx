import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Edit3,
  Pause,
  Play,
  Settings2,
  Upload,
  UserRound,
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

// 这张卡片要显示的"陪伴者"是谁，跟它下面标题/描述这些纯装饰文字分开存，
// 存成单独一个 settings key（而不是塞进 PLAYER_CONFIG_KEY 那个大对象里）。
// 之所以要分开，是因为之前的实现把"当前第一个角色的名字/头像"在首次加载时
// 算出来，混进同一份草稿里——用户哪怕只是改了期刊标签这种跟角色毫不相干的
// 文字，保存时也会把那个角色的名字/头像一起写死进设置，这个角色后来被删掉
// 也不会再更新，陪伴者就永久"跟着"一个不存在的角色了。现在改成：陪伴者是谁
// 由这个单独的 key 存一个 characterId（用户在编辑面板里手动选，选中就立刻
// 单独写入，不等其它字段一起保存），显示时永远拿这个 id 去 db.characters 里
// 现查，查不到（角色被删了）就自动清空这个 key、回退到"按创建顺序排第一个
// 角色"这个兜底，而不是抱着一个死 id 不放。
const COMPANION_LINK_KEY = 'keep_alive_player_companion_id';
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
    // 用户手动上传的自定义陪伴者头像（跟角色头像分开存）；有这个就优先显示
    // 这张，没有才落回下面选中的角色头像。
    companionAvatarOverride: null,
    // companionAvatar 永远是"最终显示用"的那张图，每次加载/切换角色时现算，
    // 不直接存进设置里，避免再次冻结成某个旧角色的死链接。
    companionAvatar: null,
  });

  const [draft, setDraft] = useState(config);
  const [stats, setStats] = useState({
    diaries: 0,
    snapshots: 0,
    travels: 0,
    todos: 0,
  });

  // 陪伴者绑定的是哪个角色：''=没手动选过，跟着"创建最早的角色"这个兜底走。
  const [companionCharacterId, setCompanionCharacterId] = useState('');
  const [characterOptions, setCharacterOptions] = useState([]);
  const [isPickingCompanion, setIsPickingCompanion] = useState(false);

  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const audioRef = useRef(null);
  const userInputRef = useRef(null);
  const companionInputRef = useRef(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [
          savedSetting,
          companionLink,
          profile,
          characters,
          diaries,
          snapshots,
          travels,
          todos,
        ] = await Promise.all([
          db.settings.get(PLAYER_CONFIG_KEY),
          db.settings.get(COMPANION_LINK_KEY),
          db.profile.toCollection().first(),
          db.characters.orderBy('id').toArray(),
          db.diaries.count(),
          db.snapshots.count(),
          db.travels.count(),
          db.todos.count(),
        ]);

        const savedConfig = savedSetting?.value || {};
        const pinnedId = companionLink?.value?.characterId || '';
        const pinnedCharacter = pinnedId
          ? characters.find((item) => String(item.id) === String(pinnedId))
          : null;

        // 之前手动选过角色，但那个角色现在找不到了（被删了）：清掉这个死
        // 引用，回到"按创建顺序排第一个角色"兜底，而不是继续抱着死 id。
        if (pinnedId && !pinnedCharacter) {
          setCompanionCharacterId('');
          db.settings
            .put({ key: COMPANION_LINK_KEY, value: { characterId: '' } })
            .catch((error) =>
              console.warn('Unable to clear stale companion link:', error),
            );
        } else {
          setCompanionCharacterId(pinnedId);
        }

        const fallbackCharacter = characters[0] || null;
        const resolvedCharacter = pinnedCharacter || fallbackCharacter;

        const nextConfig = {
          issue: savedConfig.issue || 'LATE NIGHT ISSUE / 001',
          title: savedConfig.title || 'You make me sad',
          artist: savedConfig.artist || 'Lovely Bomb · Angel Kittens',
          description:
            savedConfig.description ||
            '有些歌不是一个人听完的。它们穿过夜色，把两个相隔很远的人，暂时放进同一段旋律。',
          userAvatar: savedConfig.userAvatar || profile?.avatar || null,
          companionAvatarOverride: savedConfig.companionAvatarOverride || null,
          // 名字/头像永远现查现算，不落进 savedConfig：角色改名、换头像、
          // 被删都会在下次打开时自动反映出来，不会被冻结成某次保存时的快照。
          companionName: resolvedCharacter?.name || '陪伴者',
          companionAvatar:
            savedConfig.companionAvatarOverride ||
            resolvedCharacter?.avatar ||
            null,
        };

        setConfig(nextConfig);
        setDraft(nextConfig);
        setCharacterOptions(characters);
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

  // 只持久化这几个纯装饰字段；companionName/companionAvatar 是现查出来的
  // 显示值，故意不收进这里，不然编辑这些字段时又会把它们一起冻结进设置。
  const saveConfig = async (nextConfig) => {
    try {
      await db.settings.put({
        key: PLAYER_CONFIG_KEY,
        value: {
          issue: nextConfig.issue,
          title: nextConfig.title,
          artist: nextConfig.artist,
          description: nextConfig.description,
          userAvatar: nextConfig.userAvatar,
          companionAvatarOverride: nextConfig.companionAvatarOverride || null,
        },
      });
    } catch (error) {
      console.error('Unable to save keep-alive player configuration:', error);
    }
  };

  // 手动选一个角色当陪伴者：立刻单独写进 COMPANION_LINK_KEY，跟标题/描述那些
  // 字段的保存彻底分开，不会因为之后改别的字段而被连带覆盖或冻结。
  // characterId 传空字符串 = 取消手动绑定，回到"创建最早的角色"这个兜底。
  const handleSelectCompanion = async (characterId) => {
    const normalizedId = characterId || '';
    const resolvedCharacter = normalizedId
      ? characterOptions.find((item) => String(item.id) === String(normalizedId))
      : characterOptions[0] || null;

    setCompanionCharacterId(normalizedId);
    setIsPickingCompanion(false);

    const displayConfig = (current) => ({
      ...current,
      companionName: resolvedCharacter?.name || '陪伴者',
      companionAvatar:
        current.companionAvatarOverride || resolvedCharacter?.avatar || null,
    });

    setConfig(displayConfig);
    setDraft(displayConfig);

    try {
      await db.settings.put({
        key: COMPANION_LINK_KEY,
        value: { characterId: normalizedId },
      });
    } catch (error) {
      console.warn('Unable to save companion link:', error);
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

      // 陪伴者头像是"自定义上传"和"现查的角色头像"两层：上传的这张存进
      // companionAvatarOverride（持久化），同时立刻更新 companionAvatar
      // 这个显示字段，让它优先盖过角色头像。
      const nextConfig =
        target === 'companionAvatarOverride'
          ? { ...config, companionAvatarOverride: avatar, companionAvatar: avatar }
          : { ...config, [target]: avatar };

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
        onChange={(event) => handleAvatarUpload(event, 'companionAvatarOverride')}
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
                      className="h-full w-full object-cover" loading="lazy" decoding="async" />
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

            {isEditing && (
              <div className="relative mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsPickingCompanion((value) => !value)}
                  className="flex items-center gap-1 text-[8px] uppercase tracking-[0.14em] text-[var(--text-on-ink-muted)] transition-opacity hover:opacity-70"
                >
                  <UserRound className="h-2.5 w-2.5" strokeWidth={1.6} />
                  选择陪伴角色
                </button>

                {isPickingCompanion && (
                  <div
                    className="absolute right-0 top-full z-20 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border p-1"
                    style={{
                      backgroundColor: 'var(--modal-bg, #111)',
                      borderColor: 'var(--modal-border, rgba(255,255,255,.15))',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCompanion('')}
                      className={`block w-full rounded-md px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-white/10 ${
                        !companionCharacterId ? 'text-[var(--text-on-ink)]' : 'text-[var(--text-on-ink-muted)]'
                      }`}
                    >
                      自动（跟随最早创建的角色）
                    </button>

                    {characterOptions.map((character) => (
                      <button
                        key={character.id}
                        type="button"
                        onClick={() => handleSelectCompanion(character.id)}
                        className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-white/10 ${
                          String(companionCharacterId) === String(character.id)
                            ? 'text-[var(--text-on-ink)]'
                            : 'text-[var(--text-on-ink-muted)]'
                        }`}
                      >
                        {character.name || '未命名角色'}
                      </button>
                    ))}

                    {characterOptions.length === 0 && (
                      <p className="px-2 py-1.5 text-[10px] text-[var(--text-on-ink-muted)]">
                        还没有角色
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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
                    className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                    className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
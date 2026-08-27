import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, Link2, Pause, Play, Trash2, X } from 'lucide-react';
import db from '../db';

const POSITION_KEY = 'keep_alive_widget_position';

const DEFAULT_POSITION = {
  x: null,
  y: null
};

const getDefaultPosition = () => ({
  x: Math.max(16, window.innerWidth - 72),
  y: Math.max(16, window.innerHeight - 112)
});

const clampPosition = (position) => {
  const size = 56;
  const margin = 12;

  return {
    x: Math.min(
      Math.max(margin, position.x),
      Math.max(margin, window.innerWidth - size - margin)
    ),
    y: Math.min(
      Math.max(margin, position.y),
      Math.max(margin, window.innerHeight - size - margin)
    )
  };
};

const getPromptPreview = (chat) => {
  const prompt = String(chat?.systemPrompt || '').trim();

  if (!prompt) {
    return '此聊天尚未写入独立提示词。';
  }

  return prompt.length > 120
    ? `${prompt.slice(0, 120)}……`
    : prompt;
};

const getChatTitle = (chat) => {
  return chat?.title || chat?.name || '未命名聊天';
};

export const KeepAliveIndicator = ({
  isVisible = false,
  activeChats = [],
  audioConfig = {},
  onAudioConfigChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const positionRef = useRef(position);

  

  const dragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false
  });

  useEffect(() => {
  positionRef.current = position;
}, [position]);


  const playlist = Array.isArray(audioConfig?.playlist)
    ? audioConfig.playlist
    : [];

  const activeTrackId = audioConfig?.activeTrackId || '';

  const activeTrack = useMemo(
    () => playlist.find((track) => track.id === activeTrackId) || null,
    [playlist, activeTrackId]
  );

  useEffect(() => {
    if (!isVisible) {
      setIsOpen(false);
    }
  }, [isVisible]);

  useEffect(() => {
    let cancelled = false;

    const loadPosition = async () => {
      try {
        const saved = await db.settings.get(POSITION_KEY);

        if (cancelled) return;

        const savedPosition = saved?.value;

        if (
          savedPosition &&
          Number.isFinite(savedPosition.x) &&
          Number.isFinite(savedPosition.y)
        ) {
          setPosition(clampPosition(savedPosition));
        } else {
          setPosition(getDefaultPosition());
        }
      } catch (error) {
        console.warn('Unable to load keep-alive widget position:', error);
        setPosition(getDefaultPosition());
      }
    };

    loadPosition();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => clampPosition(current));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  
   

  if (!isVisible) return null;

  const updateAudioConfig = async (nextConfig) => {
    const normalizedConfig = {
      playlist: Array.isArray(nextConfig.playlist)
        ? nextConfig.playlist
        : [],
      activeTrackId: nextConfig.activeTrackId || ''
    };

    onAudioConfigChange?.(normalizedConfig);

    try {
      await db.settings.put({
        key: 'keep_alive_audio_config',
        value: normalizedConfig
      });
    } catch (error) {
      console.warn('Unable to save keep-alive audio config:', error);
    }
  };

 const handlePointerDown = (event) => {
  if (event.button !== undefined && event.button !== 0) return;

  dragRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: positionRef.current.x,
    originY: positionRef.current.y,
    moved: false
  };

  event.currentTarget.setPointerCapture?.(event.pointerId);
};

const handlePointerMove = (event) => {
  const drag = dragRef.current;

  if (drag.pointerId !== event.pointerId) return;

  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;

  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    drag.moved = true;
    setIsDragging(true);
  }

  if (!drag.moved) return;

  const nextPosition = clampPosition({
    x: drag.originX + deltaX,
    y: drag.originY + deltaY
  });

  positionRef.current = nextPosition;
  setPosition(nextPosition);
};

const handlePointerUp = async (event) => {
  const drag = dragRef.current;

  if (drag.pointerId !== event.pointerId) return;

  const didMove = drag.moved;
  const nextPosition = clampPosition(positionRef.current);

  dragRef.current.pointerId = null;
  dragRef.current.moved = false;

  setIsDragging(false);

  event.currentTarget.releasePointerCapture?.(event.pointerId);

  if (!didMove) {
    setIsOpen((current) => !current);
    return;
  }

  positionRef.current = nextPosition;
  setPosition(nextPosition);

  try {
    await db.settings.put({
      key: POSITION_KEY,
      value: nextPosition
    });
  } catch (error) {
    console.warn(
      'Unable to save keep-alive widget position:',
      error
    );
  }
};

const handlePointerCancel = (event) => {
  if (dragRef.current.pointerId !== event.pointerId) return;

  dragRef.current.pointerId = null;
  dragRef.current.moved = false;

  setIsDragging(false);

  event.currentTarget.releasePointerCapture?.(event.pointerId);
};

  const handleAddTrack = async (event) => {
    event.preventDefault();

    const title = newTitle.trim() || '未命名音乐';
    const url = newUrl.trim();

    if (!url) return;

    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return;
      }
    } catch {
      return;
    }

    const nextTrack = {
      id: `track_${Date.now()}`,
      title,
      url
    };

    const nextPlaylist = [...playlist, nextTrack];

    await updateAudioConfig({
      playlist: nextPlaylist,
      activeTrackId: activeTrackId || nextTrack.id
    });

    setNewTitle('');
    setNewUrl('');
  };

  const handleSelectTrack = async (trackId) => {
    await updateAudioConfig({
      playlist,
      activeTrackId: trackId
    });
  };

  const handleDeleteTrack = async (trackId) => {
    const nextPlaylist = playlist.filter((track) => track.id !== trackId);

    await updateAudioConfig({
      playlist: nextPlaylist,
      activeTrackId:
        activeTrackId === trackId
          ? nextPlaylist[0]?.id || ''
          : activeTrackId
    });
  };

  const popupWidth = Math.min(292, window.innerWidth - 24);
  const popupLeft = Math.min(
    Math.max(12, position.x - popupWidth + 56),
    Math.max(12, window.innerWidth - popupWidth - 12)
  );
  const popupTop = Math.max(12, position.y - 420);

  return (
    <>
      {isOpen && (
        <section
          className="fixed z-[60] overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            left: popupLeft,
            top: popupTop,
            width: popupWidth,
            color: 'var(--text-main)',
            background: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)',
            boxShadow: 'var(--modal-shadow)'
          }}
          aria-label="后台音频保活控制窗口"
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--divider)' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-60">
                Background Audio
              </p>
              <h2 className="mt-1 text-sm font-semibold">
                后台保活正在运行
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 transition-colors"
              style={{ color: 'var(--text-sub)' }}
              aria-label="关闭控制窗口"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>
          </div>

          <div className="max-h-[min(70vh,28rem)] space-y-4 overflow-y-auto p-4">
            <section>
              <p
                className="text-[10px] uppercase tracking-[0.16em]"
                style={{ color: 'var(--text-muted)' }}
              >
                正在保活的对话
              </p>

              <div className="mt-2 space-y-3">
                {activeChats.map((chat) => (
                  <article
                    key={chat.id}
                    className="border-l-2 pl-3"
                    style={{ borderColor: 'var(--accent-color)' }}
                  >
                    <p className="text-xs font-semibold">
                      {getChatTitle(chat)}
                    </p>

                    <p
                      className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed"
                      style={{ color: 'var(--text-sub)' }}
                    >
                      {getPromptPreview(chat)}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="border-t pt-4"
              style={{ borderColor: 'var(--divider)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Music Archive
                  </p>

                  <p className="mt-1 text-xs">
                    {activeTrack
                      ? `当前播放：${activeTrack.title}`
                      : '当前使用静音保活'}
                  </p>
                </div>

                <Disc3
                  className="h-5 w-5 opacity-60"
                  strokeWidth={1.5}
                />
              </div>

              <div className="mt-3 space-y-2">
                {playlist.map((track) => {
                  const isSelected = track.id === activeTrackId;

                  return (
                    <div
                      key={track.id}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2"
                      style={{
                        borderColor: isSelected
                          ? 'var(--accent-color)'
                          : 'var(--card-border)',
                        backgroundColor: isSelected
                          ? 'var(--control-soft-bg)'
                          : 'transparent'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTrack(track.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-label={`选择音乐：${track.title}`}
                      >
                        {isSelected ? (
                          <Pause className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Play className="h-3.5 w-3.5 shrink-0" />
                        )}

                        <span className="truncate text-xs">
                          {track.title}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTrack(track.id)}
                        className="shrink-0 rounded-full p-1"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={`删除音乐：${track.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddTrack} className="mt-3 space-y-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="音乐名称"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{
                    color: 'var(--text-main)',
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)'
                  }}
                />

                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Link2
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50"
                      strokeWidth={1.7}
                    />

                    <input
                      type="url"
                      value={newUrl}
                      onChange={(event) => setNewUrl(event.target.value)}
                      placeholder="音乐直链 URL"
                      className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none"
                      style={{
                        color: 'var(--text-main)',
                        backgroundColor: 'var(--control-soft-bg)',
                        borderColor: 'var(--card-border)'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl px-3 text-xs font-semibold"
                    style={{
                      color: 'var(--accent-foreground)',
                      backgroundColor: 'var(--accent-color)'
                    }}
                  >
                    添加
                  </button>
                </div>

                <p
                  className="text-[10px] leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  请输入浏览器可以直接播放的 mp3、ogg 或 wav 音频直链。
                </p>
              </form>
            </section>
          </div>
        </section>
      )}

      <div
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
          touchAction: 'none'
        }}
      >
      <button
  type="button"
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerCancel={handlePointerCancel}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border shadow-xl transition-transform ${
            isDragging ? 'scale-95' : 'active:scale-90'
          }`}
          style={{
            color: 'var(--accent-foreground)',
            backgroundColor: 'var(--accent-color)',
            borderColor: 'var(--card-border)',
            boxShadow:
              '0 12px 30px color-mix(in srgb, var(--accent-color) 30%, transparent)'
          }}
          aria-label="打开后台音频保活控制窗口"
          title="后台音频保活"
        >
          <span
            className="absolute inset-1 rounded-full border opacity-30"
            style={{ borderColor: 'var(--accent-foreground)' }}
          />

          <Disc3
            className="h-6 w-6 animate-[spin_8s_linear_infinite]"
            strokeWidth={1.5}
          />

          <span
            className="absolute right-1 top-1 h-2 w-2 rounded-full border"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--accent-color)'
            }}
          />
        </button>
      </div>
    </>
  );
};

export default KeepAliveIndicator;


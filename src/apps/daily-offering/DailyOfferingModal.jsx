import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  ImageOff,
  Music2,
  Pause,
  Play,
  X
} from 'lucide-react';

const getInitials = (name = '') =>
  String(name)
    .trim()
    .slice(0, 2)
    .toUpperCase() || 'U';

export const DailyOfferingModal = ({
  offering,
  isPreparing = false,
  onDismiss
}) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const track = offering?.media?.track;
  const isMusic = offering?.mediaType === 'music';
  const imageUrl = offering?.media?.imageUrl || '';
  const attribution = offering?.media?.attribution;

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.warn('Audio preview could not start:', error);
    }
  };

  if (isPreparing) {
    return (
      <div className="daily-offering-modal" role="dialog" aria-modal="true">
        <div className="daily-offering-modal__overlay" />

        <section className="daily-offering-loading">
          <span className="daily-offering-loading__seal" />
          <p>有一封信正在抵达。</p>
        </section>
      </div>
    );
  }

  if (!offering) return null;

  return (
    <div className="daily-offering-modal" role="dialog" aria-modal="true">
      <div className="daily-offering-modal__overlay" />

      <section className="daily-offering-modal__panel">
        <div className="daily-offering-modal__envelope-mark" />

        <button
          type="button"
          onClick={onDismiss}
          className="daily-offering-modal__close"
          aria-label="收起今日留物"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <header className="daily-offering-modal__sender">
          {offering.characterAvatar ? (
            <img
              src={offering.characterAvatar}
              alt=""
              className="daily-offering-modal__avatar"
            />
          ) : (
            <span className="daily-offering-modal__avatar daily-offering-modal__avatar--fallback">
              {getInitials(offering.characterName)}
            </span>
          )}

          <div>
            <p>今日留给你的</p>
            <h2>{offering.characterName}</h2>
          </div>
        </header>

        {isMusic ? (
          <section className="daily-offering-music-card">
            <div className="daily-offering-music-card__vinyl-wrap">
              {track?.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={`${track.title || offering.media?.requestedTitle || '音乐'}封面`}
                  className="daily-offering-music-card__cover"
                />
              ) : (
                <div className="daily-offering-music-card__cover daily-offering-music-card__cover--blank">
                  <Music2 className="h-7 w-7" strokeWidth={1.3} />
                </div>
              )}

              <span
                className={`daily-offering-music-card__vinyl ${
                  isPlaying ? 'daily-offering-music-card__vinyl--playing' : ''
                }`}
              />
            </div>

            <div className="daily-offering-music-card__meta">
              <p className="daily-offering-music-card__eyebrow">
                A small record for today
              </p>

              <h3>{track?.title || offering.media?.requestedTitle || '一段旋律'}</h3>

              <p className="daily-offering-music-card__artist">
                {track?.artist || offering.media?.requestedArtist || '暂未识别的演奏者'}
              </p>

              {track?.album && (
                <p className="daily-offering-music-card__album">{track.album}</p>
              )}

              <div className="daily-offering-music-card__actions">
                {track?.previewUrl ? (
                  <>
                    <audio
                      ref={audioRef}
                      src={track.previewUrl}
                      onEnded={() => setIsPlaying(false)}
                    />

                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="daily-offering-music-card__play"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" fill="currentColor" />
                      ) : (
                        <Play className="h-4 w-4" fill="currentColor" />
                      )}

                      <span>{isPlaying ? '暂停试听' : '听一小段'}</span>
                    </button>
                  </>
                ) : (
                  <span className="daily-offering-music-card__unavailable">
                    这段旋律暂时无法在此试听
                  </span>
                )}

                {track?.externalUrl && (
                  <a
                    href={track.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="daily-offering-music-card__external"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>前往聆听</span>
                  </a>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="daily-offering-image-card">
            {imageUrl && !imageFailed ? (
              <img
                src={imageUrl}
                alt={offering.media?.description || '角色留下的今日画面'}
                className="daily-offering-image-card__image"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="daily-offering-image-card__fallback">
                <ImageOff className="h-7 w-7" strokeWidth={1.25} />
                <p>{offering.media?.description || '今天的画面暂时没有抵达。'}</p>
              </div>
            )}

            {attribution?.sourcePage && (
              <a
                href={attribution.sourcePage}
                target="_blank"
                rel="noreferrer"
                className="daily-offering-image-card__attribution"
              >
                {attribution.author
                  ? `Image source · ${attribution.author}`
                  : 'Image source · Wikimedia Commons'}
              </a>
            )}
          </section>
        )}

        <blockquote className="daily-offering-modal__message">
          {offering.message}
        </blockquote>

        <p className="daily-offering-modal__ephemeral">
          转瞬即逝的陪伴，只属于今天。
        </p>
      </section>
    </div>
  );
};

export default DailyOfferingModal;

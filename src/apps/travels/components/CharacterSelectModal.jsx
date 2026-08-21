import React from 'react';
import { UserRound, X, ChevronRight } from 'lucide-react';

export const CharacterSelectModal = ({ isOpen, onClose, characters = [], onSelect }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center backdrop-blur-sm"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
    >
      <section
        className="w-full max-w-md overflow-hidden rounded-[2rem] border shadow-2xl animate-fade-in-up"
        style={{
          backgroundColor: 'var(--modal-bg)',
          borderColor: 'var(--modal-border)',
          color: 'var(--text-main)'
        }}
      >
        <header
          className="flex items-start justify-between gap-4 border-b px-5 py-5"
          style={{ borderColor: 'var(--divider)' }}
        >
          <div>
            <p
              className="text-[10px] font-mono tracking-[0.18em]"
              style={{ color: 'var(--text-muted)' }}
            >
              TRAVEL COMPANION
            </p>
            <h2 className="mt-1 font-serif text-xl font-bold">
              这次，想和谁一起出发？
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-sub)' }}>
              选择一位伴侣后，再为你们签发本次旅行专属护照。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-sub)' }}
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {characters.length > 0 ? (
            characters.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => onSelect(character)}
                className="group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-sm"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                {character.avatar ? (
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="h-12 w-12 shrink-0 rounded-2xl border object-cover"
                    style={{ borderColor: 'var(--card-border)' }}
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-serif text-lg font-bold"
                    style={{
                      backgroundColor: 'var(--control-soft-bg)',
                      borderColor: 'var(--card-border)'
                    }}
                  >
                    {character.name?.[0] || 'C'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{character.name || '未命名伴侣'}</p>
                  <p
                    className="mt-1 line-clamp-2 text-xs leading-relaxed"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    {character.bio || character.extraNotes || '从角色库带着完整设定，与你共同前往下一站。'}
                  </p>
                </div>

                <ChevronRight
                  className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: 'var(--text-muted)' }}
                />
              </button>
            ))
          ) : (
            <div
              className="space-y-3 rounded-2xl border border-dashed px-6 py-12 text-center"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <UserRound
                className="mx-auto h-8 w-8"
                style={{ color: 'var(--text-muted)' }}
              />
              <div>
                <p className="text-sm font-semibold">还没有可同行的伴侣</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-sub)' }}>
                  请先在角色库创建一位伴侣，再回来为你们签发旅程。
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CharacterSelectModal;

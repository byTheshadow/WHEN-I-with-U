import React from 'react';
import { Feather, Plus, Sparkles } from 'lucide-react';

export default function PebbleNestCompass({
  characters = [],
  activeCharId,
  onSelectChar,
  countsMap = {},
  pendingCount = 0,
  onOpenThrowModal,
  onAiInitiate,
}) {
  const activeCharacter =
    characters.find((character) => character.id === activeCharId) || characters[0];

  if (!activeCharacter) return null;

  return (
    <>
      <section className="pebble-nest-folio">
        <div className="pebble-nest-folio__inner">
          <div className="pebble-nest-folio__top">
            <div className="pebble-nest-folio__identity">
              <div className="pebble-nest-avatar">
                {activeCharacter.avatar ? (
                  <img src={activeCharacter.avatar} alt={activeCharacter.name} />
                ) : (
                  <Feather size={20} strokeWidth={1.5} />
                )}
              </div>

              <div>
                <p className="pebble-nest-folio__label">A QUIET NEST FOR</p>
                <h2 className="pebble-nest-folio__name">
                  {activeCharacter.name}
                </h2>
              </div>
            </div>

            <p className="pebble-nest-folio__quote">
              {activeCharacter.personality
                ? activeCharacter.personality.slice(0, 46)
                : '有些心意，不需要马上被回答。'}
            </p>
          </div>

          <div className="pebble-nest-folio__rule" />

          <div className="pebble-nest-folio__footer">
            <div className="pebble-nest-stats">
              <div className="pebble-nest-stat">
                <span className="pebble-nest-stat__value">
                  {countsMap[activeCharacter.id] || 0}
                </span>
                <span className="pebble-nest-stat__label">In the nest</span>
              </div>

              <div className="pebble-nest-stat">
                <span className="pebble-nest-stat__value">{pendingCount}</span>
                <span className="pebble-nest-stat__label">On the tide</span>
              </div>
            </div>

            <button
              type="button"
              className="pebble-nest-throw"
              onClick={onOpenThrowModal}
            >
              <Plus size={15} strokeWidth={1.8} />
              衔一颗石头回巢
            </button>
          </div>

          <div className="pebble-nest-invite">
            也可以让 {activeCharacter.name} 在安静的时候，带一颗石头回来。
            <button type="button" onClick={() => onAiInitiate(activeCharacter.id)}>
              去漫步寻石
            </button>
          </div>
        </div>
      </section>

      <div className="pebble-nest-index" aria-label="角色巢穴索引">
        {characters.map((character) => {
          const isActive = character.id === activeCharacter.id;

          return (
            <button
              key={character.id}
              type="button"
              onClick={() => onSelectChar(character.id)}
              className={`pebble-nest-index__item ${isActive ? 'is-active' : ''}`}
              aria-pressed={isActive}
            >
              <div className="pebble-nest-index__avatar">
                {character.avatar ? (
                  <img src={character.avatar} alt="" />
                ) : (
                  <Sparkles size={13} strokeWidth={1.4} />
                )}
              </div>

              <span className="pebble-nest-index__name">{character.name}</span>
              <span className="pebble-nest-index__count">
                ARCHIVE {String(countsMap[character.id] || 0).padStart(2, '0')}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

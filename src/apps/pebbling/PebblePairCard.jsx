import React, { useEffect, useState } from 'react';
import { Clock3, Trash2, Waves } from 'lucide-react';
import { PEBBLE_TYPES } from './pebbleTypes';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);

  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')} · ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function Stone({ typeId, small = false }) {
  const stone = PEBBLE_TYPES[typeId] || PEBBLE_TYPES['stream-pebble'];
  const Icon = stone.icon;

  return (
    <div
      className={`pebble-stone pebble-stone--${stone.id}`}
      style={{
        backgroundColor: stone.stoneColor,
        borderColor: stone.borderColor,
        boxShadow: `0 0 18px ${stone.glowColor}`,
        width: small ? '42px' : undefined,
        height: small ? '36px' : undefined,
      }}
    >
      <Icon size={small ? 15 : 18} strokeWidth={1.45} />
    </div>
  );
}

export default function PebblePairCard({ pebble, character, onDelete, index = 0 }) {
  const [timeLeft, setTimeLeft] = useState('');
  const isPending = pebble.status === 'pending';
  const isAiInitiated = pebble.sender === 'ai';
  const userStone = PEBBLE_TYPES[pebble.stoneType] || PEBBLE_TYPES['stream-pebble'];
  const aiStone = pebble.aiResponse
    ? PEBBLE_TYPES[pebble.aiResponse.giftStoneType] || PEBBLE_TYPES['stream-pebble']
    : null;

  useEffect(() => {
    if (!isPending) return undefined;

    const update = () => {
      const difference = pebble.respondAt - Date.now();

      if (difference <= 0) {
        setTimeLeft('石头已经抵岸，正在被轻轻拾起');
        return;
      }

      const minutes = Math.ceil(difference / 60000);
      setTimeLeft(`潮水仍在路上 · 约 ${minutes} 分钟`);
    };

    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, [isPending, pebble.respondAt]);

  const isWide = !isAiInitiated && !!pebble.aiResponse;
  const className = [
    'pebble-specimen',
    isWide ? 'pebble-specimen--pair' : '',
    isPending ? 'pebble-specimen--pending pebble-specimen--tall' : '',
    !isPending && !isWide ? 'pebble-specimen--compact' : '',
  ].join(' ');

  if (isWide) {
    return (
      <article className={className} style={{ animationDelay: `${index * 70}ms` }}>
        <div
          className="pebble-specimen__ambient"
          style={{ background: userStone.glowColor }}
        />

        <div className="pebble-specimen__content">
          <div className="pebble-specimen__meta">
            <span>PAIRED SPECIMEN · {formatTime(pebble.createdAt)}</span>
            <button
              type="button"
              className="pebble-specimen__delete"
              aria-label="删除这颗小石头"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(pebble.id);
              }}
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          </div>

          <div className="pebble-pair">
            <div className="pebble-pair__side">
              <Stone typeId={userStone.id} />
              <p className="pebble-specimen__type">你留下的 · {userStone.name}</p>
              <p className="pebble-pair__copy">{pebble.userContent}</p>
            </div>

            <div className="pebble-pair__line" />

            <div className="pebble-pair__side">
              <Stone typeId={aiStone.id} />
              <p className="pebble-specimen__type">
                {character?.name || '对方'} 回赠的 · {aiStone.name}
              </p>
              <p className="pebble-pair__copy">{pebble.aiResponse.content}</p>
            </div>
          </div>
        </div>
      </article>
    );
  }

  const displayText = isAiInitiated
    ? pebble.aiResponse?.content
    : pebble.userContent;

  return (
    <article className={className} style={{ animationDelay: `${index * 70}ms` }}>
      <div
        className="pebble-specimen__ambient"
        style={{ background: userStone.glowColor }}
      />

      <div className="pebble-specimen__content">
        <div className="pebble-specimen__meta">
          <span>
            {isAiInitiated
              ? `${character?.name || '对方'} 的来石`
              : `FIELD NOTE · ${formatTime(pebble.createdAt)}`}
          </span>

          <button
            type="button"
            className="pebble-specimen__delete"
            aria-label="删除这颗小石头"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(pebble.id);
            }}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>

        <Stone typeId={userStone.id} />

        <p className="pebble-specimen__type">
          {isAiInitiated ? '悄悄带回的' : '投入巢中的'} · {userStone.name}
        </p>

        <p className="pebble-specimen__text">{displayText}</p>

        {isPending && (
          <div className="pebble-specimen__status">
            <Waves size={14} strokeWidth={1.4} />
            <span>{timeLeft}</span>
          </div>
        )}

        {isAiInitiated && (
          <div className="pebble-specimen__status">
            <Clock3 size={13} strokeWidth={1.4} />
            <span>已安静放入你的巢穴</span>
          </div>
        )}
      </div>
    </article>
  );
}

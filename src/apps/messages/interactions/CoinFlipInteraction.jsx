import React, { useState } from 'react';
import { resolveInteractionMessage } from './interactionService';

export const CoinFlipInteraction = ({
  message,
  onResolved,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displaySide, setDisplaySide] = useState(
    message.metadata?.result?.side || null
  );

  const status = message.metadata?.status || 'pending';
  const resolvedSide = message.metadata?.result?.side || displaySide;
  const isPending = status === 'pending';

  const handleFlip = async () => {
    if (!isPending || isAnimating) return;

    setIsAnimating(true);

    const metadata = await resolveInteractionMessage({
      messageId: message.id,
    });

    const nextSide = metadata?.result?.side;

    if (!nextSide) {
      setIsAnimating(false);
      return;
    }

    setDisplaySide(nextSide);

    window.setTimeout(() => {
      setIsAnimating(false);
      onResolved?.();
    }, 1500);
  };

  const visibleSide = resolvedSide || 'LIGHT';

  return (
    <article
      className={`chat-interaction chat-interaction--coin ${
        isPending ? 'chat-interaction--pending' : 'chat-interaction--resolved'
      }`}
    >
      <div className="interaction-heading">
        <span className="interaction-kicker">TABLE OBJECT</span>
        <span className="interaction-title">旧硬币</span>
      </div>

      <button
        type="button"
        onClick={handleFlip}
        disabled={!isPending || isAnimating}
        className="interaction-coin-stage"
        aria-label={isPending ? '抛起旧硬币' : `硬币结果：${visibleSide}`}
      >
        <span
          className={`interaction-coin-thrower ${
            isAnimating ? 'interaction-coin-thrower--active' : ''
          }`}
        >
          <span
            className={`interaction-coin-disc interaction-coin-disc--${visibleSide.toLowerCase()} ${
              isAnimating ? 'interaction-coin-disc--spinning' : ''
            }`}
          >
            <span className="interaction-coin-face interaction-coin-face--light">
              <span>LIGHT</span>
            </span>

            <span className="interaction-coin-face interaction-coin-face--dark">
              <span>DARK</span>
            </span>

            <span className="interaction-coin-rim" />
          </span>
        </span>

        <span
          className={`interaction-coin-shadow ${
            isAnimating ? 'interaction-coin-shadow--active' : ''
          }`}
        />
      </button>

      <div className="interaction-footer">
        {isPending ? (
          <span>轻触硬币，让它替这一刻落定。</span>
        ) : (
          <span>
            落在 <strong>{visibleSide}</strong> 的一面。
          </span>
        )}
      </div>
    </article>
  );
};

export default CoinFlipInteraction;

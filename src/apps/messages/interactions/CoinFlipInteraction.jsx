import React, { useState } from 'react';
import { resolveInteractionMessage } from './interactionService';

const ANIMATION_DURATION = 1900;

export const CoinFlipInteraction = ({
  message,
  onResolved,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displaySide, setDisplaySide] = useState(
    message.metadata?.result?.side || null
  );

  const status = message.metadata?.status || 'pending';
  const storedSide = message.metadata?.result?.side || null;
  const visibleSide = storedSide || displaySide || 'LIGHT';
  const isPending = status === 'pending';

  const handleFlip = async () => {
    if (!isPending || isAnimating) return;

    /*
     * 先将随机结果写入数据库，再播放动画。
     * 所以即使动画期间刷新，结果也不会被改写。
     */
    const metadata = await resolveInteractionMessage({
      messageId: message.id,
    });

    const resolvedSide = metadata?.result?.side;

    if (!resolvedSide) {
      return;
    }

    setDisplaySide(resolvedSide);
    setIsAnimating(true);

    window.setTimeout(() => {
      setIsAnimating(false);
      onResolved?.();
    }, ANIMATION_DURATION);
  };

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
        className="interaction-coin-stage"
        onClick={handleFlip}
        disabled={!isPending || isAnimating}
        aria-label={
          isPending
            ? '抛起旧硬币'
            : `旧硬币落在 ${visibleSide} 的一面`
        }
      >
        <span
          className={`interaction-coin-ground-shadow ${
            isAnimating ? 'interaction-coin-ground-shadow--active' : ''
          }`}
        />

        <span
          className={`interaction-coin-flight ${
            isAnimating ? 'interaction-coin-flight--active' : ''
          }`}
        >
          <span
            className={`interaction-coin-spin interaction-coin-spin--${visibleSide.toLowerCase()} ${
              isAnimating ? 'interaction-coin-spin--active' : ''
            }`}
          >
            <span className="interaction-coin-body">
              <span className="interaction-coin-edge" />

              <span className="interaction-coin-face interaction-coin-face--light">
                <span className="interaction-coin-inner-ring" />
                <span className="interaction-coin-engraving">LIGHT</span>
                <span className="interaction-coin-mark interaction-coin-mark--light">
                  I
                </span>
              </span>

              <span className="interaction-coin-face interaction-coin-face--dark">
                <span className="interaction-coin-inner-ring" />
                <span className="interaction-coin-engraving">DARK</span>
                <span className="interaction-coin-mark interaction-coin-mark--dark">
                  II
                </span>
              </span>
            </span>
          </span>
        </span>
      </button>

      <div className="interaction-footer">
        {isPending ? (
          <span>轻触硬币，看它会落向哪一面。</span>
        ) : (
          <span>
            它最后停在 <strong>{visibleSide}</strong>。
          </span>
        )}
      </div>
    </article>
  );
};

export default CoinFlipInteraction;

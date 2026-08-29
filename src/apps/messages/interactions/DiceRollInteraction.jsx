import React, { useState } from 'react';
import { resolveInteractionMessage } from './interactionService';

const DICE_FACE_MAP = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 0, y: 180 },
};

const PIP_LAYOUTS = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: [
    'top-left',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-right',
  ],
};

const DiceFace = ({ value, className }) => (
  <span className={`interaction-dice-face ${className}`}>
    {PIP_LAYOUTS[value].map((position) => (
      <i
        key={`${value}-${position}`}
        className={`interaction-dice-pip interaction-dice-pip--${position}`}
      />
    ))}
  </span>
);

export const DiceRollInteraction = ({
  message,
  onResolved,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayValue, setDisplayValue] = useState(
    message.metadata?.result?.value || null
  );

  const status = message.metadata?.status || 'pending';
  const resolvedValue = message.metadata?.result?.value || displayValue;
  const isPending = status === 'pending';
  const visibleValue = resolvedValue || 1;
  const finalFace = DICE_FACE_MAP[visibleValue];

  const diceStyle = {
    '--dice-end-x': `${720 + finalFace.x}deg`,
    '--dice-end-y': `${720 + finalFace.y}deg`,
    '--dice-settled-x': `${finalFace.x}deg`,
    '--dice-settled-y': `${finalFace.y}deg`,
  };

  const handleRoll = async () => {
    if (!isPending || isAnimating) return;

    setIsAnimating(true);

    const metadata = await resolveInteractionMessage({
      messageId: message.id,
    });

    const nextValue = metadata?.result?.value;

    if (!nextValue) {
      setIsAnimating(false);
      return;
    }

    setDisplayValue(nextValue);

    window.setTimeout(() => {
      setIsAnimating(false);
      onResolved?.();
    }, 1650);
  };

  return (
    <article
      className={`chat-interaction chat-interaction--dice ${
        isPending ? 'chat-interaction--pending' : 'chat-interaction--resolved'
      }`}
    >
      <div className="interaction-heading">
        <span className="interaction-kicker">TABLE OBJECT</span>
        <span className="interaction-title">六面骰</span>
      </div>

      <button
        type="button"
        className="interaction-dice-stage"
        onClick={handleRoll}
        disabled={!isPending || isAnimating}
        aria-label={isPending ? '掷下六面骰' : `骰子结果：${visibleValue} 点`}
      >
        <span
          className={`interaction-dice-shadow ${
            isAnimating ? 'interaction-dice-shadow--active' : ''
          }`}
        />

        <span
          className={`interaction-dice-cube ${
            isAnimating ? 'interaction-dice-cube--rolling' : ''
          }`}
          style={diceStyle}
        >
          <DiceFace value={1} className="interaction-dice-face--front" />
          <DiceFace value={6} className="interaction-dice-face--back" />
          <DiceFace value={3} className="interaction-dice-face--right" />
          <DiceFace value={4} className="interaction-dice-face--left" />
          <DiceFace value={2} className="interaction-dice-face--top" />
          <DiceFace value={5} className="interaction-dice-face--bottom" />
        </span>
      </button>

      <div className="interaction-footer">
        {isPending ? (
          <span>轻触骰子，让点数自己决定。</span>
        ) : (
          <span>
            落定为 <strong>{visibleValue}</strong> 点。
          </span>
        )}
      </div>
    </article>
  );
};

export default DiceRollInteraction;

import React, { useState } from 'react';
import { resolveInteractionMessage } from './interactionService';

const RockMark = () => (
  <svg viewBox="0 0 72 72" aria-hidden="true">
    <path d="M17 49c-3-8 1-21 8-28 7-7 20-8 28-2 8 5 10 17 5 26-5 10-16 15-28 13-6-1-10-4-13-9Z" />
    <path d="M25 32c4-4 10-6 16-4M23 43c7 4 16 5 25 1" />
  </svg>
);

const PaperMark = () => (
  <svg viewBox="0 0 72 72" aria-hidden="true">
    <path d="M24 13h19l10 10v35H24z" />
    <path d="M43 13v11h10M31 35h15M31 43h15M31 51h10" />
  </svg>
);

const ScissorsMark = () => (
  <svg viewBox="0 0 72 72" aria-hidden="true">
    <circle cx="22" cy="50" r="8" />
    <circle cx="48" cy="50" r="8" />
    <path d="m28 45 17-29M42 45 26 16M29 46l13-1" />
  </svg>
);

const ChoiceMark = ({ choice }) => {
  if (choice === '石头') return <RockMark />;
  if (choice === '布') return <PaperMark />;
  return <ScissorsMark />;
};

const getOutcomeText = (outcome, characterName) => {
  if (outcome === 'user_win') return '这一次，你赢了。';
  if (outcome === 'character_win') {
    return `这一次，${characterName || '对方'}赢了。`;
  }

  return '平局，再一次也无妨。';
};

export const RockPaperScissorsInteraction = ({
  message,
  character,
  onResolved,
}) => {
  const [isResolving, setIsResolving] = useState(false);
  const [displayResult, setDisplayResult] = useState(
    message.metadata?.result || null
  );

  const status = message.metadata?.status || 'pending';
  const storedResult = message.metadata?.result || displayResult;
  const isPending = status === 'pending';

  const handleChoice = async (userChoice) => {
    if (!isPending || isResolving) return;

    setIsResolving(true);

    const metadata = await resolveInteractionMessage({
      messageId: message.id,
      userChoice,
    });

    if (!metadata?.result) {
      setIsResolving(false);
      return;
    }

    setDisplayResult(metadata.result);

    window.setTimeout(() => {
      setIsResolving(false);
      onResolved?.();
    }, 520);
  };

  return (
    <article
      className={`chat-interaction chat-interaction--rps ${
        isPending ? 'chat-interaction--pending' : 'chat-interaction--resolved'
      }`}
    >
      <div className="interaction-heading">
        <span className="interaction-kicker">TABLE GAME</span>
        <span className="interaction-title">猜拳</span>
      </div>

      {isPending ? (
        <>
          <p className="interaction-rps-invitation">
            选一张纸面，看看这一回合会偏向谁。
          </p>

          <div className="interaction-rps-choices">
            {['剪刀', '石头', '布'].map((choice) => (
              <button
                key={choice}
                type="button"
                className="interaction-rps-choice"
                onClick={() => handleChoice(choice)}
                disabled={isResolving}
                aria-label={`选择${choice}`}
              >
                <span className="interaction-rps-mark">
                  <ChoiceMark choice={choice} />
                </span>
                <span>{choice}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="interaction-rps-result">
          <div className="interaction-rps-side">
            <span className="interaction-rps-person">你</span>
            <span className="interaction-rps-result-mark">
              <ChoiceMark choice={storedResult?.userChoice} />
            </span>
            <strong>{storedResult?.userChoice}</strong>
          </div>

          <div className="interaction-rps-divider">
            <span>VS</span>
          </div>

          <div className="interaction-rps-side">
            <span className="interaction-rps-person">
              {character?.name || '对方'}
            </span>
            <span className="interaction-rps-result-mark">
              <ChoiceMark choice={storedResult?.characterChoice} />
            </span>
            <strong>{storedResult?.characterChoice}</strong>
          </div>
        </div>
      )}

      <div className="interaction-footer">
        {isPending ? (
          <span>规则由你们自己写，胜负由这一回合决定。</span>
        ) : (
          <span>
            {getOutcomeText(storedResult?.outcome, character?.name)}
          </span>
        )}
      </div>
    </article>
  );
};

export default RockPaperScissorsInteraction;

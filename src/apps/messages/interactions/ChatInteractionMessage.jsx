import React from 'react';
import CoinFlipInteraction from './CoinFlipInteraction';
import DiceRollInteraction from './DiceRollInteraction';
import RockPaperScissorsInteraction from './RockPaperScissorsInteraction';
import { INTERACTION_TYPES } from './interactionRules';

export const ChatInteractionMessage = ({
  message,
  character,
  onResolved,
}) => {
  const interactionType = message?.metadata?.interactionType;

  if (interactionType === INTERACTION_TYPES.COIN) {
    return (
      <CoinFlipInteraction
        message={message}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.DICE) {
    return (
      <DiceRollInteraction
        message={message}
        onResolved={onResolved}
      />
    );
  }

  if (interactionType === INTERACTION_TYPES.RPS) {
    return (
      <RockPaperScissorsInteraction
        message={message}
        character={character}
        onResolved={onResolved}
      />
    );
  }

  return null;
};

export default ChatInteractionMessage;

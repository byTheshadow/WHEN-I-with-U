export const INTERACTION_TYPES = {
  COIN: 'coin',
  DICE: 'dice',
  RPS: 'rps',
};

export const RPS_CHOICES = ['剪刀', '石头', '布'];

export const getCoinResult = () => (
  Math.random() >= 0.5 ? 'LIGHT' : 'DARK'
);

export const getDiceResult = () => (
  Math.floor(Math.random() * 6) + 1
);

export const getRandomRpsChoice = () => (
  RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)]
);

export const getRpsOutcome = (userChoice, characterChoice) => {
  if (userChoice === characterChoice) {
    return 'draw';
  }

  const winningPairs = {
    剪刀: '布',
    石头: '剪刀',
    布: '石头',
  };

  return winningPairs[userChoice] === characterChoice
    ? 'user_win'
    : 'character_win';
};

export const getInteractionLabel = (interactionType) => {
  switch (interactionType) {
    case INTERACTION_TYPES.COIN:
      return '旧硬币';
    case INTERACTION_TYPES.DICE:
      return '六面骰';
    case INTERACTION_TYPES.RPS:
      return '猜拳';
    default:
      return '互动';
  }
};

export const getInteractionSummary = (metadata = {}) => {
  const interactionType = metadata?.interactionType;
  const result = metadata?.result || {};

  if (interactionType === INTERACTION_TYPES.COIN) {
    return `硬币落在 ${result.side || '未知一面'}。`;
  }

  if (interactionType === INTERACTION_TYPES.DICE) {
    return `六面骰落在 ${result.value || '未知'} 点。`;
  }

  if (interactionType === INTERACTION_TYPES.RPS) {
    const outcomeText = {
      user_win: '用户获胜',
      character_win: '角色获胜',
      draw: '平局',
    };

    return `猜拳结果：用户出${result.userChoice || '未知'}，角色出${
      result.characterChoice || '未知'
    }，${outcomeText[result.outcome] || '结果未知'}。`;
  }

  return '完成了一次聊天互动。';
};

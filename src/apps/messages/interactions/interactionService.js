import db from '../../../db';
import {
  INTERACTION_TYPES,
  getCoinResult,
  getDiceResult,
  getRandomRpsChoice,
  getRpsOutcome,
} from './interactionRules';
import { generateInteractionReaction } from './interactionAiService';

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const getInitialContent = (interactionType) => {
  switch (interactionType) {
    case INTERACTION_TYPES.COIN:
      return '抛出一枚旧硬币';
    case INTERACTION_TYPES.DICE:
      return '掷下一枚六面骰';
    case INTERACTION_TYPES.RPS:
      return '发起了一次猜拳';
    default:
      return '留下了一次互动';
  }
};

export const createInteractionMessage = async ({
  chatId,
  characterId,
  interactionType,
}) => {
  if (!chatId || !characterId || !interactionType) {
    return null;
  }

  const timestamp = new Date().toISOString();

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'interaction',
    content: getInitialContent(interactionType),
    metadata: {
      interactionType,
      status: 'pending',
      result: null,
      createdAt: timestamp,
      resolvedAt: null,
    },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
  });

  dispatchLocalMessageEvent(chatId);

  return messageId;
};

const getResolvedResult = ({ interactionType, userChoice }) => {
  if (interactionType === INTERACTION_TYPES.COIN) {
    return {
      side: getCoinResult(),
    };
  }

  if (interactionType === INTERACTION_TYPES.DICE) {
    return {
      value: getDiceResult(),
    };
  }

  if (interactionType === INTERACTION_TYPES.RPS) {
    const characterChoice = getRandomRpsChoice();

    return {
      userChoice,
      characterChoice,
      outcome: getRpsOutcome(userChoice, characterChoice),
    };
  }

  return null;
};

export const resolveInteractionMessage = async ({
  messageId,
  userChoice = null,
}) => {
  if (!messageId) return null;

  let resolvedMetadata = null;
  let shouldGenerateReaction = false;
  let chatId = null;

  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);

    if (
      !message ||
      message.type !== 'interaction' ||
      !message.metadata?.interactionType
    ) {
      return;
    }

    chatId = message.chatId;

    if (message.metadata.status === 'resolved') {
      resolvedMetadata = message.metadata;
      return;
    }

    const interactionType = message.metadata.interactionType;

    if (
      interactionType === INTERACTION_TYPES.RPS &&
      !['剪刀', '石头', '布'].includes(userChoice)
    ) {
      return;
    }

    const result = getResolvedResult({
      interactionType,
      userChoice,
    });

    if (!result) return;

    const resolvedAt = new Date().toISOString();

    resolvedMetadata = {
      ...message.metadata,
      status: 'resolved',
      result,
      resolvedAt,
    };

    await db.messages.update(messageId, {
      metadata: resolvedMetadata,
    });

    shouldGenerateReaction = true;
  });

  if (!resolvedMetadata || !chatId) {
    return null;
  }

  dispatchLocalMessageEvent(chatId);

  if (shouldGenerateReaction) {
    void generateInteractionReaction({
      chatId,
      interactionMetadata: resolvedMetadata,
    });
  }

  return resolvedMetadata;
};

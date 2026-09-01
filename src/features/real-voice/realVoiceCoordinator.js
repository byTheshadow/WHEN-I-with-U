import db from '../../db';

import {
  REAL_VOICE_MARKER,
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from './realVoiceDefaults';

import {
  buildVoiceExpressionInstruction,
} from './voiceExpressionGuides';

import {
  synthesizeMiniMaxSpeech,
} from './minimaxClient';

const removeVoiceMarker = (content = '') => (
  content
    .replace(REAL_VOICE_MARKER, '')
    .replace(/^\s+/, '')
    .trim()
);

export const buildRealVoiceDecisionInstruction = (character) => {
  const profile = normalizeVoiceProfile(character?.voiceProfile);

  if (
    !hasUsableMiniMaxVoiceProfile(profile)
    || !profile.aiMaySendVoice
  ) {
    return '';
  }

  return buildVoiceExpressionInstruction({
    voiceProfile: profile,
    characterName: character?.name,
  });
};

export const applyRealVoiceIntent = (messages = []) => (
  messages.map((message) => {
    const content = message?.content || '';

    const requested = (
      message?.type === 'text'
      && content.includes(REAL_VOICE_MARKER)
    );

    return {
      ...message,
      content: requested
        ? removeVoiceMarker(content)
        : content,
      realVoiceRequested: requested,
    };
  })
);

export const createRealVoiceMessagesForReply = async ({
  chatId,
  character,
  sourceMessages,
}) => {
  const profile = normalizeVoiceProfile(character?.voiceProfile);

  if (
    !hasUsableMiniMaxVoiceProfile(profile)
    || !profile.aiMaySendVoice
    || profile.voiceExpression?.mode === 'off'
  ) {
    return [];
  }

  const requestedMessages = sourceMessages.filter((message) => (
    message.realVoiceRequested
      && message.type === 'text'
      && message.content?.trim()
  ));

  if (requestedMessages.length === 0) {
    return [];
  }

  // 即使模型意外输出多次标记，也只生成一条。
  const sourceMessage = requestedMessages[0];
  const createdAt = new Date().toISOString();

  const initialMetadata = {
    generationStatus: 'pending',
    transcript: sourceMessage.content,
    provider: 'minimax',
    modelId: profile.minimax.modelId,
    voiceId: profile.minimax.voiceId,
    language: profile.minimax.language,
    createdAt,
  };

  const messageId = await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'realVoice',
    content: sourceMessage.content,
    metadata: initialMetadata,
    versions: [{
      type: 'realVoice',
      content: sourceMessage.content,
      metadata: initialMetadata,
      timestamp: createdAt,
    }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: createdAt,
  });

  try {
    const result = await synthesizeMiniMaxSpeech({
      text: sourceMessage.content,
      voiceProfile: profile,
    });

    const readyMetadata = {
      ...initialMetadata,
      generationStatus: 'ready',
      audioBlob: result.audioBlob,
      mimeType: result.mimeType,
      byteSize: result.audioBlob.size,
    };

    await db.messages.update(messageId, {
      metadata: readyMetadata,
      versions: [{
        type: 'realVoice',
        content: sourceMessage.content,
        metadata: readyMetadata,
        timestamp: createdAt,
      }],
    });

    return [messageId];
  } catch (error) {
    const failedMetadata = {
      ...initialMetadata,
      generationStatus: 'failed',
      errorMessage: (
        error?.message
        || '这段声音没有顺利生成。'
      ),
    };

    await db.messages.update(messageId, {
      metadata: failedMetadata,
      versions: [{
        type: 'realVoice',
        content: sourceMessage.content,
        metadata: failedMetadata,
        timestamp: createdAt,
      }],
    });

    console.warn('[RealVoice] 生成失败：', error);

    return [messageId];
  }
};

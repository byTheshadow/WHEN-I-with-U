import db from '../../db';
import {
  REAL_VOICE_MARKER,
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from './realVoiceDefaults';
import { synthesizeMiniMaxSpeech } from './minimaxClient';

const removeVoiceMarker = (content = '') => (
  content
    .replace(REAL_VOICE_MARKER, '')
    .replace(/^\s+/, '')
    .trim()
);

export const buildRealVoiceDecisionInstruction = (character) => {
  if (!hasUsableMiniMaxVoiceProfile(character?.voiceProfile)) {
    return '';
  }

  return `
[真实语音留笺规则]
你可以自主决定本次回复是否值得额外留下一段真实语音。
只有在情绪明显、需要更亲近的表达、安慰、晚安、重要回应、低声分享或适合被听见的片段时，才使用真实语音。
普通信息、连续解释、过长内容、需要用户快速阅读的信息，保持纯文字即可。
如果决定留下真实语音，请在那一条需要被朗读的文字开头加上 ${REAL_VOICE_MARKER}。
不要向用户解释这个标记，不要频繁使用；一轮回复最多使用一次。
`;
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
      content: requested ? removeVoiceMarker(content) : content,
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

  if (!hasUsableMiniMaxVoiceProfile(profile)) {
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

  // 系统提示已限制一轮最多一段；这里仍做硬限制。
  const sourceMessage = requestedMessages[0];
  const createdAt = new Date().toISOString();

  const voiceMessage = {
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'realVoice',
    content: sourceMessage.content,
    metadata: {
      generationStatus: 'pending',
      transcript: sourceMessage.content,
      provider: 'minimax',
      modelId: profile.minimax.modelId,
      voiceId: profile.minimax.voiceId,
      createdAt,
    },
    versions: [],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: createdAt,
  };

  const messageId = await db.messages.add(voiceMessage);

  try {
    const result = await synthesizeMiniMaxSpeech({
      text: sourceMessage.content,
      voiceProfile: profile,
    });

    const metadata = {
      ...voiceMessage.metadata,
      generationStatus: 'ready',
      audioBlob: result.audioBlob,
      mimeType: result.mimeType,
      byteSize: result.audioBlob.size,
    };

    await db.messages.update(messageId, {
      metadata,
      versions: [{
        type: 'realVoice',
        content: sourceMessage.content,
        metadata,
        timestamp: createdAt,
      }],
    });

    return [messageId];
  } catch (error) {
    const metadata = {
      ...voiceMessage.metadata,
      generationStatus: 'failed',
      errorMessage: error?.message || '真实语音没有顺利生成。',
    };

    await db.messages.update(messageId, {
      metadata,
      versions: [{
        type: 'realVoice',
        content: sourceMessage.content,
        metadata,
        timestamp: createdAt,
      }],
    });

    console.warn('[RealVoice] 生成失败：', error);
    return [messageId];
  }
};

import db from '../../db';

import {
  REAL_VOICE_MARKER,
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from './realVoiceDefaults';

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

  return `
[真实语音留笺规则]
你可以自行判断，本次回复是否值得额外留下一段真实声音。

适合留下声音的情况包括：
- 情绪明显、亲密、安慰、道歉、告白、晚安或早安；
- 想低声分享一件重要的小事；
- 适合被听见而非只适合阅读的一句话；
- 需要停顿、语气或陪伴感才能完整传达的内容。

不适合留下声音的情况包括：
- 普通问答；
- 连续解释；
- 较长信息；
- 清单、步骤、事实说明；
- 用户需要快速阅读或检索的信息。

如果决定留下声音，请在一条短文字的开头加入 ${REAL_VOICE_MARKER}。
该标记不会被用户看见，只用于生成声音留笺。
不要解释标记本身；不要频繁使用；一轮回复最多使用一次真实声音。
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

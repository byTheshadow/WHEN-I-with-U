import db from '../../db';

import {
  REAL_VOICE_MARKER,
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from './realVoiceDefaults';

import {
  REAL_VOICE_END_MARKER,
  buildVoiceExpressionInstruction,
} from './voiceExpressionGuides';

import {
  synthesizeMiniMaxSpeech,
} from './minimaxClient';

const MINIMAX_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'calm',
  'fluent',
  'whisper',
];

const SPEECH_TAG_SUPPORTED_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
];

const WHISPER_SUPPORTED_MODELS = [
  'speech-2.6-hd',
  'speech-2.6-turbo',
];

const SPEECH_TAG_PATTERN = /\((?:laughs|chuckle|coughs|clear-throat|groans|breath|pant|inhale|exhale|gasps|sniffs|sighs|snorts|burps|lip-smacking|humming|hissing|emm|sneezes)\)/gi;

const clampNumber = ({
  value,
  fallback,
  min,
  max,
}) => {
  const numberValue = Number(value);
  const safeValue = Number.isFinite(numberValue)
    ? numberValue
    : Number(fallback);

  const normalizedFallback = Number.isFinite(safeValue)
    ? safeValue
    : min;

  return Math.min(
    max,
    Math.max(min, normalizedFallback),
  );
};

const removeSpeechTagsForDisplay = (text = '') => (
  String(text)
    .replace(SPEECH_TAG_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
);

const isWhisperUnsupported = (modelId) => (
  !WHISPER_SUPPORTED_MODELS.includes(modelId)
);

const supportsSpeechTags = (modelId) => (
  SPEECH_TAG_SUPPORTED_MODELS.includes(modelId)
);

const getSafeProfileEmotion = (profile) => {
  const emotion = profile.minimax.emotion;

  if (!MINIMAX_EMOTIONS.includes(emotion)) {
    return 'calm';
  }

  if (
    emotion === 'whisper'
    && isWhisperUnsupported(profile.minimax.modelId)
  ) {
    return 'calm';
  }

  if (
    emotion === 'fluent'
    && !WHISPER_SUPPORTED_MODELS.includes(profile.minimax.modelId)
  ) {
    return 'calm';
  }

  return emotion;
};

const normalizeVoiceIntent = ({
  rawIntent,
  profile,
}) => {
  const config = profile.minimax;
  const rawText = String(rawIntent?.text || '')
    .trim()
    .slice(0, 900);

  if (!rawText) {
    return null;
  }

  let emotion = MINIMAX_EMOTIONS.includes(rawIntent?.emotion)
    ? rawIntent.emotion
    : getSafeProfileEmotion(profile);

  if (
    emotion === 'whisper'
    && isWhisperUnsupported(config.modelId)
  ) {
    emotion = 'calm';
  }

  if (
    emotion === 'fluent'
    && !WHISPER_SUPPORTED_MODELS.includes(config.modelId)
  ) {
    emotion = 'calm';
  }

  const ttsText = supportsSpeechTags(config.modelId)
    ? rawText
    : rawText.replace(SPEECH_TAG_PATTERN, '');

  const transcript = removeSpeechTagsForDisplay(ttsText);

  if (!transcript) {
    return null;
  }

  return {
    // 实际发送给 MiniMax 的文本，可能包含合法语气标签。
    text: ttsText,

    // 用户界面与数据库内容展示的转写，不显示语气标签。
    transcript,

    emotion,

    speed: clampNumber({
      value: rawIntent?.speed,
      fallback: config.speed,
      min: 0.5,
      max: 2,
    }),

    pitch: clampNumber({
      value: rawIntent?.pitch,
      fallback: config.pitch,
      min: -12,
      max: 12,
    }),
  };
};

const tryParseVoiceIntent = ({
  rawValue,
  profile,
}) => {
  try {
    const parsed = JSON.parse(rawValue);

    return normalizeVoiceIntent({
      rawIntent: parsed,
      profile,
    });
  } catch {
    return null;
  }
};

const getRealVoiceBlockPattern = () => (
  new RegExp(
    `${REAL_VOICE_MARKER.replace(/[[\]]/g, '\\$&')}\\s*([\\s\\S]*?)\\s*${REAL_VOICE_END_MARKER.replace(/[[\]/]/g, '\\$&')}`,
    'g',
  )
);

const removeLegacyVoiceMarker = (content = '') => (
  String(content)
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

/**
 * 解析主文字 AI 返回的隐藏声音区块。
 *
 * 处理前：
 * 正常文字
 * [[REAL_VOICE]]
 * {"text":"(sighs) 我在这里。","emotion":"calm","speed":0.92,"pitch":-1}
 * [[/REAL_VOICE]]
 *
 * 处理后：
 * {
 *   content: '正常文字',
 *   realVoiceIntent: {
 *     text: '(sighs) 我在这里。',
 *     transcript: '我在这里。',
 *     emotion: 'calm',
 *     speed: 0.92,
 *     pitch: -1,
 *   },
 * }
 */
export const applyRealVoiceIntent = (
  messages = [],
  voiceProfile,
) => {
  const profile = normalizeVoiceProfile(voiceProfile);
  const blockPattern = getRealVoiceBlockPattern();

  return messages
    .map((message) => {
      const originalContent = String(message?.content || '');

      if (message?.type !== 'text') {
        return message;
      }

      let extractedIntent = null;

      const visibleContent = originalContent
        .replace(
          blockPattern,
          (fullMatch, rawJson) => {
            if (!extractedIntent) {
              extractedIntent = tryParseVoiceIntent({
                rawValue: rawJson,
                profile,
              });
            }

            // 无论 JSON 是否格式正确，都不让内部块显示给用户。
            return '';
          },
        )
        .trim();

      if (extractedIntent) {
        return {
          ...message,
          content: visibleContent,
          realVoiceRequested: true,
          realVoiceIntent: extractedIntent,
        };
      }

      /**
       * 兼容旧版 [[REAL_VOICE]] 文本协议：
       * 若旧模型缓存或旧 prompt 仍输出旧标记，
       * 仍可以按“整段文字”生成一次声音。
       */
      if (originalContent.includes(REAL_VOICE_MARKER)) {
        const legacyText = removeLegacyVoiceMarker(originalContent);

        const legacyIntent = normalizeVoiceIntent({
          rawIntent: {
            text: legacyText,
          },
          profile,
        });

        return {
          ...message,
          content: legacyText,
          realVoiceRequested: Boolean(legacyIntent),
          realVoiceIntent: legacyIntent,
        };
      }

      return {
        ...message,
        content: visibleContent,
        realVoiceRequested: false,
      };
    })
    .filter((message) => (
      message.type !== 'text'
      || message.content?.trim()
    ));
};

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

  const sourceMessage = sourceMessages.find((message) => (
    message?.type === 'text'
    && message.realVoiceRequested
    && message.realVoiceIntent?.text?.trim()
  ));

  if (!sourceMessage) {
    return [];
  }

  const voiceIntent = normalizeVoiceIntent({
    rawIntent: sourceMessage.realVoiceIntent,
    profile,
  });

  if (!voiceIntent) {
    return [];
  }

  const createdAt = new Date().toISOString();

  const initialMetadata = {
    generationStatus: 'pending',

    // 用户界面中显示的转写，不含 (sighs) 等内部语气标签。
    transcript: voiceIntent.transcript,

    // 实际交给 MiniMax 的文本，保留模型支持的语气标签。
    ttsText: voiceIntent.text,

    provider: 'minimax',
    modelId: profile.minimax.modelId,
    voiceId: profile.minimax.voiceId,
    language: profile.minimax.language,

    // 本次由主文字 AI 决定，并已完成安全校验。
    emotion: voiceIntent.emotion,
    speed: voiceIntent.speed,
    pitch: voiceIntent.pitch,

    createdAt,
  };

  const messageId = await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'realVoice',

    // 消息卡片显示的内容，不展示语气标签。
    content: voiceIntent.transcript,

    metadata: initialMetadata,
    versions: [{
      type: 'realVoice',
      content: voiceIntent.transcript,
      metadata: initialMetadata,
      timestamp: createdAt,
    }],
    currentVersionIndex: 0,
    isRead: false,
    timestamp: createdAt,
  });

  try {
    const result = await synthesizeMiniMaxSpeech({
      text: voiceIntent.text,
      voiceProfile: profile,
      voiceIntent,
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
        content: voiceIntent.transcript,
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
        content: voiceIntent.transcript,
        metadata: failedMetadata,
        timestamp: createdAt,
      }],
    });

    console.warn('[RealVoice] 生成失败：', error);

    return [messageId];
  }
};

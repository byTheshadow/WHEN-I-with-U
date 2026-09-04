import db from '../../db';

import {
  REAL_VOICE_END_MARKER,
  buildVoiceExpressionInstruction,
} from './voiceExpressionGuides';

import {
  synthesizeMiniMaxSpeech,
} from './minimaxClient';

import {
  REAL_VOICE_MARKER,
  VOICE_LANGUAGE_OPTIONS,
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from './realVoiceDefaults';

const MINIMAX_LANGUAGES = new Set(
  VOICE_LANGUAGE_OPTIONS.map((item) => item.value),
);

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
  const aiMayControlVoiceSettings = (
    profile.aiMayControlVoiceSettings === true
  );

  const rawText = String(rawIntent?.text || '')
    .trim()
    .slice(0, 900);

  const language = MINIMAX_LANGUAGES.has(rawIntent?.language)
    ? rawIntent.language
    : (
      MINIMAX_LANGUAGES.has(config.language)
        ? config.language
        : 'auto'
    );

  if (!rawText) {
    return null;
  }

  let emotion = aiMayControlVoiceSettings
    && MINIMAX_EMOTIONS.includes(rawIntent?.emotion)
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

    // 语言控制与声音表现控制独立。
    language,

    // 关闭开关时使用角色配置中的固定情绪。
    emotion,

    // 关闭开关时使用角色配置中的固定语速。
    speed: clampNumber({
      value: aiMayControlVoiceSettings
        ? rawIntent?.speed
        : config.speed,
      fallback: config.speed,
      min: 0.5,
      max: 2,
    }),

    // 关闭开关时使用角色配置中的固定音调。
    pitch: clampNumber({
      value: aiMayControlVoiceSettings
        ? rawIntent?.pitch
        : config.pitch,
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

/**
 * 从文本中提取一个完整的 JSON 对象。
 *
 * 不使用简单的正则表达式，避免 text 内容中出现标点、
 * 日文引号或转义字符时，JSON 被提前截断。
 */
const findJsonObject = (content = '') => {
  const text = String(content);
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (depth === 0) {
        startIndex = index;
      }

      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth === 0) {
        continue;
      }

      depth -= 1;

      if (depth === 0 && startIndex >= 0) {
        return {
          rawValue: text.slice(startIndex, index + 1),
          startIndex,
          endIndex: index + 1,
        };
      }
    }
  }

  return null;
};

const extractVoiceIntentFromContent = ({
  content,
  profile,
}) => {
  const originalContent = String(content || '');
  const markerIndex = originalContent.indexOf(REAL_VOICE_MARKER);

  // 优先从真实声音标记后面寻找 JSON。
  const searchContent = markerIndex >= 0
    ? originalContent.slice(
      markerIndex + REAL_VOICE_MARKER.length,
    )
    : originalContent;

  const jsonObject = findJsonObject(searchContent);

  if (!jsonObject) {
    return null;
  }

  const intent = tryParseVoiceIntent({
    rawValue: jsonObject.rawValue,
    profile,
  });

  if (!intent) {
    return null;
  }

  const offset = markerIndex >= 0
    ? markerIndex + REAL_VOICE_MARKER.length
    : 0;

  return {
    intent,
    startIndex: offset + jsonObject.startIndex,
    endIndex: offset + jsonObject.endIndex,
    markerIndex,
  };
};

const getRealVoiceBlockPattern = () => (
  new RegExp(
    `${REAL_VOICE_MARKER.replace(/[[\]]/g, '\\$&')}\\s*([\\s\\S]*?)\\s*${REAL_VOICE_END_MARKER.replace(/[[\]/]/g, '\\$&')}`,
    'g',
  )
);

const removeLegacyVoiceMarker = (content = '') => (
  String(content)
    .replaceAll(REAL_VOICE_MARKER, '')
    .replaceAll(REAL_VOICE_END_MARKER, '')
    .replace(/^\s+/, '')
    .trim()
);

const removeExtractedVoiceJson = ({
  content,
  extracted,
}) => {
  if (!extracted) {
    return String(content || '');
  }

  let result = String(content || '');

  result = (
    result.slice(0, extracted.startIndex)
    + result.slice(extracted.endIndex)
  );

  result = result
    .replaceAll(REAL_VOICE_MARKER, '')
    .replaceAll(REAL_VOICE_END_MARKER, '')
    .trim();

  return result;
};

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
 * 除了标准的：
 *
 * [[REAL_VOICE]]
 * {"text":"...", "language":"Japanese"}
 * [[/REAL_VOICE]]
 *
 * 也兼容 AI 漏掉结束标记、只输出开始标记，
 * 或直接输出 JSON 的情况。
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

      const contentWithoutCompleteBlock = originalContent
        .replace(
          blockPattern,
          (fullMatch, rawJson) => {
            if (!extractedIntent) {
              extractedIntent = tryParseVoiceIntent({
                rawValue: rawJson,
                profile,
              });
            }

            // 完整隐藏区块永远不显示给用户。
            return '';
          },
        );

      if (extractedIntent) {
        return {
          ...message,
          content: contentWithoutCompleteBlock.trim(),
          realVoiceRequested: true,
          realVoiceIntent: extractedIntent,
        };
      }

      /**
       * 兼容不完整标记：
       *
       * AI 有时会输出：
       *
       * [[REAL_VOICE]]
       * {
       *   "text": "...",
       *   "language": "Japanese"
       * }
       *
       * 但忘记输出 [[/REAL_VOICE]]。
       */
      const extracted = extractVoiceIntentFromContent({
        content: originalContent,
        profile,
      });

      if (extracted) {
        const visibleContent = removeExtractedVoiceJson({
          content: originalContent,
          extracted,
        });

        return {
          ...message,
          content: visibleContent,
          realVoiceRequested: true,
          realVoiceIntent: extracted.intent,
        };
      }

      /**
       * 兼容旧版纯文本协议。
       *
       * 如果标记后面已经出现 JSON，但 JSON 不完整，
       * 不再把 JSON 当成语音文本朗读。
       */
      if (originalContent.includes(REAL_VOICE_MARKER)) {
        const legacyText = removeLegacyVoiceMarker(originalContent);
        const looksLikeBrokenJson = (
          legacyText.includes('{')
          || legacyText.includes('"text"')
          || legacyText.includes('"language"')
        );

        if (looksLikeBrokenJson) {
          return {
            ...message,
            content: '',
            realVoiceRequested: false,
          };
        }

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
        content: contentWithoutCompleteBlock.trim(),
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

    // 用户界面中显示的转写，不含语气标签和 JSON。
    transcript: voiceIntent.transcript,

    // 实际交给 MiniMax 的文本，不包含 JSON 格式。
    ttsText: voiceIntent.text,

    provider: 'minimax',
    modelId: profile.minimax.modelId,
    voiceId: profile.minimax.voiceId,

    // 本次真实声音实际采用的语言。
    language: voiceIntent.language,

    // 本次真实声音实际采用的参数。
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

    // 消息显示内容只使用 transcript，不显示 JSON。
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

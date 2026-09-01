import { normalizeVoiceProfile } from './realVoiceDefaults';

const DEFAULT_TTS_PATH = '/t2a_v2';
const DEFAULT_MODELS_PATH = '/anthropic/v1/models';

const trimTrailingSlash = (value = '') => (
  String(value).replace(/\/+$/, '')
);

const getActiveBaseUrl = (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const { proxyBaseUrl, baseUrl } = normalized.minimax;

  return trimTrailingSlash(
    proxyBaseUrl?.trim() || baseUrl?.trim(),
  );
};

const getApiKey = (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  let apiKey = normalized.minimax.apiKey?.trim() || '';

  // 防止用户把 "Bearer " 一起粘贴进输入框，
  // 避免最终请求变成 Bearer Bearer xxxxx。
  apiKey = apiKey.replace(/^Bearer\s+/i, '').trim();

  return apiKey;
};

const createTtsHeaders = (profile) => {
  const apiKey = getApiKey(profile);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
};

const createModelsHeaders = (profile) => {
  const apiKey = getApiKey(profile);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  };
};

const getErrorMessage = (payload, fallback) => (
  payload?.base_resp?.status_msg
  || payload?.base_response?.status_msg
  || payload?.error?.message
  || payload?.message
  || payload?.error
  || fallback
);

const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawText: text,
    };
  }
};

const isLikelyCorsError = (error) => (
  error instanceof TypeError
  && (
    error.message.includes('Failed to fetch')
    || error.message.includes('NetworkError')
    || error.message.includes('Load failed')
  )
);

const createCorsError = () => (
  new Error(
    '浏览器无法直接连接 MiniMax。当前接口没有允许此 PWA 跨域访问，请填写代理地址后重试。',
  )
);

const validateProfileForRequest = (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const config = normalized.minimax;

  if (!config.apiKey?.trim()) {
    throw new Error('请先填写 MiniMax API Key。');
  }

  if (!getActiveBaseUrl(normalized)) {
    throw new Error('请先填写 MiniMax Base URL。');
  }

  return normalized;
};

const decodeBase64ToBytes = (value) => {
  const raw = window.atob(value);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
};

const decodeHexToBytes = (value) => {
  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(
      value.slice(index, index + 2),
      16,
    );
  }

  return bytes;
};

const isHexAudio = (value) => (
  typeof value === 'string'
  && value.length > 0
  && value.length % 2 === 0
  && /^[0-9a-f]+$/i.test(value)
);

const normalizeBase64 = (value) => (
  value
    .replace(/^data:audio\/[^;]+;base64,/i, '')
    .replace(/\s/g, '')
);

const audioValueToBlob = async (audioValue, mimeType) => {
  if (!audioValue) {
    throw new Error('MiniMax 没有返回可播放的音频数据。');
  }

  if (audioValue instanceof Blob) {
    return audioValue;
  }

  if (
    typeof audioValue === 'string'
    && /^https?:\/\//i.test(audioValue)
  ) {
    let response;

    try {
      response = await fetch(audioValue);
    } catch (error) {
      if (isLikelyCorsError(error)) {
        throw createCorsError();
      }

      throw error;
    }

    if (!response.ok) {
      throw new Error(
        `音频文件下载失败：HTTP ${response.status}`,
      );
    }

    return response.blob();
  }

  if (typeof audioValue !== 'string') {
    throw new Error('MiniMax 返回了暂不支持的音频格式。');
  }

  const bytes = isHexAudio(audioValue)
    ? decodeHexToBytes(audioValue)
    : decodeBase64ToBytes(normalizeBase64(audioValue));

  return new Blob([bytes], {
    type: mimeType,
  });
};

const normalizeModelList = (payload) => {
  const rawModels = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  return rawModels
    .map((item) => {
      if (typeof item === 'string') {
        return {
          id: item,
          label: item,
          type: 'model',
        };
      }

      return {
        id: item?.id || item?.model || item?.name,
        label: item?.display_name
          || item?.name
          || item?.id
          || item?.model,
        type: item?.type || 'model',
      };
    })
    .filter((item) => item.id)
    .filter((item) => {
      const modelText = `${item.id} ${item.label}`.toLowerCase();

      return (
        modelText.includes('speech')
        || modelText.includes('tts')
        || modelText.includes('voice')
        || modelText.includes('audio')
      );
    });
};

/**
 * 根据 MiniMax 官方模型列表文档：
 *
 * GET /anthropic/v1/models
 * Header: X-Api-Key: API_KEY
 *
 * 注意：
 * /models 返回的是平台支持的模型，不一定只有 TTS 模型。
 * 这里仅筛选 speech / tts / voice / audio 相关模型。
 */
export const fetchMiniMaxModels = async (profile) => {
  const normalized = validateProfileForRequest(profile);
  const baseUrl = getActiveBaseUrl(normalized);

  let response;

  try {
    response = await fetch(
  getModelsUrl(normalized),
  {
    method: 'GET',
    headers: createModelsHeaders(normalized),
  },
);

  } catch (error) {
    if (isLikelyCorsError(error)) {
      throw createCorsError();
    }

    throw error;
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload,
        `读取 MiniMax 模型失败：HTTP ${response.status}`,
      ),
    );
  }

  const models = normalizeModelList(payload);

  if (models.length === 0) {
    throw new Error(
      '模型列表接口没有返回可识别的语音模型。请确认当前 API Key 已开通 TTS 权限。',
    );
  }

  return models;
};

const buildSpeechPayload = ({
  text,
  profile,
}) => {
  const config = profile.minimax;

  const payload = {
    model: config.modelId.trim(),
    text: text.trim(),
    stream: false,

    voice_setting: {
      voice_id: config.voiceId.trim(),
      speed: Number(config.speed) || 1,
      vol: Number(config.volume) || 1,
      pitch: Number(config.pitch) || 0,
      emotion: config.emotion || 'neutral',
    },

    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: config.audioFormat || 'mp3',
      channel: 1,
    },

    subtitle_enable: false,
  };

  if (
    config.language
    && config.language !== 'auto'
  ) {
    payload.language_boost = config.language;
  }

  return payload;
};

export const synthesizeMiniMaxSpeech = async ({
  text,
  voiceProfile,
}) => {
  const normalized = validateProfileForRequest(voiceProfile);
  const config = normalized.minimax;
  const baseUrl = getActiveBaseUrl(normalized);

  if (!text?.trim()) {
    throw new Error('没有可生成声音的文字。');
  }

  if (!config.modelId?.trim()) {
    throw new Error('请先选择一个 MiniMax 语音模型。');
  }

  if (!config.voiceId?.trim()) {
    throw new Error('请先填写已有的 Voice ID。');
  }

  let response;

  try {
    response = await fetch(
      `${baseUrl}${DEFAULT_TTS_PATH}`,
      {
        method: 'POST',
        headers: createTtsHeaders(normalized),
        body: JSON.stringify(
          buildSpeechPayload({
            text,
            profile: normalized,
          }),
        ),
      },
    );
  } catch (error) {
    if (isLikelyCorsError(error)) {
      throw createCorsError();
    }

    throw error;
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload,
        `MiniMax 语音生成失败：HTTP ${response.status}`,
      ),
    );
  }

  const apiErrorCode = (
    payload?.base_resp?.status_code
    ?? payload?.base_response?.status_code
  );

  if (
    apiErrorCode !== undefined
    && apiErrorCode !== null
    && Number(apiErrorCode) !== 0
  ) {
    throw new Error(
      getErrorMessage(
        payload,
        'MiniMax 语音生成失败。',
      ),
    );
  }

  const audioValue = (
    payload?.data?.audio
    || payload?.data?.audio_url
    || payload?.audio
    || payload?.audio_url
  );

  const mimeType = config.audioFormat === 'wav'
    ? 'audio/wav'
    : 'audio/mpeg';

  const audioBlob = await audioValueToBlob(
    audioValue,
    mimeType,
  );

  return {
    audioBlob,
    mimeType: audioBlob.type || mimeType,
    provider: 'minimax',
    modelId: config.modelId,
    voiceId: config.voiceId,
    language: config.language,
  };
};

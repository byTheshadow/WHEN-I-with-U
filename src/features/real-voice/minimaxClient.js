import { normalizeVoiceProfile } from './realVoiceDefaults';

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

const createHeaders = (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const {
    apiKey,
    groupId,
    region,
  } = normalized.minimax;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`,
  };

  // 国内版常见的 Group / Tenant 传递方式。
  // 如你的 MiniMax 控制台文档要求不同 Header，
  // 只需在这里调整，不影响其他组件。
  if (region === 'china' && groupId?.trim()) {
    headers['X-Tenant-Id'] = groupId.trim();
  }

  return headers;
};

const getErrorMessage = (payload, fallback) => (
  payload?.base_resp?.status_msg
  || payload?.base_response?.status_msg
  || payload?.error?.message
  || payload?.message
  || fallback
);

const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawText: text,
    };
  }
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
    const response = await fetch(audioValue);

    if (!response.ok) {
      throw new Error(`音频文件下载失败：HTTP ${response.status}`);
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
  const rawModels = (
    Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : Array.isArray(payload?.data?.models)
          ? payload.data.models
          : []
  );

  return rawModels
    .map((item) => {
      if (typeof item === 'string') {
        return {
          id: item,
          label: item,
        };
      }

      return {
        id: item?.id || item?.model || item?.name,
        label: item?.name || item?.id || item?.model,
      };
    })
    .filter((item) => item.id)
    .filter((item) => /speech|tts|voice|audio/i.test(item.id));
};

export const fetchMiniMaxModels = async (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const baseUrl = getActiveBaseUrl(normalized);

  if (!normalized.minimax.apiKey?.trim()) {
    throw new Error('请先填写 MiniMax API Key。');
  }

  if (!baseUrl) {
    throw new Error('请先填写 MiniMax Base URL。');
  }

  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: createHeaders(normalized),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload,
        `读取模型失败：HTTP ${response.status}`,
      ),
    );
  }

  const models = normalizeModelList(payload);

  if (models.length === 0) {
    throw new Error(
      '当前接口没有返回可识别的语音模型。请确认该 Key 已开通 TTS 能力、Base URL 是否正确，或检查你的兼容服务是否支持 /models。',
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
    text,

    voice_setting: {
      voice_id: config.voiceId.trim(),
      speed: Number(config.speed) || 1,
      vol: Number(config.volume) || 1,
      pitch: Number(config.pitch) || 0,
      emotion: config.emotion || 'neutral',
    },

    audio_setting: {
      format: config.audioFormat || 'mp3',
    },

    stream: false,
  };

  // 自动识别时不发送 language_boost，
  // 避免某些模型不接受 "auto" 枚举值。
  if (config.language && config.language !== 'auto') {
    payload.language_boost = config.language;
  }

  return payload;
};

export const synthesizeMiniMaxSpeech = async ({
  text,
  voiceProfile,
}) => {
  const profile = normalizeVoiceProfile(voiceProfile);
  const config = profile.minimax;
  const baseUrl = getActiveBaseUrl(profile);

  if (!text?.trim()) {
    throw new Error('没有可生成声音的文字。');
  }

  if (!config.apiKey?.trim()) {
    throw new Error('该角色尚未填写 MiniMax API Key。');
  }

  if (!baseUrl) {
    throw new Error('该角色尚未填写 MiniMax Base URL。');
  }

  if (!config.modelId?.trim()) {
    throw new Error('请先读取并选择一个 MiniMax 语音模型。');
  }

  if (!config.voiceId?.trim()) {
    throw new Error('该角色尚未填写已有的 Voice ID。');
  }

  const response = await fetch(`${baseUrl}/t2a_v2`, {
    method: 'POST',
    headers: createHeaders(profile),
    body: JSON.stringify(buildSpeechPayload({
      text: text.trim(),
      profile,
    })),
  });

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

  if (apiErrorCode && apiErrorCode !== 0) {
    throw new Error(
      getErrorMessage(payload, 'MiniMax 语音生成失败。'),
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

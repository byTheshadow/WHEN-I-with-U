import { normalizeVoiceProfile } from './realVoiceDefaults';

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const getApiBaseUrl = (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const { proxyBaseUrl, apiBaseUrl } = normalized.minimax;

  return trimTrailingSlash(proxyBaseUrl?.trim() || apiBaseUrl);
};

const createHeaders = (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const { apiKey, groupId } = normalized.minimax;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`,
  };

  // 依据你提供的 MiniMax / One-API 参考资料。
  if (groupId?.trim()) {
    headers['X-Tenant-Id'] = groupId.trim();
  }

  return headers;
};

const getErrorMessage = (payload, fallback) => (
  payload?.base_resp?.status_msg
  || payload?.base_response?.status_msg
  || payload?.message
  || payload?.error?.message
  || fallback
);

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
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
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
      throw new Error(`音频下载失败：HTTP ${response.status}`);
    }

    return response.blob();
  }

  if (typeof audioValue !== 'string') {
    throw new Error('MiniMax 返回的音频格式暂不受支持。');
  }

  const bytes = isHexAudio(audioValue)
    ? decodeHexToBytes(audioValue)
    : decodeBase64ToBytes(normalizeBase64(audioValue));

  return new Blob([bytes], { type: mimeType });
};

export const fetchMiniMaxModels = async (profile) => {
  const baseUrl = getApiBaseUrl(profile);

  if (!baseUrl) {
    throw new Error('请先填写 MiniMax API 地址。');
  }

  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: createHeaders(profile),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getErrorMessage(
      payload,
      `读取模型失败：HTTP ${response.status}`,
    ));
  }

  const rawModels = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  const models = rawModels
    .map((item) => {
      if (typeof item === 'string') {
        return { id: item, label: item };
      }

      return {
        id: item?.id || item?.model || item?.name,
        label: item?.name || item?.id || item?.model,
      };
    })
    .filter((item) => item.id)
    .filter((item) => /speech|tts|voice|audio/i.test(item.id));

  if (models.length === 0) {
    throw new Error(
      '未从 /models 读取到语音模型。请确认该 API Key 已开通 TTS 模型，或检查代理地址。',
    );
  }

  return models;
};

export const synthesizeMiniMaxSpeech = async ({
  text,
  voiceProfile,
}) => {
  const profile = normalizeVoiceProfile(voiceProfile);
  const config = profile.minimax;
  const baseUrl = getApiBaseUrl(profile);

  if (!config.apiKey?.trim()) {
    throw new Error('该角色尚未填写 MiniMax API Key。');
  }

  if (!config.modelId?.trim()) {
    throw new Error('请先为该角色读取并选择语音模型。');
  }

  if (!config.voiceId?.trim()) {
    throw new Error('该角色尚未填写 Voice ID。');
  }

  const response = await fetch(`${baseUrl}/t2a_v2`, {
    method: 'POST',
    headers: createHeaders(profile),
    body: JSON.stringify({
      model: config.modelId,
      text,

      // 此结构需与 MiniMax T2A API 一致。
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
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getErrorMessage(
      payload,
      `MiniMax 语音生成失败：HTTP ${response.status}`,
    ));
  }

  const apiErrorCode = (
    payload?.base_resp?.status_code
    ?? payload?.base_response?.status_code
  );

  if (apiErrorCode && apiErrorCode !== 0) {
    throw new Error(getErrorMessage(payload, 'MiniMax 语音生成失败。'));
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

  const audioBlob = await audioValueToBlob(audioValue, mimeType);

  return {
    audioBlob,
    mimeType: audioBlob.type || mimeType,
    provider: 'minimax',
    modelId: config.modelId,
    voiceId: config.voiceId,
  };
};

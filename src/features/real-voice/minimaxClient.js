import { normalizeVoiceProfile } from './realVoiceDefaults';

const MINIMAX_TTS_MODELS = {
  china: [
    {
      id: 'speech-2.8-hd',
      label: 'Speech 2.8 HD',
      description: '高保真语音合成',
    },
  ],

  global: [
    {
      id: 'speech-2.8-hd',
      label: 'Speech 2.8 HD',
      description: '高保真语音合成',
    },
  ],

  custom: [
    {
      id: 'speech-2.8-hd',
      label: 'Speech 2.8 HD',
      description: '默认推荐模型',
    },
  ],
};

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
  const { apiKey } = normalized.minimax;

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`,
  };
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
    '浏览器无法直接连接 MiniMax：该接口没有向当前网站开放跨域请求。请在该角色的声音设置中填写兼容 MiniMax 的代理地址后重试。',
  )
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
        `MiniMax 音频文件下载失败：HTTP ${response.status}`,
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

/**
 * MiniMax 官方 TTS 文档没有确认 /models 是公开可调用的模型枚举接口。
 * 因此不请求 /models，而是依据本地维护的、可控的模型目录生成下拉。
 *
 * 后续官方明确提供模型列表接口后，只需要替换本函数。
 */
export const fetchMiniMaxModels = async (profile) => {
  const normalized = normalizeVoiceProfile(profile);
  const region = normalized.minimax.region || 'custom';

  return (
    MINIMAX_TTS_MODELS[region]
    || MINIMAX_TTS_MODELS.custom
  );
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

  /**
   * 官方文档中的 language_boost 使用语言名称形式，
   * 例如 Chinese、English、Japanese。
   * 自动模式则完全不传此字段。
   */
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
    throw new Error('请先选择一个 MiniMax 语音模型。');
  }

  if (!config.voiceId?.trim()) {
    throw new Error('该角色尚未填写已有的 Voice ID。');
  }

  let response;

  try {
    response = await fetch(`${baseUrl}/t2a_v2`, {
      method: 'POST',
      headers: createHeaders(profile),
      body: JSON.stringify(buildSpeechPayload({
        text,
        profile,
      })),
    });
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

  /**
   * MiniMax 非流式 T2A 通常会在 data.audio 返回编码后的音频。
   * 同时兼容 URL 形式和部分兼容服务的字段名。
   */
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

import { normalizeVoiceProfile } from './realVoiceDefaults';

const DEFAULT_TTS_PATH = '/v1/t2a_v2';

/**
 * MiniMax 官方「接口概览」确认的语音模型目录。
 *
 * 不使用 /anthropic/v1/models：
 * 该接口的返回内容主要是文本语言模型，
 * 例如 MiniMax-M3、MiniMax-M2.7，不是 TTS 专属模型列表。
 */
const MINIMAX_TTS_MODEL_CATALOG = [
  {
    id: 'speech-2.8-hd',
    label: 'Speech 2.8 HD',
    description: '最新 HD 模型，情绪渲染融合语气词，自然度优先。',
  },
  {
    id: 'speech-2.8-turbo',
    label: 'Speech 2.8 Turbo',
    description: '最新 Turbo 模型，生成更快，兼顾自然表现。',
  },
  {
    id: 'speech-2.6-hd',
    label: 'Speech 2.6 HD',
    description: '强调韵律与音质表现。',
  },
  {
    id: 'speech-2.6-turbo',
    label: 'Speech 2.6 Turbo',
    description: '低延迟语音合成，响应更敏捷。',
  },
  {
    id: 'speech-02-hd',
    label: 'Speech 02 HD',
    description: '复刻相似度、稳定性与音质表现突出。',
  },
  {
    id: 'speech-02-turbo',
    label: 'Speech 02 Turbo',
    description: '稳定性良好，并增强小语种能力。',
  },
];

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

  return (normalized.minimax.apiKey || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
};

const createTtsHeaders = (profile) => {
  const apiKey = getApiKey(profile);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
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
    return { rawText: text };
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
    '浏览器无法直接连接 MiniMax。请确认已填写可用的语音转接地址，并检查该 Worker 是否允许当前网站访问。',
  )
);

const validateProfileForRequest = (voiceProfile) => {
  const profile = normalizeVoiceProfile(voiceProfile);
  const config = profile.minimax;

  if (!config.apiKey?.trim()) {
    throw new Error('请先填写 MiniMax API Key。');
  }

  if (!getActiveBaseUrl(profile)) {
    throw new Error('请先填写 MiniMax Base URL 或可选代理地址。');
  }

  return profile;
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
 * 模型目录来自官方 TTS 文档，不进行网络请求。
 * 保留 async 是为了不改变 VoiceProfilePanel 既有调用方式。
 */
export const fetchMiniMaxModels = async () => (
  MINIMAX_TTS_MODEL_CATALOG
);

/**
 * 依据 MiniMax 同步语音合成 HTTP 文档构建请求体。
 */
const buildSpeechPayload = ({
  text,
  profile,
  voiceIntent,
}) => {
  const config = profile.minimax;

  const speed = Number(voiceIntent?.speed);
  const pitch = Number(voiceIntent?.pitch);

  const payload = {
    model: config.modelId.trim(),
    text: text.trim(),
    stream: false,

    voice_setting: {
      voice_id: config.voiceId.trim(),

      // 自动语音使用主 AI 已校验的参数；
      // 试听没有 voiceIntent，继续使用角色档案参数。
      speed: Number.isFinite(speed)
        ? speed
        : Number(config.speed) || 1,

      // 音量始终由角色设置控制，不交给文字 AI 任意改变。
      vol: Number(config.volume) || 1,

      pitch: Number.isFinite(pitch)
        ? pitch
        : Number(config.pitch) || 0,

      emotion: voiceIntent?.emotion
        || config.emotion
        || 'calm',
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
  voiceIntent,
}) => {

  const profile = validateProfileForRequest(voiceProfile);
  const config = profile.minimax;
  const baseUrl = getActiveBaseUrl(profile);

  if (!text?.trim()) {
    throw new Error('没有可生成声音的文字。');
  }

  if (!config.modelId?.trim()) {
    throw new Error('请先选择一个语音模型。');
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
        headers: createTtsHeaders(profile),
        body: JSON.stringify(
        buildSpeechPayload({
  text,
  profile,
  voiceIntent,
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

  /**
   * 兼容 MiniMax 非流式 data.audio，
   * 以及部分兼容服务返回的 audio_url。
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
  emotion: voiceIntent?.emotion || config.emotion || 'calm',
  speed: voiceIntent?.speed ?? Number(config.speed) || 1,
  pitch: voiceIntent?.pitch ?? Number(config.pitch) || 0,
};

};


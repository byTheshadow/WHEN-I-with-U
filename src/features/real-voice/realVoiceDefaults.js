export const REAL_VOICE_MARKER = '[[REAL_VOICE]]';

export const createDefaultVoiceProfile = () => ({
  enabled: false,

  // 开启后，AI 可自行决定某段回复是否应额外留下真实语音。
  aiMaySendVoice: true,

  // 首版不默认每句话都生成，避免消耗额度与拖慢回复。
  autoPlay: false,

  provider: 'minimax',

  minimax: {
    apiKey: '',
    groupId: '',

    // MiniMax API Base URL。
    apiBaseUrl: 'https://api.minimaxi.com/v1',

    // 可选。留空时直接请求 MiniMax。
    // 如发生 CORS，再填写与 MiniMax /v1 路径兼容的代理基础地址。
    proxyBaseUrl: '',

    // 由“读取模型”按钮从 /models 获取，用户不需要手填。
    modelId: '',

    // 用户已经在 MiniMax 获得并有权使用的 Voice ID。
    voiceId: '',

    speed: 1,
    volume: 1,
    pitch: 0,

    // 按 MiniMax 实际支持情况可继续扩展。
    emotion: 'neutral',
    audioFormat: 'mp3',
  },
});

export const normalizeVoiceProfile = (profile) => {
  const defaults = createDefaultVoiceProfile();

  return {
    ...defaults,
    ...(profile || {}),
    minimax: {
      ...defaults.minimax,
      ...(profile?.minimax || {}),
    },
  };
};

export const hasUsableMiniMaxVoiceProfile = (profile) => {
  const normalized = normalizeVoiceProfile(profile);

  return Boolean(
    normalized.enabled
      && normalized.provider === 'minimax'
      && normalized.minimax.apiKey?.trim()
      && normalized.minimax.voiceId?.trim()
      && normalized.minimax.modelId?.trim()
  );
};

export const REAL_VOICE_MARKER = '[[REAL_VOICE]]';

export const MINIMAX_REGION_PRESETS = {
  china: {
    label: '国内版',
    baseUrl: 'https://api.minimaxi.com/v1',
    requiresGroupId: true,
  },

  global: {
    label: '国际版',
    baseUrl: 'https://api.minimax.io/v1',
    requiresGroupId: false,
  },

  custom: {
    label: '自定义 / 兼容服务',
    baseUrl: '',
    requiresGroupId: false,
  },
};

export const VOICE_LANGUAGE_OPTIONS = [
  {
    value: 'auto',
    label: '自动识别文本语言',
  },
  {
    value: 'Chinese',
    label: '中文',
  },
  {
    value: 'English',
    label: 'English',
  },
  {
    value: 'Japanese',
    label: '日本語',
  },
  {
    value: 'Korean',
    label: '한국어',
  },
  {
    value: 'Spanish',
    label: 'Español',
  },
  {
    value: 'French',
    label: 'Français',
  },
  {
    value: 'German',
    label: 'Deutsch',
  },
  {
    value: 'Portuguese',
    label: 'Português',
  },
  {
    value: 'Russian',
    label: 'Русский',
  },
  {
    value: 'Italian',
    label: 'Italiano',
  },
];

export const createDefaultVoiceProfile = () => ({
  enabled: false,

  // 角色是否允许使用真实声音。
  aiMaySendVoice: true,

  // 首版保留，不自动播放，避免在用户未操作时突然出声。
  autoPlay: false,

  provider: 'minimax',
    voiceExpression: {
    // off | guided | intimate | reserved | custom
    mode: 'guided',

    // custom 模式下的角色专属声音表达规则。
    customInstruction: '',

    // 当前版本固定一轮最多一条。
    maxVoiceNotesPerReply: 1,
  },


  // 控制文字 AI 在什么情况下额外留下声音。
  voiceExpression: {
    // off | guided | intimate | reserved | custom
    mode: 'guided',

    // 仅改变角色何时及怎样留声，不能覆盖系统限制。
    customInstruction: '',

    // 第一版固定为 1；代码层同样保留硬限制。
    maxVoiceNotesPerReply: 1,
  },

  minimax: {
    // china | global | custom
    region: 'global',

    // 用户可随时直接编辑，不强制使用预设。
    baseUrl: MINIMAX_REGION_PRESETS.global.baseUrl,

    // 为空时直接请求 baseUrl；发生 CORS 或使用 One-API 时再填。
    proxyBaseUrl: '',

    apiKey: '',
    groupId: '',

    // 使用本地维护的 MiniMax TTS 模型目录后选择。
    modelId: '',

    // 用户已有、已授权的克隆 Voice ID。
    voiceId: '',

    // auto 时不发送 language_boost。
    language: 'auto',

    speed: 1,
    volume: 1,
    pitch: 0,
    emotion: 'calm',


    // mp3 | wav
    audioFormat: 'mp3',
  },
});

export const normalizeVoiceProfile = (profile) => {
  const defaults = createDefaultVoiceProfile();

  return {
    ...defaults,
    ...(profile || {}),
    voiceExpression: {
      ...defaults.voiceExpression,
      ...(profile?.voiceExpression || {}),

      // 当前版本固定：每轮回复最多一段真实声音。
      maxVoiceNotesPerReply: 1,
    },
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
      && normalized.minimax.baseUrl?.trim()
      && normalized.minimax.modelId?.trim()
      && normalized.minimax.voiceId?.trim(),
  );
};

export const getMiniMaxRegionPreset = (region) => (
  MINIMAX_REGION_PRESETS[region]
  || MINIMAX_REGION_PRESETS.custom
);

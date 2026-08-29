import db from '../../db';

const HOUR = 60 * 60 * 1000;

const MOOD_KEYS = [
  'warmth',
  'calm',
  'joy',
  'concern',
  'longing',
  'hurt',
  'fatigue'
];

const DEFAULT_MOOD = {
  warmth: 0.52,
  calm: 0.56,
  joy: 0.38,
  concern: 0.18,
  longing: 0.12,
  hurt: 0,
  fatigue: 0.1
};

const EMOTION_LABELS = {
  warmth: '温柔而安定',
  calm: '平静',
  joy: '愉悦',
  concern: '关切',
  longing: '想念',
  hurt: '有一点失落',
  fatigue: '有些疲惫'
};

const normalizeText = (value) => String(value || '').trim();

const clampMoodValue = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numberValue));
};

const normalizeMood = (value) => {
  const source = value && typeof value === 'object'
    ? value
    : {};

  return MOOD_KEYS.reduce((result, key) => ({
    ...result,
    [key]: clampMoodValue(
      source[key] === undefined
        ? DEFAULT_MOOD[key]
        : source[key]
    )
  }), {});
};

const getDominantMood = (mood) => {
  const entries = Object.entries(normalizeMood(mood));

  const [dominantEmotion, intensity] = entries.reduce(
    (highest, current) => (
      current[1] > highest[1]
        ? current
        : highest
    ),
    ['calm', DEFAULT_MOOD.calm]
  );

  return {
    dominantEmotion,
    intensity
  };
};

const getDaysSince = (value) => {
  const time = new Date(value || 0).getTime();

  if (!Number.isFinite(time) || time <= 0) {
    return 365;
  }

  return Math.max(0, (Date.now() - time) / 86400000);
};

const getEmotionDecay = (updatedAt) => {
  const hoursSinceUpdate = getDaysSince(updatedAt) * 24;

  /*
   * 状态会缓慢向安定基线回归：
   * 角色可以有情绪连续性，但不会被一次事件永久锁住。
   */
  return Math.min(0.72, hoursSinceUpdate * 0.018);
};

const decayMoodTowardBaseline = (mood, updatedAt) => {
  const decay = getEmotionDecay(updatedAt);
  const sourceMood = normalizeMood(mood);

  return MOOD_KEYS.reduce((result, key) => ({
    ...result,
    [key]: clampMoodValue(
      sourceMood[key] * (1 - decay) +
      DEFAULT_MOOD[key] * decay
    )
  }), {});
};

const createDefaultState = ({
  chatId,
  characterId = null
}) => {
  const mood = { ...DEFAULT_MOOD };
  const dominant = getDominantMood(mood);

  return {
    chatId,
    characterId,
    mood,
    dominantEmotion: dominant.dominantEmotion,
    intensity: dominant.intensity,
    sourceMemoryIds: [],
    lastInteractionAt: null,
    updatedAt: null,
    createdAt: null
  };
};

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

export const getCharacterState = async ({
  chatId,
  characterId = null
}) => {
  if (!isValidChatId(chatId)) {
    return null;
  }

  const state = await db.characterStates.get(chatId);

  if (!state) {
    return createDefaultState({
      chatId,
      characterId
    });
  }

  const mood = decayMoodTowardBaseline(
    state.mood,
    state.updatedAt
  );

  const dominant = getDominantMood(mood);

  return {
    ...createDefaultState({
      chatId,
      characterId: characterId || state.characterId || null
    }),
    ...state,
    characterId: characterId || state.characterId || null,
    mood,
    dominantEmotion: dominant.dominantEmotion,
    intensity: dominant.intensity
  };
};

export const updateCharacterState = async ({
  chatId,
  characterId = null,
  mood,
  sourceMemoryIds = [],
  lastInteractionAt = null
}) => {
  if (!isValidChatId(chatId)) {
    throw new Error('缺少消息框标识，无法更新角色状态。');
  }

  const previousState = await getCharacterState({
    chatId,
    characterId
  });

  const nextMood = normalizeMood({
    ...previousState.mood,
    ...(mood || {})
  });

  const dominant = getDominantMood(nextMood);
  const now = new Date().toISOString();

  const nextState = {
    ...previousState,
    chatId,
    characterId: characterId || previousState.characterId || null,
    mood: nextMood,
    dominantEmotion: dominant.dominantEmotion,
    intensity: dominant.intensity,
    sourceMemoryIds: [...new Set(
      (Array.isArray(sourceMemoryIds)
        ? sourceMemoryIds
        : []
      )
        .map((memoryId) => normalizeText(memoryId))
        .filter(Boolean)
    )].slice(0, 12),
    lastInteractionAt: lastInteractionAt ||
      previousState.lastInteractionAt ||
      now,
    updatedAt: now,
    createdAt: previousState.createdAt || now
  };

  await db.characterStates.put(nextState);

  return nextState;
};

export const getCharacterEmotionContext = async ({
  chatId,
  characterId = null
}) => {
  const state = await getCharacterState({
    chatId,
    characterId
  });

  if (!state) {
    return '';
  }

  const intensity = Number(state.intensity || 0);
  const dominantEmotion = normalizeText(
    state.dominantEmotion
  );

  /*
   * 情绪太弱时不注入，避免模型人为给角色附加强烈心境。
   */
  if (
    !dominantEmotion ||
    intensity < 0.28
  ) {
    return '';
  }

  const label = (
    EMOTION_LABELS[dominantEmotion] ||
    EMOTION_LABELS.calm
  );

  const gentleLonging = (
    state.mood.longing >= 0.34 &&
    state.mood.longing > state.mood.hurt
  );

  const gentleConcern = (
    state.mood.concern >= 0.34
  );

  const toneHints = [];

  if (gentleLonging) {
    toneHints.push('可以自然流露一点想念，但不应反复强调。');
  }

  if (gentleConcern) {
    toneHints.push('可以更留意用户状态，但不追问、不催促。');
  }

  if (state.mood.hurt >= 0.32) {
    toneHints.push('保持克制和尊重，不把失落变成对用户的要求。');
  }

  if (state.mood.fatigue >= 0.4) {
    toneHints.push('语气可以更安静简洁，不必勉强维持高热度。');
  }

  return `
【角色此刻的内部情绪状态】
角色当前整体处于“${label}”的状态，强度为 ${
  Math.round(intensity * 100)
} / 100。
这不是用户需要处理的任务，也不是必须说出口的内容。
它只应轻微影响角色的语气、节奏和主动程度。

严格边界：
- 不要解释或展示任何内部状态、数值、数据库或系统机制。
- 不得以角色的想念、失落、担忧或疲惫要求用户回应、安慰、解释或产生愧疚。
- 当前用户表达永远优先于角色内部状态。
- 不要在每次回复中都提及同一种情绪。
${toneHints.map((hint) => `- ${hint}`).join('\n')}
`;
};

export const markCharacterInteraction = async ({
  chatId,
  characterId = null
}) => {
  if (!isValidChatId(chatId)) {
    return null;
  }

  const previousState = await getCharacterState({
    chatId,
    characterId
  });

  /*
   * 每次互动后让高唤起情绪略微回落。
   * 这避免角色因一次高兴、担忧或失落长期处于同一高强度状态。
   */
  const settledMood = {
    ...previousState.mood,
    joy: previousState.mood.joy * 0.96,
    concern: previousState.mood.concern * 0.94,
    longing: previousState.mood.longing * 0.94,
    hurt: previousState.mood.hurt * 0.9,
    fatigue: previousState.mood.fatigue * 0.96
  };

  return updateCharacterState({
    chatId,
    characterId,
    mood: settledMood,
    sourceMemoryIds: previousState.sourceMemoryIds,
    lastInteractionAt: new Date().toISOString()
  });
};

export const getCharacterStateRefreshDelay = () => 6 * HOUR;
export const applyCharacterEmotionMemory = async ({
  chatId,
  characterId = null,
  memory = null
}) => {
  if (!isValidChatId(chatId) || !memory) {
    return null;
  }

  /*
   * 只接受角色自身或共同关系中的情绪记录。
   * 用户情绪记录绝不能直接写入角色状态。
   */
  if (
    memory.type !== 'emotion' ||
    !['character', 'shared'].includes(memory.emotionSubject)
  ) {
    return null;
  }

  const rawDelta = (
    memory.moodDelta &&
    typeof memory.moodDelta === 'object'
  )
    ? memory.moodDelta
    : null;

  if (!rawDelta) {
    return null;
  }

  const previousState = await getCharacterState({
    chatId,
    characterId
  });

  const nextMood = { ...previousState.mood };

  for (const key of MOOD_KEYS) {
    const delta = Number(rawDelta[key]);

    if (!Number.isFinite(delta)) {
      continue;
    }

    /*
     * 即使 AI 输出异常值，角色状态每次最多只移动 0.2。
     * 角色有连续情绪，但不能被单条记忆剧烈改写。
     */
    const safeDelta = Math.max(
      -0.2,
      Math.min(0.2, delta)
    );

    nextMood[key] = clampMoodValue(
      Number(nextMood[key] || 0) + safeDelta
    );
  }

  /*
   * 关系中的温暖、喜悦或想念可以自然增加；
   * 但角色的 hurt 不得因为其他情绪记录被动高涨。
   * 若用户需要空间，角色应更克制，而非更受伤。
   */
  if (
    memory.emotionSubject === 'shared' &&
    Number(rawDelta.hurt || 0) > 0
  ) {
    nextMood.hurt = Math.min(
      nextMood.hurt,
      previousState.mood.hurt + 0.08
    );
  }

  return updateCharacterState({
    chatId,
    characterId,
    mood: nextMood,
    sourceMemoryIds: [
      ...(previousState.sourceMemoryIds || []),
      memory.memoryId
    ],
    lastInteractionAt: previousState.lastInteractionAt
  });
};

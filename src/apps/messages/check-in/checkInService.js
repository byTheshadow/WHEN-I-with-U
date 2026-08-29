import db from '../../../db';
import { generateCheckInMessage } from './checkInAiService';

export const CHECK_IN_CONFIG_KEY = 'crossChatCheckInConfig';

const DEFAULT_CONFIG = {
  enabled: false,
  awarenessLevel: 'subtle',
  frequency: 'low',
  enabledCharacterIds: [],
  lastDeliveredAt: null,
  lastDeliveredByCharacter: {},
  dailyDate: '',
  dailyCount: 0,
};

const CHECK_IN_LIMITS = {
  low: {
    globalCooldownMs: 8 * 60 * 60 * 1000,
    characterCooldownMs: 18 * 60 * 60 * 1000,
    dailyLimit: 1,
    probability: 0.16,
  },
  medium: {
    globalCooldownMs: 4 * 60 * 60 * 1000,
    characterCooldownMs: 10 * 60 * 60 * 1000,
    dailyLimit: 2,
    probability: 0.24,
  },
  high: {
    globalCooldownMs: 2 * 60 * 60 * 1000,
    characterCooldownMs: 6 * 60 * 60 * 1000,
    dailyLimit: 3,
    probability: 0.34,
  },
};

let isChecking = false;

const getLocalDateKey = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const toTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeConfig = (value = {}) => {
  const merged = {
    ...DEFAULT_CONFIG,
    ...(value || {}),
  };

  return {
    ...merged,
    enabled: merged.enabled === true,
    awarenessLevel: [
      'subtle',
      'busy_elsewhere',
      'named_character',
    ].includes(merged.awarenessLevel)
      ? merged.awarenessLevel
      : 'subtle',
    frequency: ['low', 'medium', 'high'].includes(merged.frequency)
      ? merged.frequency
      : 'low',
    enabledCharacterIds: Array.isArray(merged.enabledCharacterIds)
      ? merged.enabledCharacterIds
      : [],
    lastDeliveredByCharacter:
      merged.lastDeliveredByCharacter &&
      typeof merged.lastDeliveredByCharacter === 'object'
        ? merged.lastDeliveredByCharacter
        : {},
    dailyCount: Number(merged.dailyCount || 0),
    dailyDate: String(merged.dailyDate || ''),
  };
};

const isInQuietHours = (quietConfig) => {
  if (!quietConfig || quietConfig.enabled !== true) {
    return false;
  }

  const parseTime = (value, fallback) => {
    const [hours, minutes] = String(value || fallback)
      .split(':')
      .map(Number);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      const [fallbackHours, fallbackMinutes] = fallback
        .split(':')
        .map(Number);

      return fallbackHours * 60 + fallbackMinutes;
    }

    return hours * 60 + minutes;
  };

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTime(quietConfig.start, '23:00');
  const endMinutes = parseTime(quietConfig.end, '08:00');

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

export const getCheckInConfig = async () => {
  const setting = await db.settings.get(CHECK_IN_CONFIG_KEY);
  return normalizeConfig(setting?.value);
};

export const saveCheckInConfig = async (nextConfig) => {
  const normalizedConfig = normalizeConfig(nextConfig);

  await db.settings.put({
    key: CHECK_IN_CONFIG_KEY,
    value: normalizedConfig,
  });

  return normalizedConfig;
};

const getEligibleCheckInChats = async ({
  activeChat,
  config,
}) => {
  const allChats = await db.chats.toArray();

  const enabledCharacterIdSet = new Set(
    config.enabledCharacterIds.map((id) => String(id))
  );

  const eligibleChats = allChats
    .filter((candidateChat) => {
      if (!candidateChat?.id || !candidateChat.characterId) {
        return false;
      }

      if (candidateChat.id === activeChat.id) {
        return false;
      }

      if (candidateChat.characterId === activeChat.characterId) {
        return false;
      }

      return enabledCharacterIdSet.has(
        String(candidateChat.characterId)
      );
    })
    .sort((left, right) => {
      return (
        toTimestamp(right.updatedAt) -
        toTimestamp(left.updatedAt)
      );
    });

  const latestChatByCharacter = new Map();

  eligibleChats.forEach((candidateChat) => {
    if (!latestChatByCharacter.has(candidateChat.characterId)) {
      latestChatByCharacter.set(
        candidateChat.characterId,
        candidateChat
      );
    }
  });

  return [...latestChatByCharacter.values()];
};

const selectEligibleChat = ({
  candidateChats,
  config,
  limits,
  now,
}) => {
  const availableChats = candidateChats.filter((candidateChat) => {
    const lastDeliveredAt =
      config.lastDeliveredByCharacter?.[candidateChat.characterId];

    const elapsedMs = now - toTimestamp(lastDeliveredAt);

    return (
      !lastDeliveredAt ||
      elapsedMs >= limits.characterCooldownMs
    );
  });

  if (availableChats.length === 0) {
    return null;
  }

  return availableChats[
    Math.floor(Math.random() * availableChats.length)
  ];
};

const getResetDailyConfig = (config) => {
  const today = getLocalDateKey();

  if (config.dailyDate === today) {
    return config;
  }

  return {
    ...config,
    dailyDate: today,
    dailyCount: 0,
  };
};

export const checkForCrossChatCheckIn = async ({
  activeChatId,
  onDelivered,
}) => {
  if (!activeChatId || isChecking) {
    return null;
  }

  isChecking = true;

  try {
    const [activeChat, config, quietHoursSetting] = await Promise.all([
      db.chats.get(activeChatId),
      getCheckInConfig(),
      db.settings.get('quietHours'),
    ]);

    if (!activeChat || !config.enabled) {
      return null;
    }

    if (isInQuietHours(quietHoursSetting?.value)) {
      return null;
    }

    const preparedConfig = getResetDailyConfig(config);
    const limits =
      CHECK_IN_LIMITS[preparedConfig.frequency] ||
      CHECK_IN_LIMITS.low;

    if (preparedConfig.dailyCount >= limits.dailyLimit) {
      return null;
    }

    const now = Date.now();
    const globalElapsedMs =
      now - toTimestamp(preparedConfig.lastDeliveredAt);

    if (
      preparedConfig.lastDeliveredAt &&
      globalElapsedMs < limits.globalCooldownMs
    ) {
      return null;
    }

    if (Math.random() > limits.probability) {
      return null;
    }

    const candidateChats = await getEligibleCheckInChats({
      activeChat,
      config: preparedConfig,
    });

    const sourceChat = selectEligibleChat({
      candidateChats,
      config: preparedConfig,
      limits,
      now,
    });

    if (!sourceChat) {
      return null;
    }

    const sourceCharacter = await db.characters.get(
      sourceChat.characterId
    );

    if (!sourceCharacter) {
      return null;
    }

    const result = await generateCheckInMessage({
      sourceChat,
      sourceCharacter,
      activeChat,
      awarenessLevel: preparedConfig.awarenessLevel,
    });

    if (!result?.messageId || !result?.content) {
      return null;
    }

    const deliveredAt = new Date().toISOString();

    const updatedConfig = {
      ...preparedConfig,
      lastDeliveredAt: deliveredAt,
      dailyDate: getLocalDateKey(),
      dailyCount: preparedConfig.dailyCount + 1,
      lastDeliveredByCharacter: {
        ...preparedConfig.lastDeliveredByCharacter,
        [sourceCharacter.id]: deliveredAt,
      },
    };

    await saveCheckInConfig(updatedConfig);

    dispatchLocalMessageEvent(sourceChat.id);

    const delivery = {
      chatId: sourceChat.id,
      characterId: sourceCharacter.id,
      characterName: sourceCharacter.name || sourceChat.title || '某个人',
      characterAvatar: sourceCharacter.avatar || '',
      preview: result.content,
    };

    onDelivered?.(delivery);

    return delivery;
  } catch (error) {
    console.warn(
      '[CheckInService] 跨聊天来讯检查未完成，当前聊天不受影响。',
      error
    );

    return null;
  } finally {
    isChecking = false;
  }
};

import db from '../../../db';
import { isFocusMuted } from '../../focus/focusMuteState';
import {
  getRecentChatMessages,
  buildHistoryContext,
  isInQuietHours,
} from '../../../services/aiService';

// 来讯此前完全不知道自己所在聊天框（sourceChat）自己聊过什么，只靠角色
// 简介硬编一条话，读起来跟这段关系里发生过的事完全脱节。这里取最近的
// 消息作为上下文，让来讯真正接得上 A 消息框自己的对话，而不是凭空写信。
const CHECK_IN_CONTEXT_MESSAGE_LIMIT = 16;

const removeEmoji = (value = '') => {
  return String(value)
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
      ''
    )
    .trim();
};

const getAwarenessGuide = ({
  awarenessLevel,
  activeChat,
}) => {
  if (awarenessLevel === 'named_character') {
    return `你可以知道用户此刻正在与 ${activeChat.title || '另一位角色'} 聊天。只可提及对方的名称，不能假装知道他们聊了什么。`;
  }

  if (awarenessLevel === 'busy_elsewhere') {
    return '你可以知道用户此刻正在别处聊天，但不知道对象是谁，也不知道任何聊天内容。';
  }

  return '你只知道用户已经有一阵子没有回应你；不要声称知道用户在哪里或正在做什么。';
};

export const generateCheckInMessage = async ({
  sourceChat,
  sourceCharacter,
  activeChat,
  awarenessLevel,
}) => {
  if (
    !sourceChat?.id ||
    !sourceCharacter?.id ||
    !activeChat?.id
  ) {
    return null;
  }

  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return null;
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const awarenessGuide = getAwarenessGuide({
    awarenessLevel,
    activeChat,
  });

  // 只取角色「自己这个聊天框」（sourceChat）的最近对话，让来讯的内容
  // 能自然接上你们俩自己聊过的东西；跟用户当前所在的另一个聊天框
  // （activeChat）无关，那边的内容仍然不可知、不可捏造。
  const rawContextMessages = await getRecentChatMessages(
    sourceChat.id,
    CHECK_IN_CONTEXT_MESSAGE_LIMIT
  );

  const historyContext = buildHistoryContext(rawContextMessages);

  const hasOwnHistory = historyContext.length > 0;

  const systemPrompt = `你正在扮演角色：${sourceCharacter.name}。

角色简介：
${sourceCharacter.bio || '无'}

补充设定：
${sourceCharacter.extraNotes || '无'}

你现在准备给用户留下一条来自自己聊天窗口的短消息。它应该像一张从另一扇门后递来的短笺，而不是质问、控制、监视或制造压力。

${
    hasOwnHistory
      ? '下面附上的是你和用户在这个聊天框里最近真实聊过的内容，你可以自然地记得它、并让这条来讯接上其中的话题或情绪；但不要逐字复述这些记录，也不要提及"记录""上下文""历史消息"这类字眼。'
      : '你和用户在这个聊天框里还没有聊过什么，这条来讯可以是一句主动的开场，而不是接续某个具体话题。'
  }

你的知情边界：
${awarenessGuide}

严格要求：
- 以角色第一人称写一条自然短消息；
- 控制在 18 到 68 个汉字之间；
- 不使用 Emoji；
- 不要使用标题、Markdown、方括号、舞台说明或额外前言；
- 不要提及 AI、系统、接口、算法、通知、聊天室或技术实现；
- 不得捏造用户当前所在的另一个聊天框里发生过的具体内容；
- 不得责备用户，不得要求立刻回复，不得使用威胁、占有、羞辱或情绪勒索；
- 保持角色原有的语气与关系感。`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...historyContext,
        ],
        temperature: 0.78,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = removeEmoji(
      data?.choices?.[0]?.message?.content || ''
    );

    if (!content) {
      return null;
    }

    const timestamp = new Date().toISOString();

    const messageId = await db.messages.add({
      chatId: sourceChat.id,
      characterId: sourceCharacter.id,
      sender: 'character',
      type: 'text',
      content,
      metadata: {
        source: 'cross_chat_check_in',
        awarenessLevel,
      },
      versions: [
        {
          type: 'text',
          content,
          metadata: {
            source: 'cross_chat_check_in',
            awarenessLevel,
          },
          timestamp,
        },
      ],
      currentVersionIndex: 0,
      isRead: false,
      timestamp,
    });

    await db.chats.update(sourceChat.id, {
      updatedAt: timestamp,
    });

    return {
      messageId,
      content,
    };
  } catch (error) {
    console.warn(
      '[CheckInAiService] 角色来讯未能生成，未写入空消息。',
      error
    );

    return null;
  }
};

// ==========================================
// 角色来讯：设置的读写
// ==========================================

const CHECK_IN_CONFIG_KEY = 'checkInConfig';

const DEFAULT_CHECK_IN_CONFIG = {
  enabled: false,
  awarenessLevel: 'subtle',
  frequency: 'medium',
  enabledCharacterIds: [],
};

export const getCheckInConfig = async () => {
  const stored = await db.settings.get(CHECK_IN_CONFIG_KEY);

  return {
    ...DEFAULT_CHECK_IN_CONFIG,
    ...(stored?.value || {}),
  };
};

export const saveCheckInConfig = async (config) => {
  const nextConfig = {
    ...DEFAULT_CHECK_IN_CONFIG,
    ...config,
  };

  await db.settings.put({
    key: CHECK_IN_CONFIG_KEY,
    value: nextConfig,
  });

  return nextConfig;
};

// ==========================================
// 角色来讯：跨聊天触发调度
// ==========================================
// 写法照抄 aiService.js 里 checkAndTriggerAutoMessage 的"随机冷却区间"
// 模式（settings 表存 lastTimestamp / cooldownMs / frequencyApplied 三个
// key），但这里的频率档位是 low/medium/high（跟 CheckInSettings.jsx 的
// FREQUENCY_OPTIONS 对应），跟主动消息那边的 low/moderate/high 不是同一套
// 档位命名，所以单独维护一份冷却区间，不能直接复用 aiService 那个函数。

const CHECK_IN_LAST_TIMESTAMP_KEY = 'checkInLastTimestamp';
const CHECK_IN_COOLDOWN_MS_KEY = 'checkInCooldownMs';
const CHECK_IN_FREQUENCY_APPLIED_KEY = 'checkInFrequencyApplied';

const getCheckInCooldownRange = (frequency) => {
  const hour = 60 * 60 * 1000;

  switch (frequency) {
    case 'high':
      return { min: 20 * 60 * 1000, max: 90 * 60 * 1000 };

    case 'low':
      return { min: 6 * hour, max: 18 * hour };

    case 'medium':
    default:
      return { min: 2 * hour, max: 5 * hour };
  }
};

const getRandomCheckInCooldownMs = (frequency) => {
  const { min, max } = getCheckInCooldownRange(frequency);
  return Math.floor(min + Math.random() * (max - min));
};

// 防止同一次调用重叠触发（例如用户连续快速发送几条消息）。
let isCheckInTriggering = false;

/**
 * 在当前聊天（activeChatId）里发送消息之后调用：如果条件满足，从"另一扇门"
 * ——另一个被允许来讯的角色自己的聊天框——悄悄递来一条消息，并通过
 * onDelivered 回调把可以展示在 CheckInNotice 上的信息交回去。
 *
 * 不满足条件（未开启 / 没有可用角色 / 免打扰 / 冷却未到）时什么都不做，
 * 静默返回，不会抛错也不会调用 onDelivered。
 */
export const checkForCrossChatCheckIn = async ({
  activeChatId,
  onDelivered,
}) => {
  if (isCheckInTriggering) {
    return;
  }

  isCheckInTriggering = true;

  try {
    const config = await getCheckInConfig();

    if (!config.enabled) {
      return;
    }

    const enabledCharacterIds = (config.enabledCharacterIds || []).map(String);

    if (enabledCharacterIds.length === 0) {
      return;
    }

    // 全局免打扰时段复用 SettingsPage 里"陪伴频率"的同一个开关，
    // 角色来讯不应该在用户已经设为安静的时段里出现。
    const quietHoursSetting = await db.settings.get('quietHours');

    if (isInQuietHours(quietHoursSetting?.value)) {
      return;
    }

    const now = Date.now();

    const lastTimestampSetting = await db.settings.get(CHECK_IN_LAST_TIMESTAMP_KEY);
    const lastTimestamp = Number(lastTimestampSetting?.value || 0);

    const cooldownMsSetting = await db.settings.get(CHECK_IN_COOLDOWN_MS_KEY);
    let cooldownMs = Number(cooldownMsSetting?.value || 0);

    const frequencyAppliedSetting = await db.settings.get(CHECK_IN_FREQUENCY_APPLIED_KEY);

    // 第一次触发，或者用户在设置里改过频率：重新算一轮随机冷却。
    if (!cooldownMs || cooldownMs < 0 || frequencyAppliedSetting?.value !== config.frequency) {
      cooldownMs = getRandomCheckInCooldownMs(config.frequency);

      await db.settings.put({
        key: CHECK_IN_COOLDOWN_MS_KEY,
        value: cooldownMs,
      });

      await db.settings.put({
        key: CHECK_IN_FREQUENCY_APPLIED_KEY,
        value: config.frequency,
      });
    }

    // 冷却未到，本次不触发。
    if (lastTimestamp > 0 && now - lastTimestamp < cooldownMs) {
      return;
    }

    // 候选：被允许来讯、且不是用户当前正停留的这个聊天框。
    const candidateChats = await db.chats
      .filter((chat) => (
        chat?.id !== activeChatId &&
        enabledCharacterIds.includes(String(chat?.characterId)) &&
        !isFocusMuted(chat)
      ))
      .toArray();

    if (candidateChats.length === 0) {
      return;
    }

    const sourceChat = candidateChats[
      Math.floor(Math.random() * candidateChats.length)
    ];

    const sourceCharacter = await db.characters.get(sourceChat.characterId);

    if (!sourceCharacter) {
      return;
    }

    const activeChat = await db.chats.get(activeChatId);

    if (!activeChat) {
      return;
    }

    const result = await generateCheckInMessage({
      sourceChat,
      sourceCharacter,
      activeChat,
      awarenessLevel: config.awarenessLevel,
    });

    if (!result) {
      return;
    }

    // 无论用户是否点开这条来讯，冷却都从"生成成功"这一刻重新计算，
    // 避免生成失败（例如 API 报错）也白白消耗掉一整轮冷却。
    await db.settings.put({
      key: CHECK_IN_LAST_TIMESTAMP_KEY,
      value: now,
    });

    await db.settings.put({
      key: CHECK_IN_COOLDOWN_MS_KEY,
      value: getRandomCheckInCooldownMs(config.frequency),
    });

    onDelivered?.({
      chatId: sourceChat.id,
      characterAvatar: sourceCharacter.avatar,
      characterName: sourceCharacter.name,
      preview: result.content,
    });
  } catch (error) {
    console.warn(
      '[CheckInService] 跨聊天来讯检查失败：',
      error
    );
  } finally {
    isCheckInTriggering = false;
  }
};
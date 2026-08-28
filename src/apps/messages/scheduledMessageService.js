import db from '../../db';

const SCHEDULE_PATTERN =
  /\s*\[SCHEDULE_MESSAGE:\s*(\d{1,4})\s*(?:\|\s*([^\]]*))?\]\s*/gi;

const MIN_DELAY_MINUTES = 15;
const MAX_DELAY_MINUTES = 24 * 60;
const SCHEDULER_INTERVAL_MS = 60 * 1000;

let schedulerTimer = null;
let isProcessingDueMessages = false;

const getNowIso = () => new Date().toISOString();

const normalizeText = (value) => String(value || '').trim();

const normalizeDelayMinutes = (value) => {
  const minutes = Number.parseInt(value, 10);

  if (!Number.isInteger(minutes)) {
    return null;
  }

  if (
    minutes < MIN_DELAY_MINUTES ||
    minutes > MAX_DELAY_MINUTES
  ) {
    return null;
  }

  return minutes;
};

const getMessageContentForContext = (message) => {
  if (!message) return '';

  if (message.type === 'sticker') {
    return `[发送了表情包：${
      message.metadata?.name || message.content || '表情包'
    }]`;
  }

  if (message.type === 'image') {
    return `[发送了画面：${message.content || ''}]`;
  }

  if (message.type === 'voice') {
    return `[发送了语音：${message.content || ''}]`;
  }

  if (message.type === 'transfer') {
    return `[发送了心意转账：${
      message.metadata?.amount || ''
    }，留言：${message.content || ''}]`;
  }

  if (message.type === 'gift') {
    return `[赠送了礼物：${
      message.metadata?.name || message.content || ''
    }]`;
  }

  if (message.type === 'food') {
    return `[送来了餐食：${
      message.metadata?.item || message.content || ''
    }]`;
  }

  if (message.type === 'kinship') {
    return `[赠送了亲属额度卡：${
      message.metadata?.amount || ''
    }]`;
  }

  return normalizeText(message.content);
};

/**
 * 从 AI 原始回复中分离预约指令。
 *
 * 返回：
 * - content: 可直接展示给用户的正文
 * - schedule: AI 有效预约时的计划数据，否则为 null
 *
 * 一次回复只接受一个预约指令，避免模型重复安排多次触达。
 */
export const extractScheduledMessageDirective = (rawText) => {
  const originalText = String(rawText || '');
  let matchedSchedule = null;

  const content = originalText
    .replace(
      SCHEDULE_PATTERN,
      (fullMatch, delayValue, rawIntent) => {
        if (matchedSchedule) {
          return '';
        }

        const delayMinutes = normalizeDelayMinutes(delayValue);

        if (!delayMinutes) {
          console.warn(
            '[ScheduledMessage] 忽略不在允许范围内的预约时间：',
            delayValue
          );
          return '';
        }

        matchedSchedule = {
          delayMinutes,
          intent: normalizeText(rawIntent).slice(0, 240)
        };

        return '';
      }
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    content,
    schedule: matchedSchedule
  };
};

/**
 * 普通 AI 对话回复成功后调用。
 * 每个 chat 只保留一条 pending 预约；新计划会替代旧计划。
 */
export const createScheduledMessage = async ({
  chatId,
  characterId,
  delayMinutes,
  intent = ''
}) => {
  if (!chatId || !characterId) {
    return null;
  }

  const normalizedDelay = normalizeDelayMinutes(delayMinutes);

  if (!normalizedDelay) {
    return null;
  }

  const nowIso = getNowIso();
  const scheduledFor = new Date(
    Date.now() + normalizedDelay * 60 * 1000
  ).toISOString();

  let scheduleId = null;

  await db.transaction(
    'rw',
    db.scheduledMessages,
    async () => {
      // 不删除历史计划，以便保留原因；仅取消尚未执行的旧计划。
      await db.scheduledMessages
        .where('chatId')
        .equals(chatId)
        .and((item) => item.status === 'pending')
        .modify({
          status: 'cancelled',
          cancelledReason: 'replaced_by_new_schedule',
          updatedAt: nowIso
        });

      scheduleId = await db.scheduledMessages.add({
        chatId,
        characterId,
        intent: normalizeText(intent),
        scheduledFor,
        status: 'pending',
        attemptCount: 0,
        sentMessageId: null,
        cancelledReason: '',
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }
  );

  console.log('[ScheduledMessage] 已创建对话预约：', {
    scheduleId,
    chatId,
    delayMinutes: normalizedDelay,
    scheduledFor
  });

  return scheduleId;
};

/**
 * 用户在同一个聊天窗重新发言，原本“稍后询问”的语境通常已经失效。
 * 所以取消该聊天窗所有待执行预约。
 */
export const cancelPendingScheduledMessagesForChat = async (
  chatId,
  reason = 'user_returned_to_chat'
) => {
  if (!chatId) return 0;

  const nowIso = getNowIso();

  return db.scheduledMessages
    .where('chatId')
    .equals(chatId)
    .and((item) => item.status === 'pending')
    .modify({
      status: 'cancelled',
      cancelledReason: reason,
      updatedAt: nowIso
    });
};

const fetchScheduledMessageCompletion = async ({
  chat,
  character,
  scheduledMessage,
  historyMessages
}) => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return {
      error: true,
      code: 'CONFIG_MISSING'
    };
  }

  const history = historyMessages
    .filter((message) => (
      message &&
      message.type !== 'error' &&
      ['user', 'character'].includes(message.sender)
    ))
    .slice(-12)
    .map((message) => ({
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: getMessageContentForContext(message)
    }))
    .filter((message) => message.content);

  const userName = normalizeText(
    chat.userName || character.userName || '你'
  );

  const now = new Date();
  const nowText = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });

  const systemPrompt = `你正在扮演用户专属的数字伴侣：${character.name}。

【角色设定】
- 角色姓名：${character.name}
- 角色人设：${character.bio || '无'}
- 补充设定：${character.extraNotes || '无'}
- 用户称呼：${userName}

【当前时间】
${nowText}

【稍后联系的原始意图】
${scheduledMessage.intent || '自然地延续之前尚未说完的关心。'}

【任务】
你此前决定在此时主动联系用户。请结合当前时间、角色设定和近期对话，自然写一条短消息。

严格要求：
1. 以角色第一人称表达，不自称 AI。
2. 不提及系统、定时器、预约、指令、API、模型或任何技术实现。
3. 不要说“系统提醒我”“我被安排在这个时间联系你”。
4. 不使用 Emoji，不使用 Markdown，不加标题，不加发件人前缀。
5. 只输出一条完整、自然的中文消息，控制在 100 字以内。
6. 不要输出 [SCHEDULE_MESSAGE] 或任何方括号指令。
7. 不要描述已经发生的现实肢体接触；保持在线上陪伴语境。
8. 若近期对话已经明显不适合原本意图，请自然地表达一句不过度打扰的关心即可。`;

  try {
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...history
        ],
        temperature: 0.8,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      return {
        error: true,
        code: `HTTP_${response.status}`
      };
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = normalizeText(choice?.message?.content);

    if (choice?.finish_reason === 'length') {
      console.warn(
        '[ScheduledMessage] 到期消息因输出长度限制提前结束。',
        { content }
      );
    }

    if (!content) {
      return {
        error: true,
        code: 'EMPTY_RESPONSE'
      };
    }

    return {
      error: false,
      content
    };
  } catch (error) {
    console.error('[ScheduledMessage] 到期消息请求失败：', error);

    return {
      error: true,
      code: 'NETWORK_ERROR'
    };
  }
};

const claimDueScheduledMessage = async (scheduleId) => {
  const nowIso = getNowIso();
  let claimed = false;

  await db.transaction(
    'rw',
    db.scheduledMessages,
    async () => {
      const current = await db.scheduledMessages.get(scheduleId);

      if (!current || current.status !== 'pending') {
        return;
      }

      const dueAt = new Date(current.scheduledFor).getTime();

      if (Number.isNaN(dueAt) || dueAt > Date.now()) {
        return;
      }

      await db.scheduledMessages.update(scheduleId, {
        status: 'processing',
        attemptCount: Number(current.attemptCount || 0) + 1,
        updatedAt: nowIso
      });

      claimed = true;
    }
  );

  return claimed;
};

const markScheduledMessageFailed = async (scheduleId, reason) => {
  await db.scheduledMessages.update(scheduleId, {
    status: 'failed',
    cancelledReason: reason || 'generation_failed',
    updatedAt: getNowIso()
  });
};

const executeScheduledMessage = async (scheduledMessage) => {
  const claimed = await claimDueScheduledMessage(scheduledMessage.id);

  if (!claimed) {
    return;
  }

  try {
    const [chat, character, recentMessages] = await Promise.all([
      db.chats.get(scheduledMessage.chatId),
      db.characters.get(scheduledMessage.characterId),
      db.messages
        .where('chatId')
        .equals(scheduledMessage.chatId)
        .sortBy('timestamp')
    ]);

    if (!chat || !character) {
      await markScheduledMessageFailed(
        scheduledMessage.id,
        'chat_or_character_not_found'
      );
      return;
    }

    // 用户已在计划创建后重新发言，但因某种边界情况没有取消计划时，
    // 到期阶段再做一次保护，避免过时的“稍后问候”仍然发出。
    const createdAtTime = new Date(
      scheduledMessage.createdAt
    ).getTime();

    const userReturnedAfterScheduling = recentMessages.some((message) => (
      message.sender === 'user' &&
      new Date(message.timestamp).getTime() > createdAtTime
    ));

    if (userReturnedAfterScheduling) {
      await db.scheduledMessages.update(scheduledMessage.id, {
        status: 'cancelled',
        cancelledReason: 'user_sent_message_after_schedule',
        updatedAt: getNowIso()
      });
      return;
    }

    const result = await fetchScheduledMessageCompletion({
      chat,
      character,
      scheduledMessage,
      historyMessages: recentMessages
    });

    if (result.error) {
      await markScheduledMessageFailed(
        scheduledMessage.id,
        result.code
      );
      return;
    }

    const content = normalizeText(result.content);

    if (!content) {
      await markScheduledMessageFailed(
        scheduledMessage.id,
        'empty_message_content'
      );
      return;
    }

    const nowIso = getNowIso();

    const metadata = {
      isAutoGenerated: true,
      source: 'scheduled-message',
      scheduledMessageId: scheduledMessage.id
    };

    let messageId = null;

    await db.transaction(
      'rw',
      db.messages,
      db.chats,
      db.scheduledMessages,
      async () => {
        messageId = await db.messages.add({
          chatId: chat.id,
          characterId: character.id,
          sender: 'character',
          type: 'text',
          content,
          metadata,
          versions: [
            {
              type: 'text',
              content,
              metadata,
              timestamp: nowIso
            }
          ],
          currentVersionIndex: 0,
          isRead: false,
          timestamp: nowIso
        });

        await db.chats.update(chat.id, {
          updatedAt: nowIso
        });

        await db.scheduledMessages.update(scheduledMessage.id, {
          status: 'sent',
          sentMessageId: messageId,
          cancelledReason: '',
          updatedAt: nowIso
        });
      }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('new-local-message-inserted', {
          detail: {
            chatId: chat.id,
            messageId
          }
        })
      );
    }

    console.log('[ScheduledMessage] 已发送到期预约消息：', {
      scheduleId: scheduledMessage.id,
      messageId,
      chatId: chat.id
    });
  } catch (error) {
    console.error('[ScheduledMessage] 执行预约消息失败：', error);

    await markScheduledMessageFailed(
      scheduledMessage.id,
      'unexpected_execution_error'
    );
  }
};

export const checkAndSendDueScheduledMessages = async () => {
  if (isProcessingDueMessages) {
    return;
  }

  isProcessingDueMessages = true;

  try {
    const nowIso = getNowIso();

    const dueMessages = await db.scheduledMessages
      .where('status')
      .equals('pending')
      .and((item) => item.scheduledFor <= nowIso)
      .sortBy('scheduledFor');

    // 一次只处理最多两条，避免应用重新打开时出现大量突发消息。
    for (const scheduledMessage of dueMessages.slice(0, 2)) {
      await executeScheduledMessage(scheduledMessage);
    }
  } catch (error) {
    console.error('[ScheduledMessage] 检查到期计划失败：', error);
  } finally {
    isProcessingDueMessages = false;
  }
};

export const startScheduledMessageScheduler = () => {
  if (schedulerTimer) {
    return;
  }

  void checkAndSendDueScheduledMessages();

  schedulerTimer = window.setInterval(() => {
    void checkAndSendDueScheduledMessages();
  }, SCHEDULER_INTERVAL_MS);

  console.log('[ScheduledMessage] 对话预约调度器已启动。');
};

export const stopScheduledMessageScheduler = () => {
  if (!schedulerTimer) {
    return;
  }

  window.clearInterval(schedulerTimer);
  schedulerTimer = null;

  console.log('[ScheduledMessage] 对话预约调度器已停止。');
};

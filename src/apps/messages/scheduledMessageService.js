import db from '../../db';

const SCHEDULE_PATTERN =
  /\s*\[SCHEDULE_MESSAGE:\s*(\d{1,4})(?:\s*\|\s*([^\]]*))?\]\s*/gi;

const SCHEDULE_TYPES = {
  REMINDER: 'reminder',
  FOLLOW_UP: 'follow_up'
};

const CANCEL_POLICIES = {
  KEEP: 'keep',
  CANCEL_IF_USER_REPLIES: 'cancel_if_user_replies'
};

const MIN_DELAY_MINUTES = 10;
const MAX_DELAY_MINUTES = 24 * 60;
const SCHEDULER_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPT_COUNT = 3;
const STALE_PROCESSING_TIMEOUT_MS = 3 * 60 * 1000;

let schedulerTimer = null;
let isProcessingDueMessages = false;

const getNowIso = () => new Date().toISOString();

const normalizeText = (value) => (
  String(value || '').trim()
);

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
  if (!message) {
    return '';
  }

  if (message.type === 'sticker') {
    return `[发送了表情包：${
      message.metadata?.name ||
      message.content ||
      '表情包'
    }]`;
  }

  if (message.type === 'image') {
    return `[发送了画面：${
      message.content || ''
    }]`;
  }

  if (message.type === 'voice') {
    return `[发送了语音：${
      message.content || ''
    }]`;
  }

  if (message.type === 'transfer') {
    return `[发送了心意转账：${
      message.metadata?.amount || ''
    }，留言：${
      message.content || ''
    }]`;
  }

  if (message.type === 'gift') {
    return `[赠送了礼物：${
      message.metadata?.name ||
      message.content ||
      ''
    }]`;
  }

  if (message.type === 'food') {
    return `[送来了餐食：${
      message.metadata?.item ||
      message.content ||
      ''
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
 * - content：可直接展示给用户的正文
 * - schedule：AI 有效预约时的计划数据，否则为 null
 */
export const extractScheduledMessageDirective = (
  rawText
) => {
  const originalText = String(rawText || '');
  let matchedSchedule = null;

  const content = originalText
    .replace(
      SCHEDULE_PATTERN,
      (
        fullMatch,
        delayValue,
        rawPayload = ''
      ) => {
        if (matchedSchedule) {
          return '';
        }

        const delayMinutes =
          normalizeDelayMinutes(delayValue);

        if (!delayMinutes) {
          console.warn(
            '[ScheduledMessage] 忽略不在允许范围内的预约时间：',
            delayValue
          );

          return '';
        }

        const parts = String(rawPayload)
          .split('|')
          .map((part) => part.trim());

        const declaredType = parts[0];

        const scheduleType = (
          declaredType === SCHEDULE_TYPES.REMINDER ||
          declaredType === SCHEDULE_TYPES.FOLLOW_UP
        )
          ? declaredType
          : SCHEDULE_TYPES.FOLLOW_UP;

        const intent = (
          scheduleType === declaredType
            ? parts.slice(1).join(' | ')
            : parts.join(' | ')
        ).trim();

        matchedSchedule = {
          delayMinutes,
          scheduleType,
          cancelPolicy:
            scheduleType === SCHEDULE_TYPES.REMINDER
              ? CANCEL_POLICIES.KEEP
              : CANCEL_POLICIES.CANCEL_IF_USER_REPLIES,
          intent: intent.slice(0, 240)
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
 * 创建预约消息。
 */
export const createScheduledMessage = async ({
  chatId,
  characterId,
  delayMinutes,
  intent = '',
  scheduleType = SCHEDULE_TYPES.FOLLOW_UP,
  cancelPolicy = null
}) => {
  if (!chatId || !characterId) {
    return null;
  }

  const normalizedDelay =
    normalizeDelayMinutes(delayMinutes);

  if (!normalizedDelay) {
    return null;
  }

  const normalizedScheduleType = (
    scheduleType === SCHEDULE_TYPES.REMINDER ||
    scheduleType === SCHEDULE_TYPES.FOLLOW_UP
  )
    ? scheduleType
    : SCHEDULE_TYPES.FOLLOW_UP;

  const normalizedCancelPolicy =
    normalizedScheduleType === SCHEDULE_TYPES.REMINDER
      ? CANCEL_POLICIES.KEEP
      : (
          cancelPolicy ||
          CANCEL_POLICIES.CANCEL_IF_USER_REPLIES
        );

  const nowIso = getNowIso();

  const scheduledFor = new Date(
    Date.now() +
    normalizedDelay * 60 * 1000
  ).toISOString();

  let scheduleId = null;

  await db.transaction(
    'rw',
    db.scheduledMessages,
    async () => {
      /*
       * 新建 follow_up 时，只取消同一聊天中尚未执行的旧 follow_up。
       * 历史记录仍然保留在归档中。
       */
      if (
        normalizedScheduleType ===
        SCHEDULE_TYPES.FOLLOW_UP
      ) {
        await db.scheduledMessages
          .where('chatId')
          .equals(chatId)
          .and((item) => (
            item.status === 'pending' &&
            (
              item.scheduleType ||
              SCHEDULE_TYPES.FOLLOW_UP
            ) === SCHEDULE_TYPES.FOLLOW_UP
          ))
          .modify({
            status: 'cancelled',
            cancelledReason:
              'replaced_by_new_follow_up',
            updatedAt: nowIso
          });
      }

      /*
       * 必须接住 add() 返回的主键。
       */
      scheduleId = await db.scheduledMessages.add({
        chatId,
        characterId,
        scheduleType: normalizedScheduleType,
        cancelPolicy: normalizedCancelPolicy,
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

  console.log(
    '[ScheduledMessage] 已创建对话预约：',
    {
      scheduleId,
      chatId,
      delayMinutes: normalizedDelay,
      scheduledFor
    }
  );

  return scheduleId;
};

/**
 * 用户重新发言后，取消该聊天中需要因用户回复而收回的预约。
 */
export const cancelPendingScheduledMessagesForChat = async (
  chatId,
  reason = 'user_returned_to_chat'
) => {
  if (!chatId) {
    return 0;
  }

  const nowIso = getNowIso();

  return db.scheduledMessages
    .where('chatId')
    .equals(chatId)
    .and((item) => {
      const cancelPolicy =
        item.cancelPolicy ||
        (
          item.scheduleType ===
          SCHEDULE_TYPES.REMINDER
            ? CANCEL_POLICIES.KEEP
            : CANCEL_POLICIES.CANCEL_IF_USER_REPLIES
        );

      return (
        item.status === 'pending' &&
        cancelPolicy ===
          CANCEL_POLICIES.CANCEL_IF_USER_REPLIES
      );
    })
    .modify({
      status: 'cancelled',
      cancelledReason: reason,
      updatedAt: nowIso
    });
};

/**
 * 从不同兼容 API 的响应结构中提取文本。
 *
 * 主要兼容：
 * 1. choices[0].message.content 为字符串
 * 2. choices[0].message.content 为数组
 * 3. choices[0].message.content 为对象
 * 4. choices[0].text
 * 5. output_text
 */
const extractTextFromApiResponse = (data) => {
  const choice = data?.choices?.[0];
  const message = choice?.message;

  const rawContent =
    message?.content ??
    choice?.text ??
    data?.output_text ??
    data?.output?.[0]?.content?.[0]?.text ??
    '';

  if (typeof rawContent === 'string') {
    return normalizeText(rawContent);
  }

  if (Array.isArray(rawContent)) {
    return normalizeText(
      rawContent
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (!part || typeof part !== 'object') {
            return '';
          }

          return (
            part.text ||
            part.content ||
            ''
          );
        })
        .join('')
    );
  }

  if (
    rawContent &&
    typeof rawContent === 'object'
  ) {
    return normalizeText(
      rawContent.text ||
      rawContent.content ||
      ''
    );
  }

  return '';
};

/**
 * 请求预约消息正文。
 *
 * 请求格式与 aiService.js 中的普通 Chat Completions
 * 请求保持一致。
 */
const fetchScheduledMessageCompletion = async ({
  chat,
  character,
  scheduledMessage,
  historyMessages
}) => {
  const apiSettings = await db.settings.get(
    'apiConfig'
  );

  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return {
      error: true,
      code: 'CONFIG_MISSING',
      message:
        '请先配置有效的 API Base URL 与 API Key。'
    };
  }

  const history = historyMessages
    .filter((message) => (
      message &&
      message.type !== 'error' &&
      ['user', 'character'].includes(
        message.sender
      )
    ))
    .slice(-15)
    .map((message) => ({
      role: message.sender === 'user'
        ? 'user'
        : 'assistant',
      content: getMessageContentForContext(message)
    }))
    .filter((message) => message.content);

  const userName = normalizeText(
    chat.userName ||
    character.userName ||
    '你'
  );

  const now = new Date();

  const nowText = now.toLocaleString(
    'zh-CN',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }
  );

  const systemPrompt = `你正在扮演用户专属的数字伴侣：${character.name}。

【角色设定】
- 角色姓名：${character.name}
- 角色人设：${character.bio || '无'}
- 补充设定：${character.extraNotes || '无'}
- 用户称呼：${userName}

【当前时间】
${nowText}

【稍后联系的原始意图】
${
  scheduledMessage.intent ||
  '自然地延续之前尚未说完的关心。'
}

【任务】
你此前决定在此时主动联系用户。请结合当前时间、角色设定和近期对话，自然写一条短消息。

严格要求：
1. 以角色第一人称表达，不自称 AI。
2. 不提及系统、定时器、预约、指令、API、模型或技术实现。
3. 不要说“系统提醒我”或“我被安排在这个时间联系你”。
4. 不使用 Emoji，不使用 Markdown，不加标题，不加发件人前缀。
5. 只输出一条完整、自然的中文消息，控制在 100 字以内。
6. 不要输出 [SCHEDULE_MESSAGE] 或其他方括号指令。
7. 不要描述已经发生的现实肢体接触，保持在线上陪伴语境。
8. 若近期对话已经明显不适合原本意图，请自然表达一句不过度打扰的关心即可。`;

  try {
    const baseUrl = String(
      apiConfig.baseUrl
    ).replace(/\/$/, '');

    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model:
            apiConfig.model || 'gpt-3.5-turbo',
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
      }
    );

    if (!response.ok) {
      let errorDetail =
        response.statusText ||
        '请求未成功';

      try {
        const errorData =
          await response.json();

        errorDetail =
          errorData?.error?.message ||
          errorData?.message ||
          errorDetail;
      } catch {
        // 某些服务会返回 HTML 或纯文本错误页。
      }

      return {
        error: true,
        code: `HTTP_${response.status}`,
        message: errorDetail
      };
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const content =
      extractTextFromApiResponse(data);

    if (choice?.finish_reason === 'length') {
      console.warn(
        '[ScheduledMessage] 到期消息因输出长度限制提前结束。',
        {
          content
        }
      );
    }

    if (!content) {
      console.warn(
        '[ScheduledMessage] API 返回成功但文本内容为空： ' +
        JSON.stringify(
          {
            topLevelKeys: Object.keys(data || {}),
            topLevelError: data?.error || null,
            finishReason: choice?.finish_reason ?? null,
            messageKeys: Object.keys(message || {}),
            content: message?.content ?? null,
            reasoningContent:
              message?.reasoning_content ?? null,
            refusal: message?.refusal ?? null,
            contentFilterResults:
              message?.content_filter_results ??
              choice?.content_filter_results ??
              null
          },
          null,
          2
        )
      );

      console.warn(
        '[ScheduledMessage] 原始响应完整内容：',
        JSON.stringify(data, null, 2)
      );

      return {
        error: true,
        code: 'EMPTY_RESPONSE',
        message:
          'AI 返回内容为空，请检查当前模型或 API 服务状态。'
      };
    }

    return {
      error: false,
      content
    };
  } catch (error) {
    console.error(
      '[ScheduledMessage] 到期消息请求失败：',
      error
    );

    return {
      error: true,
      code: 'NETWORK_ERROR',
      message: error?.message || '网络请求失败'
    };
  }
};

/**
 * 抢占一条到期预约。
 *
 * 返回递增 attemptCount 后的最新记录，
 * 不返回简单 boolean。
 */
const claimDueScheduledMessage = async (
  scheduleId
) => {
  const nowIso = getNowIso();
  let claimedMessage = null;

  await db.transaction(
    'rw',
    db.scheduledMessages,
    async () => {
      const current =
        await db.scheduledMessages.get(scheduleId);

      if (!current || current.status !== 'pending') {
        return;
      }

      const dueAt = new Date(
        current.scheduledFor
      ).getTime();

      if (
        Number.isNaN(dueAt) ||
        dueAt > Date.now()
      ) {
        return;
      }

      const nextAttemptCount =
        Number(current.attemptCount || 0) + 1;

      const updatedFields = {
        status: 'processing',
        attemptCount: nextAttemptCount,
        updatedAt: nowIso
      };

      await db.scheduledMessages.update(
        scheduleId,
        updatedFields
      );

      claimedMessage = {
        ...current,
        ...updatedFields
      };
    }
  );

  return claimedMessage;
};

/**
 * 根据实际执行次数决定回到 pending 还是进入 failed。
 *
 * attemptCount 在 claim 时递增，因此：
 * - 第 1 次失败：pending
 * - 第 2 次失败：pending
 * - 第 3 次失败：failed
 */
const handleScheduledMessageFailure = async (
  scheduledMessage,
  reason
) => {
  if (!scheduledMessage?.id) {
    return;
  }

  const attemptCount = Number(
    scheduledMessage.attemptCount || 0
  );

  const nowIso = getNowIso();

  await db.scheduledMessages.update(
    scheduledMessage.id,
    attemptCount < MAX_ATTEMPT_COUNT
      ? {
          status: 'pending',
          cancelledReason:
            reason || 'generation_failed',
          updatedAt: nowIso
        }
      : {
          status: 'failed',
          cancelledReason:
            reason || 'generation_failed',
          updatedAt: nowIso
        }
  );
};

const executeScheduledMessage = async (
  scheduledMessage
) => {
  /*
   * 这里必须使用 claim 返回的最新对象，
   * 因为它包含本次递增后的 attemptCount。
   */
  const claimedScheduledMessage =
    await claimDueScheduledMessage(
      scheduledMessage.id
    );

  if (!claimedScheduledMessage) {
    return;
  }

  try {
    const [
      chat,
      character,
      recentMessages
    ] = await Promise.all([
      db.chats.get(
        claimedScheduledMessage.chatId
      ),
      db.characters.get(
        claimedScheduledMessage.characterId
      ),
      db.messages
        .where('chatId')
        .equals(claimedScheduledMessage.chatId)
        .sortBy('timestamp')
    ]);

    if (!chat || !character) {
      await handleScheduledMessageFailure(
        claimedScheduledMessage,
        'chat_or_character_not_found'
      );

      return;
    }

    const createdAtTime = new Date(
      claimedScheduledMessage.createdAt
    ).getTime();

    const cancelPolicy =
      claimedScheduledMessage.cancelPolicy ||
      (
        claimedScheduledMessage.scheduleType ===
        SCHEDULE_TYPES.REMINDER
          ? CANCEL_POLICIES.KEEP
          : CANCEL_POLICIES.CANCEL_IF_USER_REPLIES
      );

    if (
      cancelPolicy ===
      CANCEL_POLICIES.CANCEL_IF_USER_REPLIES
    ) {
      const userReturnedAfterScheduling =
        recentMessages.some((message) => (
          message.sender === 'user' &&
          new Date(message.timestamp).getTime() >
            createdAtTime
        ));

      if (userReturnedAfterScheduling) {
        await db.scheduledMessages.update(
          claimedScheduledMessage.id,
          {
            status: 'cancelled',
            cancelledReason:
              'user_sent_message_after_schedule',
            updatedAt: getNowIso()
          }
        );

        return;
      }
    }

    const result =
      await fetchScheduledMessageCompletion({
        chat,
        character,
        scheduledMessage:
          claimedScheduledMessage,
        historyMessages: recentMessages
      });

    if (result.error) {
      await handleScheduledMessageFailure(
        claimedScheduledMessage,
        result.code
      );

      return;
    }

    const content = normalizeText(
      result.content
    );

    if (!content) {
      await handleScheduledMessageFailure(
        claimedScheduledMessage,
        'empty_message_content'
      );

      return;
    }

    const nowIso = getNowIso();

    const metadata = {
      isAutoGenerated: true,
      source: 'scheduled-message',
      scheduledMessageId:
        claimedScheduledMessage.id
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

        await db.scheduledMessages.update(
          claimedScheduledMessage.id,
          {
            status: 'sent',
            sentMessageId: messageId,
            cancelledReason: '',
            updatedAt: nowIso
          }
        );
      }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(
          'new-local-message-inserted',
          {
            detail: {
              chatId: chat.id,
              messageId
            }
          }
        )
      );
    }

    /*
     * 页面当前由 Service Worker 控制且用户已经授权通知时，
     * 显示本地系统通知。
     */
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      navigator.serviceWorker?.controller
    ) {
      try {
        const registration =
          await navigator.serviceWorker.ready;

        await registration.showNotification(
          character.name || '消息提醒',
          {
            body: content.slice(0, 80),
            tag:
              `scheduled-${claimedScheduledMessage.id}`,
            icon: '/icon-192.png'
          }
        );
      } catch (error) {
        console.warn(
          '[ScheduledMessage] 显示本地通知失败：',
          error
        );
      }
    }

    console.log(
      '[ScheduledMessage] 已发送到期预约消息：',
      {
        scheduleId:
          claimedScheduledMessage.id,
        messageId,
        chatId: chat.id
      }
    );
  } catch (error) {
    console.error(
      '[ScheduledMessage] 执行预约消息失败：',
      error
    );

    await handleScheduledMessageFailure(
      claimedScheduledMessage,
      'unexpected_execution_error'
    );
  }
};

/**
 * 恢复长期卡在 processing 的预约。
 */
const recoverStaleProcessingScheduledMessages =
  async () => {
    const nowIso = getNowIso();

    const staleThreshold = new Date(
      Date.now() -
      STALE_PROCESSING_TIMEOUT_MS
    ).toISOString();

    const staleItems = await db.scheduledMessages
      .where('status')
      .equals('processing')
      .and((item) => {
        const updatedAt =
          item.updatedAt ||
          item.createdAt ||
          '';

        return updatedAt <= staleThreshold;
      })
      .toArray();

    for (const item of staleItems) {
      const attemptCount = Number(
        item.attemptCount || 0
      );

      await db.scheduledMessages.update(
        item.id,
        attemptCount >= MAX_ATTEMPT_COUNT
          ? {
              status: 'failed',
              cancelledReason:
                'stuck_processing_exceeded_retry',
              updatedAt: nowIso
            }
          : {
              status: 'pending',
              updatedAt: nowIso
            }
      );
    }

    if (staleItems.length > 0) {
      console.warn(
        '[ScheduledMessage] 已恢复卡住的预约记录：',
        staleItems.map((item) => ({
          id: item.id,
          attemptCount: item.attemptCount
        }))
      );
    }
  };

export const checkAndSendDueScheduledMessages =
  async () => {
    if (isProcessingDueMessages) {
      return;
    }

    isProcessingDueMessages = true;

    try {
      /*
       * 先恢复卡死记录，再查询 pending。
       */
      await recoverStaleProcessingScheduledMessages();

      const nowIso = getNowIso();

      const dueMessages = await db.scheduledMessages
        .where('status')
        .equals('pending')
        .and((item) => (
          item.scheduledFor <= nowIso
        ))
        .sortBy('scheduledFor');

      /*
       * 一轮最多处理两条，避免重新打开应用时突发发送大量消息。
       */
      for (
        const scheduledMessage of
        dueMessages.slice(0, 2)
      ) {
        await executeScheduledMessage(
          scheduledMessage
        );
      }
    } catch (error) {
      console.error(
        '[ScheduledMessage] 检查到期计划失败：',
        error
      );
    } finally {
      isProcessingDueMessages = false;
    }
  };

const handleWakeUp = () => {
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible'
  ) {
    void checkAndSendDueScheduledMessages();
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

  document.addEventListener(
    'visibilitychange',
    handleWakeUp
  );

  window.addEventListener(
    'focus',
    handleWakeUp
  );

  window.addEventListener(
    'pageshow',
    handleWakeUp
  );

  console.log(
    '[ScheduledMessage] 对话预约调度器已启动。'
  );
};

export const stopScheduledMessageScheduler = () => {
  if (!schedulerTimer) {
    return;
  }

  window.clearInterval(schedulerTimer);
  schedulerTimer = null;

  document.removeEventListener(
    'visibilitychange',
    handleWakeUp
  );

  window.removeEventListener(
    'focus',
    handleWakeUp
  );

  window.removeEventListener(
    'pageshow',
    handleWakeUp
  );

  console.log(
    '[ScheduledMessage] 对话预约调度器已停止。'
  );
};
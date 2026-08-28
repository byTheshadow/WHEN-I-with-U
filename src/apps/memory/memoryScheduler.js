import db from '../../db';

import {
  createMemory,
  createPendingMemoryCandidate,
  ensureMemoryJob,
  getMemoryJob
} from './memoryService';

import {
  MEMORY_JOB_STATUSES,
  MEMORY_STATUSES
} from './memoryConstants';

import {
  extractMemoryFromConversation
} from './memoryAiService';

import {
  buildMemorySourceBatch,
  getUsableMessages,
  inspectMemorySignals
} from './memorySignals';

const activeMemoryJobs = new Set();
const pendingTimers = new Map();

const NORMAL_CHECKPOINT = 30;
const HIGH_PRIORITY_DELAY = 15000;
const NORMAL_DELAY = 90000;
const RETRY_DELAY = 10 * 60 * 1000;
const CONTINUATION_DELAY = 1000;
const MAX_RETRY_COUNT = 3;

const nowIso = () => new Date().toISOString();

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

const isDocumentVisible = () => (
  typeof document !== 'undefined' &&
  document.visibilityState === 'visible'
);

const getChatMessagesById = async (chatId) => {
  const messages = await db.messages
    .where('chatId')
    .equals(chatId)
    .toArray();

  return messages.sort((a, b) => {
    const aId = Number(a.id);
    const bId = Number(b.id);

    if (
      Number.isFinite(aId) &&
      Number.isFinite(bId)
    ) {
      return aId - bId;
    }

    return new Date(a.timestamp || 0).getTime()
      - new Date(b.timestamp || 0).getTime();
  });
};

const getMessagesSinceCursor = (
  messages,
  lastProcessedMessageId
) => {
  if (
    lastProcessedMessageId === null ||
    lastProcessedMessageId === undefined
  ) {
    return messages;
  }

  const numericCursor = Number(lastProcessedMessageId);

  if (!Number.isFinite(numericCursor)) {
    return messages;
  }

  return messages.filter((message) => (
    Number(message.id) > numericCursor
  ));
};

const getHighestMessageId = (
  messages,
  fallbackValue = null
) => {
  const ids = messages
    .map((message) => Number(message?.id))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  return ids[0] ?? fallbackValue;
};

const updateMemoryJob = async (chatId, updates) => {
  const currentJob = await getMemoryJob(chatId);

  if (!currentJob) {
    return null;
  }

  const nextJob = {
    ...currentJob,
    ...updates,
    updatedAt: nowIso()
  };

  await db.memoryJobs.update(currentJob.id, nextJob);

  return nextJob;
};

const clearPendingTimer = (chatId) => {
  const timer = pendingTimers.get(chatId);

  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(chatId);
  }
};

const scheduleTimer = ({
  chatId,
  delay,
  callback
}) => {
  clearPendingTimer(chatId);

  const timer = setTimeout(() => {
    pendingTimers.delete(chatId);
    void callback();
  }, delay);

  pendingTimers.set(chatId, timer);

  return timer;
};

const normalizeComparableText = (value) => (
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
);

const getExistingMemoryContentSet = async (chatId) => {
  const [
    memories,
    candidates
  ] = await Promise.all([
    db.memories
      .where('chatId')
      .equals(chatId)
      .toArray(),
    db.memoryCandidates
      .where('chatId')
      .equals(chatId)
      .toArray()
  ]);

  return new Set(
    [...memories, ...candidates]
      .map((item) => normalizeComparableText(item.content))
      .filter(Boolean)
  );
};

const persistExtractionResult = async ({
  chatId,
  extraction,
  lastProcessedMessageId
}) => {
  const existingContents = await getExistingMemoryContentSet(chatId);

  let createdMemories = 0;
  let createdCandidates = 0;
  let skippedDuplicates = 0;

  for (const memory of extraction.memories || []) {
    const comparableContent = normalizeComparableText(memory.content);

    if (
      !comparableContent ||
      existingContents.has(comparableContent)
    ) {
      skippedDuplicates += 1;
      continue;
    }

    await createMemory({
      chatId,
      title: memory.title,
      content: memory.content,
      type: memory.type,
      status: MEMORY_STATUSES.ACTIVE,
      importance: memory.importance,
      confidence: memory.confidence,
      sourceMessageIds: memory.sourceMessageIds,
      sourceMessageTimestamps: memory.sourceMessageTimestamps,
      sourceState: memory.sourceState,
      sourceKind: memory.sourceKind,
      note: '由对话整理形成。'
    });

    existingContents.add(comparableContent);
    createdMemories += 1;
  }

  for (const candidate of extraction.candidates || []) {
    const comparableContent = normalizeComparableText(candidate.content);

    if (
      !comparableContent ||
      existingContents.has(comparableContent)
    ) {
      skippedDuplicates += 1;
      continue;
    }

    await createPendingMemoryCandidate({
      chatId,
      title: candidate.title,
      content: candidate.content,
      type: candidate.type,
      priority: candidate.priority,
      sourceMessageIds: candidate.sourceMessageIds,
      sourceMessageTimestamps: candidate.sourceMessageTimestamps,
      sourceKind: candidate.sourceKind
    });

    existingContents.add(comparableContent);
    createdCandidates += 1;
  }

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.IDLE,
    lastProcessedMessageId,
    nextRunAt: null,
    retryCount: 0,
    lastError: '',
    lastCompletedAt: nowIso()
  });

  return {
    createdMemories,
    createdCandidates,
    skippedDuplicates
  };
};

const scheduleContinuationIfNeeded = async ({
  chatId,
  lastProcessedMessageId
}) => {
  const allMessages = await getChatMessagesById(chatId);

  const remainingMessages = getMessagesSinceCursor(
    allMessages,
    lastProcessedMessageId
  );

  const remainingUsableMessages = getUsableMessages(
    remainingMessages
  );

  if (remainingUsableMessages.length === 0) {
    return false;
  }

  /*
   * 当前批次达到上限后，说明仍有待处理消息。
   * 即使剩余不足 30 条，也应该继续处理：
   * 否则一段历史积压的尾部消息会长期停留在 cursor 之后。
   */
  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.PENDING,
    nextRunAt: new Date(
      Date.now() + CONTINUATION_DELAY
    ).toISOString()
  });

  scheduleTimer({
    chatId,
    delay: CONTINUATION_DELAY,
    callback: () => runMemoryProcessing(chatId, {
      force: true,
      allowHidden: true
    })
  });

  return true;
};

const scheduleRetry = async ({
  chatId,
  error
}) => {
  const currentJob = await getMemoryJob(chatId);

  if (!currentJob) {
    return;
  }

  const retryCount = Number(currentJob.retryCount || 0) + 1;

  if (retryCount > MAX_RETRY_COUNT) {
    await updateMemoryJob(chatId, {
      status: MEMORY_JOB_STATUSES.FAILED,
      nextRunAt: null,
      retryCount,
      lastError: error?.message || '未知错误'
    });

    return;
  }

  const retryAt = new Date(
    Date.now() + RETRY_DELAY
  ).toISOString();

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.FAILED,
    nextRunAt: retryAt,
    retryCount,
    lastError: error?.message || '未知错误'
  });

  scheduleTimer({
    chatId,
    delay: RETRY_DELAY,
    callback: () => runMemoryProcessing(chatId, {
      force: true,
      allowHidden: true
    })
  });
};

export const runMemoryProcessing = async (
  chatId,
  {
    force = false,
    allowHidden = false
  } = {}
) => {
  if (
    !isValidChatId(chatId) ||
    activeMemoryJobs.has(chatId)
  ) {
    return {
      skipped: true,
      reason: 'already_running_or_invalid'
    };
  }

  if (
    !force &&
    !allowHidden &&
    !isDocumentVisible()
  ) {
    return {
      skipped: true,
      reason: 'document_hidden'
    };
  }

  activeMemoryJobs.add(chatId);

  try {
    const job = await ensureMemoryJob(chatId);

    const allMessages = await getChatMessagesById(chatId);

    const pendingMessages = getMessagesSinceCursor(
      allMessages,
      job.lastProcessedMessageId
    );

    const usableMessages = getUsableMessages(pendingMessages);

    if (usableMessages.length === 0) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'no_usable_messages'
      };
    }

    const signals = inspectMemorySignals(pendingMessages);

    const shouldProcess = (
      force ||
      usableMessages.length >= NORMAL_CHECKPOINT ||
      signals.hasHighPrioritySignal
    );

    if (!shouldProcess) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'checkpoint_not_reached',
        usableMessageCount: usableMessages.length
      };
    }

    /*
     * buildMemorySourceBatch 已按消息 ID 从早到晚挑选最多 40 条。
     * 这批消息才是本轮实际交给 AI 的内容，也是 cursor 唯一可安全推进的范围。
     */
    const sourceBatch = buildMemorySourceBatch(
      pendingMessages
    );

    if (sourceBatch.length === 0) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'no_valid_source_batch'
      };
    }

    await updateMemoryJob(chatId, {
      status: MEMORY_JOB_STATUSES.RUNNING,
      nextRunAt: null,
      lastError: ''
    });

    const extraction = await extractMemoryFromConversation({
      chatId,
      messages: sourceBatch
    });

    /*
     * 不能使用 pendingMessages 的最大 ID。
     * 否则 pendingMessages 超过 40 条时，未送入 AI 的消息会被永久跳过。
     */
    const lastProcessedMessageId = getHighestMessageId(
      extraction.sourceMessageIds?.map((id) => ({ id })) || [],
      getHighestMessageId(
        sourceBatch,
        job.lastProcessedMessageId
      )
    );

    const persisted = await persistExtractionResult({
      chatId,
      extraction,
      lastProcessedMessageId
    });

    const continuationScheduled = await scheduleContinuationIfNeeded({
      chatId,
      lastProcessedMessageId
    });

    return {
      skipped: false,
      createdMemories: persisted.createdMemories,
      createdCandidates: persisted.createdCandidates,
      skippedDuplicates: persisted.skippedDuplicates,
      sourceMessageCount: sourceBatch.length,
      lastProcessedMessageId,
      continuationScheduled
    };
  } catch (error) {
    console.warn(
      '[Memory] Processing failed safely:',
      error
    );

    try {
      await scheduleRetry({
        chatId,
        error
      });
    } catch (jobUpdateError) {
      console.warn(
        '[Memory] Failed to persist retry state:',
        jobUpdateError
      );
    }

    return {
      skipped: false,
      error: error?.message || '未知错误'
    };
  } finally {
    activeMemoryJobs.delete(chatId);
  }
};

export const scheduleMemoryProcessing = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return;
  }

  const job = await ensureMemoryJob(chatId);

  const allMessages = await getChatMessagesById(chatId);

  const pendingMessages = getMessagesSinceCursor(
    allMessages,
    job.lastProcessedMessageId
  );

  const usableMessages = getUsableMessages(pendingMessages);

  if (usableMessages.length === 0) {
    return;
  }

  const signals = inspectMemorySignals(pendingMessages);

  const shouldPrepare = (
    usableMessages.length >= NORMAL_CHECKPOINT ||
    signals.hasHighPrioritySignal
  );

  if (!shouldPrepare) {
    return;
  }

  const delay = signals.hasHighPrioritySignal
    ? HIGH_PRIORITY_DELAY
    : NORMAL_DELAY;

  const nextRunAt = new Date(
    Date.now() + delay
  ).toISOString();

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.PENDING,
    nextRunAt,
    lastError: ''
  });

  scheduleTimer({
    chatId,
    delay,
    callback: () => runMemoryProcessing(chatId)
  });
};

export const cancelScheduledMemoryProcessing = (chatId) => {
  if (!isValidChatId(chatId)) {
    return;
  }

  clearPendingTimer(chatId);
};

/**
 * 页面重新打开或应用重新载入后，可恢复 IndexedDB 中尚未完成的记忆任务。
 *
 * 可在 App.jsx 的初始化 useEffect 中执行：
 *
 *   void restoreMemoryProcessingSchedules();
 */
export const restoreMemoryProcessingSchedules = async () => {
  const jobs = await db.memoryJobs
    .where('status')
    .anyOf([
      MEMORY_JOB_STATUSES.PENDING,
      MEMORY_JOB_STATUSES.FAILED
    ])
    .toArray();

  const now = Date.now();

  for (const job of jobs) {
    if (!isValidChatId(job.chatId)) {
      continue;
    }

    const nextRunTime = new Date(
      job.nextRunAt || 0
    ).getTime();

    const delay = Number.isFinite(nextRunTime)
      ? Math.max(0, nextRunTime - now)
      : 0;

    scheduleTimer({
      chatId: job.chatId,
      delay,
      callback: () => runMemoryProcessing(job.chatId, {
        force: true,
        allowHidden: true
      })
    });
  }

  return jobs.length;
};

export const runMemoryProcessingNow = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return {
      skipped: true,
      reason: 'invalid_chat_id'
    };
  }

  cancelScheduledMemoryProcessing(chatId);

  return runMemoryProcessing(chatId, {
    force: true,
    allowHidden: true
  });
};
